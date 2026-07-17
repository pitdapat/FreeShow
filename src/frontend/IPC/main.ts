import { uid } from "uid"
import type { ToMainReceiveValue, ToMainSendPayloads } from "../../types/IPC/ToMain"
import { ToMain } from "../../types/IPC/ToMain"
import type { MainReceiveValue, MainReturnPayloads } from "./../../types/IPC/Main"
import { MAIN, Main, type MainSendValue } from "./../../types/IPC/Main"
import { mainResponses } from "./responsesMain"
import { isDev } from "../stores"
import { get } from "svelte/store"

// @ts-ignore // T extends keyof typeof Main
export function requestMainMultiple<T extends Main>(object: { [K in T]: (data: MainReturnPayloads[K] | undefined) => void }) {
    Object.keys(object).forEach((id) => {
        requestMain(id as T, undefined, object[id])
    })
}

const MAIN_RECEIVER_ID = "main-receiver"

type PendingMainRequest = {
    id: Main
    resolve: (data: unknown) => void
    timeout: NodeJS.Timeout
}

const pendingMainRequests = new Map<string, PendingMainRequest>()
const mainSubscriptions = new Map<string, { id: Main | ToMain; callback: (data: any) => void }>()
let mainReceiverRegistered = false
let mainGlobalReceiverRegistered = false

function receiveMainMessages() {
    if (mainReceiverRegistered) return
    mainReceiverRegistered = true

    window.api.receive(
        MAIN,
        async (msg: MainReceiveValue | ToMainReceiveValue, listenerId?: string) => {
            if (listenerId) {
                const pendingRequest = pendingMainRequests.get(listenerId)
                if (pendingRequest && msg.channel === pendingRequest.id) {
                    clearTimeout(pendingRequest.timeout)
                    pendingMainRequests.delete(listenerId)
                    pendingRequest.resolve(msg.data)
                }
            }

            mainSubscriptions.forEach((subscription) => {
                if (subscription.id === msg.channel) subscription.callback(msg.data)
            })

            if (!mainGlobalReceiverRegistered) return

            const id = msg.channel
            if (!Object.values({ ...Main, ...ToMain }).includes(id)) throw new Error(`Invalid channel: ${id}`)
            if (!mainResponses[id]) return // console.error(`No response for channel: ${id}`)

            const response = await (mainResponses[id] as any)(msg.data)
            if (!response) return

            window.api.send(MAIN, { channel: id, data: response }, listenerId)
        },
        MAIN_RECEIVER_ID
    )
}

// @ts-ignore
export async function requestMain<ID extends Main, R = Awaited<MainReturnPayloads[ID]>>(id: ID, value?: MainSendValue<ID>, callback?: (data: R | undefined) => void, waitingTimeout: number = 15000) {
    const listenerId = id + uid(5)

    const returnData: R | undefined = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
            if (!pendingMainRequests.delete(listenerId)) return
            if (get(isDev)) console.error(`IPC Message Timed Out: ${id}`)
            resolve(undefined)
        }, waitingTimeout)

        pendingMainRequests.set(listenerId, { id, resolve: (data) => resolve(data as R), timeout })
        receiveMainMessages()
        sendMain(id, value, listenerId)
    })

    if (callback) callback(returnData)
    return returnData
}

export function sendMainMultiple<T extends Main>(keys: T[]) {
    keys.forEach((id) => sendMain(id))
}

export function sendMain<ID extends Main>(id: ID, value?: MainSendValue<ID>, listenerId?: string) {
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!window.api) return

    window.api.send(MAIN, { channel: id, data: value }, listenerId)
}

export function receiveMainGlobal() {
    if (mainGlobalReceiverRegistered) return
    mainGlobalReceiverRegistered = true
    receiveMainMessages()
}

// @ts-ignore works as it should
export function receiveMain<ID extends Main, R = Awaited<MainReturnPayloads[ID]>>(id: ID, callback: (data: R) => void) {
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    const listenerId = uid()

    mainSubscriptions.set(listenerId, { id, callback })
    receiveMainMessages()

    return listenerId
}

export function receiveToMain<ID extends ToMain, R = Awaited<ToMainSendPayloads[ID]>>(id: ID, callback: (data: R) => void) {
    if (!Object.values(ToMain).includes(id)) throw new Error(`Invalid channel: ${id}`)
    const listenerId = uid()

    mainSubscriptions.set(listenerId, { id, callback })
    receiveMainMessages()

    return listenerId
}

export function destroyMain(listenerId: string) {
    mainSubscriptions.delete(listenerId)
}
