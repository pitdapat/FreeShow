import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Unit tests live alongside source as *.test.ts under src/.
// The Playwright e2e (config/testing/start.test.ts) is excluded — it uses @playwright/test.
// This config sits in config/testing/, so point the root back at the project root.
export default defineConfig({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    test: {
        include: ["src/**/*.test.ts"],
        exclude: ["src/**/*.component.test.ts", "src/**/*.integration.test.ts", "src/electron/cloud/syncManager.test.ts"],
        setupFiles: [fileURLToPath(new URL("./testGuards.ts", import.meta.url))],
        environment: "node",
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            reportsDirectory: "test-output/coverage",
            include: ["src/electron/cloud/syncLedger.ts", "src/electron/data/backupValidation.ts", "src/electron/IPC/channelValidation.ts", "src/electron/utils/atomicWrite.ts", "src/frontend/components/output/layers/slideContentState.ts"],
            thresholds: {
                lines: 90,
                functions: 90,
                statements: 90,
                branches: 80,
                "src/electron/cloud/syncLedger.ts": { lines: 90, functions: 90, statements: 90, branches: 80 },
                "src/electron/data/backupValidation.ts": { lines: 85, functions: 85, statements: 85, branches: 75 },
                "src/electron/IPC/channelValidation.ts": { lines: 90, functions: 90, statements: 90, branches: 80 },
                "src/electron/utils/atomicWrite.ts": { lines: 90, functions: 90, statements: 90, branches: 80 },
                "src/frontend/components/output/layers/slideContentState.ts": { lines: 90, functions: 90, statements: 90, branches: 80 }
            }
        }
    }
})
