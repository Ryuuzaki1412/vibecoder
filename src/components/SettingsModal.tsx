import { useState } from "react";
import type { AIConfig, AIProvider } from "../types";
import { PROVIDER_PRESETS } from "../types";
import { Icon } from "./Icon";
import { testAI } from "../lib/tauri";
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