import dotenv from 'dotenv';
import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import { DEFAULT_CATEGORY_NAMES } from '../src/api/categories/service';

/**
 * Local dev seed (`bun run seed`). Creates one test user through the real
 * Better Auth signup path (correct password hash) plus the default
 * categories, mirroring src/config/auth.ts signup behavior. Also seeds
 * sample expenses and budgets for exercising list/analytics endpoints.
 *
 * Talks to Postgres through pg directly instead of the generated
 * PrismaClient: that client targets the workerd runtime and its WASM query
 * compiler cannot load under Node/bun. DEFAULT_CATEGORY_NAMES is imported
 * rather than duplicated; its module chain never instantiates the WASM
 * compiler unless a Prisma query actually runs.
 *
 * Reads .dev.vars (gitignored) for DATABASE_URL / BETTER_AUTH_SECRET.
 * Idempotent per dataset: an existing user is kept; only empty datasets
 * (categories, expenses, budgets) get filled in.
 */

dotenv.config({ path: '.dev.vars' });

const [name = 'Test User', email = 'test@vault.local', password = 'correct-horse-battery'] =
    process.argv.slice(2);

/** Amounts are EGP minor units (piastres); daysAgo spreads rows for list views. */
const SAMPLE_EXPENSES: { category: string; amountMinor: number; daysAgo: number; note: string }[] =
    [
        { category: 'Groceries', amountMinor: 45_000, daysAgo: 13, note: 'Weekly market run' },
        { category: 'Transport', amountMinor: 3_500, daysAgo: 12, note: 'Metro top-up' },
        { category: 'Dining', amountMinor: 18_000, daysAgo: 11, note: 'Koshary lunch' },
        { category: 'Entertainment', amountMinor: 25_000, daysAgo: 9, note: 'Cinema tickets' },
        { category: 'Groceries', amountMinor: 62_500, daysAgo: 8, note: 'Supermarket restock' },
        { category: 'Bills', amountMinor: 120_000, daysAgo: 6, note: 'Electricity bill' },
        { category: 'Health', amountMinor: 40_000, daysAgo: 5, note: 'Pharmacy' },
        { category: 'Dining', amountMinor: 9_500, daysAgo: 4, note: 'Coffee with friends' },
        { category: 'Shopping', amountMinor: 85_000, daysAgo: 3, note: 'New headphones' },
        { category: 'Transport', amountMinor: 7_000, daysAgo: 2, note: 'Ride-hailing' },
        { category: 'Groceries', amountMinor: 38_200, daysAgo: 1, note: 'Bread and produce' },
        { category: 'Other', amountMinor: 15_000, daysAgo: 0, note: 'Misc' },
    ];

const SAMPLE_BUDGETS: {
    category: string | null;
    periodType: 'week' | 'month';
    amountMinor: number;
}[] = [
    { category: null, periodType: 'month', amountMinor: 2_000_000 },
    { category: 'Groceries', periodType: 'month', amountMinor: 300_000 },
    { category: 'Dining', periodType: 'week', amountMinor: 60_000 },
];

async function main(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL not set — copy .dev.vars.example to .dev.vars');
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) throw new Error('BETTER_AUTH_SECRET not set — see .dev.vars.example');

    const pool = new Pool({ connectionString: databaseUrl });
    try {
        const found = await pool.query<{ id: string }>('SELECT id FROM "user" WHERE email = $1', [
            email,
        ]);

        let userId: string;
        if (found.rows.length > 0) {
            userId = found.rows[0].id;
            console.log(`user ${email} exists (${userId}); topping up any empty datasets`);
        } else {
            const auth = betterAuth({
                database: pool,
                secret,
                baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:8787',
                emailAndPassword: { enabled: true },
            });
            const { user } = await auth.api.signUpEmail({ body: { name, email, password } });
            userId = user.id;
            console.log(`seeded user ${email} (${userId})`);
            console.log(`password: ${password}`);
        }

        // Default categories are topped up whenever missing — covers fresh
        // signups and an existing user whose categories were wiped.
        const catCount = await pool.query<{ n: string }>(
            'SELECT count(*) AS n FROM category WHERE "userId" = $1',
            [userId],
        );
        if (catCount.rows[0].n === '0') {
            await pool.query(
                `INSERT INTO category ("userId", "name", "createdAt", "updatedAt")
                 SELECT $1, name, now(), now() FROM unnest($2::text[]) AS name`,
                [userId, [...DEFAULT_CATEGORY_NAMES]],
            );
            console.log(`seeded ${DEFAULT_CATEGORY_NAMES.length} default categories`);
        }

        const cats = await pool.query<{ id: string; name: string }>(
            'SELECT id, name FROM category WHERE "userId" = $1',
            [userId],
        );
        const categoryId = (name: string | null): string | null =>
            name === null ? null : (cats.rows.find((c) => c.name === name)?.id ?? null);

        const counts = await pool.query<{ expenses: string; budgets: string }>(
            `SELECT
               (SELECT count(*) FROM expense WHERE "userId" = $1) AS expenses,
               (SELECT count(*) FROM budget WHERE "userId" = $1) AS budgets`,
            [userId],
        );

        if (counts.rows[0].expenses !== '0') {
            console.log(`expenses already present (${counts.rows[0].expenses}); skipping`);
        } else {
            for (const e of SAMPLE_EXPENSES) {
                const occurredAt = new Date(Date.now() - e.daysAgo * 86_400_000);
                await pool.query(
                    `INSERT INTO expense
                       (id, "userId", "amountMinor", "currency", "categoryId", "occurredAt", "note", "updatedAt")
                     VALUES ($1, $2, $3, 'EGP', $4, $5, $6, now())`,
                    [
                        crypto.randomUUID(),
                        userId,
                        e.amountMinor,
                        categoryId(e.category),
                        occurredAt,
                        e.note,
                    ],
                );
            }
            console.log(`seeded ${SAMPLE_EXPENSES.length} sample expenses`);
        }

        if (counts.rows[0].budgets !== '0') {
            console.log(`budgets already present (${counts.rows[0].budgets}); skipping`);
        } else {
            for (const b of SAMPLE_BUDGETS) {
                await pool.query(
                    `INSERT INTO budget ("userId", "periodType", "amountMinor", "categoryId", "updatedAt")
                     VALUES ($1, $2::"PeriodType", $3, $4, now())`,
                    [userId, b.periodType, b.amountMinor, categoryId(b.category)],
                );
            }
            console.log(`seeded ${SAMPLE_BUDGETS.length} sample budgets`);
        }
    } finally {
        await pool.end();
    }
}

main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
});
