import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, ListOrdered, RefreshCw } from "lucide-react";
import { Button } from "antd";

import { canvasThemes } from "@/lib/canvas-theme";
import { resolveModelRequestConfig, useEffectiveConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";

type PublicQueueItem = {
    id: string;
    pos?: number | null;
    queue_position?: number | null;
    state?: string;
    inst?: string;
    user?: string;
    mode?: string;
    w?: number | null;
    h?: number | null;
    frames?: number | null;
    n?: number | null;
    elapsed_s?: number | null;
    est_total_s?: number | null;
    eta_ms?: number | null;
};

type PublicQueueSnapshot = {
    ok: boolean;
    summary?: {
        run?: number;
        pending?: number;
        image?: number;
        image_run?: number;
        gateway_waiting?: number;
        total_left_s?: number;
        clear_eta_ms?: number;
        total_frames?: number;
    };
    items?: PublicQueueItem[];
};

function resolveQueueOrigin(baseUrl?: string): string {
    const raw = (baseUrl || "").trim();
    if (!raw) return "";
    try {
        const parsed = new URL(raw);
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return raw.replace(/\/v1\/?$/i, "").replace(/\/+$/, "");
    }
}

function formatDuration(seconds?: number | null): string {
    if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "-";
    const s = Math.round(seconds);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m < 60) return r ? `${m}分${r}秒` : `${m}分`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm ? `${h}小时${rm}分` : `${h}小时`;
}

