import path from "path"

type BackupFile = { name: string; content: string | Buffer }

export type BackupRestoreAction = { kind: "show"; fileName: string; id: string; show: Record<string, unknown> } | { kind: "store"; storeId: string; data: Record<string, unknown> }

export type BackupRestorePlan = { ok: true; actions: BackupRestoreAction[] } | { ok: false; reason: string }

function plainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function safeShowFileName(value: string): string | null {
    const candidate = value.endsWith(".show") ? value : `${value}.show`
    const baseName = path.posix.basename(path.win32.basename(candidate))
    if (!baseName || baseName !== candidate || baseName === ".show" || candidate.includes("\0")) return null
    return baseName
}

function parseShow(value: unknown): { id: string; show: Record<string, unknown> } | null {
    if (!Array.isArray(value) || value.length !== 2) return null
    const [id, show] = value
    if (typeof id !== "string" || !id || !plainObject(show)) return null
    if (show.name !== undefined && typeof show.name !== "string") return null
    return { id, show }
}

export function planBackupRestore(files: BackupFile[], portableStoreIds: string[]): BackupRestorePlan {
    const actions: BackupRestoreAction[] = []
    const storeIds = new Set(portableStoreIds)
    const seenStores = new Set<string>()
    const seenShowFiles = new Set<string>()

    const addShow = (fileNameSource: string, parsed: { id: string; show: Record<string, unknown> }): BackupRestorePlan | null => {
        const fileName = safeShowFileName(fileNameSource)
        if (!fileName) return { ok: false, reason: `Unsafe show filename: ${fileNameSource}` }

        const collisionKey = fileName.toLocaleLowerCase("en-US")
        if (seenShowFiles.has(collisionKey)) return { ok: false, reason: `Conflicting show filename: ${fileName}` }
        seenShowFiles.add(collisionKey)
        actions.push({ kind: "show", fileName, ...parsed })
        return null
    }

    for (const file of files) {
        const normalizedName = file.name.replace(/\\/g, "/")
        const baseName = path.posix.basename(normalizedName)
        const id = baseName.replace(/\.json$/i, "")
        const isSingleShow = normalizedName.startsWith("SHOWS/") && baseName.toLowerCase().endsWith(".show")
        const isShowsCollection = id === "SHOWS_CONTENT"
        const storeId = storeIds.has(id) ? id : null

        if (!isSingleShow && !isShowsCollection && !storeId) continue
        if (typeof file.content !== "string") return { ok: false, reason: `Unsupported binary backup entry: ${file.name}` }

        let parsed: unknown
        try {
            parsed = JSON.parse(file.content)
        } catch {
            return { ok: false, reason: `Malformed JSON in backup entry: ${file.name}` }
        }

        if (isSingleShow) {
            const parsedShow = parseShow(parsed)
            if (!parsedShow) return { ok: false, reason: `Invalid show schema: ${file.name}` }
            const error = addShow(baseName, parsedShow)
            if (error) return error
            continue
        }

        if (isShowsCollection) {
            if (!plainObject(parsed)) return { ok: false, reason: `Invalid shows collection: ${file.name}` }
            for (const [showId, show] of Object.entries(parsed)) {
                if (!showId || !plainObject(show) || (show.name !== undefined && typeof show.name !== "string")) {
                    return { ok: false, reason: `Invalid show in collection: ${showId || "<empty>"}` }
                }
                const error = addShow(String(show.name || showId), { id: showId, show })
                if (error) return error
            }
            continue
        }

        if (!plainObject(parsed)) return { ok: false, reason: `Invalid store schema: ${file.name}` }
        if (seenStores.has(storeId!)) return { ok: false, reason: `Duplicate store entry: ${storeId}` }
        seenStores.add(storeId!)
        actions.push({ kind: "store", storeId: storeId!, data: parsed })
    }

    if (!actions.length) return { ok: false, reason: "Backup contains no supported restorable entries" }
    return { ok: true, actions }
}
