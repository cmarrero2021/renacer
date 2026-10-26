// Arranca src/index.js, captura consola y lo mata (con log de eventos)
const { spawn } = require('child_process');

const p = spawn('node', ['src/index.js'], { cwd: __dirname });
let out = '';
const push = (d) => { out += d.toString(); };
p.stdout.on('data', push);
p.stderr.on('data', push);
p.on('error', (e) => { out += '\n[SPAWN ERROR] ' + e.message; });
p.on('exit', (code) => { out += `\n[EXIT code=${code}]`; });

setTimeout(() => {
    try { p.kill(); } catch (e) { void e; }
    setTimeout(() => {
        console.log(out.split('\n').slice(0, 40).join('\n'));
        process.exit(0);
    }, 800);
}, 8000);
