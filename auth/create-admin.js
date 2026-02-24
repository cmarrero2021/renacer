// create-admin.js

require('dotenv').config();
const { hashPassword } = require('./src/utils');
const pool = require('./src/db');

// Datos del administrador
const adminUser = {
  firstName: 'Admin',
  lastName: 'Principal',
  cedula: 12345678,
  email: 'admin@example.com',
  password: 'Admin123$',
};

// Definición de recursos y acciones para los permisos
const resources = ['user', 'role', 'permission', 'revista'];
const actions = ['create', 'read', 'update', 'delete'];

async function createPermissions(client) {
  const permissionIds = [];

  for (const resource of resources) {
    for (const action of actions) {
      const name = `${action}_${resource}`;
      const res = await client.query(
        `INSERT INTO permissions (name, resource, action) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [name, resource, action]
      );
      permissionIds.push(res.rows[0].id);
    }
  }

  console.log('✅ Permisos creados o actualizados');
  return permissionIds;
}

async function createAdminRole(client, permissionIds) {
  // Crear el rol Admin si no existe
  const roleRes = await client.query(
    `INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    ['Admin', 'Rol con todos los permisos']
  );

  const roleId = roleRes.rows[0].id;

  // Asignar todos los permisos al rol Admin
  for (const permissionId of permissionIds) {
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [roleId, permissionId]
    );
  }

  console.log('✅ Rol Admin creado y permisos asignados');
  return roleId;
}

async function createAdminUser(client, roleId) {
  // Verificar si el usuario ya existe por correo o cédula
  const checkUser = await client.query(
    `SELECT id FROM users WHERE email = $1 OR cedula = $2`,
    [adminUser.email, adminUser.cedula]
  );

  if (checkUser.rows.length > 0) {
    console.log('⚠️ El usuario Administrador ya existe');
    return;
  }

  // Hash de la contraseña
  const hashedPassword = await hashPassword(adminUser.password);

  // Crear el usuario
  const userRes = await client.query(
    `INSERT INTO users (first_name, last_name, cedula, email, password_hash, is_email_verified, status) 
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      adminUser.firstName,
      adminUser.lastName,
      adminUser.cedula,
      adminUser.email,
      hashedPassword,
      true, // is_email_verified
      'active',
    ]
  );

  const userId = userRes.rows[0].id;

  // Asignar el rol Admin al usuario
  await client.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
    [userId, roleId]
  );

  console.log(`✅ Usuario administrador creado con ID: ${userId}`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const permissionIds = await createPermissions(client);
    const roleId = await createAdminRole(client, permissionIds);
    await createAdminUser(client, roleId);
    await client.query('COMMIT');
    console.log('✅ Rol y usuario administrador creados exitosamente');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error al crear el rol y usuario administrador:', e.message);
  } finally {
    client.release();
  }
}

main();