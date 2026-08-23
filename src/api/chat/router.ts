import { Hono } from 'hono';
import { requireAuth } from '../../config/auth';
import type { AppEnv } from '../../config/env';
import { validateJson } from '../categories/validation';
import { parseMessageController } from './controller';
import { parseMessageSchema } from './validation';

/**
 * Chat resource (ticket #12), mounted at /api/chat. Session-scoped via
 * requireAuth; the stricter rate-limit bucket is already applied to
 * /api/chat/* in src/index.ts (foundation ticket).
 */
const router = new Hono<AppEnv>();

router.use('*', requireAuth);

router.post('/parse', validateJson(parseMessageSchema), (c) =>
    parseMessageController(c, c.req.valid('json')),
);

export default router;
