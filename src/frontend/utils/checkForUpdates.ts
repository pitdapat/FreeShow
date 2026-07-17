import { get } from "svelte/store"
import { UPDATE_RELEASES_API } from "../../common/updateSource"
import { activePopup, alertUpdates, isDev, popupData, special } from "./../stores"

interface UpdateData {
    latestVersion: string
    changelog: string
    hasUpdate: boolean
}

export async function getUpdateData(currentVersion: string, includeBeta: boolean): Promise<UpdateData> {
    const response = await fetch(UPDATE_RELEASES_API)
    if (!response.ok) throw new Error(`Could not fetch fork releases: ${response.status}`)

    const data = await response.json()
    if (!Array.isArray(data)) throw new Error("Invalid fork release response")

    const latestAll = data.filter((a: any) => a.draft === false)[0]
    const latestRelease = data.filter((a: any) => a.draft === false && a.prerelease === false)[0]

    const latestVersionAll = latestAll?.tag_name?.slice(1) || ""
    const latestVersionStable = latestRelease?.tag_name?.slice(1) || latestVersionAll
    const latestVersion = includeBeta ? latestVersionAll : latestVersionStable
    const changelog = includeBeta ? latestAll?.body || "" : latestRelease?.body || latestAll?.body || ""

    return {
        latestVersion,
        changelog,
        hasUpdate: !!latestVersion && currentVersion !== latestVersion
    }
}

export function checkForUpdates(currentVersion: string) {
    if (get(isDev) || get(alertUpdates) === false) return
    const includeBeta = currentVersion.includes("-beta") || get(special).betaVersionAlert

    getUpdateData(currentVersion, includeBeta)
        .then(({ latestVersion, changelog, hasUpdate }) => {
            if (get(activePopup) !== null) return
            if (!hasUpdate) return

            popupData.set({ changelog, latestVersion })
            activePopup.set("new_update")
        })
        .catch((error) => {
            console.warn(error)
        })
}
