import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ok, fail } from "../../lib/response";
import { db } from "../../lib/db";
import { memberships, groups } from "../../lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { AppEnv } from "../../lib/middleware";
import { addMemberSchema, updateMemberSchema } from "./membership.schema";

const membership = new Hono<AppEnv>();

// List members of a group
membership.get("/", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.query("groupId");
  if (!groupId) return c.json(fail("BAD_REQUEST", "groupId required"), 400);

  const [membership_] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)));
  if (!membership_) return c.json(fail("FORBIDDEN", "Not a member"), 403);

  const members = await db
    .select()
    .from(memberships)
    .where(eq(memberships.groupId, groupId))
    .orderBy(desc(memberships.createdAt));
  return c.json(ok(members));
});

// Add member to group
membership.post(
  "/",
  zValidator("json", addMemberSchema),
  async (c) => {
    const userId = c.get("userId");
    const groupId = c.req.query("groupId");
    if (!groupId) return c.json(fail("BAD_REQUEST", "groupId required"), 400);

    const [self] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)));
    if (!self) return c.json(fail("FORBIDDEN", "Not a member"), 403);

    const body = c.req.valid("json");

    const [existing] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, body.userId)));
    if (existing) return c.json(fail("CONFLICT", "Already a member"), 409);

    const [member] = await db
      .insert(memberships)
      .values({ id: crypto.randomUUID(), groupId, ...body })
      .returning();
    return c.json(ok(member), 201);
  }
);

// Update member role
membership.patch(
  "/:id",
  zValidator("json", updateMemberSchema),
  async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const [existing] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.id, id));
    if (!existing) return c.json(fail("NOT_FOUND", "Member not found"), 404);

    const [self] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.groupId, existing.groupId), eq(memberships.userId, userId)));
    if (!self || self.role !== "admin") return c.json(fail("FORBIDDEN", "Admin only"), 403);

    const body = c.req.valid("json");
    const [updated] = await db
      .update(memberships)
      .set(body)
      .where(eq(memberships.id, id))
      .returning();
    return c.json(ok(updated));
  }
);

// Remove member from group (or leave)
membership.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.id, id));
  if (!existing) return c.json(fail("NOT_FOUND", "Member not found"), 404);

  // Self-leave or admin-removing
  const isSelf = existing.userId === userId;
  if (!isSelf) {
    const [self] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.groupId, existing.groupId), eq(memberships.userId, userId)));
    if (!self || self.role !== "admin") return c.json(fail("FORBIDDEN", "Admin only"), 403);
  }

  await db.delete(memberships).where(eq(memberships.id, id));
  return c.json(ok({ deleted: true }));
});

export default membership;
