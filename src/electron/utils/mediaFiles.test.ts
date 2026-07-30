import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { moveMediaFiles } from "./mediaFiles"

const temporaryFolders: string[] = []

afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(temporaryFolders.splice(0).map((folder) => fs.promises.rm(folder, { recursive: true, force: true })))
})

function fileError(code: string, message: string) {
    return Object.assign(new Error(message), { code })
}

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

    it("uses an exclusive copy when a hard link cannot cross filesystems", async () => {
        const { source, destination } = await setup()
        const oldPath = path.join(source, "intro.mp4")
        const newPath = path.join(destination, "intro.mp4")
        await fs.promises.writeFile(oldPath, "video")
        vi.spyOn(fs.promises, "link").mockRejectedValueOnce(fileError("EXDEV", "Cross-device link"))

        const result = await moveMediaFiles({ paths: [oldPath], destination })

        expect(result).toEqual({ moved: [{ oldPath, newPath }], errors: [] })
        await expect(fs.promises.readFile(newPath, "utf8")).resolves.toBe("video")
        await expect(fs.promises.access(oldPath)).rejects.toThrow()
    })

    it("rolls back the destination when the source cannot be removed", async () => {
        const { source, destination } = await setup()
        const oldPath = path.join(source, "playing.mp4")
        const newPath = path.join(destination, "playing.mp4")
        await fs.promises.writeFile(oldPath, "in-use video")
        const unlink = fs.promises.unlink.bind(fs.promises)
        vi.spyOn(fs.promises, "unlink").mockImplementation((filePath) => {
            if (filePath === oldPath) return Promise.reject(fileError("EBUSY", "File is in use"))
            return unlink(filePath)
        })

        const result = await moveMediaFiles({ paths: [oldPath], destination })

        expect(result.moved).toEqual([])
        expect(result.errors).toEqual([{ path: oldPath, error: "File is in use" }])
        await expect(fs.promises.readFile(oldPath, "utf8")).resolves.toBe("in-use video")
        await expect(fs.promises.access(newPath)).rejects.toThrow()
    })

    it("returns one clear error per file when the destination is unavailable", async () => {
        const { source } = await setup()
        const firstPath = path.join(source, "one.mp4")
        const secondPath = path.join(source, "two.mp4")
        await fs.promises.writeFile(firstPath, "one")
        await fs.promises.writeFile(secondPath, "two")

        const result = await moveMediaFiles({
            paths: [firstPath, secondPath],
            destination: path.join(source, "missing")
        })

        expect(result).toEqual({
            moved: [],
            errors: [
                { path: firstPath, error: "Destination folder is unavailable." },
                { path: secondPath, error: "Destination folder is unavailable." }
            ]
        })
        await expect(fs.promises.readFile(firstPath, "utf8")).resolves.toBe("one")
        await expect(fs.promises.readFile(secondPath, "utf8")).resolves.toBe("two")
    })

    it("moves a duplicate selection only once", async () => {
        const { source, destination } = await setup()
        const oldPath = path.join(source, "intro.mp4")
        const newPath = path.join(destination, "intro.mp4")
        await fs.promises.writeFile(oldPath, "video")

        const result = await moveMediaFiles({ paths: [oldPath, oldPath], destination })

        expect(result).toEqual({ moved: [{ oldPath, newPath }], errors: [] })
        await expect(fs.promises.readFile(newPath, "utf8")).resolves.toBe("video")
    })

    it("rejects folders without removing their contents", async () => {
        const { source, destination } = await setup()
        const nestedFile = path.join(source, "keep.txt")
        await fs.promises.writeFile(nestedFile, "keep")

        const result = await moveMediaFiles({ paths: [source], destination })

        expect(result).toEqual({
            moved: [],
            errors: [{ path: source, error: "Source file is unavailable." }]
        })
        await expect(fs.promises.readFile(nestedFile, "utf8")).resolves.toBe("keep")
    })

    it("treats dropping a file into its current folder as a safe no-op", async () => {
        const { source } = await setup()
        const oldPath = path.join(source, "intro.mp4")
        await fs.promises.writeFile(oldPath, "video")

        const result = await moveMediaFiles({ paths: [oldPath], destination: source })

        expect(result).toEqual({ moved: [], errors: [] })
        await expect(fs.promises.readFile(oldPath, "utf8")).resolves.toBe("video")
    })
})
