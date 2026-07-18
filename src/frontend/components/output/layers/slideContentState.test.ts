import { describe, expect, it } from "vitest"
import { getItemRenderKey, hasRealTransition, itemsAreEqual } from "./slideContentState"

describe("slide content transition state", () => {
    it("forces a new Svelte identity when a media item changes render branch", () => {
        const persistentKey = getItemRenderKey(0, true)
        const transitioningKey = getItemRenderKey(0, false)

        expect(persistentKey).toBe("0:persistent")
        expect(transitioningKey).toBe("0:transition")
        expect(transitioningKey).not.toBe(persistentKey)
        expect(new Set([persistentKey, transitioningKey]).size).toBe(2)
    })

    it("does not classify absent, none, or zero-duration transitions as real", () => {
        expect(hasRealTransition(undefined, undefined)).toBe(false)
        expect(hasRealTransition({ type: "none", duration: 500 } as any, undefined)).toBe(false)
        expect(hasRealTransition({ type: "fade", duration: 0 } as any, undefined)).toBe(false)
    })

    it("lets an item transition override a disabled global transition", () => {
        expect(hasRealTransition({ type: "fade", duration: 250 } as any, { type: "none", duration: 0 } as any)).toBe(true)
    })

    it("rejects meaningful content changes and missing items", () => {
        const original = { type: "media", src: "a.mp4", style: "opacity:1" } as any

        expect(itemsAreEqual(original, { ...original, src: "missing.mp4" })).toBe(false)
        expect(itemsAreEqual(original, undefined)).toBe(false)
        expect(itemsAreEqual(undefined, original)).toBe(false)
        expect(itemsAreEqual(undefined, undefined)).toBe(false)
        expect(itemsAreEqual(original, { ...original })).toBe(true)
    })
})
