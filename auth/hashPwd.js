// hashPwd.js - Utilidad para hashear contraseñas desde la línea de comandos

const { hashPassword } = require('./src/utils');

// Password por defecto (hardcodeado)
const DEFAULT_PASSWORD = 'Admin123$';

async function main() {
  // Obtener el password desde los argumentos de línea de comandos
  // Si no se proporciona, usar el password por defecto
  const password = process.argv[2] || DEFAULT_PASSWORD;
  const isDefaultPassword = !process.argv[2];

  try {
    // Hash de la contraseña
    const hashedPassword = await hashPassword(password);
    
    console.log('\n✅ Contraseña hasheada exitosamente:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (isDefaultPassword) {
      console.log('ℹ️  Usando password por defecto (no se proporcionó argumento)');
    }
    console.log(`🔐 Password original: ${password}`);
    console.log(`🔒 Hash generado:     ${hashedPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📖 Uso:');
    console.log('   node hashPwd.js              → Hashea el password por defecto');
    console.log('   node hashPwd.js <contraseña> → Hashea la contraseña proporcionada\n');
  } catch (error) {
    console.error('❌ Error al hashear la contraseña:', error.message);
    process.exit(1);
  }
}

main();
