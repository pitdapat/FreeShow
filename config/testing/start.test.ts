import { _electron as electron, type ElectronApplication, type Page } from "playwright"
import { expect, test, type TestInfo } from "@playwright/test"
import fs from "fs"
import os from "os"
import path from "path"

type TestApp = {
    app: ElectronApplication
    page: Page
    dataPath: string
    settingsPath: string
    errors: string[]
    networkAttempts: string[]
}

const testRoots: string[] = []
const activeApps = new Set<ElectronApplication>()
const isolatedBoundaryUrls = new Set(["https://raw.githack.com/googlefonts/noto-emoji/main/fonts/NotoColorEmoji.ttf", "https://churchapps.github.io/VotdContent/v1/verses.json", "https://api.github.com/repos/pitdapat/FreeShow/releases"])

function createFolder(prefix: string) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
    testRoots.push(folder)
    return folder
}

async function launch(settingsPath: string, dataPath: string, testInfo: TestInfo): Promise<TestApp> {
    const app = await electron.launch({
        args: ["--disable-gpu", "."],
        env: { ...process.env, NODE_ENV: "production", FS_MOCK_STORE_PATH: settingsPath },
        timeout: 30000
    })
    activeApps.add(app)
    const errors: string[] = []
    const networkAttempts: string[] = []
    const page = await waitForMainWindow(app)

    await page.route(/^https?:\/\//, (route) => {
        const url = route.request().url()
        if (!isolatedBoundaryUrls.has(url)) networkAttempts.push(url)
        return route.fulfill({ status: 204, body: "" })
    })
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.stack || error.message}`))
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console.error: ${message.text()}`)
    })

    await app.evaluate(async ({ dialog }, folder) => {
        dialog.showOpenDialogSync = () => [folder]
    }, dataPath)

    await page.locator('main[data-app-ready="true"]').waitFor()
    await initializeIfNeeded(page)
    await testInfo.attach("runtime-paths", { body: JSON.stringify({ settingsPath, dataPath }, null, 2), contentType: "application/json" })
    return { app, page, dataPath, settingsPath, errors, networkAttempts }
}

async function waitForMainWindow(app: ElectronApplication) {
    await expect.poll(() => app.windows().find((window) => window.url().includes("index.html")), { message: "main window did not replace the splash screen" }).toBeTruthy()
    return app.windows().find((window) => window.url().includes("index.html"))!
}

async function initializeIfNeeded(page: Page) {
    const getStarted = page.getByRole("button", { name: "Get started", exact: false })
    if (!(await getStarted.count())) return

    await page.getByRole("button", { name: "Language", exact: false }).click()
    await page.getByRole("option", { name: /English$/ }).click()
    await page.getByRole("button", { name: "Data location", exact: false }).click()
    await getStarted.click()

    const skipGuide = page.getByRole("button", { name: "Skip", exact: true })
    await expect(skipGuide).toBeVisible()
    await skipGuide.click()
}

async function close(testApp: TestApp) {
    await forceClose(testApp.app)
    activeApps.delete(testApp.app)
    expect(testApp.errors, testApp.errors.join("\n")).toEqual([])
    expect(testApp.networkAttempts, `unexpected network access:\n${testApp.networkAttempts.join("\n")}`).toEqual([])
}

async function forceClose(app: ElectronApplication) {
    const process = app.process()
    await Promise.race([app.evaluate(({ app }) => app.exit(0)).catch(() => {}), new Promise((resolve) => setTimeout(resolve, 3000))])
    if (process.exitCode === null) {
        await Promise.race([new Promise((resolve) => process.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 5000))])
    }
    if (process.exitCode === null) process.kill()
    if (process.exitCode === null) {
        await Promise.race([new Promise((resolve) => process.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 5000))])
    }
}

test.afterEach(async () => {
    for (const app of activeApps) await forceClose(app)
    activeApps.clear()
    for (const root of testRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })
})

