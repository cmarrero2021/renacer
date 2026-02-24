-- Script para agregar permisos de Auditoría
-- Ejecutar este script en la base de datos _api_revistas

-- Permisos para gestión de auditoría
INSERT INTO permissions (name, resource, action, description) VALUES
('view_audit_menu', 'audit', 'view', 'Ver menú de auditoría'),
('view_login_logs', 'login_logs', 'read', 'Ver registros de ingresos al sistema'),
('view_action_logs', 'action_logs', 'read', 'Ver registros de acciones del sistema')
ON CONFLICT (name) DO NOTHING;

-- Asignar estos permisos al rol Admin
DO $$
DECLARE
    admin_role_id INT;
    perm_id INT;
BEGIN
    -- Obtener el id del rol Admin
    SELECT id INTO admin_role_id FROM roles WHERE LOWER(name) = 'admin' OR LOWER(name) = 'administrador';
    
    IF admin_role_id IS NOT NULL THEN
        -- Asignar view_audit_menu
        SELECT id INTO perm_id FROM permissions WHERE name = 'view_audit_menu';
        IF perm_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (admin_role_id, perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- Asignar view_login_logs
        SELECT id INTO perm_id FROM permissions WHERE name = 'view_login_logs';
        IF perm_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (admin_role_id, perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- Asignar view_action_logs
        SELECT id INTO perm_id FROM permissions WHERE name = 'view_action_logs';
        IF perm_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (admin_role_id, perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        RAISE NOTICE 'Permisos de auditoría asignados al rol Admin (id: %)', admin_role_id;
    ELSE
        RAISE WARNING 'No se encontró el rol Admin. Los permisos fueron creados pero no asignados automáticamente.';
    END IF;
END $$;

-- Verificar permisos creados
SELECT p.id, p.name, p.resource, p.action, p.description 
FROM permissions p 
WHERE name IN ('view_audit_menu', 'view_login_logs', 'view_action_logs');

-- Verificar asignación al rol Admin
SELECT r.name AS rol, p.name AS permiso, p.description
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.name IN ('view_audit_menu', 'view_login_logs', 'view_action_logs')
ORDER BY r.name, p.name;
