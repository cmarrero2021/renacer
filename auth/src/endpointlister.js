// endpointlister.js

module.exports = function listEndpoints(app) {
    const endpoints = [];

    // Recorrer las capas de rutas
    app._router.stack.forEach(layer => {
        if (layer.route) {
            // Si es una ruta directa
            const path = layer.route.path;
            const methods = Object.keys(layer.route.methods).map(method => method.toUpperCase());
            endpoints.push({ path, methods });
        } else if (layer.name === 'router') {
            // Si hay subrouters, recorrer sus capas también
            layer.handle.stack.forEach(subLayer => {
                if (subLayer.route) {
                    const path = (layer.route?.path || '') + subLayer.route.path; // Concatenar el prefijo de la ruta
                    const methods = Object.keys(subLayer.route.methods).map(method => method.toUpperCase());
                    endpoints.push({ path, methods });
                }
            });
        }
    });

    return endpoints;
};