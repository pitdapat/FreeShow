import type { FileFolder } from "../../../../types/Main"

function normalizePath(filePath: string) {
    return filePath.replaceAll("\\", "/").replace(/\/+$/, "")
}

export function isPathInsideRoot(filePath: string, rootPath: string) {
    const file = normalizePath(filePath)
    const root = normalizePath(rootPath)
    return !!root && (file === root || file.startsWith(root + "/"))
}

export function getAllMediaRootFolders(folderContents: FileFolder[], rootPaths: string[]) {
    const normalizedRoots = new Set(rootPaths.filter(Boolean).map(normalizePath))
    return folderContents.filter((item) => item.isFolder && normalizedRoots.has(normalizePath(item.path)))
}

export function getRecursiveMediaFiles(folderContents: FileFolder[], rootPaths: string[]) {
    return folderContents.filter((item) => !item.isFolder && rootPaths.some((rootPath) => isPathInsideRoot(item.path, rootPath)))
}

export function getAllMediaSearchResults(folderContents: FileFolder[], rootPaths: string[], searchValue: string) {
    const normalizeSearchValue = (value: string) => value.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    const normalizedSearch = normalizeSearchValue(searchValue)
    const matchingFiles = getRecursiveMediaFiles(folderContents, rootPaths).filter((item) => normalizeSearchValue(item.name).includes(normalizedSearch))
    return [...getAllMediaRootFolders(folderContents, rootPaths), ...matchingFiles]
}
