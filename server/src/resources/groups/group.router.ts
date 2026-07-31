import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { GroupController } from './group.controller';
import { createGroupSchema, updateGroupSchema } from './group.schema';
import type { AppEnv } from '../../lib/middleware';

const group = new Hono<AppEnv>();
const controller = new GroupController();

// Static routes (must be before /:id to avoid param catch)
group.get('/company-summary', (c) => controller.getCompanySummary(c));

// Create group + auto-add creator as admin member
group.post('/', zValidator('json', createGroupSchema), (c) =>
    controller.create(c)
);

// List groups the user belongs to
group.get('/', (c) => controller.list(c));

// Compute group balances
group.get('/:id/balances', (c) => controller.getBalances(c));

// Get group by ID (must be member)
group.get('/:id', (c) => controller.getById(c));

// Update group (admin only)
group.patch('/:id', zValidator('json', updateGroupSchema), (c) =>
    controller.update(c)
);

// Delete group (admin only)
group.delete('/:id', (c) => controller.delete(c));

export default group;
