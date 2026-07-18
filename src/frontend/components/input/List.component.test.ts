import { render } from "@testing-library/svelte"
import { describe, expect, it } from "vitest"
import List from "./List.svelte"

describe("List layout boundaries", () => {
    it("does not emit negative or non-finite margins that invert surrounding layout", async () => {
        const view = render(List, { top: -20, bottom: Number.NaN })
        const list = view.container.querySelector(".list")

        expect(list).toHaveStyle({ marginTop: "0px", marginBottom: "0px" })
        expect(list?.getAttribute("style")).not.toMatch(/NaN|:\s*-/)
    })
})
