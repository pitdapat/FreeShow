import type { Item, Transition } from "../../../../types/Show"

export function hasRealTransition(itemTransition: Transition | undefined, globalTransition: Transition | undefined) {
    const transition = itemTransition || globalTransition
    return !!transition && transition.type !== "none" && !!transition.duration
}

export function itemsAreEqual(oldItem: Item | undefined, newItem: Item | undefined) {
    if (!oldItem || !newItem) return false
    return JSON.stringify(oldItem) === JSON.stringify(newItem)
}

/** A branch change must remount the item; index-only identity caused the media transition crash. */
export function getItemRenderKey(index: number, persistent: boolean) {
    return `${index}:${persistent ? "persistent" : "transition"}`
}
