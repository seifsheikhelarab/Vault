import { HTTPException } from 'hono/http-exception';
import type { PrismaClient } from '../generated/prisma/client';

/**
 * Shared ownership/serialization helpers. Every resource scopes queries by
 * userId so a missing or foreign row is indistinguishable (404).
 */

/** Prisma returns BigInt; JSON.stringify throws on it. Downsize while lossless. */
export function serializeAmountMinor<Row extends { amountMinor: bigint }>(
    row: Row,
): Omit<Row, 'amountMinor'> & { amountMinor: number } {
    return { ...row, amountMinor: Number(row.amountMinor) };
}

interface FindFirstByUser<T> {
    findFirst(args: { where: { id: string; userId: string } }): Promise<T | null>;
}

export async function findOwnedOr404<T>(
    model: FindFirstByUser<T>,
    userId: string,
    id: string,
): Promise<T> {
    const row = await model.findFirst({ where: { id, userId } });
    if (!row) throw new HTTPException(404);
    return row;
}

interface DeleteManyByUser {
    deleteMany(args: { where: { id: string; userId: string } }): Promise<{ count: number }>;
}

export async function deleteOwnedOr404(
    model: DeleteManyByUser,
    userId: string,
    id: string,
): Promise<void> {
    const result = await model.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new HTTPException(404);
}

export async function assertCategoryOwned(
    db: PrismaClient,
    userId: string,
    categoryId: string,
): Promise<void> {
    const category = await db.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new HTTPException(404);
}
