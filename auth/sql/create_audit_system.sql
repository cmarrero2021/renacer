-- ============================================
-- SISTEMA DE AUDITORÍA - PostgreSQL
-- ============================================
-- Este script crea la infraestructura necesaria para
-- auditar todas las operaciones CRUD en las tablas
-- del sistema de revistas científicas
-- ============================================

-- 1. Crear tabla de auditoría
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    username VARCHAR(255),
    ip_address INET,
    table_name VARCHAR(100) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id INTEGER,
    old_data JSONB,
    new_data JSONB,
    changed_fields JSONB,
    sql_command TEXT,
    action_timestamp TIMESTAMP(6) WITHOUT TIME ZONE DEFAULT NOW(),
    session_token VARCHAR(255)
);

-- Índices para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(action_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);

-- 2. Crear función genérica de auditoría
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_fields JSONB;
    v_record_id INTEGER;
    v_user_id INTEGER;
    v_username VARCHAR(255);
    v_ip_address INET;
    v_session_token VARCHAR(255);
    v_sql_command TEXT;
BEGIN
    -- Intentar obtener información del contexto de la aplicación
    -- Estos valores deben ser establecidos por la aplicación antes de ejecutar operaciones
    BEGIN
        v_user_id := current_setting('audit.user_id', true)::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;
    
    BEGIN
        v_username := current_setting('audit.username', true);
    EXCEPTION WHEN OTHERS THEN
        v_username := current_user;
    END;
    
    BEGIN
        v_ip_address := current_setting('audit.ip_address', true)::INET;
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := NULL;
    END;
    
    BEGIN
        v_session_token := current_setting('audit.session_token', true);
    EXCEPTION WHEN OTHERS THEN
        v_session_token := NULL;
    END;

    -- Determinar el tipo de operación y capturar datos
    IF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
        v_old_data := NULL;
        v_changed_fields := v_new_data;
        v_record_id := NEW.id;
        v_sql_command := 'INSERT INTO ' || TG_TABLE_NAME;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id;
        v_sql_command := 'UPDATE ' || TG_TABLE_NAME || ' WHERE id = ' || NEW.id;
        
        -- Calcular solo los campos que cambiaron
        SELECT jsonb_object_agg(key, value) INTO v_changed_fields
        FROM (
            SELECT n.key, n.value
            FROM jsonb_each(v_new_data) n
            LEFT JOIN jsonb_each(v_old_data) o ON n.key = o.key
            WHERE n.value IS DISTINCT FROM o.value
        ) changed;
        
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_changed_fields := NULL;
        v_record_id := OLD.id;
        v_sql_command := 'DELETE FROM ' || TG_TABLE_NAME || ' WHERE id = ' || OLD.id;
    END IF;

    -- Insertar registro de auditoría
    INSERT INTO public.audit_logs (
        user_id,
        username,
        ip_address,
        table_name,
        action,
        record_id,
        old_data,
        new_data,
        changed_fields,
        sql_command,
        session_token
    ) VALUES (
        v_user_id,
        v_username,
        v_ip_address,
        TG_TABLE_NAME,
        TG_OP,
        v_record_id,
        v_old_data,
        v_new_data,
        v_changed_fields,
        v_sql_command,
        v_session_token
    );

    -- Retornar el registro apropiado
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear triggers en las tablas de revistas y mantenedores

-- Trigger para REVISTAS
DROP TRIGGER IF EXISTS audit_revistas_trigger ON public.revistas;
CREATE TRIGGER audit_revistas_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.revistas
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para AREAS_CONOCIMIENTO
DROP TRIGGER IF EXISTS audit_areas_conocimiento_trigger ON public.areas_conocimiento;
CREATE TRIGGER audit_areas_conocimiento_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.areas_conocimiento
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para EDITORIALES
DROP TRIGGER IF EXISTS audit_editoriales_trigger ON public.editoriales;
CREATE TRIGGER audit_editoriales_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.editoriales
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para ESTADOS
DROP TRIGGER IF EXISTS audit_estados_trigger ON public.estados;
CREATE TRIGGER audit_estados_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.estados
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para FORMATOS
DROP TRIGGER IF EXISTS audit_formatos_trigger ON public.formatos;
CREATE TRIGGER audit_formatos_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.formatos
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para IDIOMAS
DROP TRIGGER IF EXISTS audit_idiomas_trigger ON public.idiomas;
CREATE TRIGGER audit_idiomas_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.idiomas
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para INDICES
DROP TRIGGER IF EXISTS audit_indices_trigger ON public.indices;
CREATE TRIGGER audit_indices_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.indices
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para PERIODICIDAD
DROP TRIGGER IF EXISTS audit_periodicidad_trigger ON public.periodicidad;
CREATE TRIGGER audit_periodicidad_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.periodicidad
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 4. Triggers para tablas de administración (usuarios, roles, permisos)

