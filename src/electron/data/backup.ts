import fs from "fs"
import path from "path"
import { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import type { SaveActions } from "../../types/Save"
import { sendMain, sendToMain } from "../IPC/main"
import { deleteFile, deleteFolder, doesPathExist, getDataFolderPath, getFileStats, getTimePointString, loadShows, makeDir, openInSystem, readFile, readFolder, selectFilesDialog, writeFileAtomic } from "../utils/files"
import { _store, setStore, storeFilesData } from "./store"
import { planBackupRestore } from "./backupValidation"
import { compressToZip, decompressZip } from "./zip"

export async function startBackup({ customTriggers, isCloudSync }: { customTriggers?: SaveActions; isCloudSync?: boolean } = {}): Promise<{ entries?: { name: string; content?: string | Buffer; filePath?: string }[]; path?: string } | void> {
    // no need to backup shows on auto backup (as that just takes a lot of space)
    const isAutoBackup = !!customTriggers?.isAutoBackup

    const folderName = getTimePointString() + (isAutoBackup ? "_auto" : "")
    const backupFolder = path.join(getDataFolderPath("backups"), folderName)
    const entries: { name: string; content?: string | Buffer; filePath?: string }[] = []

    // CONFIGS
    await Promise.all(
        Object.entries(storeFilesData).map(async ([id, data]) => {
            if (!data.portable) return
            await syncStores(id as keyof typeof _store)
        })
    )

    // bibles are not backed up because they are located in the Bibles folder
    if (isCloudSync) {
        await syncStores("MEDIA") // sync media data
        await syncBibles()
    } else {
        // "SYNCED_SETTINGS" and "STAGE" has to be before "SETTINGS" and "SHOWS" (can't remember why)
        await syncStores("SETTINGS")
    }

    // SHOWS
    if (!isAutoBackup || customTriggers?.backupShows) await syncAllShows()

    if (isCloudSync) return { entries }

    const zipPath = backupFolder + ".zip"
    await compressToZip(entries, zipPath)

    sendToMain(ToMain.BACKUP, { finished: true, path: zipPath })

    if (!isAutoBackup) openInSystem(zipPath, true)

    /// //

    async function syncStores(id: keyof typeof _store) {
        const store = _store[id]
        if (!store) return

        const name = id + ".json"
        entries.push({ name, filePath: store.path })
    }

    async function syncBibles() {
        const biblesPath = getDataFolderPath("scriptures")
        if (!fs.existsSync(biblesPath)) return

        const bibleFiles = readFolder(biblesPath)

        bibleFiles.forEach((fileName) => {
            const sourcePath = path.join(biblesPath, fileName)
            const destPath = `BIBLE_${fileName}`
            entries.push({ name: destPath, filePath: sourcePath })
        })
    }

    async function syncAllShows() {
        const showsPath = getDataFolderPath("shows")
        if (!fs.existsSync(showsPath)) return

        const showFilesOnDisk = readFolder(showsPath)

        for (const fileName of showFilesOnDisk) {
            if (fileName.toLowerCase().endsWith(".show")) {
                entries.push({ name: "SHOWS/" + fileName, filePath: path.join(showsPath, fileName) })
            }
        }
    }
}

export function getBackups() {
    const backupsFolder = getDataFolderPath("backups")
    const files = readFolder(backupsFolder)

    const backups: { path: string; name: string; date: number; size: number }[] = []
    files.forEach((name) => {
        const filePath = path.resolve(backupsFolder, name)
        const stat = getFileStats(filePath)
        if (!stat) return

        if (name.endsWith(".zip")) {
            backups.push({ path: filePath, name: name.replace(".zip", ""), date: stat.stat.ctimeMs, size: stat.stat.size })
        } else if (stat.folder) {
            let size = 0
            readFolder(filePath).forEach((fileName) => {
                const fileStat = getFileStats(path.resolve(filePath, fileName))
                if (fileStat) size += fileStat.stat.size
            })
            if (size > 0) backups.push({ path: filePath, name, date: stat.stat.ctimeMs, size })
        }
    })

    return backups
}

export function deleteBackup(data: { path: string }) {
    if (!data?.path) return

    const backupsFolder = getDataFolderPath("backups")
    const folderPath = path.resolve(backupsFolder, data.path)

    const stats = getFileStats(folderPath)
    if (stats?.folder) deleteFolder(folderPath)
    else deleteFile(folderPath)
}

// RESTORE

export async function restoreFiles(data?: { path: string }) {
    let files: { name: string; content: string | Buffer }[] = []

    if (data?.path) {
        if (data.path.endsWith(".zip")) {
            const decompressed = await decompressZip([data.path], false)
            files = decompressed.map((d) => ({ name: d.name, content: d.content }))
        } else {
            files = readFolder(data.path).map((name) => ({ name, content: readFile(path.join(data.path, name)) || "" }))
        }
    } else {
        const initialPath = getDataFolderPath("backups")
        const selectedPaths = selectFilesDialog("", { name: "FreeShow Backup Files", extensions: ["json", "zip"] }, true, initialPath)

        if (selectedPaths?.length) {
            for (const p of selectedPaths) {
                if (p.endsWith(".zip")) {
                    const decompressed = await decompressZip([p], false)
                    files.push(...decompressed.map((d) => ({ name: d.name, content: d.content })))
                } else {
                    files.push({ name: path.basename(p), content: readFile(p) || "" })
                }
            }
        }
    }

    const showsPath = getDataFolderPath("shows")
    const restorableStoreFiles = Object.entries(storeFilesData)
        .filter(([_, data]) => data.portable)
        .map(([key, _]) => key)
    // SETTINGS is intentionally included in local backups even though it is not portable.
    const plan = planBackupRestore(files, [...restorableStoreFiles, "SETTINGS"])
    if (!plan.ok) {
        sendToMain(ToMain.ALERT, `Backup restore rejected: ${plan.reason}`)
        return sendToMain(ToMain.RESTORE2, { finished: false })
    }

    sendToMain(ToMain.RESTORE2, { starting: true })

    let showsRestored = false
    plan.actions.forEach((action) => {
        if (action.kind === "show") {
            if (!doesPathExist(showsPath)) makeDir(showsPath)
            const showPath = path.resolve(showsPath, action.fileName)
            writeFileAtomic(showPath, JSON.stringify([action.id, action.show]), action.id)
            showsRestored = true
            return
        }

        restoreStore(action.data, action.storeId as keyof typeof _store)
    })

    if (showsRestored) sendMain(Main.SHOWS, loadShows())

    sendToMain(ToMain.RESTORE2, { finished: true })
    return

    /// //

    function restoreStore(source: Record<string, unknown>, storeId: keyof typeof _store) {
        if (!_store[storeId]) return
        const data = { ...source }

        if (storeId === "SETTINGS") {
            delete data.dataPath
            delete data.showsPath
        }

        setStore(_store[storeId], data)

        sendMain(storeId as Main, data)
    }
}
