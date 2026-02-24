-- ============================================
-- ACTUALIZACIÓN: Detección de Borrado Lógico
-- ============================================
-- Este script actualiza la función de auditoría para
-- diferenciar entre borrado físico (DELETE) y borrado
-- lógico (UPDATE que establece deleted_at)
-- ============================================

-- 1. Eliminar vista que depende de la tabla
DROP VIEW IF EXISTS public.vaudit_logs;

-- 2. Modificar constraint y tamaño de columna action
-- Expandir la columna action de VARCHAR(10) a VARCHAR(20)
ALTER TABLE public.audit_logs ALTER COLUMN action TYPE VARCHAR(20);

-- Actualizar el constraint para aceptar nuevos tipos de acción
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check 
    CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE'));

-- 3. Recrear la vista
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

-- 2. Actualizar la función de auditoría para detectar borrado lógico
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
    v_action VARCHAR(20);
    v_is_soft_delete BOOLEAN := FALSE;
BEGIN
    -- Intentar obtener información del contexto de la aplicación
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
        
        -- Safe extraction of ID
        IF (v_new_data ? 'id') THEN
            v_record_id := (v_new_data ->> 'id')::INTEGER;
        ELSE
            v_record_id := NULL;
        END IF;

        v_sql_command := 'INSERT INTO ' || TG_TABLE_NAME;
        v_action := 'INSERT';
        
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Safe extraction of ID
        IF (v_new_data ? 'id') THEN
            v_record_id := (v_new_data ->> 'id')::INTEGER;
        ELSE
            v_record_id := NULL;
        END IF;
        
        -- Calcular solo los campos que cambiaron
        SELECT jsonb_object_agg(key, value) INTO v_changed_fields
        FROM (
            SELECT n.key, n.value
            FROM jsonb_each(v_new_data) n
            LEFT JOIN jsonb_each(v_old_data) o ON n.key = o.key
            WHERE n.value IS DISTINCT FROM o.value
        ) changes;

        v_sql_command := 'UPDATE ' || TG_TABLE_NAME;
        v_action := 'UPDATE';

        -- Detección de Borrado Lógico (Soft Delete)
        IF (v_new_data ? 'deleted_at') THEN
            IF ((v_old_data ->> 'deleted_at') IS NULL OR (v_old_data ->> 'deleted_at') = 'null') 
               AND ((v_new_data ->> 'deleted_at') IS NOT NULL AND (v_new_data ->> 'deleted_at') <> 'null') THEN
                v_is_soft_delete := TRUE;
                v_action := 'SOFT_DELETE';
            END IF;
        END IF;
        
        -- Apéndice de ID al comando SQL solo si tenemos ID
        IF v_record_id IS NOT NULL THEN
             v_sql_command := v_sql_command || ' WHERE id = ' || v_record_id;
        END IF;
        
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_changed_fields := NULL;
        
        -- Safe extraction of ID
        IF (v_old_data ? 'id') THEN
            v_record_id := (v_old_data ->> 'id')::INTEGER;
        ELSE
            v_record_id := NULL;
        END IF;

        v_sql_command := 'DELETE FROM ' || TG_TABLE_NAME;
        IF v_record_id IS NOT NULL THEN
             v_sql_command := v_sql_command || ' WHERE id = ' || v_record_id;
        END IF;
        
        v_action := 'DELETE';
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
        v_action,
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



-- 3. Actualizar función helper para establecer contexto (Corrección de persistencia)
-- is_local = false asegura que las variables persistan durante la sesión (útil para pool de conexiones y transacciones implícitas)
CREATE OR REPLACE FUNCTION public.set_audit_context(
    p_user_id INTEGER DEFAULT NULL,
    p_username VARCHAR(255) DEFAULT NULL,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_session_token VARCHAR(255) DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Usamos false en el tercer parámetro para que la configuración dure toda la sesión actual
    -- y no se pierda al terminar la "transacción" implícita de esta llamada.
    -- Manejamos NULLs convirtiéndolos a strings vacíos o cadenas nulas que el trigger sepa manejar.
    
    PERFORM set_config('audit.user_id', COALESCE(p_user_id::TEXT, ''), false);
    PERFORM set_config('audit.username', COALESCE(p_username, ''), false);
    PERFORM set_config('audit.ip_address', COALESCE(p_ip_address, ''), false);
    PERFORM set_config('audit.session_token', COALESCE(p_session_token, ''), false);
END;
$$ LANGUAGE plpgsql;

-- 4. Verificación
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Actualización de Auditoría completada';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Ahora se detectan 4 tipos de acción:';
    RAISE NOTICE '  - INSERT: Creación de registro';
    RAISE NOTICE '  - UPDATE: Modificación de registro';
    RAISE NOTICE '  - SOFT_DELETE: Borrado lógico (deleted_at)';
    RAISE NOTICE '  - DELETE: Borrado físico';
    RAISE NOTICE '============================================';
END $$;
