import { Hono } from 'hono';
import type { AppEnv } from '../config/env';
import { createPrisma, resolveDatabaseUrl } from '../config/prisma';
import authRouter from './auth/router';
import budgetsRouter from './budgets/router';
import categoriesRouter from './categories/router';
import chatRouter from './chat/router';
import dashboardRouter from './dashboard/router';
import expensesRouter from './expenses/router';
import recurringRouter from './recurring/router';
import reportsRouter from './reports/router';
import syncRouter from './sync/router';

const api = new Hono<AppEnv>();

// One client per request, memoized per connection string inside createPrisma.
api.use('*', async (c, next) => {
    c.set('db', createPrisma(resolveDatabaseUrl(c.env)));
    await next();
});

// Resource routers (reports, dashboard) mount here as they land.
api.route('/auth', authRouter);
api.route('/budgets', budgetsRouter);
api.route('/categories', categoriesRouter);
api.route('/chat', chatRouter);
api.route('/dashboard', dashboardRouter);
api.route('/expenses', expensesRouter);
api.route('/recurring', recurringRouter);
api.route('/reports', reportsRouter);
api.route('/sync', syncRouter);

export default api;
