import { desc } from 'drizzle-orm';
import { db } from '../../lib/db';
import { categories } from '../../lib/db/schema';
import type { CreateCategoryInput } from './category.schema';

export class CategoryService {
    async create(userId: string, data: CreateCategoryInput) {
        const id = crypto.randomUUID();
        const [cat] = await db
            .insert(categories)
            .values({ ...data, id, userId })
            .returning();
        return cat;
    }

    // Note: userId is accepted for API consistency with other services but
    // categories are currently not scoped per-user in list queries.
    async list(_userId: string) {
        const data = await db
            .select()
            .from(categories)
            .orderBy(desc(categories.createdAt));
        return data;
    }
}
