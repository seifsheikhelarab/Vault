import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

const url = process.env.DATABASE_URL;
if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
}

const client = postgres(url);
const db = drizzle(client, { schema });

const DEFAULT_CATEGORIES = [
    'Food',
    'Transport',
    'Entertainment',
    'Utilities',
    'Health',
    'Shopping'
];

async function seed() {
    console.log('Seeding categories...');
    for (const name of DEFAULT_CATEGORIES) {
        const existing = await db
            .select()
            .from(schema.categories)
            .where(eq(schema.categories.name, name))
            .limit(1);
        if (existing.length === 0) {
            await db.insert(schema.categories).values({
                id: crypto.randomUUID(),
                name
            });
            console.log(`  Created: ${name}`);
        } else {
            console.log(`  Exists: ${name}`);
        }
    }
    console.log('Done.');
    await client.end();
}

seed().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
});
