import { useRef, useState, type ReactNode } from "react";
import { Loader2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ImageSettingsTheme } from "@/components/image-settings-panel";
import {
    audioFormatOptions,
    audioLanguageOptions,
    audioSpeedLabel,
    audioVoiceOptions,
    isQwenBaseMode,
    isQwenDesignMode,
    normalizeAudioFormatValue,
    normalizeAudioProviderValue,
    normalizeAudioSpeedValue,
    normalizeAudioTtsModeValue,
    normalizeAudioVoiceValue,
    qwenTtsModeOptions,
    qwenVoiceOptions,
} from "@/lib/audio-generation";
import { type CanvasTheme } from "@/lib/canvas-theme";
import { formatRefAudioBytes, getCachedRefAudio, importRefAudioFile, QWEN_REF_MAX_SECONDS } from "@/lib/qwen-tts-ref-audio";
import type { AiConfig } from "@/stores/use-config-store";

const speedOptions = ["0.75", "1", "1.25", "1.5"];

export type AudioSettingKey =
    | "audioVoice"
    | "audioFormat"
    | "audioSpeed"
    | "audioInstructions"
    | "audioProvider"
    | "audioTtsMode"
    | "audioLanguage"
    | "audioRefId"
    | "audioRefName"
    | "audioRefText";

type AudioSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: AudioSettingKey, value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
    referenceAudioCount?: number;
};

