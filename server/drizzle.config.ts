import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'postgresql',
    schema: ['./src/lib/db/schema.ts', './src/lib/db/auth-schema.ts'],
    out: './drizzle',
    dbCredentials: {
        url: process.env.DATABASE_URL!
    }
});
