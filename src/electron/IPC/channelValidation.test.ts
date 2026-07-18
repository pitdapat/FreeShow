import { describe, expect, it } from "vitest"
import { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import { classifyMainMessage } from "./channelValidation"

describe("IPC channel validation", () => {
    it.each([undefined, null, {}, { channel: 42 }, { data: "SAVE" }])("rejects malformed messages instead of dereferencing them (%j)", (message) => {
        expect(() => classifyMainMessage(message)).toThrow("Invalid IPC message")
    })

    it("rejects unknown channels rather than silently routing attacker-controlled input", () => {
        expect(() => classifyMainMessage({ channel: "WRITE_ARBITRARY_FILE", data: { path: "secrets" } })).toThrow("Invalid channel")
    })

    it("separates renderer responses from main-process commands", () => {
        expect(classifyMainMessage({ channel: Main.SAVE, data: {} })).toBe("main")
        expect(classifyMainMessage({ channel: ToMain.SAVE2, data: {} })).toBe("renderer-response")
    })
})
