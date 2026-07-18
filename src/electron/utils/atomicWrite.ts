import fs from "fs"
import path from "path"

export type AtomicWriteOperations = Pick<typeof fs, "existsSync" | "renameSync" | "unlinkSync" | "writeFileSync">

let writeSequence = 0

/** Keep the previous destination intact until a complete staged write can be renamed into place. */
export function atomicWriteFileSync(filePath: string, content: string | NodeJS.ArrayBufferView, operations: AtomicWriteOperations = fs) {
    const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${writeSequence++}.tmp`)

    try {
        operations.writeFileSync(tempPath, content)
        operations.renameSync(tempPath, filePath)
    } catch (error) {
        try {
            if (operations.existsSync(tempPath)) operations.unlinkSync(tempPath)
        } catch {
            // Preserve the original error; stale staging data must not mask why commit failed.
        }
        throw error
    }
}
