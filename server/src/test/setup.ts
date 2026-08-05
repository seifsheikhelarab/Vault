import { beforeAll, afterAll } from 'vitest';
import { app } from '../index';
import { auth } from '../lib/auth';

export { app };

// ── Test data shared across test suites ──────────────────────────────

export interface TestUser {
    id: string;
    email: string;
    name: string;
}

export interface TestCategory {
    id: string;
    name: string;
}

let testUser: TestUser | null = null;
let secondUser: TestUser | null = null;
let testCategory: TestCategory | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authContext: any = null;

/**
 * Returns the shared test user created during setup.
 * Throws if called before setup completes.
 */
export function getTestUser(): TestUser {
    if (!testUser)
        throw new Error('Test user not initialized — did beforeAll run?');
    return testUser;
}

/**
 * Returns the second test user created during setup.
 * Used for permission testing (e.g. non-member, non-admin scenarios).
 */
export function getSecondUser(): TestUser {
    if (!secondUser)
        throw new Error('Second user not initialized — did beforeAll run?');
    return secondUser;
}

/**
 * Returns the shared test category created during setup.
 * Throws if called before setup completes.
 */
export function getTestCategory(): TestCategory {
    if (!testCategory)
        throw new Error('Test category not initialized — did beforeAll run?');
    return testCategory;
}

/**
 * Creates authenticated request headers for testing protected routes.
 * Uses the x-test-user-id header which the auth middleware respects in test mode.
 */
export function getAuthHeaders(userId: string): Headers {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('x-test-user-id', userId);
    return headers;
}

/**
 * Creates an additional test user for use within test files.
 * Useful when tests need more users than the two created in setup.
 */
export async function createTestUser(email?: string): Promise<TestUser> {
    const ctx = await auth!.$context;
    const testUtils = ctx.test;
    const userObj = testUtils.createUser({
        email: email || `dynamic-${crypto.randomUUID()}@example.com`,
        name: 'Dynamic Test User'
    });
    const saved = await testUtils.saveUser(userObj);
    return { id: saved.id, email: saved.email, name: saved.name };
}

/**
 * Deletes a test user by ID.
 */
export async function deleteTestUser(userId: string): Promise<void> {
    if (authContext) {
        await authContext.test.deleteUser(userId);
    }
}

/**
 * Sets up test data before all tests run:
 * 1. Creates two test users via Better Auth testUtils (for permission testing)
 * 2. Creates a test category via direct DB insert
 *
 * Uses unique UUID-based emails to avoid conflicts from interrupted runs.
 */
beforeAll(async () => {
    // Get the auth context which includes testUtils helpers
    authContext = await auth.$context;
    const test = authContext.test;

    // ── Create primary test user ──────────────────────────────────────
    const userObj = test.createUser({
        email: `primary-${crypto.randomUUID()}@example.com`,
        name: 'Primary Test User'
    });
    const savedUser = await test.saveUser(userObj);
    testUser = {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name
    };

    // ── Create second test user (for permission tests) ────────────────
    const userObj2 = test.createUser({
        email: `second-${crypto.randomUUID()}@example.com`,
        name: 'Second Test User'
    });
    const savedUser2 = await test.saveUser(userObj2);
    secondUser = {
        id: savedUser2.id,
        email: savedUser2.email,
        name: savedUser2.name
    };

    // ── Create a test category ────────────────────────────────────────
    const { db } = await import('../lib/db');
    const { categories } = await import('../lib/db/schema');
    const catId = crypto.randomUUID();
    await db.insert(categories).values({
        id: catId,
        name: 'Test Category',
        userId: testUser.id
    });
    testCategory = { id: catId, name: 'Test Category' };
});

/**
 * Cleans up test data after all tests complete.
 * Expenses must be deleted before categories because
 * expense.category_id → category.id is ON DELETE RESTRICT.
 * Explicitly delete the test category in case user-deletion
 * cascade fails, then clean up test users.
 */
afterAll(async () => {
    if (authContext) {
        const { db } = await import('../lib/db');
        const { expenses, categories } = await import('../lib/db/schema');
        const { eq } = await import('drizzle-orm');

        try {
            await db.delete(expenses);
        } catch (err) {
            console.error('[test-cleanup] Failed to delete expenses:', err);
        }

        // Delete the test category explicitly before deleting users,
        // as cascade from user delete is theoretically handled by the FK
        // but we want to be explicit about cleanup.
        if (testCategory) {
            try {
                await db
                    .delete(categories)
                    .where(eq(categories.id, testCategory.id));
            } catch (err) {
                console.error(
                    '[test-cleanup] Failed to delete test category:',
                    err
                );
            }
        }

        if (testUser) {
            try {
                await authContext.test.deleteUser(testUser.id);
            } catch (err) {
                console.error(
                    '[test-cleanup] Failed to delete test user:',
                    err
                );
            }
        }
        if (secondUser) {
            try {
                await authContext.test.deleteUser(secondUser.id);
            } catch (err) {
                console.error(
                    '[test-cleanup] Failed to delete second user:',
                    err
                );
            }
        }
    }
});
