const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")
const { getAffectedServers, root, servers } = require("./serverBuildState")

console.log("Watching server sources (initial builds are skipped when outputs are current)...")

const debounceTimers = new Map()
const runningBuilds = new Map()
const queuedBuilds = new Set()
const watchers = []

function buildServer(server) {
    if (runningBuilds.has(server)) {
        queuedBuilds.add(server)
        return
    }

    console.log(`Server source changed, rebuilding ${server}...`)
    const build = spawn(process.execPath, [path.join(__dirname, "createServerFiles.js"), server], {
        cwd: root,
        stdio: "inherit",
        shell: false,
        env: { ...process.env, NODE_ENV: "development" }
    })

    runningBuilds.set(server, build)
    build.on("close", (code) => {
        runningBuilds.delete(server)
        if (code !== 0) console.error(`${server} rebuild failed with code ${code}`)

        if (queuedBuilds.delete(server)) scheduleBuild(server)
    })
}

function scheduleBuild(server) {
    clearTimeout(debounceTimers.get(server))
    debounceTimers.set(
        server,
        setTimeout(() => {
            debounceTimers.delete(server)
            buildServer(server)
        }, 250)
    )
}

function scheduleAffectedServers(watchId, filename) {
    getAffectedServers(watchId, filename).forEach(scheduleBuild)
}

function watchDirectory(watchId, relativePath) {
    const target = path.join(root, relativePath)
    if (!fs.existsSync(target)) return

    const watcher = fs.watch(target, { recursive: true }, (_event, filename) => scheduleAffectedServers(watchId, filename))
    watcher.on("error", (error) => console.error(`Failed to watch ${relativePath}:`, error))
    watchers.push(watcher)
}

function watchFile(relativePath) {
    const target = path.join(root, relativePath)
    if (!fs.existsSync(target)) return

    const watcher = fs.watch(target, () => servers.forEach(scheduleBuild))
    watcher.on("error", (error) => console.error(`Failed to watch ${relativePath}:`, error))
    watchers.push(watcher)
}

watchDirectory("server", "src/server")
watchDirectory("shared", "src/common")
watchDirectory("shared", "src/types")
watchFile("config/building/vite.config.servers.mjs")
watchFile("config/typescript/tsconfig.server.json")
watchFile("package.json")
watchFile("package-lock.json")

function shutdown() {
    watchers.forEach((watcher) => watcher.close())
    debounceTimers.forEach(clearTimeout)
    runningBuilds.forEach((process) => process.kill())
    process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
