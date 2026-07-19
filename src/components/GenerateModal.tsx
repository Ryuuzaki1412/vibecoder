import { useEffect, useMemo, useRef, useState } from "react";
import type { AIConfig, PromptTemplate } from "../types";
import { Icon } from "./Icon";
import { callAI } from "../lib/tauri";

interface GenerateModalProps {
  templates: PromptTemplate[];
  /** Plain-text content extracted from the editor (not raw HTML). */
  noteContent: string;
  config: AIConfig;
  hasAPIKey: boolean;
  onClose: () => void;
  onGenerated: (mvp: string) => void;
  onToast: (kind: "info" | "success" | "error" | "warning", msg: string) => void;
  onRequestOpenSettings: () => void;
}

const MVP_SYSTEM_PROMPT = `你是 VibeCoder 的「MVP 架构师」。
你根据用户的想法,产出一份可落地的最小可行产品(MVP)方案。
要求:
- 用中文回答,使用 Markdown 格式
- 务实、具体、可执行 — 避免空话
- 技术栈建议要给出理由,而非罗列名词
- 开发步骤按 MVP 范围(最小可发布单元)拆解
- 不要给出超过必要范围的复杂方案`;

export function GenerateModal({
  templates,
  noteContent,
  config,
  hasAPIKey,
  onClose,
  onGenerated,
  onToast,
  onRequestOpenSettings,
}: GenerateModalProps) {
  const mvpTemplates = useMemo(
    () => templates.filter((t) => t.type === "mvp" || t.type === "custom"),
    [templates],
  );
  const [selectedTplId, setSelectedTplId] = useState<string>(
    mvpTemplates[0]?.id ?? "",
  );
  const [extra, setExtra] = useState("");
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);

  // Auto-scroll streaming output
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamText]);

  const handleGenerate = async () => {
    if (!hasAPIKey) {
      onToast("warning", "请先在 ⚙ 设置中配置 AI API Key");
      onRequestOpenSettings();
      return;
    }
    if (!noteContent.trim()) {
      onToast("warning", "当前笔记为空,先写点东西");
      return;
    }
    const tpl = templates.find((t) => t.id === selectedTplId);
    if (!tpl) {
      onToast("error", "未选中模板");
      return;
    }

    const userContent = extra.trim()
      ? `${noteContent}\n\n---\n补充说明:${extra.trim()}`
      : noteContent;

    const userPrompt = tpl.content.replace(/\{\{content\}\}/g, userContent);

    setStreamText("");
    setIsStreaming(true);
    try {
      const text = await callAI(config, MVP_SYSTEM_PROMPT, userPrompt);
      setStreamText(text);
      onToast("success", "MVP 方案生成完成 🚀");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      onToast("error", `生成失败: ${msg}`);
      setStreamText(`(错误: ${msg})`);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSaveToNote = () => {
    if (!streamText) return;
    onGenerated(streamText);
    onClose();
  };

  const handleCopy = async () => {
    if (!streamText) return;
    await navigator.clipboard.writeText(streamText);
    onToast("success", "已复制到剪贴板");
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Icon name="rocket" size={20} />&nbsp;生成 MVP 方案
          </h2>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>选择模板</label>
            <select
              value={selectedTplId}
              onChange={(e) => setSelectedTplId(e.target.value)}
            >
              {mvpTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.type === "mvp" ? "· 推荐" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>
              补充说明
              <span className="optional">可选 — 例如目标平台、预算、时间约束</span>
            </label>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={3}
              placeholder="例:面向 macOS 用户,3 个月内上线,1 人开发..."
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
              }}
            >
              输出
            </span>
            {streamText && (
              <button className="btn-ghost" onClick={handleCopy}>
                <Icon name="copy" size={12} />
                复制
              </button>
            )}
          </div>

          <div
            ref={streamRef}
            className={`stream-area ${isStreaming ? "thinking" : ""}`}
          >
            {streamText ||
              (isStreaming
                ? "AI 正在思考"
                : "点击「开始生成」让 AI 基于你的笔记产出 MVP 方案")}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn-secondary"
            onClick={handleCopy}
            disabled={!streamText || isStreaming}
          >
            <Icon name="copy" size={14} />
            复制
          </button>
          <button
            className="btn-primary"
            onClick={handleSaveToNote}
            disabled={!streamText || isStreaming}
            title="保存到笔记底部"
          >
            <Icon name="check" size={14} />
            保存到笔记
          </button>
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={isStreaming}
            style={{ background: "var(--accent-hover)" }}
          >
            <Icon name="rocket" size={14} />
            {isStreaming ? "生成中..." : streamText ? "重新生成" : "开始生成"}
          </button>
        </div>
      </div>
    </div>
  );
}