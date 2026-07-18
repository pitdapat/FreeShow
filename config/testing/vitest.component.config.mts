import { svelteTesting } from "@testing-library/svelte/vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { fileURLToPath } from "node:url"
import sveltePreprocess from "svelte-preprocess"
import { defineConfig } from "vitest/config"

export default defineConfig({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    plugins: [
        svelte({
            preprocess: sveltePreprocess({ typescript: { tsconfigFile: "config/typescript/tsconfig.svelte.json" } }),
            compilerOptions: { dev: true }
        }),
        svelteTesting()
    ],
    test: {
        include: ["src/**/*.component.test.ts"],
        setupFiles: [fileURLToPath(new URL("./testGuards.ts", import.meta.url)), fileURLToPath(new URL("./vitest.component.setup.ts", import.meta.url))],
        environment: "jsdom"
    }
})
