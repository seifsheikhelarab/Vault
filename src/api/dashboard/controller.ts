import type { Context } from 'hono';
import type { AppEnv } from '../../config/env';
import { getDashboard } from './service';

/**
 * Dashboard controller (ticket #11). Thin like every other resource: session
 * userId plus validated query in, one snapshot JSON out.
 */
export async function dashboardController(c: Context<AppEnv>, query: { date?: string }) {
    const db = c.get('db');
    return c.json(await getDashboard(db, c.get('userId'), query.date));
}
