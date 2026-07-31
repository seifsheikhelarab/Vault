import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../lib/db';
import { memberships } from '../../lib/db/schema';
import type { AddMemberInput, UpdateMemberInput } from './membership.schema';

export class MembershipService {
    async list(userId: string, groupId: string) {
        const [membership] = await db
            .select()
            .from(memberships)
            .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)));
        if (!membership) return { error: 'FORBIDDEN' as const };

        const members = await db
            .select()
            .from(memberships)
            .where(eq(memberships.groupId, groupId))
            .orderBy(desc(memberships.createdAt));
        return members;
    }

    async add(userId: string, groupId: string, data: AddMemberInput) {
        const [self] = await db
            .select()
            .from(memberships)
            .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)));
        if (!self) return { error: 'FORBIDDEN' as const };

        const [existing] = await db
            .select()
            .from(memberships)
            .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, data.userId)));
        if (existing) return { error: 'CONFLICT' as const };

        const [member] = await db
            .insert(memberships)
            .values({ id: crypto.randomUUID(), groupId, ...data })
            .returning();
        return member;
    }

    async update(userId: string, id: string, data: UpdateMemberInput) {
        const [existing] = await db
            .select()
            .from(memberships)
            .where(eq(memberships.id, id));
        if (!existing) return { error: 'NOT_FOUND' as const };

        const [self] = await db
            .select()
            .from(memberships)
            .where(and(eq(memberships.groupId, existing.groupId), eq(memberships.userId, userId)));
        if (!self || self.role !== 'admin') return { error: 'FORBIDDEN' as const };

        const [updated] = await db
            .update(memberships)
            .set(data)
            .where(eq(memberships.id, id))
            .returning();
        return updated;
    }

    async remove(userId: string, id: string) {
        const [existing] = await db
            .select()
            .from(memberships)
            .where(eq(memberships.id, id));
        if (!existing) return { error: 'NOT_FOUND' as const };

        const isSelf = existing.userId === userId;
        if (!isSelf) {
            const [self] = await db
                .select()
                .from(memberships)
                .where(and(eq(memberships.groupId, existing.groupId), eq(memberships.userId, userId)));
            if (!self || self.role !== 'admin') return { error: 'FORBIDDEN' as const };
        }

        await db.delete(memberships).where(eq(memberships.id, id));
        return { deleted: true };
    }
}
