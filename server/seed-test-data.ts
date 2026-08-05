import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';

const url = process.env.DATABASE_URL;
if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
}

const client = postgres(url);
const db = drizzle(client, { schema });

// ─── Helpers ────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();

/** Convert a dollar amount to integer cents (business-max bounded). */
const toCents = (dollars: number): number => Math.round(dollars * 100);

function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(
        10 + Math.floor(Math.random() * 8),
        Math.floor(Math.random() * 60),
        0,
        0
    );
    return d;
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Configuration ──────────────────────────────────────────────────────────

const TEST_USERS = [
    {
        name: 'Alice Tester',
        email: 'test@example.com',
        password: 'password123'
    },
    { name: 'Bob Friend', email: 'friend@example.com', password: 'password123' }
] as const;

const USER_CATEGORIES = ['Restaurants', 'Groceries', 'Coffee'];

const BUDGETS = [
    { category: 'Food', amountCents: 60_000, period: 'monthly' as const },
    { category: 'Transport', amountCents: 20_000, period: 'monthly' as const },
    {
        category: 'Entertainment',
        amountCents: 15_000,
        period: 'monthly' as const
    }
];

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    // Step 1: Create (or find) test users
    console.log('\n👤 Creating test users...');

    const userRecords: Record<string, typeof schema.user.$inferSelect> = {};

    for (const u of TEST_USERS) {
        const existing = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.email, u.email))
            .limit(1);

        let user: typeof schema.user.$inferSelect;

        if (existing.length > 0) {
            user = existing[0];
            console.log(`  ✓ ${u.email} already exists`);

            // Update password if account exists
            const existingAccount = await db
                .select()
                .from(schema.account)
                .where(eq(schema.account.userId, user.id))
                .limit(1);
            if (existingAccount.length > 0) {
                const hashed = await hashPassword(u.password);
                await db
                    .update(schema.account)
                    .set({ password: hashed })
                    .where(eq(schema.account.id, existingAccount[0].id));
                console.log(`    ↳ password updated`);
            }
        } else {
            const id = uid();
            const now = new Date();
            const [created] = await db
                .insert(schema.user)
                .values({
                    id,
                    name: u.name,
                    email: u.email,
                    emailVerified: true,
                    createdAt: now,
                    updatedAt: now
                })
                .returning();
            user = created;
            console.log(`  ✓ Created ${u.email}`);
        }

        // Ensure account record exists
        const hashed = await hashPassword(u.password);
        const existingAccount = await db
            .select()
            .from(schema.account)
            .where(eq(schema.account.userId, user.id))
            .limit(1);

        if (existingAccount.length === 0) {
            await db.insert(schema.account).values({
                id: uid(),
                accountId: u.email,
                providerId: 'credential',
                userId: user.id,
                password: hashed,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log(`    ↳ account created`);
        }

        userRecords[u.name] = user;
    }

    const alice = userRecords['Alice Tester'];
    const bob = userRecords['Bob Friend'];

    // Step 2: Seed shared categories (if not present)
    console.log('\n📂 Seeding categories...');

    const DEFAULT_CATEGORIES = [
        'Food',
        'Transport',
        'Entertainment',
        'Utilities',
        'Health',
        'Shopping'
    ];

    for (const name of DEFAULT_CATEGORIES) {
        const existing = await db
            .select()
            .from(schema.categories)
            .where(eq(schema.categories.name, name))
            .limit(1);
        if (existing.length === 0) {
            await db.insert(schema.categories).values({ id: uid(), name });
            console.log(`  ✓ ${name}`);
        } else {
            console.log(`  · ${name} (exists)`);
        }
    }

    // Step 3: Create user-scoped custom categories
    console.log('\n🏷️  Creating custom categories...');

    const catMap = new Map<string, string>(); // name -> id

    // Load all category IDs
    const allCats = await db.select().from(schema.categories);
    for (const c of allCats) catMap.set(c.name, c.id);

    for (const name of USER_CATEGORIES) {
        const existing = await db
            .select()
            .from(schema.categories)
            .where(eq(schema.categories.name, name))
            .limit(1);
        if (existing.length === 0) {
            const id = uid();
            await db.insert(schema.categories).values({
                id,
                name,
                userId: alice.id
            });
            catMap.set(name, id);
            console.log(`  ✓ ${name} (user-scoped)`);
        } else {
            catMap.set(name, existing[0].id);
            console.log(`  · ${name} (exists)`);
        }
    }

    function categoryId(name: string): string {
        return catMap.get(name) ?? allCats[0].id;
    }

    // Step 4: Create budgets
    console.log('\n💰 Creating budgets...');

    const existingBudgets = await db
        .select()
        .from(schema.budgets)
        .where(eq(schema.budgets.userId, alice.id));
    const existingBudgetCats = new Set(
        existingBudgets.map((b) => b.categoryId)
    );

    for (const b of BUDGETS) {
        const cid = categoryId(b.category);
        if (!existingBudgetCats.has(cid)) {
            await db.insert(schema.budgets).values({
                id: uid(),
                categoryId: cid,
                amountCents: b.amountCents,
                period: b.period,
                userId: alice.id
            });
            console.log(
                `  ✓ ${b.category} — $${(b.amountCents / 100).toFixed(2)}/${b.period}`
            );
        } else {
            console.log(`  · ${b.category} (exists)`);
        }
    }

    // Step 5: Create personal expenses (last 30 days)
    console.log('\n💸 Creating personal expenses...');

    const existingExpenses = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.expenses)
        .where(eq(schema.expenses.userId, alice.id));

    const expenseCount = Number(existingExpenses[0]?.count ?? 0);

    if (expenseCount >= 15) {
        console.log('  · Personal expenses already exist, skipping...');
    } else {
        const PERSONAL_EXPENSES = [
            // Food
            {
                desc: "Grocery run at Trader Joe's",
                cat: 'Food',
                amt: 87.43,
                ago: 1
            },
            { desc: 'Lunch at Chipotle', cat: 'Food', amt: 14.58, ago: 2 },
            {
                desc: 'Dinner at Italian place',
                cat: 'Restaurants',
                amt: 62.15,
                ago: 3
            },
            { desc: 'Coffee and pastry', cat: 'Coffee', amt: 8.75, ago: 4 },
            {
                desc: 'Whole Foods groceries',
                cat: 'Groceries',
                amt: 112.6,
                ago: 5
            },
            { desc: 'Pizza delivery', cat: 'Food', amt: 28.99, ago: 6 },
            {
                desc: 'Brunch with friends',
                cat: 'Restaurants',
                amt: 34.5,
                ago: 7
            },
            {
                desc: 'Snacks from 7-Eleven',
                cat: 'Groceries',
                amt: 6.25,
                ago: 8
            },
            {
                desc: 'Meal prep ingredients',
                cat: 'Groceries',
                amt: 45.8,
                ago: 9
            },
            {
                desc: 'Coffee beans subscription',
                cat: 'Coffee',
                amt: 19.99,
                ago: 10
            },
            { desc: 'Fast food drive-thru', cat: 'Food', amt: 11.47, ago: 12 },
            { desc: 'Sushi takeout', cat: 'Restaurants', amt: 41.2, ago: 14 },
            { desc: "Farmer's market", cat: 'Groceries', amt: 32.0, ago: 16 },
            { desc: 'Ice cream shop', cat: 'Food', amt: 7.5, ago: 18 },

            // Transport
            {
                desc: 'Gas station fill-up',
                cat: 'Transport',
                amt: 48.3,
                ago: 2
            },
            { desc: 'Uber to downtown', cat: 'Transport', amt: 22.15, ago: 5 },
            { desc: 'Monthly bus pass', cat: 'Transport', amt: 75.0, ago: 10 },
            { desc: 'Parking garage', cat: 'Transport', amt: 15.0, ago: 13 },
            { desc: 'Bike repair shop', cat: 'Transport', amt: 35.5, ago: 20 },

            // Entertainment
            {
                desc: 'Movie tickets — Dune 3',
                cat: 'Entertainment',
                amt: 32.0,
                ago: 4
            },
            {
                desc: 'Spotify Premium',
                cat: 'Entertainment',
                amt: 10.99,
                ago: 8
            },
            {
                desc: 'Concert tickets',
                cat: 'Entertainment',
                amt: 85.0,
                ago: 15
            },
            { desc: 'Bowling night', cat: 'Entertainment', amt: 28.5, ago: 22 },
            {
                desc: 'Steam game purchase',
                cat: 'Entertainment',
                amt: 59.99,
                ago: 25
            },

            // Utilities
            { desc: 'Electric bill', cat: 'Utilities', amt: 95.42, ago: 3 },
            {
                desc: 'Internet — Comcast',
                cat: 'Utilities',
                amt: 69.99,
                ago: 7
            },
            { desc: 'Water bill', cat: 'Utilities', amt: 34.2, ago: 15 },
            { desc: 'Phone plan', cat: 'Utilities', amt: 55.0, ago: 20 },

            // Health
            { desc: 'Gym membership', cat: 'Health', amt: 49.99, ago: 6 },
            { desc: 'Pharmacy — vitamins', cat: 'Health', amt: 24.5, ago: 11 },
            { desc: 'Doctor co-pay', cat: 'Health', amt: 30.0, ago: 28 },

            // Shopping
            { desc: 'New running shoes', cat: 'Shopping', amt: 120.0, ago: 9 },
            {
                desc: 'Amazon — desk lamp',
                cat: 'Shopping',
                amt: 39.99,
                ago: 14
            },
            { desc: 'Target run', cat: 'Shopping', amt: 67.35, ago: 19 },
            { desc: 'Bookstore haul', cat: 'Shopping', amt: 48.22, ago: 26 }
        ];

        for (const exp of PERSONAL_EXPENSES) {
            await db.insert(schema.expenses).values({
                id: uid(),
                amountCents: toCents(exp.amt),
                description: exp.desc,
                date: daysAgo(exp.ago),
                scope: 'personal',
                userId: alice.id,
                categoryId: categoryId(exp.cat),
                payerNameSnapshot: alice.name,
                payerEmailSnapshot: alice.email
            });
        }
        console.log(`  ✓ ${PERSONAL_EXPENSES.length} personal expenses`);
    } // end else (no existing personal expenses)

    // Step 6: Create a social group with members
    console.log('\n👥 Creating social group...');

    const existingGroup = await db
        .select()
        .from(schema.groups)
        .where(eq(schema.groups.name, 'Roommates'))
        .limit(1);

    let groupId: string;

    if (existingGroup.length > 0) {
        groupId = existingGroup[0].id;
        console.log('  · Roommates group exists');
    } else {
        groupId = uid();
        await db.insert(schema.groups).values({
            id: groupId,
            name: 'Roommates',
            kind: 'social',
            createdBy: alice.id
        });
        console.log('  ✓ Roommates group created');
    }

    // Add memberships
    for (const user of [alice, bob]) {
        const existingMembership = await db
            .select()
            .from(schema.memberships)
            .where(
                sql`${schema.memberships.groupId} = ${groupId} AND ${schema.memberships.userId} = ${user.id}`
            )
            .limit(1);

        if (existingMembership.length === 0) {
            await db.insert(schema.memberships).values({
                id: uid(),
                groupId,
                userId: user.id,
                role: user.id === alice.id ? 'admin' : 'member'
            });
            console.log(
                `  ✓ ${user.name} → member (${user.id === alice.id ? 'admin' : 'member'})`
            );
        }
    }

    // Step 7: Create group expenses with splits
    console.log('\n🧾 Creating group expenses...');

    const existingGroupExpenses = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.expenses)
        .where(eq(schema.expenses.groupId, groupId));

    if (Number(existingGroupExpenses[0]?.count ?? 0) === 0) {
        const GROUP_EXPENSES = [
            {
                desc: 'Pizza + drinks',
                amt: 48.5,
                cat: 'Food',
                ago: 3,
                payerId: alice.id,
                payerName: alice.name,
                payerEmail: alice.email,
                splits: [
                    {
                        userId: alice.id,
                        amt: 24.25,
                        name: alice.name,
                        email: alice.email
                    },
                    {
                        userId: bob.id,
                        amt: 24.25,
                        name: bob.name,
                        email: bob.email
                    }
                ]
            },
            {
                desc: 'Cleaning supplies',
                amt: 32.8,
                cat: 'Shopping',
                ago: 7,
                payerId: bob.id,
                payerName: bob.name,
                payerEmail: bob.email,
                splits: [
                    {
                        userId: alice.id,
                        amt: 16.4,
                        name: alice.name,
                        email: alice.email
                    },
                    {
                        userId: bob.id,
                        amt: 16.4,
                        name: bob.name,
                        email: bob.email
                    }
                ]
            },
            {
                desc: 'Internet bill (shared)',
                amt: 69.99,
                cat: 'Utilities',
                ago: 10,
                payerId: alice.id,
                payerName: alice.name,
                payerEmail: alice.email,
                splits: [
                    {
                        userId: alice.id,
                        amt: 35.0,
                        name: alice.name,
                        email: alice.email
                    },
                    {
                        userId: bob.id,
                        amt: 34.99,
                        name: bob.name,
                        email: bob.email
                    }
                ]
            },
            {
                desc: 'TV streaming — Netflix',
                amt: 15.99,
                cat: 'Entertainment',
                ago: 15,
                payerId: bob.id,
                payerName: bob.name,
                payerEmail: bob.email,
                splits: [
                    {
                        userId: alice.id,
                        amt: 8.0,
                        name: alice.name,
                        email: alice.email
                    },
                    {
                        userId: bob.id,
                        amt: 7.99,
                        name: bob.name,
                        email: bob.email
                    }
                ]
            }
        ];

        for (const exp of GROUP_EXPENSES) {
            const expenseId = uid();
            await db.insert(schema.expenses).values({
                id: expenseId,
                amountCents: toCents(exp.amt),
                description: exp.desc,
                date: daysAgo(exp.ago),
                scope: 'group',
                userId: exp.payerId,
                groupId,
                categoryId: categoryId(exp.cat),
                payerNameSnapshot: exp.payerName,
                payerEmailSnapshot: exp.payerEmail
            });

            for (const split of exp.splits) {
                await db.insert(schema.splits).values({
                    id: uid(),
                    expenseId,
                    userId: split.userId,
                    amountCents: toCents(split.amt),
                    userNameSnapshot: split.name,
                    userEmailSnapshot: split.email
                });
            }
        }
        console.log(`  ✓ ${GROUP_EXPENSES.length} group expenses with splits`);
    } else {
        console.log('  · Group expenses already exist');
    }

    // Step 8: Create a settlement
    console.log('\n💳 Creating settlement...');

    const existingSettlement = await db
        .select()
        .from(schema.settlements)
        .where(eq(schema.settlements.groupId, groupId))
        .limit(1);

    if (existingSettlement.length === 0) {
        await db.insert(schema.settlements).values({
            id: uid(),
            fromUserId: bob.id,
            fromUserNameSnapshot: bob.name,
            fromUserEmailSnapshot: bob.email,
            toUserId: alice.id,
            toUserNameSnapshot: alice.name,
            toUserEmailSnapshot: alice.email,
            amountCents: 5_000,
            groupId,
            note: 'Settled up for pizza and cleaning supplies'
        });
        console.log('  ✓ Bob paid Alice $50.00');
    } else {
        console.log('  · Settlement already exists');
    }

    // Step 9: Create a department group with a budget and claim
    console.log('\n🏢 Creating department group...');

    const existingDept = await db
        .select()
        .from(schema.groups)
        .where(eq(schema.groups.name, 'Engineering'))
        .limit(1);

    let deptId: string;

    if (existingDept.length > 0) {
        deptId = existingDept[0].id;
        console.log('  · Engineering department exists');
    } else {
        deptId = uid();
        await db.insert(schema.groups).values({
            id: deptId,
            name: 'Engineering',
            kind: 'department',
            createdBy: alice.id
        });
        console.log('  ✓ Engineering department created');
    }

    // Add alice as member
    const deptMembership = await db
        .select()
        .from(schema.memberships)
        .where(
            sql`${schema.memberships.groupId} = ${deptId} AND ${schema.memberships.userId} = ${alice.id}`
        )
        .limit(1);

    if (deptMembership.length === 0) {
        await db.insert(schema.memberships).values({
            id: uid(),
            groupId: deptId,
            userId: alice.id,
            role: 'admin'
        });
        console.log('  ✓ Alice → admin');
    }

    // Department budget
    const deptBudgetExisting = await db
        .select()
        .from(schema.budgets)
        .where(eq(schema.budgets.groupId, deptId))
        .limit(1);

    if (deptBudgetExisting.length === 0) {
        await db.insert(schema.budgets).values({
            id: uid(),
            categoryId: categoryId('Entertainment'),
            amountCents: 500_000,
            period: 'monthly',
            groupId: deptId,
            userId: alice.id
        });
        console.log('  ✓ Department budget — $5000/month (Entertainment)');
    }

    // Department expense with claim
    const deptExpenseExisting = await db
        .select()
        .from(schema.expenses)
        .where(eq(schema.expenses.groupId, deptId))
        .limit(1);

    if (deptExpenseExisting.length === 0) {
        const claimExpenseId = uid();
        await db.insert(schema.expenses).values({
            id: claimExpenseId,
            amountCents: 120_000,
            description: 'Team offsite — escape room + dinner',
            date: daysAgo(5),
            scope: 'company',
            userId: alice.id,
            groupId: deptId,
            categoryId: categoryId('Entertainment'),
            payerNameSnapshot: alice.name,
            payerEmailSnapshot: alice.email
        });

        await db.insert(schema.claims).values({
            id: uid(),
            expenseId: claimExpenseId,
            status: 'approved',
            reviewerId: alice.id,
            reviewNote: 'Approved — within team budget',
            reviewedAt: daysAgo(4)
        });

        console.log('  ✓ Department expense ($1200) with approved claim');

        // Also add a pending claim
        const pendingExpenseId = uid();
        await db.insert(schema.expenses).values({
            id: pendingExpenseId,
            amountCents: 45_000,
            description: 'Conference registration — ReactConf',
            date: daysAgo(1),
            scope: 'company',
            userId: alice.id,
            groupId: deptId,
            categoryId: categoryId('Entertainment'),
            payerNameSnapshot: alice.name,
            payerEmailSnapshot: alice.email
        });

        await db.insert(schema.claims).values({
            id: uid(),
            expenseId: pendingExpenseId,
            status: 'submitted'
        });

        console.log('  ✓ Pending claim — ReactConf ($450)');
    }

    // ─── Done ────────────────────────────────────────────────────────────────

    console.log('\n✅ Seed complete!');
    console.log(`\nLogin: ${TEST_USERS[0].email} / ${TEST_USERS[0].password}`);
    console.log(`Also:  ${TEST_USERS[1].email} / ${TEST_USERS[1].password}\n`);

    await client.end();
}

main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
});
