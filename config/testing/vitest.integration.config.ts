import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    test: {
        include: ["src/**/*.integration.test.ts", "src/electron/cloud/syncManager.test.ts"],
        setupFiles: [fileURLToPath(new URL("./testGuards.ts", import.meta.url))],
        environment: "node",
        fileParallelism: false
    }
})
