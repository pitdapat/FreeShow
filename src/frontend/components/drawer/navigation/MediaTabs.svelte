<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import type { ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import { ToMain } from "../../../../types/IPC/ToMain"
    import type { FileFolder } from "../../../../types/Main"
    import { destroyMain, receiveToMain, requestMain, sendMain } from "../../../IPC/main"
    import { drawerTabsData, labelsDisabled, media, mediaFolderRefresh, mediaFolders, providerConnections, special } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import { addDrawerFolder } from "../../helpers/dropActions"
    import Icon from "../../helpers/Icon.svelte"
    import { countFolderMediaItems } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { buildMediaFolderTree, MEDIA_LIBRARY_DEPTH, normalizeMediaPath, type MediaFolderTreeNode } from "../media/mediaLibrary"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("media")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.media?.activeSubTab || ""
    $: activeFolderPath = $drawerTabsData.media?.activeFolderPath || ""

    $: foldersList = keysToID($mediaFolders)
    $: favoritesListLength = Object.values($media).filter((a) => !a.audio && a.favourite).length

    let allCount = 0
    let folderContents: FileFolder[] = []
    let countsRequest = 0
    $: if (foldersList.length || $mediaFolderRefresh) getCounts()
    async function getCounts() {
        const requestId = ++countsRequest
        const folderPaths = foldersList.map((a) => a.path || "")
        const data = keysToID((await requestMain(Main.READ_FOLDER, { path: folderPaths, depth: MEDIA_LIBRARY_DEPTH })) || {})
        if (requestId !== countsRequest) return

        folderContents = data
        allCount = 0

        folderPaths.forEach((folderPath) => {
            const count = countFolderMediaItems(folderPath, data, true)
            allCount += count.video + count.image
        })
    }

    // Content providers with libraries, and are currently connected
    let contentProviders: { providerId: ContentProviderId; displayName: string; hasContentLibrary: boolean }[] = []
    $: if ($providerConnections) getProviders()
    function getProviders() {
        requestMain(Main.GET_CONTENT_PROVIDERS).then((allProviders) => {
            if (!allProviders) return
            contentProviders = allProviders.filter((p) => p.hasContentLibrary && $providerConnections[p.providerId])
        })
    }

    $: if ($providerConnections) {
        requestMain(Main.GET_CONTENT_PROVIDERS).then((allProviders) => {
            if (!allProviders) return
            contentProviders = allProviders.filter((p) => p.hasContentLibrary && $providerConnections[p.providerId])
        })
    }

    $: curriculumProviders = contentProviders.filter((a) => (a.providerId !== "churchApps" || $special.churchAppsCloudOnly !== true) && a.providerId !== "canva")

    let sections: any[] = []
    $: sections = [
        [
            { id: "all", label: "category.all", icon: "all", count: allCount },
            { id: "favourites", label: "category.favourites", icon: "star", count: favoritesListLength, hidden: !favoritesListLength && activeSubTab !== "favourites" }
        ],
        ...(curriculumProviders.length ? [[{ id: "TITLE", label: "Curriculum" }, ...curriculumProviders.map((a) => ({ id: a.providerId, label: a.displayName, icon: "web" }))]] : []),
        [{ id: "inputs", label: "emitters.inputs", icon: "input" }, "SEPARATOR", { id: "online", label: "media.online", icon: "web" }].filter(Boolean),
        [{ id: "TITLE", label: "media.folders" }, ...convertToButton(foldersList, folderContents, activeFolderPath)]
    ]

    function convertToButton(categories: any[], contents: FileFolder[], selectedPath: string) {
        return sortObject(categories, "name").map((a) => {
            const tree = buildMediaFolderTree(contents, a.path)
            return convertFolderNode(tree, a, contents, selectedPath, true)
        })
    }

    function convertFolderNode(folder: MediaFolderTreeNode, rootFolder: any, contents: FileFolder[], selectedPath: string, isRoot = false): any {
        const type = isRoot ? rootFolder.mediaType : null
        const option = type ? { title: `clock.type: <b>preview.${type}</b>`, icon: `type_${type}`, style: "opacity: 0.6;" } : null
        const count = countFolderMediaItems(folder.path, contents, true)
        const activePath = selectedPath || rootFolder.path

        return {
            id: isRoot ? rootFolder.id : `media-folder:${normalizeMediaPath(folder.path)}`,
            label: isRoot ? rootFolder.name : folder.name,
            icon: "folder",
            option,
            count: count.folder + count.video + count.image,
            boxedIcon: true,
            noEdit: !isRoot,
            droppable: true,
            targetTabId: rootFolder.id,
            treeKey: `media:${normalizeMediaPath(folder.path)}`,
            isActive: activeSubTab === rootFolder.id && normalizeMediaPath(activePath) === normalizeMediaPath(folder.path),
            openTrigger: () => openFolder(rootFolder.id, folder.path),
            dropData: { id: rootFolder.id, path: folder.path, type: "media_folder" },
            treeChildren: folder.treeChildren.map((child) => convertFolderNode(child, rootFolder, contents, selectedPath))
        }
    }

    function openFolder(rootId: string, folderPath: string) {
        drawerTabsData.update((data) => {
            if (!data.media) data.media = { enabled: true, activeSubTab: rootId }
            data.media.activeSubTab = rootId
            data.media.activeFolderPath = folderPath
            return data
        })
    }

    const PICK_ID = uid()
    function addFolder() {
        sendMain(Main.OPEN_FOLDER, { channel: PICK_ID })
    }
    let listenerId = receiveToMain(ToMain.OPEN_FOLDER2, (data) => {
        if (data.channel !== PICK_ID || !data.path) return
        addDrawerFolder(data, "media")
    })
    onDestroy(() => destroyMain(listenerId))

    function updateName(e: any) {
        const { id, value } = e.detail
        mediaFolders.update((a) => {
            if (a[id].default) delete a[id].default
            a[id].name = value
            return a
        })
    }
</script>

<NavigationSections {sections} active={activeSubTab} on:rename={updateName}>
    <div slot="section_2" style="{!curriculumProviders.length ? 'padding: 8px;' : ''}{foldersList.length && !curriculumProviders.length ? 'padding-top: 12px;' : ''}">
        {#if !curriculumProviders.length}
            <MaterialButton style="width: 100%;" title="new.system_folder" variant="outlined" disabled={readOnly} on:click={addFolder} small>
                <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.system_folder" />{/if}
            </MaterialButton>
        {/if}
    </div>
    <div slot="section_3" style="padding: 8px;{foldersList.length ? 'padding-top: 12px;' : ''}">
        <MaterialButton style="width: 100%;" title="new.system_folder" variant="outlined" disabled={readOnly} on:click={addFolder} small>
            <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
            {#if !$labelsDisabled}<T id="new.system_folder" />{/if}
        </MaterialButton>
    </div>
</NavigationSections>
