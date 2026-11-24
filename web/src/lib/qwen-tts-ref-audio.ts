import { nanoid } from "nanoid";

import { getMediaBlob } from "@/services/file-storage";
import type { ReferenceAudio } from "@/types/media";

export const QWEN_REF_MIN_SECONDS = 1;
export const QWEN_REF_MAX_SECONDS = 20;
const TARGET_SAMPLE_RATE = 24000;

export type CachedRefAudio = {
    id: string;
    name: string;
    durationSec: number;
    sampleRate: number;
    dataUrl: string;
    bytes: number;
};

const refAudioCache = new Map<string, CachedRefAudio>();
const nodeRefAudioIndex = new Map<string, string>();

/** 格式化文件字节大小为可读字符串。 */
export function formatRefAudioBytes(bytes: number): string {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 按缓存 ID 获取已导入的参考音频。 */
export function getCachedRefAudio(id?: string): CachedRefAudio | undefined {
    if (!id) return undefined;
    return refAudioCache.get(id);
}

/** 导入本地音频文件并转码为 24kHz 单声道 WAV dataURL。 */
export async function importRefAudioFile(file: File): Promise<CachedRefAudio> {
    if (!file.type.startsWith("audio/") && !/\.(wav|mp3|m4a|flac|ogg|opus|aac|webm)$/i.test(file.name)) {
        throw new Error("参考音频格式不支持，请上传 wav / mp3 / m4a / flac 等音频文件");
    }
    return decodeAndCacheRefAudio(await file.arrayBuffer(), file.name);
}

/** 将画布连线的参考音频节点转码为 24kHz 单声道 WAV 并缓存。 */
export async function resolveNodeRefAudio(item: ReferenceAudio, options?: { signal?: AbortSignal }): Promise<CachedRefAudio> {
    const cacheKey = item.storageKey || item.url || "";
    if (cacheKey) {
        const existing = refAudioCache.get(nodeRefAudioIndex.get(cacheKey) || "");
        if (existing) return existing;
    }
    let blob = item.storageKey ? await getMediaBlob(item.storageKey) : null;
    if (!blob) {
        const url = item.url || "";
        if (!url) throw new Error("连入的音频节点没有可用的音频内容，请先生成或上传音频");
        try {
            blob = await (await fetch(url, { signal: options?.signal })).blob();
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") throw error;
            throw new Error("读取连线音频失败，请重新生成该音频节点");
        }
    }
    if (!blob || !blob.size) throw new Error("连入的音频节点没有可用的音频内容，请先生成或上传音频");
    const cached = await decodeAndCacheRefAudio(await blob.arrayBuffer(), item.name || "画布音频节点");
    if (cacheKey) nodeRefAudioIndex.set(cacheKey, cached.id);
    return cached;
}

async function decodeAndCacheRefAudio(buffer: ArrayBuffer, name: string): Promise<CachedRefAudio> {
    const AudioCtx = typeof window === "undefined" ? null : window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
    if (!AudioCtx) throw new Error("当前浏览器不支持解码音频，无法生成参考音频");
    const ctx = new AudioCtx();
    let decoded: AudioBuffer;
    try {
        decoded = await ctx.decodeAudioData(buffer.slice(0));
    } catch {
        throw new Error("参考音频解码失败，请换一个文件或先转成 wav / mp3");
    } finally {
        void ctx.close();
    }
    const duration = decoded.duration;
    if (duration < QWEN_REF_MIN_SECONDS) {
        throw new Error(`参考音频太短（${duration.toFixed(1)} 秒），请上传 ${QWEN_REF_MIN_SECONDS} 秒以上`);
    }
    const clipped = Math.min(duration, QWEN_REF_MAX_SECONDS);
    const frameCount = Math.max(1, Math.round(clipped * TARGET_SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0, 0, clipped);
    const rendered = await offline.startRendering();
    const pcm16 = floatToInt16(rendered.getChannelData(0));
    const wavBytes = encodeMonoWav(pcm16, TARGET_SAMPLE_RATE);
    const dataUrl = `data:audio/wav;base64,${uint8ToBase64(wavBytes)}`;
    const entry: CachedRefAudio = {
        id: nanoid(),
        name,
        durationSec: Number(clipped.toFixed(2)),
        sampleRate: TARGET_SAMPLE_RATE,
        dataUrl,
        bytes: wavBytes.byteLength,
    };
    refAudioCache.set(entry.id, entry);
    return entry;
}

function floatToInt16(channel: Float32Array): Int16Array {
    const out = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i += 1) {
        const clamped = Math.max(-1, Math.min(1, channel[i]));
        out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    return out;
}

function encodeMonoWav(samples: Int16Array, sampleRate: number): Uint8Array {
    const dataSize = samples.byteLength;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, dataSize, true);
    new Uint8Array(buffer, 44).set(new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
    return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, text: string) {
    for (let i = 0; i < text.length; i += 1) {
        view.setUint8(offset + i, text.charCodeAt(i));
    }
}

function uint8ToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}
