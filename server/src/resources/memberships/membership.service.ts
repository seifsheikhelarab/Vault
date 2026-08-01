import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../lib/db';
import { memberships } from '../../lib/db/schema';
import { user } from '../../lib/db/auth-schema';
import type { AddMemberInput, UpdateMemberInput } from './membership.schema';

export class MembershipService {
    async list(userId: string, groupId: string) {
        const [membership] = await db
            .select()
            .from(memberships)
            .where(
                and(
                    eq(memberships.groupId, groupId),
                    eq(memberships.userId, userId)
                )
            );
        if (!membership) return { error: 'FORBIDDEN' as const };

        const rows = await db
            .select({
                id: memberships.id,
                groupId: memberships.groupId,
                userId: memberships.userId,
                role: memberships.role,
                createdAt: memberships.createdAt,
                name: user.name,
                email: user.email
            })
            .from(memberships)
            .innerJoin(user, eq(memberships.userId, user.id))
            .where(eq(memberships.groupId, groupId))
            .orderBy(desc(memberships.createdAt));

        return rows.map((r) => ({
            id: r.id,
            groupId: r.groupId,
            userId: r.userId,
            role: r.role,
            createdAt: r.createdAt,
            user: { name: r.name, email: r.email }
        }));
    }

    async add(userId: string, groupId: string, data: AddMemberInput) {
        const [self] = await db
            .select()
            .from(memberships)
            .where(
                and(
                    eq(memberships.groupId, groupId),
                    eq(memberships.userId, userId)
                )
            );
        if (!self) return { error: 'FORBIDDEN' as const };

        // Resolve email to user ID
        const [targetUser] = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, data.email));
        if (!targetUser) return { error: 'NOT_FOUND' as const };

        const [existing] = await db
            .select()
            .from(memberships)
            .where(
                and(
                    eq(memberships.groupId, groupId),
                    eq(memberships.userId, targetUser.id)
                )
            );
        if (existing) return { error: 'CONFLICT' as const };

        const [member] = await db
            .insert(memberships)
            .values({ id: crypto.randomUUID(), groupId, userId: targetUser.id, role: data.role })
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
            .where(
                and(
                    eq(memberships.groupId, existing.groupId),
                    eq(memberships.userId, userId)
                )
            );
        if (!self || self.role !== 'admin')
            return { error: 'FORBIDDEN' as const };

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
                .where(
                    and(
                        eq(memberships.groupId, existing.groupId),
                        eq(memberships.userId, userId)
                    )
                );
            if (!self || self.role !== 'admin')
                return { error: 'FORBIDDEN' as const };
        }

        await db.delete(memberships).where(eq(memberships.id, id));
        return { deleted: true };
    }
}
