import { desc, eq, isNull, or, and } from 'drizzle-orm';
import { db } from '../../lib/db';
import { categories, expenses } from '../../lib/db/schema';
import type {
    CreateCategoryInput,
    UpdateCategoryInput
} from './category.schema';

export class CategoryService {
    async create(userId: string, data: CreateCategoryInput) {
        const id = crypto.randomUUID();
        const [cat] = await db
            .insert(categories)
            .values({ ...data, id, userId })
            .returning();
        return cat;
    }

    /**
     * Lists categories scoped to the current user plus global categories
     * (those with no userId, e.g. seeded defaults). This prevents test-
     * created categories from leaking into other users' views.
     */
    async list(userId: string) {
        const data = await db
            .select()
            .from(categories)
            .where(or(eq(categories.userId, userId), isNull(categories.userId)))
            .orderBy(desc(categories.createdAt));
        return data;
    }

    async update(userId: string, id: string, data: UpdateCategoryInput) {
        const [cat] = await db
            .select()
            .from(categories)
            .where(and(eq(categories.id, id), eq(categories.userId, userId)));
        if (!cat) return { error: 'FORBIDDEN' as const };

        const [updated] = await db
            .update(categories)
            .set({ name: data.name, icon: data.icon ?? null })
            .where(eq(categories.id, id))
            .returning();
        return updated;
    }

    async delete(userId: string, id: string) {
        const [cat] = await db
            .select()
            .from(categories)
            .where(and(eq(categories.id, id), eq(categories.userId, userId)));
        if (!cat) return { error: 'FORBIDDEN' as const };

        // Check if any expenses reference this category (FK is ON DELETE RESTRICT)
        const [linked] = await db
            .select()
            .from(expenses)
            .where(eq(expenses.categoryId, id))
            .limit(1);
        if (linked) {
            return { error: 'IN_USE' as const };
        }

        await db.delete(categories).where(eq(categories.id, id));
        return { deleted: true };
    }
}
