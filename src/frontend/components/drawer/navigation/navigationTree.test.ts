import { describe, expect, it } from "vitest"
import { countNestedNavigationItems, nestNavigationItems, wouldCreateNavigationCycle } from "./navigationTree"

describe("navigation hierarchy", () => {
    const categories = {
        worship: { name: "Worship" },
        youth: { name: "Youth", parent: "worship" },
        camp: { name: "Camp", parent: "youth" }
    }

    it("builds nested categories while preserving root order", () => {
        const tree = nestNavigationItems(Object.entries(categories).map(([id, item]) => ({ id, ...item })))

        expect(tree.map((item) => item.id)).toEqual(["worship"])
        expect(tree[0].treeChildren[0].id).toBe("youth")
        expect(tree[0].treeChildren[0].treeChildren[0].id).toBe("camp")
    })

    it("prevents moving a category into itself or a descendant", () => {
        expect(wouldCreateNavigationCycle(categories, ["worship"], "camp")).toBe(true)
        expect(wouldCreateNavigationCycle(categories, ["youth"], "youth")).toBe(true)
        expect(wouldCreateNavigationCycle(categories, ["camp"], "worship")).toBe(false)
    })

    it("includes descendants in folder counts", () => {
        expect(countNestedNavigationItems(categories, { worship: 2, youth: 3, camp: 4 }, "worship")).toBe(9)
    })

    it("does not hide malformed cyclic data", () => {
        const tree = nestNavigationItems([
            { id: "one", parent: "two" },
            { id: "two", parent: "one" }
        ])

        expect(tree.length).toBeGreaterThan(0)
        expect(new Set(tree.map((item) => item.id))).toContain("one")
    })
})
