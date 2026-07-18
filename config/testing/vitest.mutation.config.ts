import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Keep mutation runs restricted to tests that exercise the mutated critical modules.
// Pulling unrelated suites into Stryker's instrumented sandbox adds noise without
// increasing the strength of these fault-injection checks.
export default defineConfig({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    test: {
        include: ["src/electron/cloud/syncLedger.test.ts", "src/electron/data/backupValidation.test.ts", "src/electron/IPC/channelValidation.test.ts", "src/electron/utils/atomicWrite.test.ts", "src/frontend/components/output/layers/slideContentState.test.ts"],
        setupFiles: [fileURLToPath(new URL("./testGuards.ts", import.meta.url))],
        environment: "node"
    }
})
