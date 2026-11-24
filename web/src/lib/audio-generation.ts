export const audioVoiceOptions = [
    { value: "alloy", label: "Alloy" },
    { value: "ash", label: "Ash" },
    { value: "ballad", label: "Ballad" },
    { value: "coral", label: "Coral" },
    { value: "echo", label: "Echo" },
    { value: "fable", label: "Fable" },
    { value: "nova", label: "Nova" },
    { value: "onyx", label: "Onyx" },
    { value: "sage", label: "Sage" },
    { value: "shimmer", label: "Shimmer" },
    { value: "verse", label: "Verse" },
    { value: "marin", label: "Marin" },
    { value: "cedar", label: "Cedar" },
];

export const audioFormatOptions = [
    { value: "mp3", label: "MP3" },
    { value: "wav", label: "WAV" },
    { value: "opus", label: "Opus" },
    { value: "aac", label: "AAC" },
    { value: "flac", label: "FLAC" },
    { value: "pcm", label: "PCM" },
];

export const audioProviderOptions = [{ value: "qwen3tts", label: "Qwen3-TTS" }] as const;

export const qwenTtsModeOptions = [
    { value: "custom", label: "预设音色" },
    { value: "design", label: "音色设计" },
    { value: "base", label: "参考音频克隆" },
] as const;

export type QwenTtsMode = (typeof qwenTtsModeOptions)[number]["value"];

export const QWEN_TTS_MODELS: Record<QwenTtsMode, string> = {
    custom: "qwen3-tts-1.7b-customvoice",
    design: "qwen3-tts-1.7b-voicedesign",
    base: "qwen3-tts-1.7b-base",
};

export const qwenVoiceOptions = [
    { value: "Vivian", label: "Vivian" },
    { value: "Serena", label: "Serena" },
    { value: "Uncle_Fu", label: "Uncle Fu" },
    { value: "Dylan", label: "Dylan" },
    { value: "Eric", label: "Eric" },
    { value: "Ryan", label: "Ryan" },
    { value: "Aiden", label: "Aiden" },
    { value: "Ono_Anna", label: "Ono Anna" },
    { value: "Sohee", label: "Sohee" },
];

export const QWEN_DEFAULT_VOICE = "Vivian";

export const audioLanguageOptions = [
    { value: "auto", label: "自动" },
    { value: "Chinese", label: "中文" },
    { value: "English", label: "English" },
    { value: "Japanese", label: "日本語" },
    { value: "Korean", label: "한국어" },
    { value: "German", label: "Deutsch" },
    { value: "French", label: "Français" },
    { value: "Russian", label: "Русский" },
    { value: "Portuguese", label: "Português" },
    { value: "Spanish", label: "Español" },
    { value: "Italian", label: "Italiano" },
];

export function normalizeAudioProviderValue(_value?: string): "qwen3tts" {
    return "qwen3tts";
}

export function normalizeAudioTtsModeValue(value?: string): QwenTtsMode {
    return value === "design" || value === "base" ? value : "custom";
}

export function qwenTtsModelForMode(mode?: string): string {
    return QWEN_TTS_MODELS[normalizeAudioTtsModeValue(mode)];
}

export function isQwenDesignMode(mode?: string): boolean {
    return normalizeAudioTtsModeValue(mode) === "design";
}

export function isQwenBaseMode(mode?: string): boolean {
    return normalizeAudioTtsModeValue(mode) === "base";
}

export function audioTtsModeLabel(mode?: string): string {
    const normalized = normalizeAudioTtsModeValue(mode);
    return qwenTtsModeOptions.find((item) => item.value === normalized)?.label || normalized;
}

export function normalizeQwenVoiceValue(value?: string): string {
    return (value || "").trim() || QWEN_DEFAULT_VOICE;
}

export function normalizeAudioVoiceValue(value: string, provider = "qwen3tts") {
    if (normalizeAudioProviderValue(provider) === "qwen3tts") {
        return normalizeQwenVoiceValue(value);
    }
    return audioVoiceOptions.some((item) => item.value === value) ? value : "alloy";
}

export function normalizeAudioFormatValue(value: string) {
    return audioFormatOptions.some((item) => item.value === value) ? value : "mp3";
}

export function normalizeAudioSpeedValue(value: string) {
    const speed = Number(value);
    if (!Number.isFinite(speed)) return "1";
    return String(Math.max(0.25, Math.min(4, Number(speed.toFixed(2)))));
}

export function audioVoiceLabel(value: string, provider = "qwen3tts") {
    if (normalizeAudioProviderValue(provider) === "qwen3tts") {
        const voice = normalizeQwenVoiceValue(value);
        return qwenVoiceOptions.find((item) => item.value === voice)?.label || voice;
    }
    const voice = normalizeAudioVoiceValue(value, provider);
    return audioVoiceOptions.find((item) => item.value === voice)?.label || voice;
}

export function audioFormatLabel(value: string) {
    const format = normalizeAudioFormatValue(value);
    return audioFormatOptions.find((item) => item.value === format)?.label || format;
}

export function audioSpeedLabel(value: string) {
    return `${normalizeAudioSpeedValue(value)}x`;
}

export function audioMimeType(format: string) {
    if (format === "wav") return "audio/wav";
    if (format === "opus") return "audio/opus";
    if (format === "aac") return "audio/aac";
    if (format === "flac") return "audio/flac";
    if (format === "pcm") return "audio/pcm";
    return "audio/mpeg";
}
