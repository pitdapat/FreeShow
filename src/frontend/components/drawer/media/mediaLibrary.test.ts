import type { FileFolder } from "../../../../types/Main"
import { describe, expect, it } from "vitest"
import { getAllMediaRootFolders, getAllMediaSearchResults, getRecursiveMediaFiles, isPathInsideRoot } from "./mediaLibrary"

const stats = {} as any
const contents: FileFolder[] = [
    {
        isFolder: true,
        path: "D:\\Media",
        name: "Media",
        files: ["D:\\Media\\2026"]
    },
    {
        isFolder: true,
        path: "D:\\Media\\2026",
        name: "2026",
        files: ["D:\\Media\\2026\\Worship"]
    },
    {
        isFolder: true,
        path: "D:\\Media\\2026\\Worship",
        name: "Worship",
        files: ["D:\\Media\\2026\\Worship\\intro.mp4"]
    },
    {
        isFolder: false,
        path: "D:\\Media\\2026\\Worship\\intro.mp4",
        name: "intro.mp4",
        stats
    },
    {
        isFolder: false,
        path: "D:\\Other\\unrelated.mp4",
        name: "unrelated.mp4",
        stats
    }
]

describe("All Media folder organization", () => {
    it("shows registered library roots instead of flattening nested folders", () => {
        expect(getAllMediaRootFolders(contents, ["D:\\Media"]).map((item) => item.path)).toEqual(["D:\\Media"])
    })

    it("keeps deeply nested media available to the optional flat view and search", () => {
        expect(getRecursiveMediaFiles(contents, ["D:\\Media"]).map((item) => item.path)).toEqual(["D:\\Media\\2026\\Worship\\intro.mp4"])
    })

    it("keeps library roots navigable while returning nested search matches", () => {
        expect(getAllMediaSearchResults(contents, ["D:\\Media"], "INTRO").map((item) => item.path)).toEqual(["D:\\Media", "D:\\Media\\2026\\Worship\\intro.mp4"])
    })

    it("uses path boundaries instead of matching similarly named folders", () => {
        expect(isPathInsideRoot("D:\\Media Archive\\clip.mp4", "D:\\Media")).toBe(false)
        expect(isPathInsideRoot("/mnt/media/2026/clip.mp4", "/mnt/media")).toBe(true)
    })
})
