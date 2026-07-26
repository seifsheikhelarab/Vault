import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";
import { ok, fail } from "../../lib/response";
import { db } from "../../lib/db";
import { settlements } from "../../lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { AppEnv } from "../../lib/middleware";

const createSettlementSchema = z.object({
  toUserId: z.string().min(1),
  amount: z.number().positive(),
  groupId: z.string().optional(),
  note: z.string().max(200).optional(),
});

const settlementQuerySchema = z.object({
  groupId: z.string().optional(),
});

const settlement = new Hono<AppEnv>();

settlement.post(
  "/",
  zValidator("json", createSettlementSchema),
  async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    if (body.toUserId === userId) return c.json(fail("BAD_REQUEST", "Cannot settle with yourself"), 400);

    const [s] = await db
      .insert(settlements)
      .values({ id: crypto.randomUUID(), fromUserId: userId, ...body, amount: String(body.amount) })
      .returning();
    return c.json(ok(s), 201);
  }
);

settlement.get(
  "/",
  zValidator("query", settlementQuerySchema),
  async (c) => {
    const userId = c.get("userId");
    const { groupId } = c.req.valid("query");

    const conditions = [
      // User is either sender or receiver
      eq(settlements.fromUserId, userId),
    ];
    if (groupId) conditions.push(eq(settlements.groupId, groupId));

    const data = await db
      .select()
      .from(settlements)
      .where(and(...conditions))
      .orderBy(desc(settlements.createdAt));
    return c.json(ok(data));
  }
);

settlement.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [s] = await db.select().from(settlements).where(eq(settlements.id, id));
  if (!s) return c.json(fail("NOT_FOUND", "Settlement not found"), 404);
  if (s.fromUserId !== userId && s.toUserId !== userId)
    return c.json(fail("FORBIDDEN", "Not your settlement"), 403);
  return c.json(ok(s));
});

export default settlement;
