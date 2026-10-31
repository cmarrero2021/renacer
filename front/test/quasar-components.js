// ─────────────────────────────────────────────────────────────────────────────
// Helper: registro explícito de componentes y directivas de Quasar para VTU.
// En el entorno de pruebas, Quasar.install() no registra los componentes
// globalmente (build cliente ESM en jsdom), por eso se registran a mano.
// ─────────────────────────────────────────────────────────────────────────────
import * as QuasarAll from 'quasar';

const components = {};
const directives = {};

for (const [nombre, def] of Object.entries(QuasarAll)) {
    if (!def || typeof def !== 'object' && typeof def !== 'function') continue;
    if (typeof nombre !== 'string') continue;
    if (nombre.startsWith('Q') && def.name && /^Q[A-Z]/.test(String(def.name))) {
        components[nombre] = def;
    } else if (typeof def.mounted === 'function' || typeof def.updated === 'function') {
        // Directivas de Quasar (Ripple, ClosePopup, Intersection, ...)
        directives[nombre] = def;
    }
}

export const quasarComponents = components;
export const quasarDirectives = directives;