-- Trigger para USERS
DROP TRIGGER IF EXISTS audit_users_trigger ON public.users;
CREATE TRIGGER audit_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para ROLES
DROP TRIGGER IF EXISTS audit_roles_trigger ON public.roles;
CREATE TRIGGER audit_roles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para PERMISSIONS
DROP TRIGGER IF EXISTS audit_permissions_trigger ON public.permissions;
CREATE TRIGGER audit_permissions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.permissions
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para USER_ROLES
DROP TRIGGER IF EXISTS audit_user_roles_trigger ON public.user_roles;
CREATE TRIGGER audit_user_roles_trigger
    AFTER INSERT OR DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para ROLE_PERMISSIONS
DROP TRIGGER IF EXISTS audit_role_permissions_trigger ON public.role_permissions;
CREATE TRIGGER audit_role_permissions_trigger
    AFTER INSERT OR DELETE ON public.role_permissions
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para USER_PERMISSIONS
DROP TRIGGER IF EXISTS audit_user_permissions_trigger ON public.user_permissions;
CREATE TRIGGER audit_user_permissions_trigger
    AFTER INSERT OR DELETE ON public.user_permissions
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 5. Función helper para establecer contexto de auditoría desde la aplicación
CREATE OR REPLACE FUNCTION public.set_audit_context(
    p_user_id INTEGER DEFAULT NULL,
    p_username VARCHAR(255) DEFAULT NULL,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_session_token VARCHAR(255) DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    IF p_user_id IS NOT NULL THEN
        PERFORM set_config('audit.user_id', p_user_id::TEXT, true);
    END IF;
    IF p_username IS NOT NULL THEN
        PERFORM set_config('audit.username', p_username, true);
    END IF;
    IF p_ip_address IS NOT NULL THEN
        PERFORM set_config('audit.ip_address', p_ip_address, true);
    END IF;
    IF p_session_token IS NOT NULL THEN
        PERFORM set_config('audit.session_token', p_session_token, true);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Vista para consultar la auditoría de forma más legible
CREATE OR REPLACE VIEW public.vaudit_logs AS
SELECT 
    al.id,
    al.action_timestamp AS fecha,
    al.user_id AS id_usuario,
    COALESCE(u.first_name || ' ' || u.last_name, al.username) AS usuario,
    al.ip_address AS ip,
    al.table_name AS tabla,
    al.action AS accion,
    al.record_id AS id_registro,
    al.old_data AS datos_anteriores,
    al.new_data AS datos_nuevos,
    al.changed_fields AS campos_modificados,
    al.sql_command AS comando_sql
FROM public.audit_logs al
LEFT JOIN public.users u ON u.id = al.user_id
ORDER BY al.action_timestamp DESC;

-- 7. Comentarios en la tabla
COMMENT ON TABLE public.audit_logs IS 'Tabla de auditoría para registro de todas las operaciones CRUD del sistema';
COMMENT ON COLUMN public.audit_logs.user_id IS 'ID del usuario que realizó la acción';
COMMENT ON COLUMN public.audit_logs.username IS 'Nombre de usuario (respaldo si no hay user_id)';
COMMENT ON COLUMN public.audit_logs.ip_address IS 'Dirección IP desde donde se realizó la acción';
COMMENT ON COLUMN public.audit_logs.table_name IS 'Nombre de la tabla afectada';
COMMENT ON COLUMN public.audit_logs.action IS 'Tipo de acción: INSERT, UPDATE, DELETE';
COMMENT ON COLUMN public.audit_logs.record_id IS 'ID del registro afectado';
COMMENT ON COLUMN public.audit_logs.old_data IS 'Datos antes de la modificación (JSON)';
COMMENT ON COLUMN public.audit_logs.new_data IS 'Datos después de la modificación (JSON)';
COMMENT ON COLUMN public.audit_logs.changed_fields IS 'Solo los campos que cambiaron (para UPDATE)';
COMMENT ON COLUMN public.audit_logs.sql_command IS 'Comando SQL aproximado ejecutado';
COMMENT ON COLUMN public.audit_logs.action_timestamp IS 'Fecha y hora de la acción';
COMMENT ON COLUMN public.audit_logs.session_token IS 'Token de sesión del usuario';

-- 8. Verificación
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Sistema de Auditoría instalado correctamente';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Tabla audit_logs creada';
    RAISE NOTICE 'Función audit_trigger_function creada';
    RAISE NOTICE 'Función set_audit_context creada';
    RAISE NOTICE 'Vista vaudit_logs creada';
    RAISE NOTICE '';
    RAISE NOTICE 'Triggers creados en las siguientes tablas:';
    RAISE NOTICE '  - revistas';
    RAISE NOTICE '  - areas_conocimiento';
    RAISE NOTICE '  - editoriales';
    RAISE NOTICE '  - estados';
    RAISE NOTICE '  - formatos';
    RAISE NOTICE '  - idiomas';
    RAISE NOTICE '  - indices';
    RAISE NOTICE '  - periodicidad';
    RAISE NOTICE '  - users';
    RAISE NOTICE '  - roles';
    RAISE NOTICE '  - permissions';
    RAISE NOTICE '  - user_roles';
    RAISE NOTICE '  - role_permissions';
    RAISE NOTICE '  - user_permissions';
    RAISE NOTICE '============================================';
END $$;
