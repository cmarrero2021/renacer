-- Migración: Recuperación de Contraseña
-- Tabla para historial de contraseñas (últimas 5)
CREATE TABLE IF NOT EXISTS public.password_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP(6) WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_password_history_user_id ON public.password_history (user_id);

COMMENT ON TABLE public.password_history IS 'Historial de contraseñas para evitar reutilización de las últimas 5';

-- Columnas para control de intentos de recuperación
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS recovery_attempts INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_recovery_attempt TIMESTAMP(6) WITHOUT TIME ZONE;

-- Trigger de auditoría para password_history
CREATE TRIGGER audit_password_history_trigger
    AFTER INSERT OR DELETE OR UPDATE ON public.password_history
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
