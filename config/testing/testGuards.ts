import { afterEach, beforeEach, vi } from "vitest"

beforeEach(() => {
    vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("Unexpected network access: tests must explicitly stub fetch")))
    )
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})
