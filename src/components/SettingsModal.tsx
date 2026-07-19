import { useState } from "react";
import type { AIConfig, AIProvider } from "../types";
import { PROVIDER_PRESETS } from "../types";
import { Icon } from "./Icon";
import {
  check,
  relaunchApp,
  testAI,
  type Update,
  type DownloadEvent,
} from "../lib/tauri";

interface SettingsModalProps {
  config: AIConfig;
  onChange: (patch: Partial<AIConfig>) => void;
  onReset: () => void;
  onClose: () => void;
  onToast: (kind: "info" | "success" | "error" | "warning", msg: string) => void;
}

export function SettingsModal({
  config,
  onChange,
  onReset,
  onClose,
  onToast,
}: SettingsModalProps) {
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    state: "idle" | "loading" | "success" | "error";
    msg: string;
  }>({ state: "idle", msg: "" });

  // Online update state
  type UpdatePhase =
    | "idle"
    | "checking"
    | "downloading"
    | "ready"   // downloaded & installed, awaiting user click to restart
    | "uptodate"
    | "error";
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>("idle");
  const [updateObj, setUpdateObj] = useState<Update | null>(null);
  const [downloadPct, setDownloadPct] = useState<number>(0);
  const [updateError, setUpdateError] = useState<string>("");

  const handleProviderChange = (provider: AIProvider) => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === provider);
    if (preset) {
      onChange({
        provider,
        baseUrl: preset.baseUrl,
        model: preset.model,
      });
    } else {
      onChange({ provider });
    }
  };

  const handleTest = async () => {
    if (!config.apiKey.trim() && config.provider !== "ollama" && config.provider !== "lmstudio") {
      setTestResult({ state: "error", msg: "API Key 为空,无法测试" });
      return;
    }
    setTestResult({ state: "loading", msg: "正在连接 AI..." });
    try {
      const reply = await testAI(config);
      setTestResult({
        state: "success",
        msg: `✅ 连接成功!AI 回复:「${reply.slice(0, 80)}${reply.length > 80 ? "..." : ""}」`,
      });
      onToast("success", "AI 连接测试成功");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ state: "error", msg: `❌ 连接失败: ${msg}` });
      onToast("error", "AI 连接测试失败");
    }
  };

  const handleCheckUpdate = async () => {
    setUpdatePhase("checking");
    setUpdateError("");
    try {
      const update = await check();
      if (update === null) {
        setUpdatePhase("uptodate");
        setUpdateObj(null);
      } else {
        setUpdatePhase("idle");
        setUpdateObj(update);
      }
    } catch (e: unknown) {
      setUpdatePhase("error");
      setUpdateError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleInstall = async () => {
    if (!updateObj) return;
    setUpdatePhase("downloading");
    setDownloadPct(0);
    try {
      await updateObj.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          const total = event.data.contentLength ?? 0;
          setDownloadPct(total > 0 ? 1 : 0);
        } else if (event.event === "Progress") {
          // Tauri 2.0's Progress event reports chunk length only; we show
          // a moving indeterminate indicator since we don't get cumulative
          // bytes for free. Once Finished fires we'll snap to 100%.
          setDownloadPct((p) => Math.min(95, Math.max(p + 3, 5)));
        } else if (event.event === "Finished") {
          setDownloadPct(100);
        }
      });
      setUpdatePhase("ready");
    } catch (e: unknown) {
      setUpdatePhase("error");
      setUpdateError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRestart = async () => {
    try {
      await relaunchApp();
    } catch (e: unknown) {
      setUpdatePhase("error");
      setUpdateError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>设置</h2>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">
          {/* AI */}
          <div className="settings-section">
            <h3>AI 提供方</h3>
            <p className="hint">
              所有 AI 调用(润色、生成 MVP)都通过你的 API Key 直接连到对应服务,
              <br />
              VibeCoder 不存储、不转发你的 Key 到任何第三方。
            </p>

            <div className="form-row">
              <label>Provider</label>
              <select
                value={config.provider}
                onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
              >
                {PROVIDER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {(() => {
                const preset = PROVIDER_PRESETS.find((p) => p.id === config.provider);
                return preset?.note ? (
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--accent-text)",
                      marginTop: 6,
                      fontStyle: "italic",
                    }}
                  >
                    💡 {preset.note}
                  </p>
                ) : null;
              })()}
            </div>

            <div className="form-row">
              <label>Base URL</label>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) => onChange({ baseUrl: e.target.value })}
                placeholder="https://api.anthropic.com"
              />
            </div>

            <div className="form-row">
              <label>Model ID</label>
              <input
                type="text"
                value={config.model}
                onChange={(e) => onChange({ model: e.target.value })}
                placeholder="claude-3-5-sonnet-latest"
              />
            </div>

            <div className="form-row">
              <label>API Key</label>
              <div className="input-wrap">
                <input
                  type={showKey ? "text" : "password"}
                  value={config.apiKey}
                  onChange={(e) => onChange({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  autoComplete="off"
                />
                <button
                  className="icon-btn-sm"
                  onClick={() => setShowKey((v) => !v)}
                  title={showKey ? "隐藏" : "显示"}
                >
                  <Icon name={showKey ? "eye-off" : "eye"} size={14} />
                </button>
              </div>
            </div>

            <div className="form-row">
              <label>超时 (秒)</label>
              <input
                type="number"
                min={10}
                max={600}
                value={config.timeoutSecs}
                onChange={(e) =>
                  onChange({ timeoutSecs: Number(e.target.value) || 120 })
                }
              />
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={handleTest}>
                <Icon name="check" size={14} />
                测试连接
              </button>
              <button className="btn-ghost" onClick={onReset}>
                重置为默认
              </button>
            </div>

            {testResult.state !== "idle" && (
              <div className={`test-result ${testResult.state}`}>
                {testResult.msg}
              </div>
            )}
          </div>

          {/* Update */}
          <div className="settings-section">
            <h3>更新</h3>
            <p className="hint">
              一键从 GitHub Releases 拉新版,签名校验 + 自动安装 + 重启。
            </p>

            <div className="form-actions">
              <button
                className="btn-secondary"
                onClick={handleCheckUpdate}
                disabled={updatePhase === "checking" || updatePhase === "downloading"}
              >
                <Icon name="refresh" size={14} />
                {updatePhase === "checking" ? "检查中..." : "检查更新"}
              </button>
              {updateObj && updatePhase === "idle" && (
                <button
                  className="btn-primary"
                  onClick={handleInstall}
                  style={{ fontSize: 12 }}
                >
                  <Icon name="download" size={12} />
                  下载并安装 v{updateObj.version}
                </button>
              )}
              {updatePhase === "downloading" && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  下载中... {downloadPct > 0 ? `${downloadPct}%` : ""}
                </span>
              )}
              {updatePhase === "ready" && (
                <button
                  className="btn-primary"
                  onClick={handleRestart}
                  style={{ fontSize: 12, background: "var(--success)" }}
                >
                  ✓ 已下载 — 重启应用
                </button>
              )}
              {updatePhase === "uptodate" && (
                <span style={{ fontSize: 12, color: "var(--success)" }}>
                  ✓ 已是最新版本
                </span>
              )}
            </div>

            {updatePhase === "error" && (
              <div className="test-result error">
                ❌ {updateError}
              </div>
            )}

            {updateObj && updateObj.body && updatePhase === "idle" && (
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.55,
                  maxHeight: 120,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  background: "var(--bg-code)",
                  padding: 8,
                  borderRadius: 4,
                  marginTop: 10,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {updateObj.body}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}