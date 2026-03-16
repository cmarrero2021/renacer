const fs = require('fs');
const schemas = JSON.parse(fs.readFileSync('d:\\proyectos\\rencam\\auth\\schemas.json', 'utf8'));

['centro_propietarios', 'centro_representantes', 'centro_telefonos', 'centro_correos'].forEach(table => {
    console.log(`\n--- ${table} ---`);
    if(schemas[table]) {
        schemas[table].forEach(c => console.log(`${c.column} (${c.type})`));
    }
});
