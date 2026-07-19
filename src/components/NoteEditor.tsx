import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note, NoteStatus, AIConfig, PromptTemplate } from "../types";
import { NOTE_STATUS_LABELS, NOTE_STATUS_ORDER } from "../types";
import { Icon } from "./Icon";
import { StatusIndicator } from "./StatusBadge";
import { renderMarkdown } from "../lib/markdown";
import { callAI } from "../lib/tauri";
import { formatTime } from "../lib/storage";

interface NoteEditorProps {
  note: Note;
  config: AIConfig;
  hasAPIKey: boolean;
  templates: PromptTemplate[];
  onChange: (patch: Partial<Pick<Note, "title" | "content" | "mvp">>) => void;
  onStatusChange: (status: NoteStatus) => void;
  onRequestOpenSettings: () => void;
  onToast: (
    kind: "info" | "success" | "error" | "warning",
    msg: string,
  ) => void;
}

const POLISH_SYSTEM_PROMPT = `你是 VibeCoder 的「润色助手」。
你的唯一职责是把用户给的文字改写得**更清晰、更通顺、更专业**,仅此而已。

严格要求:
- 严格保留原文的所有事实、观点、立场和数据,**不要新增、删减或改写用户的意思**
- 只能修正错别字、语法、标点、用词、句式
- 可以用 Markdown 优化排版(列表、加粗、标题层级),但不要新增原文没有的章节或小标题
- **绝对不要**输出 MVP 方案、产品设计、技术栈、代码示例、目录、摘要、说明、前后缀
- 直接输出润色后的正文,不要加任何额外内容、解释、引用或包装文字`;

const PERSIST_DEBOUNCE_MS = 250;

// ============================================================
// NoteEditor — markdown source editor (PERF-FIXED v2)
//
// - Textarea is UNCONTROLLED: browser owns the value, React never
//   re-renders on keystroke.
// - Word count updates via direct DOM (a <span> ref), no React state.
// - Preview is snapshotted on toggle (renderMarkdown runs once per
//   open, not on every keystroke).
// - Debounced commit (250ms) to the parent so App / Sidebar don't
//   re-render while typing.
// ============================================================

