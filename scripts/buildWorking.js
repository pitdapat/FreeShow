const { createHash } = require("crypto")
const { spawnSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..")
const statePath = path.join(root, "dist", ".working-build-state.json")
const productionIndex = '<script type="module" crossorigin src="./build/bundle.js"></script><link rel="stylesheet" href="./build/bundle.css">'
const developmentIndex = '<script type="module" src="/src/frontend/main.ts"></script>'
const servers = ["remote", "stage", "controller", "output_stream"]
const generatedConfigs = ["svelte", "electron", "server"].map((id) => path.join(root, "config", "typescript", `tsconfig.${id}.prod.json`))

const inputGroups = {
    frontend: ["src/frontend", "src/common", "src/types", "vite.config.mjs", "config/typescript/tsconfig.svelte.json", "src/frontend/tsconfig.json"],
    electron: ["src/electron", "src/common", "src/types", "config/typescript/tsconfig.electron.json", "src/electron/tsconfig.json"],
    forceFull: ["package.json", "package-lock.json", "scripts/buildWorking.js", "scripts/preBuild.js", "scripts/postBuild.js", "vite.config.mjs", "config/building/vite.config.servers.mjs", "config/building/electron-builder.yaml", "config/building/electron-builder-fork.cjs", "config/typescript/tsconfig.svelte.json", "config/typescript/tsconfig.server.json", "config/typescript/tsconfig.electron.json", "src/frontend/tsconfig.json", "src/electron/tsconfig.json"],
    native: ["package-lock.json", "node_modules/electron/package.json"]
}

const serverSharedInputs = ["src/server/common", "src/server/icon.png", "src/server/sw.js", "src/common", "src/types", "config/building/vite.config.servers.mjs", "config/typescript/tsconfig.server.json"]

function listFiles(inputPath) {
    const absolutePath = path.join(root, inputPath)
    if (!fs.existsSync(absolutePath)) return []

    const stats = fs.statSync(absolutePath)
    if (!stats.isDirectory()) return [absolutePath]

    return fs
        .readdirSync(absolutePath, { withFileTypes: true })
        .flatMap((entry) => listFiles(path.join(inputPath, entry.name)))
        .filter((file) => !file.endsWith(".test.ts"))
}

function hashInputs(inputs) {
    const hash = createHash("sha256")
    const files = [...new Set(inputs.flatMap(listFiles))].sort()

    files.forEach((file) => {
        hash.update(path.relative(root, file).replaceAll("\\", "/"))
        hash.update(fs.readFileSync(file))
    })

    return hash.digest("hex")
}

function getCurrentState() {
    return {
        version: 1,
        frontend: hashInputs(inputGroups.frontend),
        electron: hashInputs(inputGroups.electron),
        forceFull: hashInputs(inputGroups.forceFull),
        native: hashInputs(inputGroups.native),
        servers: Object.fromEntries(servers.map((server) => [server, hashInputs([...serverSharedInputs, `src/server/${server}`])]))
    }
}

function readPreviousState() {
    if (!fs.existsSync(statePath)) return null

    try {
        return JSON.parse(fs.readFileSync(statePath, "utf8"))
    } catch (error) {
        console.warn("Working-build cache is unreadable; a full build will be used.", error)
        return null
    }
}

function requiredOutputsExist() {
    const outputs = ["public/build/bundle.js", "public/build/bundle.css", "build/electron/index.js", "build/public/icon.png", ...servers.flatMap((server) => [`build/electron/${server}/client.js`, `build/electron/${server}/styles.css`, `build/electron/${server}/index.html`])]

    return outputs.every((output) => fs.existsSync(path.join(root, output)))
}

function createPlan(previous, current) {
    if (!previous || previous.version !== current.version || previous.forceFull !== current.forceFull || !requiredOutputsExist()) {
        return { full: true, frontend: true, electron: true, servers: [...servers], rebuildNative: true }
    }

    return {
        full: false,
        frontend: previous.frontend !== current.frontend,
        electron: previous.electron !== current.electron,
        servers: servers.filter((server) => previous.servers?.[server] !== current.servers[server]),
        rebuildNative: previous.native !== current.native
    }
}

function run(command, args, extraEnv = {}) {
    console.log(`\n> ${command} ${args.join(" ")}`)
    const useWindowsShell = process.platform === "win32" && ["npm", "npx"].includes(command)
    const result = spawnSync(command, args, {
        cwd: root,
        stdio: "inherit",
        shell: useWindowsShell,
        env: { ...process.env, ...extraEnv }
    })

    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`)
}

function ensureWorkingCopyIsClosed() {
    if (process.platform !== "win32") return

    const result = spawnSync("tasklist", ["/FI", "IMAGENAME eq FreeShow.exe", "/FO", "CSV", "/NH"], { encoding: "utf8" })
    if (result.status === 0 && /^"FreeShow\.exe"/im.test(result.stdout || "")) {
        throw new Error("FreeShow.exe is running. Close the installed or working copy before replacing dist\\win-unpacked.")
    }
}

function ensureProductionConfigs() {
    run(process.execPath, ["scripts/preBuild.js"], { NODE_ENV: "production", FREESHOW_INCREMENTAL_BUILD: "1" })
}

function cleanFrontendOutput() {
    fs.rmSync(path.join(root, "public", "build"), { recursive: true, force: true })
}

function cleanElectronOutput() {
    const electronOutput = path.join(root, "build", "electron")
    if (fs.existsSync(electronOutput)) {
        fs.readdirSync(electronOutput).forEach((entry) => {
            if (!servers.includes(entry)) fs.rmSync(path.join(electronOutput, entry), { recursive: true, force: true })
        })
    }

    fs.rmSync(path.join(root, "build", "types"), { recursive: true, force: true })
}

function removeProductionConfigs() {
    generatedConfigs.forEach((config) => {
        if (fs.existsSync(config)) fs.unlinkSync(config)
    })
}

function writeState(state) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true })
    fs.writeFileSync(statePath, JSON.stringify({ ...state, builtAt: new Date().toISOString() }, null, 2) + "\n")
}

function describePlan(plan) {
    if (plan.full) return "full production build (cache missing or build inputs changed)"

    const groups = []
    if (plan.frontend) groups.push("frontend")
    if (plan.electron) groups.push("Electron")
    if (plan.servers.length) groups.push(`servers: ${plan.servers.join(", ")}`)
    return groups.length ? groups.join("; ") : "no compiled groups; package only"
}

async function main() {
    const currentState = getCurrentState()

    if (process.argv.includes("--initialize-cache")) {
        if (!requiredOutputsExist()) throw new Error("Cannot initialize the cache because required production outputs are missing.")
        writeState(currentState)
        console.log(`Initialized working-build cache at ${statePath}`)
        return
    }

    const plan = createPlan(readPreviousState(), currentState)
    console.log(`Fast working-build plan: ${describePlan(plan)}`)
    if (process.argv.includes("--plan")) return

    ensureWorkingCopyIsClosed()

    const indexPath = path.join(root, "public", "index.html")
    const originalIndex = fs.readFileSync(indexPath, "utf8")
    if (!originalIndex.includes(developmentIndex) && !originalIndex.includes(productionIndex)) throw new Error("public/index.html contains an unknown script configuration.")

    try {
        if (plan.full) {
            run("npm", ["run", "build"])
        } else {
            const needsCompilation = plan.frontend || plan.electron || plan.servers.length
            if (needsCompilation) ensureProductionConfigs()
            if (plan.frontend) {
                cleanFrontendOutput()
                run("npx", ["vite", "build"], { NODE_ENV: "production" })
            }
            if (plan.servers.length) run(process.execPath, ["scripts/vite/createServerFiles.js", ...plan.servers], { NODE_ENV: "production" })
            if (plan.electron) {
                cleanElectronOutput()
                run("npx", ["tsc", "--p", "config/typescript/tsconfig.electron.prod.json"], { NODE_ENV: "production" })
            }
        }

        let productionHtml = fs.readFileSync(indexPath, "utf8")
        productionHtml = productionHtml.replace(developmentIndex, productionIndex)
        fs.writeFileSync(indexPath, productionHtml)

        const packageEnvironment = plan.rebuildNative ? {} : { FREESHOW_SKIP_NPM_REBUILD: "1" }
        run("npx", ["electron-builder", "--config", "config/building/electron-builder-fork.cjs", "--dir", "--win", "--x64", "--publish", "never"], packageEnvironment)

        const executable = path.join(root, "dist", "win-unpacked", "FreeShow.exe")
        if (!fs.existsSync(executable)) throw new Error("Packaging completed without dist\\win-unpacked\\FreeShow.exe")

        writeState(getCurrentState())
        console.log(`\nWorking build ready: ${executable}`)
    } finally {
        fs.writeFileSync(indexPath, originalIndex)
        removeProductionConfigs()
    }
}

main().catch((error) => {
    console.error("\nFast working build failed:", error.message || error)
    process.exitCode = 1
})
