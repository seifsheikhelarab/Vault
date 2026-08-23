import { Hono } from 'hono';
import { requireAuth } from '../../config/auth';
import type { AppEnv } from '../../config/env';
import { monthlyReportController, weeklyReportController } from './controller';
import { reportQuerySchema, validateQuery } from './validation';

/**
 * Reports resource (ticket #10), mounted at /api/reports. Session-scoped via
 * requireAuth; errors flow through the central onError. GET-only, JSON only.
 */
const router = new Hono<AppEnv>();

router.use('*', requireAuth);

router.get('/weekly', validateQuery(reportQuerySchema), (c) =>
    weeklyReportController(c, c.req.valid('query')),
);
router.get('/monthly', validateQuery(reportQuerySchema), (c) =>
    monthlyReportController(c, c.req.valid('query')),
);

export default router;
