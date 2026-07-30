export type NestedNavigationItem<T> = T & { treeChildren: NestedNavigationItem<T>[] }

export function nestNavigationItems<T extends { id: string; parent?: string | null }>(items: T[]): NestedNavigationItem<T>[] {
    const ids = new Set(items.map((item) => item.id))
    const childrenByParent = new Map<string, T[]>()
    const roots: T[] = []

    items.forEach((item) => {
        const parent = item.parent
        if (!parent || parent === item.id || !ids.has(parent)) {
            roots.push(item)
            return
        }

        childrenByParent.set(parent, [...(childrenByParent.get(parent) || []), item])
    })

    const visited = new Set<string>()
    const build = (item: T, ancestors = new Set<string>()): NestedNavigationItem<T> => {
        visited.add(item.id)
        const nextAncestors = new Set(ancestors).add(item.id)
        const children = (childrenByParent.get(item.id) || []).filter((child) => !nextAncestors.has(child.id))
        return { ...item, treeChildren: children.map((child) => build(child, nextAncestors)) }
    }

    const tree = roots.map((item) => build(item))

    // Recover gracefully from legacy/corrupt cycles instead of hiding categories.
    items.filter((item) => !visited.has(item.id)).forEach((item) => tree.push(build(item)))
    return tree
}

export function wouldCreateNavigationCycle<T extends { parent?: string | null }>(items: Record<string, T>, movingIds: string[], targetId: string | null) {
    if (!targetId) return false

    const moving = new Set(movingIds)
    const visited = new Set<string>()
    let current: string | null = targetId

    while (current && !visited.has(current)) {
        if (moving.has(current)) return true
        visited.add(current)
        current = items[current]?.parent || null
    }

    return false
}

export function countNestedNavigationItems<T extends { parent?: string | null }>(items: Record<string, T>, directCounts: Record<string, number>, categoryId: string) {
    const visited = new Set<string>()

    function count(id: string): number {
        if (visited.has(id)) return 0
        visited.add(id)

        const childIds = Object.keys(items).filter((itemId) => items[itemId]?.parent === id)
        return (directCounts[id] || 0) + childIds.reduce((total, childId) => total + count(childId), 0)
    }

    return count(categoryId)
}
