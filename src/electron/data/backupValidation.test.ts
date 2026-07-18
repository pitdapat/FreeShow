import { describe, expect, it } from "vitest"
import { planBackupRestore } from "./backupValidation"

const stores = ["SETTINGS", "PROJECTS"]
const validShow = JSON.stringify(["show-1", { name: "Service", slides: {} }])

describe("backup restore preflight", () => {
    it.each([
        ["truncated JSON", [{ name: "SHOWS/Service.show", content: validShow.slice(0, -2) }], "Malformed JSON"],
        ["wrong show schema", [{ name: "SHOWS/Service.show", content: JSON.stringify({ name: "Service" }) }], "Invalid show schema"],
        ["binary supported entry", [{ name: "SETTINGS.json", content: Buffer.from("binary") }], "Unsupported binary"],
        ["unsupported-only archive", [{ name: "readme.txt", content: "nothing restorable" }], "no supported"],
        ["ambiguous store filename", [{ name: "EVIL_SETTINGS.json", content: "{}" }], "no supported"],
        ["non-show file in shows folder", [{ name: "SHOWS/readme.txt", content: validShow }], "no supported"],
        ["array store payload", [{ name: "SETTINGS.json", content: "[]" }], "Invalid store schema"],
        ["null store payload", [{ name: "SETTINGS.json", content: "null" }], "Invalid store schema"]
    ])("rejects %s before producing any restore actions", (_case, files, reason) => {
        const result = planBackupRestore(files, stores)

        expect(result).toEqual({ ok: false, reason: expect.stringContaining(reason) })
    })

    it.each([
        ["short tuple", ["show-1"]],
        ["long tuple", ["show-1", { name: "Service" }, "extra"]],
        ["empty id", ["", { name: "Service" }]],
        ["non-string id", [42, { name: "Service" }]],
        ["null show", ["show-1", null]],
        ["array show", ["show-1", []]],
        ["non-string name", ["show-1", { name: 42 }]]
    ])("rejects malformed single-show %s", (_case, payload) => {
        const result = planBackupRestore([{ name: "SHOWS/Service.show", content: JSON.stringify(payload) }], stores)

        expect(result).toEqual({ ok: false, reason: expect.stringContaining("Invalid show schema") })
    })

    it.each([
        ["empty id", { "": { name: "Service" } }],
        ["null show", { id: null }],
        ["array show", { id: [] }],
        ["non-string name", { id: { name: 42 } }]
    ])("rejects malformed aggregate-show %s", (_case, payload) => {
        const result = planBackupRestore([{ name: "SHOWS_CONTENT.json", content: JSON.stringify(payload) }], stores)

        expect(result).toEqual({ ok: false, reason: expect.stringContaining("Invalid show in collection") })
    })

    it("rejects an empty destination show filename", () => {
        const result = planBackupRestore([{ name: "SHOWS/.show", content: validShow }], stores)

        expect(result).toEqual({ ok: false, reason: expect.stringContaining("Unsafe show filename") })
    })

    it.each(["../escaped", "folder/escaped", "..\\escaped", "C:\\escaped"])("rejects traversal-derived aggregate show name %s", (name) => {
        const result = planBackupRestore([{ name: "SHOWS_CONTENT.json", content: JSON.stringify({ id: { name, slides: {} } }) }], stores)

        expect(result).toEqual({ ok: false, reason: expect.stringContaining("Unsafe show filename") })
    })

    it("rejects case-insensitive show collisions instead of overwriting one entry", () => {
        const result = planBackupRestore(
            [
                { name: "SHOWS/Service.show", content: validShow },
                { name: "SHOWS/service.show", content: JSON.stringify(["show-2", { name: "Other", slides: {} }]) }
            ],
            stores
        )

        expect(result).toEqual({ ok: false, reason: expect.stringContaining("Conflicting show filename") })
    })

    it("rejects duplicate stores so archive order cannot silently choose a winner", () => {
        const result = planBackupRestore(
            [
                { name: "SETTINGS.json", content: JSON.stringify({ language: "en" }) },
                { name: "folder/SETTINGS.json", content: JSON.stringify({ language: "fr" }) }
            ],
            stores
        )

        expect(result).toEqual({ ok: false, reason: expect.stringContaining("Duplicate store entry") })
    })

    it("produces semantic actions only after every recognized entry passes preflight", () => {
        const result = planBackupRestore(
            [
                { name: "SHOWS/Service.show", content: validShow },
                { name: "SETTINGS.json", content: JSON.stringify({ language: "en", dataPath: "must-not-be-restored" }) },
                { name: "notes.txt", content: "ignored unsupported content" }
            ],
            stores
        )

        expect(result).toEqual({
            ok: true,
            actions: [
                { kind: "show", fileName: "Service.show", id: "show-1", show: { name: "Service", slides: {} } },
                { kind: "store", storeId: "SETTINGS", data: { language: "en", dataPath: "must-not-be-restored" } }
            ]
        })
    })

    it("derives a safe filename and complete action from an aggregate show without a name", () => {
        const result = planBackupRestore([{ name: "SHOWS_CONTENT.json", content: JSON.stringify({ fallbackId: { slides: { a: { items: [] } } } }) }], stores)

        expect(result).toEqual({
            ok: true,
            actions: [{ kind: "show", fileName: "fallbackId.show", id: "fallbackId", show: { slides: { a: { items: [] } } } }]
        })
    })
})