export function AudioSettingsPanel({
    config,
    onConfigChange,
    theme,
    showTitle = true,
    className = "w-[320px] space-y-4 rounded-2xl px-1 py-0.5",
    referenceAudioCount = 0,
}: AudioSettingsPanelProps) {
    const { t } = useTranslation();
    const isQwen = normalizeAudioProviderValue(config.audioProvider) === "qwen3tts";
    const ttsMode = normalizeAudioTtsModeValue(config.audioTtsMode);
    const voice = normalizeAudioVoiceValue(config.audioVoice, config.audioProvider);
    const format = normalizeAudioFormatValue(config.audioFormat);
    const speed = normalizeAudioSpeedValue(config.audioSpeed);
    const voices = isQwen ? qwenVoiceOptions : audioVoiceOptions;

    const instructionsTitle = isQwen
        ? isQwenDesignMode(ttsMode)
            ? t("settingsPanels.audio.designDescription")
            : t("settingsPanels.audio.styleInstructions")
        : t("settingsPanels.audio.instructions");
    const instructionsPlaceholder = isQwen
        ? isQwenDesignMode(ttsMode)
            ? t("settingsPanels.audio.designPlaceholder")
            : t("settingsPanels.audio.stylePlaceholder")
        : t("settingsPanels.audio.instructionsPlaceholder");

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-lg font-semibold">{t("settingsPanels.audio.title")}</div> : null}

                {isQwen ? (
                    <SettingGroup title={t("settingsPanels.audio.mode")} color={theme.node.muted}>
                        <div className="grid grid-cols-3 gap-2">
                            {qwenTtsModeOptions.map((item) => (
                                <OptionPill key={item.value} selected={ttsMode === item.value} theme={theme} onClick={() => onConfigChange("audioTtsMode", item.value)}>
                                    {item.label}
                                </OptionPill>
                            ))}
                        </div>
                        <div className="text-[11px] leading-4" style={{ color: theme.node.muted }}>
                            {t(`settingsPanels.audio.modeHints.${ttsMode}`)}
                        </div>
                    </SettingGroup>
                ) : null}

                {!isQwen || ttsMode === "custom" ? (
                    <SettingGroup title={t("settingsPanels.audio.voice")} color={theme.node.muted}>
                        <div className="grid grid-cols-3 gap-2.5">
                            {voices.map((item) => (
                                <OptionPill key={item.value} selected={voice === item.value} theme={theme} onClick={() => onConfigChange("audioVoice", item.value)}>
                                    {item.label}
                                </OptionPill>
                            ))}
                        </div>
                        {isQwen ? (
                            <input
                                type="text"
                                className="h-9 w-full rounded-full border bg-transparent px-3 text-sm outline-none"
                                style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                                value={config.audioVoice || ""}
                                placeholder={t("settingsPanels.audio.voicePlaceholder")}
                                onChange={(event) => onConfigChange("audioVoice", event.target.value)}
                                onMouseDown={(event) => event.stopPropagation()}
                            />
                        ) : null}
                    </SettingGroup>
                ) : null}

                {isQwen && isQwenBaseMode(ttsMode) ? (
                    <QwenRefAudioPicker config={config} theme={theme} onConfigChange={onConfigChange} referenceAudioCount={referenceAudioCount} />
                ) : null}

                {isQwen ? (
                    <SettingGroup title={t("settingsPanels.audio.language")} color={theme.node.muted}>
                        <select
                            className="h-9 w-full cursor-pointer rounded-full border bg-transparent px-3 text-sm outline-none"
                            style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                            value={config.audioLanguage || "auto"}
                            onChange={(event) => onConfigChange("audioLanguage", event.target.value)}
                            onMouseDown={(event) => event.stopPropagation()}
                        >
                            {audioLanguageOptions.map((item) => (
                                <option key={item.value} value={item.value} style={{ background: theme.toolbar.panel, color: theme.node.text }}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </SettingGroup>
                ) : null}

                <SettingGroup title={t("settingsPanels.audio.format")} color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-2.5">
                        {audioFormatOptions.map((item) => (
                            <OptionPill key={item.value} selected={format === item.value} theme={theme} onClick={() => onConfigChange("audioFormat", item.value)}>
                                {item.label}
                            </OptionPill>
                        ))}
                    </div>
                </SettingGroup>

                <SettingGroup title={t("settingsPanels.audio.speed")} color={theme.node.muted}>
                    <div className="grid grid-cols-4 gap-2.5">
                        {speedOptions.map((value) => (
                            <OptionPill key={value} selected={speed === value} theme={theme} onClick={() => onConfigChange("audioSpeed", value)}>
                                {audioSpeedLabel(value)}
                            </OptionPill>
                        ))}
                    </div>
                    <input
                        type="number"
                        min={0.25}
                        max={4}
                        step={0.05}
                        className="h-9 w-full rounded-full border bg-transparent px-3 text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        style={{ borderColor: theme.node.stroke, color: theme.node.text, WebkitTextFillColor: theme.node.text }}
                        value={config.audioSpeed || "1"}
                        onChange={(event) => onConfigChange("audioSpeed", event.target.value)}
                        onBlur={(event) => onConfigChange("audioSpeed", normalizeAudioSpeedValue(event.target.value))}
                        onMouseDown={(event) => event.stopPropagation()}
                    />
                </SettingGroup>

                {!isQwen || !isQwenBaseMode(ttsMode) ? (
                    <SettingGroup title={instructionsTitle} color={theme.node.muted}>
                        <textarea
                            value={config.audioInstructions || ""}
                            placeholder={instructionsPlaceholder}
                            className="thin-scrollbar h-20 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm leading-5 outline-none"
                            style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                            onChange={(event) => onConfigChange("audioInstructions", event.target.value)}
                            onMouseDown={(event) => event.stopPropagation()}
                        />
                        {isQwen && isQwenDesignMode(ttsMode) ? (
                            <div className="text-[11px] leading-4" style={{ color: theme.node.muted }}>
                                {t("settingsPanels.audio.designRequired")}
                            </div>
                        ) : null}
                    </SettingGroup>
                ) : null}

                <div className="text-[11px] leading-4" style={{ color: theme.node.muted }}>
                    {isQwen
                        ? t("settingsPanels.audio.qwenFooter", { format: format.toUpperCase() })
                        : t("settingsPanels.audio.openaiFooter")}
                </div>
            </div>
        </ImageSettingsTheme>
    );
}

function QwenRefAudioPicker({
    config,
    theme,
    onConfigChange,
    referenceAudioCount,
}: {
    config: AiConfig;
    theme: CanvasTheme;
    onConfigChange: (key: AudioSettingKey, value: string) => void;
    referenceAudioCount: number;
}) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [errMsg, setErrMsg] = useState("");
    const cached = getCachedRefAudio(config.audioRefId);
    const expired = Boolean(config.audioRefId) && !cached;
    const hasConnected = referenceAudioCount > 0;

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setLoading(true);
        setErrMsg("");
        try {
            const imported = await importRefAudioFile(file);
            onConfigChange("audioRefId", imported.id);
            onConfigChange("audioRefName", imported.name);
        } catch (error) {
            setErrMsg(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <SettingGroup title={t("settingsPanels.audio.referenceAudio")} color={theme.node.muted}>
            {hasConnected ? (
                <div className="rounded-xl border px-3 py-2 text-[11px] leading-4" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                    {t("settingsPanels.audio.referenceFromNode", { count: referenceAudioCount })}
                </div>
            ) : null}
            <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
            <button
                type="button"
                className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border bg-transparent px-2 text-sm transition hover:opacity-80"
                style={{ borderColor: theme.node.stroke, color: theme.node.text, opacity: hasConnected ? 0.7 : 1 }}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => inputRef.current?.click()}
                disabled={loading}
            >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                <span className="truncate">
                    {hasConnected ? t("settingsPanels.audio.uploadAlternative") : cached ? cached.name : t("settingsPanels.audio.uploadReference")}
                </span>
            </button>
            <div className="text-[11px] leading-4" style={{ color: theme.node.muted }}>
                {hasConnected
                    ? t("settingsPanels.audio.referenceNodeHint")
                    : cached
                      ? t("settingsPanels.audio.referenceMeta", { duration: cached.durationSec.toFixed(1), size: formatRefAudioBytes(cached.bytes) })
                      : expired
                        ? t("settingsPanels.audio.referenceExpired", { name: config.audioRefName || "" })
                        : t("settingsPanels.audio.referenceHint", { seconds: QWEN_REF_MAX_SECONDS })}
            </div>
            {errMsg ? (
                <div className="text-[11px] leading-4" style={{ color: "#d14343" }}>
                    {errMsg}
                </div>
            ) : null}
            <textarea
                value={config.audioRefText || ""}
                placeholder={t("settingsPanels.audio.referenceTextPlaceholder")}
                className="thin-scrollbar h-14 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm leading-5 outline-none"
                style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                onChange={(event) => onConfigChange("audioRefText", event.target.value)}
                onMouseDown={(event) => event.stopPropagation()}
            />
        </SettingGroup>
    );
}

function OptionPill({ selected, theme, onClick, children }: { selected: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            className="h-9 cursor-pointer rounded-full border px-2 text-sm transition hover:opacity-80"
            style={{ background: "transparent", borderColor: selected ? theme.node.text : theme.node.stroke, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function SettingGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) {
    return (
        <div className="space-y-2.5">
            <div className="text-xs font-medium" style={{ color }}>
                {title}
            </div>
            {children}
        </div>
    );
}
