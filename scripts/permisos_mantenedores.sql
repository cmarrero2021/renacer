-- =====================================================
-- Script para crear permisos de los mantenedores
-- Ejecutar en la base de datos PostgreSQL
-- =====================================================

-- Permisos para Areas de Conocimiento
INSERT INTO permissions (name, description, resource, action) VALUES
('view_areas_conocimiento', 'Ver listado de áreas de conocimiento', 'areas_conocimiento', 'view'),
('create_areas_conocimiento', 'Crear área de conocimiento', 'areas_conocimiento', 'create'),
('update_areas_conocimiento', 'Editar área de conocimiento', 'areas_conocimiento', 'update'),
('delete_areas_conocimiento', 'Eliminar área de conocimiento', 'areas_conocimiento', 'delete'),
('export_areas_conocimiento', 'Exportar áreas de conocimiento', 'areas_conocimiento', 'export');

-- Permisos para Editoriales
INSERT INTO permissions (name, description, resource, action) VALUES
('view_editoriales', 'Ver listado de editoriales', 'editoriales', 'view'),
('create_editoriales', 'Crear editorial', 'editoriales', 'create'),
('update_editoriales', 'Editar editorial', 'editoriales', 'update'),
('delete_editoriales', 'Eliminar editorial', 'editoriales', 'delete'),
('export_editoriales', 'Exportar editoriales', 'editoriales', 'export');

-- Permisos para Estados
INSERT INTO permissions (name, description, resource, action) VALUES
('view_estados', 'Ver listado de estados', 'estados', 'view'),
('create_estados', 'Crear estado', 'estados', 'create'),
('update_estados', 'Editar estado', 'estados', 'update'),
('delete_estados', 'Eliminar estado', 'estados', 'delete'),
('export_estados', 'Exportar estados', 'estados', 'export');

-- Permisos para Formatos
INSERT INTO permissions (name, description, resource, action) VALUES
('view_formatos', 'Ver listado de formatos', 'formatos', 'view'),
('create_formatos', 'Crear formato', 'formatos', 'create'),
('update_formatos', 'Editar formato', 'formatos', 'update'),
('delete_formatos', 'Eliminar formato', 'formatos', 'delete'),
('export_formatos', 'Exportar formatos', 'formatos', 'export');

-- Permisos para Idiomas
INSERT INTO permissions (name, description, resource, action) VALUES
('view_idiomas', 'Ver listado de idiomas', 'idiomas', 'view'),
('create_idiomas', 'Crear idioma', 'idiomas', 'create'),
('update_idiomas', 'Editar idioma', 'idiomas', 'update'),
('delete_idiomas', 'Eliminar idioma', 'idiomas', 'delete'),
('export_idiomas', 'Exportar idiomas', 'idiomas', 'export');

-- Permisos para Índices
INSERT INTO permissions (name, description, resource, action) VALUES
('view_indices', 'Ver listado de índices', 'indices', 'view'),
('create_indices', 'Crear índice', 'indices', 'create'),
('update_indices', 'Editar índice', 'indices', 'update'),
('delete_indices', 'Eliminar índice', 'indices', 'delete'),
('export_indices', 'Exportar índices', 'indices', 'export');

-- Permisos para Periodicidad
INSERT INTO permissions (name, description, resource, action) VALUES
('view_periodicidad', 'Ver listado de periodicidades', 'periodicidad', 'view'),
('create_periodicidad', 'Crear periodicidad', 'periodicidad', 'create'),
('update_periodicidad', 'Editar periodicidad', 'periodicidad', 'update'),
('delete_periodicidad', 'Eliminar periodicidad', 'periodicidad', 'delete'),
('export_periodicidad', 'Exportar periodicidades', 'periodicidad', 'export');

-- Permiso general para ver el menú de mantenedores
INSERT INTO permissions (name, description, resource, action) VALUES
('view_mantenedores_menu', 'Ver menú de mantenedores', 'mantenedores', 'view');

-- =====================================================
-- Asignar TODOS los permisos al rol Admin (id = 1)
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions 
WHERE name IN (
    'view_areas_conocimiento', 'create_areas_conocimiento', 'update_areas_conocimiento', 'delete_areas_conocimiento', 'export_areas_conocimiento',
    'view_editoriales', 'create_editoriales', 'update_editoriales', 'delete_editoriales', 'export_editoriales',
    'view_estados', 'create_estados', 'update_estados', 'delete_estados', 'export_estados',
    'view_formatos', 'create_formatos', 'update_formatos', 'delete_formatos', 'export_formatos',
    'view_idiomas', 'create_idiomas', 'update_idiomas', 'delete_idiomas', 'export_idiomas',
    'view_indices', 'create_indices', 'update_indices', 'delete_indices', 'export_indices',
    'view_periodicidad', 'create_periodicidad', 'update_periodicidad', 'delete_periodicidad', 'export_periodicidad',
    'view_mantenedores_menu'
)
ON CONFLICT DO NOTHING;

-- Verificar permisos creados
SELECT name, resource, action FROM permissions WHERE resource IN ('areas_conocimiento', 'editoriales', 'estados', 'formatos', 'idiomas', 'indices', 'periodicidad', 'mantenedores') ORDER BY resource, action;
