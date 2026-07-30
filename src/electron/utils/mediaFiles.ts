import fs from "fs"
import path from "path"

export type MediaFileMoveResult = {
    moved: { oldPath: string; newPath: string }[]
    errors: { path: string; error: string }[]
}

export async function moveMediaFiles({ paths, destination }: { paths: string[]; destination: string }): Promise<MediaFileMoveResult> {
    const moved: MediaFileMoveResult["moved"] = []
    const errors: MediaFileMoveResult["errors"] = []

    let destinationStats: fs.Stats | null = null
    try {
        destinationStats = await fs.promises.stat(destination)
    } catch {
        // The common error response below is clearer than the platform error.
    }

    if (!destinationStats?.isDirectory()) {
        return { moved, errors: paths.map((filePath) => ({ path: filePath, error: "Destination folder is unavailable." })) }
    }

    for (const sourcePath of [...new Set(paths)]) {
        try {
            const sourceStats = await fs.promises.stat(sourcePath)
            if (!sourceStats.isFile()) {
                errors.push({ path: sourcePath, error: "Source file is unavailable." })
                continue
            }

            const newPath = path.join(destination, path.basename(sourcePath))
            if (path.resolve(sourcePath) === path.resolve(newPath)) continue

            try {
                // A hard link makes same-drive moves fast while refusing to
                // overwrite an existing destination.
                await fs.promises.link(sourcePath, newPath)
            } catch (err) {
                const code = (err as NodeJS.ErrnoException).code
                if (code === "EEXIST") {
                    errors.push({ path: sourcePath, error: "A file with this name already exists in the destination." })
                    continue
                }
                if (!["EXDEV", "EPERM", "EACCES", "ENOTSUP"].includes(code || "")) throw err

                // Hard links are unavailable across drives and on some file
                // systems, so fall back to an exclusive copy.
                await fs.promises.copyFile(sourcePath, newPath, fs.constants.COPYFILE_EXCL)
            }

            try {
                await fs.promises.unlink(sourcePath)
            } catch (err) {
                // Roll back the destination if removing the source failed so a
                // reported failure never leaves an unexplained duplicate.
                await fs.promises.unlink(newPath).catch(() => {})
                throw err
            }

            moved.push({ oldPath: sourcePath, newPath })
        } catch (err) {
            const code = (err as NodeJS.ErrnoException).code
            const error = code === "EEXIST" ? "A file with this name already exists in the destination." : (err as Error).message || "Could not move media file."
            errors.push({ path: sourcePath, error })
        }
    }

    return { moved, errors }
}
