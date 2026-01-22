import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/types/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
});
