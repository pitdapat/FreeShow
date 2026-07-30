import type { FileFolder } from "../../../../types/Main"

export const MEDIA_LIBRARY_DEPTH = 8

export function normalizeMediaPath(filePath: string) {
    return filePath.replaceAll("\\", "/").replace(/\/+$/, "")
}

export function isPathInsideRoot(filePath: string, rootPath: string) {
    const file = normalizeMediaPath(filePath)
    const root = normalizeMediaPath(rootPath)
    return !!root && (file === root || file.startsWith(root + "/"))
}

export function getAllMediaRootFolders(folderContents: FileFolder[], rootPaths: string[]) {
    const normalizedRoots = new Set(rootPaths.filter(Boolean).map(normalizeMediaPath))
    return folderContents.filter((item) => item.isFolder && normalizedRoots.has(normalizeMediaPath(item.path)))
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

export type MediaFolderTreeNode = {
    path: string
    name: string
    treeChildren: MediaFolderTreeNode[]
}

export function buildMediaFolderTree(folderContents: FileFolder[], rootPath: string): MediaFolderTreeNode {
    const folders = folderContents.filter((item): item is Extract<FileFolder, { isFolder: true }> => item.isFolder)
    const foldersByPath = new Map(folders.map((folder) => [normalizeMediaPath(folder.path), folder]))

    function build(folderPath: string, ancestors = new Set<string>()): MediaFolderTreeNode {
        const normalizedPath = normalizeMediaPath(folderPath)
        const folder = foldersByPath.get(normalizedPath)
        const nextAncestors = new Set(ancestors).add(normalizedPath)
        const children = folders.filter((candidate) => getMediaParentPath(candidate.path) === normalizedPath && !nextAncestors.has(normalizeMediaPath(candidate.path))).sort((a, b) => a.name.localeCompare(b.name))

        return {
            path: folder?.path || folderPath,
            name: folder?.name || getMediaPathName(folderPath),
            treeChildren: children.map((child) => build(child.path, nextAncestors))
        }
    }

    return build(rootPath)
}

export function getMediaParentPath(filePath: string) {
    const normalized = normalizeMediaPath(filePath)
    return normalized.slice(0, normalized.lastIndexOf("/"))
}

function getMediaPathName(filePath: string) {
    const normalized = normalizeMediaPath(filePath)
    return normalized.slice(normalized.lastIndexOf("/") + 1)
}
