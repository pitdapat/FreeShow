export type VideoPlaybackProblem = {
    translationKey: "toast.video_decode_error" | "toast.video_source_error"
    codecLabel: string
}

const codecLabels: { pattern: RegExp; label: string }[] = [
    { pattern: /^(avc1|avc3|h264)/i, label: "H.264" },
    { pattern: /^(hvc1|hev1|hevc|h265)/i, label: "H.265/HEVC" },
    { pattern: /^(av01|av1)/i, label: "AV1" },
    { pattern: /^(vp09|vp9)/i, label: "VP9" },
    { pattern: /^(vp08|vp8)/i, label: "VP8" },
    {
        pattern: /^(ap4h|ap4x|apch|apcn|apcs|apco|prores)/i,
        label: "Apple ProRes"
    }
]

const audioOrMetadataCodec = /^(mp4a|aac|ac-3|ec-3|opus|vorbis|flac|alac|mp3|tmcd|text|wvtt|stpp)/i

export function getVideoCodecLabel(codecs: string[] = []) {
    const videoCodec = codecs.find((codec) => !audioOrMetadataCodec.test(codec))
    if (!videoCodec) return "unknown codec"

    return codecLabels.find(({ pattern }) => pattern.test(videoCodec))?.label || videoCodec
}

export function getVideoPlaybackProblem(errorCode: number | null | undefined, codecs: string[] = []): VideoPlaybackProblem | null {
    // HTMLMediaElement only knows that playback failed. Codec metadata helps
    // explain the failure, but must not be used to reject a file before playback:
    // HEVC/AV1 support varies with Electron, OS, hardware, and acceleration.
    if (errorCode === 3) {
        return {
            translationKey: "toast.video_decode_error",
            codecLabel: getVideoCodecLabel(codecs)
        }
    }

    if (errorCode === 4) {
        return {
            translationKey: "toast.video_source_error",
            codecLabel: getVideoCodecLabel(codecs)
        }
    }

    return null
}
