import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../lib/db';
import { settlements } from '../../lib/db/schema';
import type {
    CreateSettlementInput,
    SettlementQueryInput
} from './settlement.schema';

export class SettlementService {
    async create(userId: string, data: CreateSettlementInput) {
        const [s] = await db
            .insert(settlements)
            .values({
                id: crypto.randomUUID(),
                fromUserId: userId,
                ...data,
                amount: String(data.amount)
            })
            .returning();
        return s;
    }

    async list(userId: string, query: SettlementQueryInput) {
        const { groupId } = query;
        const conditions = [eq(settlements.fromUserId, userId)];
        if (groupId) conditions.push(eq(settlements.groupId, groupId));

        const data = await db
            .select()
            .from(settlements)
            .where(and(...conditions))
            .orderBy(desc(settlements.createdAt));
        return data;
    }

    async getById(userId: string, id: string) {
        const [s] = await db
            .select()
            .from(settlements)
            .where(eq(settlements.id, id));
        if (!s) return null;
        if (s.fromUserId !== userId && s.toUserId !== userId) return null;
        return s;
    }
}
