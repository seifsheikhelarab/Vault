import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { MembershipController } from './membership.controller';
import { addMemberSchema, updateMemberSchema } from './membership.schema';
import type { AppEnv } from '../../lib/middleware';

const membership = new Hono<AppEnv>();
const controller = new MembershipController();

membership.get('/', (c) => controller.list(c));

membership.post('/', zValidator('json', addMemberSchema), (c) =>
    controller.add(c)
);

membership.patch('/:id', zValidator('json', updateMemberSchema), (c) =>
    controller.update(c)
);

membership.delete('/:id', (c) => controller.remove(c));

export default membership;
