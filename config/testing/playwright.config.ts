import { defineConfig } from "@playwright/test"

export default defineConfig({
    testDir: ".",
    testMatch: ["start.test.ts"],
    timeout: 90_000,
    expect: { timeout: 15_000 },
    retries: 0,
    workers: 1,
    forbidOnly: !!process.env.CI,
    outputDir: "../../test-output/playwright-artifacts",
    reporter: process.env.CI ? [["github"], ["html", { outputFolder: "test-output/playwright-report", open: "never" }]] : [["line"]],
    use: {
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
        video: "retain-on-failure"
    }
})