export function NoteEditor({
  note,
  config,
  hasAPIKey,
  templates,
  onChange,
  onStatusChange,
  onRequestOpenSettings,
  onToast,
}: NoteEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const wordCountRef = useRef<HTMLSpanElement>(null);

  const [isPolishing, setIsPolishing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const polishTemplate = useMemo(
    () => templates.find((t) => t.type === "polish"),
    [templates],
  );

  // ============================================================
  // Persistence — debounced commit, latest-value-wins
  // ============================================================
  const pendingTimer = useRef<number | null>(null);
  const pendingValue = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const flushPending = useCallback(() => {
    if (pendingTimer.current !== null) {
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
    if (pendingValue.current !== null) {
      onChangeRef.current({ content: pendingValue.current });
      pendingValue.current = null;
    }
  }, []);

  // Flush on unmount so we never lose the last keystrokes.
  useEffect(() => {
    return () => {
      if (pendingTimer.current !== null) {
        window.clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
      if (pendingValue.current !== null) {
        onChangeRef.current({ content: pendingValue.current });
        pendingValue.current = null;
      }
    };
  }, []);

  // Switch note → flush old, sync title/content/title-height via ref
  useEffect(() => {
    flushPending();
    const initialContent = note.content || "";
    if (editorRef.current) editorRef.current.value = initialContent;
    if (titleRef.current) {
      titleRef.current.value = note.title || "";
      titleRef.current.style.height = "auto";
      titleRef.current.style.height =
        titleRef.current.scrollHeight + "px";
    }
    if (wordCountRef.current)
      wordCountRef.current.textContent = `${initialContent.length} 字`;
    setIsPreviewing(false);
    setPreviewHtml("");
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // Handlers (all touch the DOM directly — no React state per keystroke)
  // ============================================================

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ title: e.currentTarget.value });
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const schedulePersist = useCallback((val: string) => {
    pendingValue.current = val;
    if (pendingTimer.current !== null) {
      window.clearTimeout(pendingTimer.current);
    }
    pendingTimer.current = window.setTimeout(() => {
      pendingTimer.current = null;
      if (pendingValue.current !== null) {
        onChangeRef.current({ content: pendingValue.current });
        pendingValue.current = null;
      }
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const handleContentChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const val = e.currentTarget.value;
    if (wordCountRef.current)
      wordCountRef.current.textContent = `${val.length} 字`;
    schedulePersist(val);
  };

  const togglePreview = () => {
    if (isPreviewing) {
      setIsPreviewing(false);
      return;
    }
    const val = editorRef.current?.value ?? "";
    setPreviewHtml(renderMarkdown(val));
    setIsPreviewing(true);
  };

  const refreshPreviewIfOpen = () => {
    if (!isPreviewing) return;
    const val = editorRef.current?.value ?? "";
    setPreviewHtml(renderMarkdown(val));
  };

  const handlePolish = async () => {
    const val = editorRef.current?.value ?? "";
    if (!val.trim()) {
      onToast("warning", "内容为空,先写点东西再润色");
      return;
    }
    if (!hasAPIKey) {
      onToast("warning", "请先在 ⚙ 设置中配置 AI API Key");
      onRequestOpenSettings();
      return;
    }
    setIsPolishing(true);
    try {
      const userPrompt = polishTemplate
        ? polishTemplate.content.replace(/\{\{content\}\}/g, val)
        : val;
      const polished = await callAI(config, POLISH_SYSTEM_PROMPT, userPrompt);
      // Strip accidental markdown code fences the model might emit
      const cleaned = polished
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/```\s*$/, "")
        .trim();
      if (editorRef.current) {
        editorRef.current.value = cleaned;
        editorRef.current.focus();
        editorRef.current.setSelectionRange(cleaned.length, cleaned.length);
      }
      if (wordCountRef.current)
        wordCountRef.current.textContent = `${cleaned.length} 字`;
      refreshPreviewIfOpen();
      // Commit immediately (no debounce for AI-rewritten content)
      flushPending();
      pendingValue.current = cleaned;
      onChangeRef.current({ content: cleaned });
      pendingValue.current = null;
      onToast("success", "润色完成 ✨");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      onToast("error", `润色失败: ${msg}`);
    } finally {
      setIsPolishing(false);
    }
  };

  return (
    <div className="editor">
      {/* Title + status row */}
      <div className="editor-title-row">
        <textarea
          ref={titleRef}
          className="editor-title"
          rows={1}
          defaultValue={note.title}
          placeholder="给这个想法起个名字..."
          onChange={handleTitleChange}
        />
        <div className="status-picker">
          <button
            className="status-picker-trigger"
            onClick={() => setStatusMenuOpen((v) => !v)}
            title="更改状态"
          >
            <StatusIndicator status={note.status} />
            <Icon name="edit" size={12} />
          </button>
          {statusMenuOpen && (
            <div className="status-picker-menu">
              {NOTE_STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  className={`status-picker-item ${
                    s === note.status ? "active" : ""
                  }`}
                  onClick={() => {
                    onStatusChange(s);
                    setStatusMenuOpen(false);
                  }}
                >
                  <StatusIndicator status={s} />
                  <span>{NOTE_STATUS_LABELS[s]}</span>
                  {s === note.status && (
                    <span className="status-check">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action bar (AI + meta) */}
      <div className="editor-meta-bar">
        <div className="editor-meta-row">
          <span>更新于 {formatTime(note.updatedAt)}</span>
          <span>·</span>
          <span ref={wordCountRef}>{(note.content || "").length} 字</span>
          <span className="editor-hint">· 支持 Markdown</span>
        </div>
        <div className="editor-actions">
          <button
            className="btn-secondary"
            onClick={togglePreview}
            title={isPreviewing ? "切回编辑" : "预览(渲染 Markdown)"}
          >
            <Icon name={isPreviewing ? "edit" : "eye"} size={14} />
            {isPreviewing ? "编辑" : "预览"}
          </button>
          <button
            className="btn-primary"
            onClick={handlePolish}
            disabled={isPolishing}
            title="AI 润色当前笔记"
          >
            {isPolishing ? (
              <>
                <span
                  className="icon-btn loading"
                  style={{ width: 14, height: 14 }}
                >
                  <Icon name="sparkles" size={14} />
                </span>
                润色中
              </>
            ) : (
              <>
                <Icon name="sparkles" size={14} />
                AI 润色
              </>
            )}
          </button>
        </div>
      </div>

      <div className="editor-divider" />

      {/* Content area */}
      <div className="editor-body">
        {isPreviewing ? (
          <div
            className="md editor-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <textarea
            ref={editorRef}
            className="editor-textarea"
            defaultValue={note.content || ""}
            onChange={handleContentChange}
            spellCheck={false}
            placeholder={
              "随便写 — 潦草、碎片、念头都可以。\n\n" +
              "支持 Markdown:\n" +
              "**加粗**  *斜体*  `行内代码`  ~~删除线~~\n" +
              "# 标题  ## 二级标题  ### 三级标题\n" +
              "- 无序列表 / 1. 有序列表(可嵌套缩进)\n" +
              "> 引用\n" +
              "```代码块```\n" +
              "--- 分隔线\n" +
              "[链接](url)"
            }
          />
        )}
      </div>

      {/* MVP section — still rendered as markdown (AI-generated) */}
      {note.mvp && (
        <div className="mvp-section">
          <div className="mvp-header">
            <span className="mvp-title">
              <Icon name="rocket" size={16} />
              MVP 产品方案
            </span>
            <button
              className="btn-ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(note.mvp || "");
                onToast("success", "已复制到剪贴板");
              }}
              title="复制 MVP"
            >
              <Icon name="copy" size={13} />
              复制
            </button>
          </div>
          <div
            className="mvp-content md"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(note.mvp) }}
          />
        </div>
      )}
    </div>
  );
}