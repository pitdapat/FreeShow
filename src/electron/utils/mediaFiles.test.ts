import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it } from "vitest"
import { moveMediaFiles } from "./mediaFiles"

const temporaryFolders: string[] = []

afterEach(async () => {
    await Promise.all(temporaryFolders.splice(0).map((folder) => fs.promises.rm(folder, { recursive: true, force: true })))
})

async function setup() {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "freeshow-media-move-"))
    temporaryFolders.push(root)
    const source = path.join(root, "source")
    const destination = path.join(root, "destination")
    await fs.promises.mkdir(source)
    await fs.promises.mkdir(destination)
    return { source, destination }
}

describe("moveMediaFiles", () => {
    it("moves a media file into a subfolder without changing its name", async () => {
        const { source, destination } = await setup()
        const oldPath = path.join(source, "intro.mp4")
        const newPath = path.join(destination, "intro.mp4")
        await fs.promises.writeFile(oldPath, "video")

        const result = await moveMediaFiles({ paths: [oldPath], destination })

        expect(result).toEqual({ moved: [{ oldPath, newPath }], errors: [] })
        await expect(fs.promises.readFile(newPath, "utf8")).resolves.toBe("video")
        await expect(fs.promises.access(oldPath)).rejects.toThrow()
    })

    it("does not overwrite an existing file with the same name", async () => {
        const { source, destination } = await setup()
        const oldPath = path.join(source, "intro.mp4")
        const existingPath = path.join(destination, "intro.mp4")
        await fs.promises.writeFile(oldPath, "new")
        await fs.promises.writeFile(existingPath, "existing")

        const result = await moveMediaFiles({ paths: [oldPath], destination })

        expect(result.moved).toEqual([])
        expect(result.errors[0]?.path).toBe(oldPath)
        await expect(fs.promises.readFile(existingPath, "utf8")).resolves.toBe("existing")
        await expect(fs.promises.readFile(oldPath, "utf8")).resolves.toBe("new")
    })
})
