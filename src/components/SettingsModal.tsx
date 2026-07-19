import { useState } from "react";
import type { AIConfig, AIProvider } from "../types";
import { PROVIDER_PRESETS } from "../types";
import { Icon } from "./Icon";
import { checkUpdate, downloadUpdate, testAI, type UpdateInfo } from "../lib/tauri";
import type { EditorFont } from "../lib/storage";
import { EDITOR_FONT_OPTIONS } from "../lib/storage";

interface SettingsModalProps {
  config: AIConfig;
  editorFont: EditorFont;
  onChangeEditorFont: (f: EditorFont) => void;
  onChange: (patch: Partial<AIConfig>) => void;
  onReset: () => void;
  onClose: () => void;
  onToast: (kind: "info" | "success" | "error" | "warning", msg: string) => void;
}

export function SettingsModal({
  config,
  editorFont,
  onChangeEditorFont,
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
  type UpdateState =
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "result"; info: UpdateInfo; downloading: boolean; downloadedTo?: string }
    | { kind: "error"; msg: string };
  const [updateState, setUpdateState] = useState<UpdateState>({ kind: "idle" });

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
    setUpdateState({ kind: "checking" });
    try {
      const info = await checkUpdate();
      setUpdateState({ kind: "result", info, downloading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setUpdateState({ kind: "error", msg });
    }
  };

  const handleDownload = async () => {
    if (updateState.kind !== "result") return;
    // Pick the platform-appropriate asset (macOS DMG for now).
    const dmg = updateState.info.assets.find(
      (a) => a.name.endsWith(".dmg") || a.name.endsWith(".zip"),
    );
    if (!dmg) {
      setUpdateState({
        kind: "error",
        msg: "没找到适合当前平台的下载文件",
      });
      return;
    }
    setUpdateState({ ...updateState, downloading: true });
    try {
      const dest = await downloadUpdate(dmg.browser_download_url, dmg.name);
      setUpdateState({ ...updateState, downloading: false, downloadedTo: dest });
      onToast(
        "success",
        `已下载到 ${dest.split("/").pop()} — 请把应用拖入 /Applications 替换旧版`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setUpdateState({ kind: "error", msg });
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
          {/* Appearance */}
          <div className="settings-section">
            <h3>外观</h3>
            <p className="hint">编辑器正文字体。可随时切换。</p>
            <div className="font-grid">
              {EDITOR_FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={`font-card font-${opt.id} ${editorFont === opt.id ? "active" : ""}`}
                  onClick={() => onChangeEditorFont(opt.id)}
                >
                  <div className="font-sample">Aa</div>
                  <div className="font-name">{opt.label}</div>
                  {editorFont === opt.id && (
                    <span className="font-check">
                      <Icon name="check" size={12} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

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
              从 GitHub Releases 检查新版。点击「下载」会保存到 ~/Downloads
              并自动打开 DMG,把它拖进 /Applications 即可覆盖旧版。
            </p>

            <div className="form-actions">
              <button
                className="btn-secondary"
                onClick={handleCheckUpdate}
                disabled={updateState.kind === "checking"}
              >
                <Icon name="refresh" size={14} />
                {updateState.kind === "checking" ? "检查中..." : "检查更新"}
              </button>
            </div>

            {updateState.kind === "error" && (
              <div className="test-result error">
                ❌ 检查失败:{updateState.msg}
              </div>
            )}

            {updateState.kind === "result" && (
              <UpdateResultPanel
                state={updateState}
                onDownload={handleDownload}
              />
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

// ============================================================
// Update result sub-panel
// ============================================================

interface UpdateResultPanelProps {
  state: Extract<
    { kind: "result"; info: UpdateInfo; downloading: boolean; downloadedTo?: string },
    { kind: "result" }
  >;
  onDownload: () => void;
}

function UpdateResultPanel({ state, onDownload }: UpdateResultPanelProps) {
  const { info, downloading, downloadedTo } = state;
  const hasUpdate = info.has_update;
  return (
    <div
      className={`test-result ${hasUpdate ? "loading" : "success"}`}
      style={{ marginTop: 14 }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {hasUpdate
          ? `🎉 发现新版本 v${info.latest_version}`
          : `✅ 已是最新版本`}
      </div>
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
        当前版本 v{info.current_version}
        {info.published_at
          ? `  ·  发布于 ${new Date(info.published_at).toLocaleDateString()}`
          : ""}
      </div>
      {info.release_name && (
        <div style={{ fontSize: 12, marginBottom: 6 }}>
          <strong>{info.release_name}</strong>
        </div>
      )}
      {info.release_notes && (
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.55,
            maxHeight: 120,
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            background: "var(--bg)",
            padding: 8,
            borderRadius: 4,
            marginBottom: 8,
            fontFamily: "var(--font-sans)",
          }}
        >
          {info.release_notes}
        </div>
      )}
      {hasUpdate && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="btn-primary"
            onClick={onDownload}
            disabled={downloading || !!downloadedTo}
            style={{ fontSize: 12 }}
          >
            <Icon name="download" size={12} />
            {downloading
              ? "下载中..."
              : downloadedTo
                ? "✓ 已下载"
                : "下载并打开"}
          </button>
          <a
            href={info.release_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--text-muted)" }}
          >
            在 GitHub 查看 →
          </a>
        </div>
      )}
      {downloadedTo && (
        <div style={{ fontSize: 11, marginTop: 8, color: "var(--success)" }}>
          ✓ 已保存到 <code>{downloadedTo}</code>
          <br />
          DMG 已自动挂载,把 VibeCoder.app 拖入 /Applications 替换旧版。
        </div>
      )}
    </div>
  );
}