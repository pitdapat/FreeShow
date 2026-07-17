import { afterEach, describe, expect, it, vi } from "vitest"
import { UPDATE_RELEASES_API, UPDATE_RELEASES_URL, UPDATE_REPOSITORY } from "../../common/updateSource"

vi.mock("../stores", () => ({
    activePopup: { subscribe: vi.fn() },
    alertUpdates: { subscribe: vi.fn() },
    isDev: { subscribe: vi.fn() },
    popupData: { set: vi.fn() },
    special: { subscribe: vi.fn() }
}))

import { getUpdateData } from "./checkForUpdates"

describe("fork update source", () => {
    afterEach(() => vi.unstubAllGlobals())

    it("targets only the personal FreeShow fork", () => {
        expect(UPDATE_REPOSITORY).toEqual({ owner: "pitdapat", repo: "FreeShow" })
        expect(UPDATE_RELEASES_API).toBe("https://api.github.com/repos/pitdapat/FreeShow/releases")
        expect(UPDATE_RELEASES_URL).toBe("https://github.com/pitdapat/FreeShow/releases")
    })

    it("checks the fork releases and returns the newest published version", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                { draft: false, prerelease: true, tag_name: "v1.6.4-pitdapat.2", body: "Fork update" },
                { draft: false, prerelease: false, tag_name: "v1.6.4-pitdapat.1", body: "Fork release" }
            ]
        })
        vi.stubGlobal("fetch", fetchMock)

        await expect(getUpdateData("1.6.4-pitdapat.1", true)).resolves.toEqual({
            latestVersion: "1.6.4-pitdapat.2",
            changelog: "Fork update",
            hasUpdate: true
        })
        expect(fetchMock).toHaveBeenCalledWith(UPDATE_RELEASES_API)
    })

    it("rejects failed GitHub responses instead of treating them as releases", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }))

        await expect(getUpdateData("1.6.4-pitdapat.1", true)).rejects.toThrow("Could not fetch fork releases: 404")
    })
})
