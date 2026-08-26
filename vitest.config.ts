import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Prisma's workerd-runtime client imports its query compiler as
 * `./query_compiler_fast_bg.wasm?module` (a wrangler convention whose default
 * export is a WebAssembly.Module). Node/vitest cannot parse that import, so
 * resolve it here by reading and compiling the wasm at module-eval time.
 */
function wasmModule(): Plugin {
    return {
        name: 'wasm?module',
        enforce: 'pre',
        load(id) {
            if (!id.endsWith('.wasm?module')) return null;
            const file = id.slice(0, -'?module'.length);
            const code =
                `import { readFileSync } from 'node:fs';\n` +
                `export default new WebAssembly.Module(readFileSync(${JSON.stringify(file)}));`;
            return { code, map: null };
        },
    };
}

export default defineConfig({
    plugins: [wasmModule()],
    test: {
        globalSetup: './src/test/global-setup.ts',
        pool: 'forks', // each worker is a separate process; DB shared, truncate between tests
        // Workers share one database and truncateAll wipes everything between
        // tests, so parallel files truncate each other's rows mid-request.
        // Serialize until per-worker schemas/databases exist.
        fileParallelism: false,
        // Multi-request integration tests (signup hashing + N authed roundtrips)
        // blow past the 5s default on slower machines before finishing setup().
        testTimeout: 30_000,
    },
});
