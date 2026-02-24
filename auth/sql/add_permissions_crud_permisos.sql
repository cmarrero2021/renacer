-- Script para agregar permisos CRUD de la gestión de permisos
-- Ejecutar este script en la base de datos _api_revistas

-- Permisos para gestión de permisos
INSERT INTO permissions (name, resource, action, description) VALUES
('create_permission', 'permissions', 'create', 'Crear nuevos permisos en el sistema'),
('update_permission', 'permissions', 'update', 'Editar permisos existentes'),
('delete_permission', 'permissions', 'delete', 'Eliminar permisos del sistema')
ON CONFLICT (name) DO NOTHING;

-- Asignar estos permisos al rol Admin (asumiendo que el rol Admin tiene id = 1)
-- Si el rol Admin tiene otro id, ajustar el valor
DO $$
DECLARE
    admin_role_id INT;
    perm_id INT;
BEGIN
    -- Obtener el id del rol Admin
    SELECT id INTO admin_role_id FROM roles WHERE LOWER(name) = 'admin' OR LOWER(name) = 'administrador';
    
    IF admin_role_id IS NOT NULL THEN
        -- Asignar create_permission
        SELECT id INTO perm_id FROM permissions WHERE name = 'create_permission';
        IF perm_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (admin_role_id, perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- Asignar update_permission
        SELECT id INTO perm_id FROM permissions WHERE name = 'update_permission';
        IF perm_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (admin_role_id, perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- Asignar delete_permission
        SELECT id INTO perm_id FROM permissions WHERE name = 'delete_permission';
        IF perm_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (admin_role_id, perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        RAISE NOTICE 'Permisos asignados al rol Admin (id: %)', admin_role_id;
    ELSE
        RAISE WARNING 'No se encontró el rol Admin. Los permisos fueron creados pero no asignados automáticamente.';
    END IF;
END $$;

-- Verificar permisos creados
SELECT p.id, p.name, p.resource, p.action, p.description 
FROM permissions p 
WHERE name IN ('create_permission', 'update_permission', 'delete_permission');

-- Verificar asignación al rol Admin
SELECT r.name AS rol, p.name AS permiso, p.description
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.name IN ('create_permission', 'update_permission', 'delete_permission')
ORDER BY r.name, p.name;
