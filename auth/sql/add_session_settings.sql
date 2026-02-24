-- Create session_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS session_settings (
    id SERIAL PRIMARY KEY,
    global_timeout INTEGER NOT NULL DEFAULT 60,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default record if table is empty
INSERT INTO session_settings (global_timeout)
SELECT 60
WHERE NOT EXISTS (SELECT 1 FROM session_settings);

-- Insert Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('view_maintenance_menu', 'maintenance', 'view', 'Ver menú de mantenimiento'),
('view_session_settings', 'session_settings', 'view', 'Ver configuración de sesión'),
('edit_session_settings', 'session_settings', 'update', 'Editar configuración de sesión')
ON CONFLICT (name) DO NOTHING;

-- Assign to Admin Role
DO $$
DECLARE
    admin_role_id INT;
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE LOWER(name) IN ('admin', 'administrador', 'administrator');
    
    IF admin_role_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT admin_role_id, id FROM permissions 
        WHERE name IN ('view_maintenance_menu', 'view_session_settings', 'edit_session_settings')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
