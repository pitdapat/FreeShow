import { Main, type MainReceiveValue } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"

export function classifyMainMessage(value: unknown): "main" | "renderer-response" {
    if (!value || typeof value !== "object" || typeof (value as any).channel !== "string") throw new Error("Invalid IPC message: missing channel")

    const channel = (value as MainReceiveValue).channel
    if (Object.values(Main).includes(channel)) return "main"
    if (Object.values(ToMain).includes(channel as any)) return "renderer-response"
    throw new Error(`Invalid channel: ${channel}`)
}
