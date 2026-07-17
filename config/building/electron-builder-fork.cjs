const fs = require("fs")
const path = require("path")
const yaml = require("js-yaml")

const baseConfigPath = path.join(__dirname, "electron-builder.yaml")
const config = yaml.load(fs.readFileSync(baseConfigPath, "utf8"))

config.win.azureSignOptions = null
config.publish = [
    {
        provider: "github",
        owner: "pitdapat",
        repo: "FreeShow",
        releaseType: "release"
    }
]

module.exports = config
