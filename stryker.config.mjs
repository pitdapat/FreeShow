/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
    mutate: ["src/electron/cloud/syncLedger.ts", "src/electron/data/backupValidation.ts", "src/electron/IPC/channelValidation.ts", "src/electron/utils/atomicWrite.ts", "src/frontend/components/output/layers/slideContentState.ts"],
    testRunner: "vitest",
    vitest: { configFile: "config/testing/vitest.mutation.config.ts" },
    reporters: ["clear-text", "progress", "json"],
    jsonReporter: { fileName: "test-output/mutation/mutation.json" },
    thresholds: { high: 90, low: 80, break: 80 },
    coverageAnalysis: "off",
    timeoutMS: 15000,
    concurrency: 2
}
