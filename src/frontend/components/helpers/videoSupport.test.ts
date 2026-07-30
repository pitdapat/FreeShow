import { describe, expect, it } from "vitest"
import { getVideoCodecLabel, getVideoPlaybackProblem } from "./videoSupport"

describe("video playback support reporting", () => {
    it("does not reject a codec before the browser reports a playback failure", () => {
        expect(getVideoPlaybackProblem(null, ["hvc1.2.4.L153.B0", "mp4a.40.2"])).toBeNull()
        expect(getVideoPlaybackProblem(0, ["av01.0.08M.08", "opus"])).toBeNull()
    })

    it("reports the actual decode failure with a useful HEVC label", () => {
        expect(getVideoPlaybackProblem(3, ["hvc1.2.4.L153.B0", "mp4a.40.2"])).toEqual({
            translationKey: "toast.video_decode_error",
            codecLabel: "H.265/HEVC"
        })
    })

    it("reports a source failure separately from a decode failure", () => {
        expect(getVideoPlaybackProblem(4, ["avc1.640028", "mp4a.40.2"])).toEqual({
            translationKey: "toast.video_source_error",
            codecLabel: "H.264"
        })
    })

    it("ignores audio and timecode tracks when naming the video codec", () => {
        expect(getVideoCodecLabel(["mp4a.40.2", "tmcd", "ap4h"])).toBe("Apple ProRes")
        expect(getVideoCodecLabel(["mp4a.40.2", "tmcd"])).toBe("unknown codec")
    })

    it.each([
        { errorCode: 1, description: "an aborted load" },
        { errorCode: 2, description: "a network failure" },
        { errorCode: 0, description: "an empty browser error" },
        { errorCode: undefined, description: "no browser error" }
    ])("does not misreport $description as an unsupported video", ({ errorCode }) => {
        expect(getVideoPlaybackProblem(errorCode, ["hvc1.2.4.L153.B0"])).toBeNull()
    })

    it.each([
        { codec: "avc1.640028", expected: "H.264" },
        { codec: "hev1.1.6.L93.B0", expected: "H.265/HEVC" },
        { codec: "av01.0.08M.08", expected: "AV1" },
        { codec: "vp09.00.10.08", expected: "VP9" },
        { codec: "vp08.00.41.08", expected: "VP8" }
    ])("labels $codec as $expected in user-facing playback errors", ({ codec, expected }) => {
        expect(getVideoCodecLabel([codec])).toBe(expected)
    })
})
