const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..", "..")
const servers = ["remote", "stage", "controller", "output_stream"]

const sharedInputs = ["src/server/common", "src/server/icon.png", "src/server/sw.js", "src/common", "src/types", "config/building/vite.config.servers.mjs", "config/typescript/tsconfig.server.json", "package.json", "package-lock.json"]

function getNewestModifiedTime(inputPath) {
    if (!fs.existsSync(inputPath)) return 0

    const stats = fs.statSync(inputPath)
    if (!stats.isDirectory()) return stats.mtimeMs

    return fs.readdirSync(inputPath, { withFileTypes: true }).reduce((newest, entry) => {
        const entryPath = path.join(inputPath, entry.name)
        return Math.max(newest, getNewestModifiedTime(entryPath))
    }, stats.mtimeMs)
}

function isServerBuildCurrent(server) {
    const outputDirectory = path.join(root, "build", "electron", server)
    const requiredFiles = ["client.js", "styles.css", "index.html"].map((file) => path.join(outputDirectory, file))
    if (requiredFiles.some((file) => !fs.existsSync(file))) return false

    const generatedFiles = ["client.js", "styles.css"].map((file) => path.join(outputDirectory, file))
    const oldestOutput = Math.min(...generatedFiles.map((file) => fs.statSync(file).mtimeMs))
    const inputs = [...sharedInputs, `src/server/${server}`].map((input) => path.join(root, input))
    const newestInput = Math.max(...inputs.map(getNewestModifiedTime))

    return oldestOutput >= newestInput
}

function getServersNeedingBuild() {
    return servers.filter((server) => !isServerBuildCurrent(server))
}

function getAffectedServers(watchId, filename = "") {
    if (watchId !== "server") return servers

    const firstPathPart = String(filename).replaceAll("\\", "/").split("/")[0]
    return servers.includes(firstPathPart) ? [firstPathPart] : servers
}

module.exports = { getAffectedServers, getServersNeedingBuild, isServerBuildCurrent, root, servers }