test("empty creation is rejected, then valid show survives a full application restart", async ({}, testInfo) => {
    const settingsPath = createFolder("freeshow-e2e-settings-")
    const dataPath = createFolder("freeshow-e2e-data-")
    let testApp = await launch(settingsPath, dataPath, testInfo)
    const showsPath = path.join(dataPath, "Shows")
    const showFiles = () => (fs.existsSync(showsPath) ? fs.readdirSync(showsPath).filter((file) => file.endsWith(".show")) : [])

    await testApp.page.getByText("New project").first().click()
    await testApp.page.getByText("New show").first().click()
    expect(showFiles()).not.toContain("Restart Proof.show")

    await testApp.page.getByLabel("Name", { exact: true }).fill("Restart Proof")
    await testApp.page.getByText("Quick Lyrics").click()
    const createButton = testApp.page.getByTestId("create.show.popup.new.show")
    await expect(createButton).toBeDisabled()
    expect(showFiles()).not.toContain("Restart Proof.show")

    await testApp.page.getByLabel(/quick lyrics/i).fill("[Verse]\nfirst line\nsecond line\n\n[Chorus]\nnever lose me")
    await createButton.click()
    await testApp.page.keyboard.press("Control+s")

    const showPath = path.join(showsPath, "Restart Proof.show")
    await expect.poll(() => (fs.existsSync(showPath) ? fs.readFileSync(showPath, "utf8") : "")).toContain("never lose me")
    const persistedBeforeRestart = fs.readFileSync(showPath, "utf8")
    await close(testApp)

    testApp = await launch(settingsPath, dataPath, testInfo)
    await expect(testApp.page.getByText("Restart Proof").first()).toBeVisible()
    expect(fs.readFileSync(showPath, "utf8")).toBe(persistedBeforeRestart)
    await close(testApp)
})

test("the plus button in the left Shows drawer creates a persisted show", async ({}, testInfo) => {
    const settingsPath = createFolder("freeshow-e2e-settings-")
    const dataPath = createFolder("freeshow-e2e-data-")
    const testApp = await launch(settingsPath, dataPath, testInfo)

    const drawerAddShow = testApp.page.locator('.drawer button[data-title*="Create a new show"]')
    await expect(drawerAddShow).toHaveCount(1)
    await expect(drawerAddShow).toBeVisible()
    await drawerAddShow.click()

    await testApp.page.getByLabel("Name", { exact: true }).fill("Left Drawer Proof")
    await testApp.page.getByText("Quick Lyrics").click()
    await testApp.page.getByLabel(/quick lyrics/i).fill("[Verse]\ncreated from the left drawer")
    await testApp.page.getByTestId("create.show.popup.new.show").click()

    await expect(testApp.page.getByText("Left Drawer Proof", { exact: true }).first()).toBeVisible()
    await testApp.page.keyboard.press("Control+s")
    const showPath = path.join(dataPath, "Shows", "Left Drawer Proof.show")
    await expect.poll(() => (fs.existsSync(showPath) ? fs.readFileSync(showPath, "utf8") : "")).toContain("created from the left drawer")
    await close(testApp)
})

test("a truncated show cannot crash startup or be silently overwritten", async ({}, testInfo) => {
    const settingsPath = createFolder("freeshow-e2e-settings-")
    const dataPath = createFolder("freeshow-e2e-data-")
    let testApp = await launch(settingsPath, dataPath, testInfo)
    await close(testApp)

    const showsPath = path.join(dataPath, "Shows")
    fs.mkdirSync(showsPath, { recursive: true })
    const corruptPath = path.join(showsPath, "Corrupt.show")
    const corruptBytes = '["show-corrupt", {"name":"Corrupt","slides":'
    fs.writeFileSync(corruptPath, corruptBytes)

    testApp = await launch(settingsPath, dataPath, testInfo)
    await expect(testApp.page.locator('main[data-app-ready="true"]')).toBeVisible()
    await expect(testApp.page.getByText("Corrupt", { exact: true })).toHaveCount(0)
    expect(fs.readFileSync(corruptPath, "utf8")).toBe(corruptBytes)
    await close(testApp)
})

test("a partially valid damaged backup is rejected without replacing existing data", async ({}, testInfo) => {
    const settingsPath = createFolder("freeshow-e2e-settings-")
    const dataPath = createFolder("freeshow-e2e-data-")
    const backupPath = createFolder("freeshow-e2e-damaged-backup-")
    const testApp = await launch(settingsPath, dataPath, testInfo)

    const welcomePath = path.join(dataPath, "Shows", "Welcome.show")
    await expect.poll(() => fs.existsSync(welcomePath)).toBe(true)
    const validBeforeRestore = fs.readFileSync(welcomePath, "utf8")
    const [welcomeId, welcomeShow] = JSON.parse(validBeforeRestore)
    fs.writeFileSync(path.join(backupPath, "SHOWS_CONTENT.json"), JSON.stringify({ [welcomeId]: { ...welcomeShow, forbiddenRestoreMarker: "must never commit" } }))
    fs.writeFileSync(path.join(backupPath, "SETTINGS.json"), '{"language":"en"')

    await testApp.page.evaluate(({ backupPath }) => (window as any).api.send("MAIN", { channel: "RESTORE", data: { path: backupPath } }), { backupPath })

    await expect(testApp.page.getByText(/Backup restore rejected: Malformed JSON in backup entry: SETTINGS\.json/)).toBeVisible()
    expect(fs.readFileSync(welcomePath, "utf8")).toBe(validBeforeRestore)
    expect(fs.readFileSync(welcomePath, "utf8")).not.toContain("forbiddenRestoreMarker")
    await close(testApp)
})