function formatClock(ms?: number | null): string {
    if (!ms) return "-";
    return new Date(ms).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** 画布顶栏实时生成队列状态徽章与弹窗。 */
export function CanvasQueuePopover() {
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const config = useEffectiveConfig();
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const [snapshot, setSnapshot] = useState<PublicQueueSnapshot | null>(null);
    const [loading, setLoading] = useState(false);
    const [unavailable, setUnavailable] = useState(false);

    const queueOrigin = useMemo(() => {
        const videoCfg = resolveModelRequestConfig(config, config.videoModel || config.model);
        return resolveQueueOrigin(videoCfg.baseUrl || config.baseUrl);
    }, [config]);

    const fetchQueue = useCallback(
        async (manual = false) => {
            if (!queueOrigin) return;
            if (manual) setLoading(true);
            try {
                const res = await fetch(`${queueOrigin}/api/public/queue`, { cache: "no-store" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as PublicQueueSnapshot;
                if (data && data.ok) {
                    setSnapshot(data);
                    setUnavailable(false);
                }
            } catch {
                if (!snapshot) setUnavailable(true);
            } finally {
                if (manual) setLoading(false);
            }
        },
        [queueOrigin, snapshot],
    );

    useEffect(() => {
        if (!queueOrigin) return;
        void fetchQueue(false);
        const timer = window.setInterval(() => void fetchQueue(false), open ? 8000 : 15000);
        return () => window.clearInterval(timer);
    }, [queueOrigin, open, fetchQueue]);

    useEffect(() => {
        if (!open) return;
        const syncPos = () => setButtonRect(buttonRef.current?.getBoundingClientRect() || null);
        const closeOnOutside = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            setOpen(false);
        };
        syncPos();
        window.addEventListener("resize", syncPos);
        window.addEventListener("scroll", syncPos, true);
        window.addEventListener("pointerdown", closeOnOutside, true);
        return () => {
            window.removeEventListener("resize", syncPos);
            window.removeEventListener("scroll", syncPos, true);
            window.removeEventListener("pointerdown", closeOnOutside, true);
        };
    }, [open]);

    if (!queueOrigin || (unavailable && !snapshot)) return null;

    const sum = snapshot?.summary || {};
    const runCount = Number(sum.run || 0);
    const waitCount = Number(sum.pending || 0) + Number(sum.gateway_waiting || 0);
    const imgCount = Number(sum.image || 0) + Number(sum.image_run || 0);
    const totalCount = runCount + waitCount + imgCount;
    const isBusy = totalCount > 0;
    const items = snapshot?.items || [];

    const panel =
        open && buttonRect
            ? createPortal(
                  <div
                      ref={panelRef}
                      style={{
                          position: "fixed",
                          zIndex: 1200,
                          width: 420,
                          maxWidth: "calc(100vw - 24px)",
                          top: buttonRect.bottom + 8,
                          left: Math.max(12, Math.min(window.innerWidth - 432, buttonRect.right - 420)),
                          background: theme.toolbar.panel,
                          border: `1px solid ${theme.toolbar.border}`,
                          borderRadius: 16,
                          boxShadow: "0 18px 54px rgba(28, 25, 23, 0.18)",
                          color: theme.node.text,
                          overflow: "hidden",
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                  >
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${theme.toolbar.border}` }}>
                          <div className="flex items-center gap-2 text-sm font-semibold">
                              <span
                                  className="inline-block size-2 rounded-full"
                                  style={{ background: isBusy ? "#f59e0b" : "#22c55e" }}
                              />
                              <span>生成队列</span>
                              <span className="text-xs font-normal" style={{ color: theme.node.muted }}>
                                  {isBusy ? `预计 ${formatDuration(sum.total_left_s)} 清空` : "当前空闲"}
                              </span>
                          </div>
                          <div className="flex items-center gap-1">
                              <button
                                  type="button"
                                  className="grid size-7 cursor-pointer place-items-center rounded-lg transition hover:opacity-80"
                                  style={{ color: theme.node.muted }}
                                  title="刷新队列"
                                  onClick={() => void fetchQueue(true)}
                              >
                                  <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                              </button>
                              <button
                                  type="button"
                                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs transition hover:opacity-80"
                                  style={{ color: theme.node.muted }}
                                  title="在新窗口打开独立队列看板"
                                  onClick={() => window.open(`${queueOrigin}/queue`, "_blank", "noopener,noreferrer")}
                              >
                                  <span>大屏</span>
                                  <ExternalLink className="size-3" />
                              </button>
                          </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 px-4 py-2.5 text-center text-xs" style={{ borderBottom: `1px solid ${theme.toolbar.border}` }}>
                          <div className="rounded-lg py-1.5" style={{ background: theme.node.fill }}>
                              <div style={{ color: theme.node.muted }}>视频运行</div>
                              <div className="mt-0.5 text-base font-semibold">{runCount}</div>
                          </div>
                          <div className="rounded-lg py-1.5" style={{ background: theme.node.fill }}>
                              <div style={{ color: theme.node.muted }}>视频排队</div>
                              <div className="mt-0.5 text-base font-semibold">{waitCount}</div>
                          </div>
                          <div className="rounded-lg py-1.5" style={{ background: theme.node.fill }}>
                              <div style={{ color: theme.node.muted }}>出图队列</div>
                              <div className="mt-0.5 text-base font-semibold">{imgCount}</div>
                          </div>
                      </div>

                      <div className="thin-scrollbar max-h-[340px] overflow-y-auto px-3 py-2">
                          {items.length === 0 ? (
                              <div className="py-8 text-center text-xs" style={{ color: theme.node.muted }}>
                                  当前没有运行中或排队的任务
                              </div>
                          ) : (
                              <div className="space-y-1.5">
                                  {items.map((it, idx) => {
                                      const isRun = it.state === "running";
                                      const pct =
                                          isRun && it.est_total_s && it.elapsed_s != null
                                              ? Math.min(99, Math.max(4, Math.round((it.elapsed_s / it.est_total_s) * 100)))
                                              : 0;
                                      const spec =
                                          it.inst === "image"
                                              ? `${it.w && it.h ? `${it.w}×${it.h}` : "出图"}${it.n ? ` · ${it.n}张` : ""}`
                                              : `${it.w && it.h ? `${it.w}×${it.h}` : "视频"}${it.frames ? ` · ${(it.frames / 24).toFixed(1)}s` : ""}`;
                                      return (
                                          <div
                                              key={`${it.id}-${idx}`}
                                              className="rounded-xl px-3 py-2 text-xs"
                                              style={{ background: theme.node.fill }}
                                          >
                                              <div className="flex items-center justify-between gap-2">
                                                  <div className="flex min-w-0 items-center gap-1.5">
                                                      <span
                                                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                                          style={{
                                                              background: isRun ? "rgba(34,197,94,0.16)" : "rgba(245,158,11,0.16)",
                                                              color: isRun ? "#22c55e" : "#f59e0b",
                                                          }}
                                                      >
                                                          {isRun ? "运行中" : `排队 #${it.queue_position ?? idx}`}
                                                      </span>
                                                      <span className="truncate font-medium">{it.user || "匿名"}</span>
                                                      <span className="shrink-0 text-[11px]" style={{ color: theme.node.muted }}>
                                                          {it.inst === "image" ? "出图" : it.mode || "video"}
                                                      </span>
                                                  </div>
                                                  <span className="shrink-0 text-[11px]" style={{ color: theme.node.muted }}>
                                                      预计 {formatClock(it.eta_ms)}
                                                  </span>
                                              </div>
                                              <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: theme.node.muted }}>
                                                  <span>{spec}</span>
                                                  <span>
                                                      {isRun
                                                          ? `已跑 ${formatDuration(it.elapsed_s)} / ${formatDuration(it.est_total_s)}`
                                                          : `已等 ${formatDuration(it.elapsed_s)}`}
                                                  </span>
                                              </div>
                                              {isRun && pct > 0 ? (
                                                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full" style={{ background: theme.toolbar.border }}>
                                                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#22c55e" }} />
                                                  </div>
                                              ) : null}
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                  </div>,
                  document.body,
              )
            : null;

    return (
        <>
            <span ref={buttonRef} className="inline-flex">
                <Button
                    type="text"
                    className="!h-10 !rounded-xl !px-3 !font-medium"
                    style={{
                        background: open ? theme.toolbar.activeBg : theme.toolbar.panel,
                        color: theme.node.text,
                        boxShadow: "0 10px 30px rgba(28,25,23,.10)",
                    }}
                    icon={<ListOrdered className="size-4" />}
                    onClick={() => {
                        setOpen((v) => !v);
                        void fetchQueue(true);
                    }}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className="inline-block size-2 rounded-full"
                            style={{ background: isBusy ? "#f59e0b" : "#22c55e" }}
                        />
                        <span>{isBusy ? `队列 ${totalCount}` : "队列 空闲"}</span>
                    </span>
                </Button>
            </span>
            {panel}
        </>
    );
}
