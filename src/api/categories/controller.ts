import type { Context } from 'hono';
import type { AppEnv } from '../../config/env';
import {
    createCategory,
    deleteCategory,
    getCategory,
    listCategories,
    updateCategory,
} from './service';

/**
 * Categories controllers (ticket #6). Handlers stay thin: pull the session
 * userId set by requireAuth plus the zod-validated inputs the router chain
 * extracted, delegate to the service, return bare resources.
 */

export async function createCategoryController(c: Context<AppEnv>, input: { name: string }) {
    const db = c.get('db');
    const category = await createCategory(db, c.get('userId'), input);
    return c.json(category, 201);
}

export async function listCategoriesController(c: Context<AppEnv>) {
    const db = c.get('db');
    return c.json(await listCategories(db, c.get('userId')));
}

export async function getCategoryController(c: Context<AppEnv>, id: string) {
    const db = c.get('db');
    return c.json(await getCategory(db, c.get('userId'), id));
}

export async function updateCategoryController(
    c: Context<AppEnv>,
    id: string,
    input: { name: string },
) {
    const db = c.get('db');
    const category = await updateCategory(db, c.get('userId'), id, input);
    return c.json(category);
}

export async function deleteCategoryController(c: Context<AppEnv>, id: string) {
    const db = c.get('db');
    await deleteCategory(db, c.get('userId'), id);
    return c.body(null, 204);
}
