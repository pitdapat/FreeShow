import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it } from "vitest"
import { atomicWriteFileSync, type AtomicWriteOperations } from "./atomicWrite"

const testFolders: string[] = []

function createTestFolder() {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "freeshow-atomic-write-"))
    testFolders.push(folder)
    return folder
}

afterEach(() => {
    for (const folder of testFolders.splice(0)) fs.rmSync(folder, { recursive: true, force: true })
})

describe("atomicWriteFileSync", () => {
    it("preserves the last valid file and removes staged data when commit fails", () => {
        const folder = createTestFolder()
        const destination = path.join(folder, "service.show")
        const original = JSON.stringify(["show-1", { name: "Last valid service", slides: { a: { items: [] } } }])
        fs.writeFileSync(destination, original)
        const operations: AtomicWriteOperations = {
            existsSync: fs.existsSync,
            unlinkSync: fs.unlinkSync,
            writeFileSync: fs.writeFileSync,
            renameSync: () => {
                throw Object.assign(new Error("simulated power loss before commit"), { code: "EIO" })
            }
        }

        expect(() => atomicWriteFileSync(destination, "truncated replacement", operations)).toThrow("simulated power loss")
        expect(fs.readFileSync(destination, "utf8")).toBe(original)
        expect(fs.readdirSync(folder)).toEqual(["service.show"])
    })

    it("never creates a destination when staging fails", () => {
        const folder = createTestFolder()
        const destination = path.join(folder, "new.show")
        const operations: AtomicWriteOperations = {
            existsSync: fs.existsSync,
            renameSync: fs.renameSync,
            unlinkSync: fs.unlinkSync,
            writeFileSync: () => {
                throw Object.assign(new Error("disk full"), { code: "ENOSPC" })
            }
        }

        expect(() => atomicWriteFileSync(destination, "partial", operations)).toThrow("disk full")
        expect(fs.existsSync(destination)).toBe(false)
        expect(fs.readdirSync(folder)).toEqual([])
    })

    it("reports the write failure even when staging cleanup also fails", () => {
        const operations: AtomicWriteOperations = {
            existsSync: () => true,
            renameSync: fs.renameSync,
            unlinkSync: () => {
                throw new Error("cleanup denied")
            },
            writeFileSync: () => {
                throw new Error("primary write failure")
            }
        }

        expect(() => atomicWriteFileSync("ignored.show", "partial", operations)).toThrow("primary write failure")
    })

    it("commits complete Unicode data without leaving staging artifacts", () => {
        const folder = createTestFolder()
        const destination = path.join(folder, "unicode.show")
        fs.writeFileSync(destination, "old")
        const replacement = JSON.stringify(["show-1", { name: "Café 你好 🎵", lyrics: "line 1\nline 2" }])

        atomicWriteFileSync(destination, replacement)

        expect(fs.readFileSync(destination, "utf8")).toBe(replacement)
        expect(fs.readdirSync(folder)).toEqual(["unicode.show"])
    })
})
