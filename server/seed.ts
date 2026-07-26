import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./src/lib/db/schema";
import { eq } from "drizzle-orm";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const client = postgres(url);
const db = drizzle(client, { schema });

const DEFAULT_CATEGORIES = [
  { name: "Food", icon: "🍕" },
  { name: "Transport", icon: "🚗" },
  { name: "Entertainment", icon: "🎬" },
  { name: "Utilities", icon: "💡" },
  { name: "Health", icon: "💪" },
  { name: "Shopping", icon: "🛍️" },
];

async function seed() {
  console.log("Seeding categories...");
  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.name, cat.name))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(schema.categories).values({
        id: crypto.randomUUID(),
        name: cat.name,
        icon: cat.icon,
      });
      console.log(`  Created: ${cat.name}`);
    } else {
      console.log(`  Exists: ${cat.name}`);
    }
  }
  console.log("Done.");
  await client.end();
}

seed().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
