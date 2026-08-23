import { Hono } from 'hono';
import { requireAuth } from '../../config/auth';
import type { AppEnv } from '../../config/env';
import { dashboardController } from './controller';
import { reportQuerySchema, validateQuery } from '../reports/validation';

/**
 * Dashboard resource (ticket #11), mounted at /api/dashboard. Session-scoped
 * via requireAuth; errors flow through the central onError. The optional
 * `date` query pins the clock and is the exact schema reports uses.
 */
const router = new Hono<AppEnv>();

router.use('*', requireAuth);

router.get('/', validateQuery(reportQuerySchema), (c) =>
    dashboardController(c, c.req.valid('query')),
);

export default router;
