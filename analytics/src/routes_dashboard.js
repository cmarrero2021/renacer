// analytics/src/routes_dashboard.js
const express = require('express');
const router = express.Router();
const { createHandler } = require('graphql-http/lib/use/express');
const { schema } = require('./graphql/schema');
const { authenticate, authorize } = require('./middlewares');
const controller = require('./controllers_dashboard');

// ─── GraphQL Endpoint ─────────────────────────────────────────────────────────
router.all('/graphql', authenticate, (req, res, next) => {
    createHandler({
        schema,
        context: () => ({ userId: req.userId }),
    })(req, res, next);
});

// ─── Consultas Guardadas (REST) ───────────────────────────────────────────────
router.get('/saved-queries', authenticate, controller.listSavedQueries);
router.get('/saved-queries/:id', authenticate, controller.getSavedQuery);
router.post('/saved-queries', authenticate, controller.createSavedQuery);
router.put('/saved-queries/:id', authenticate, controller.updateSavedQuery);
router.delete('/saved-queries/:id', authenticate, controller.deleteSavedQuery);

// ─── Compartir / Revocar acceso ───────────────────────────────────────────────
router.post('/saved-queries/:id/grant', authenticate, controller.grantQueryAccess);
router.delete('/saved-queries/:id/grant', authenticate, controller.revokeQueryAccess);

module.exports = router;
