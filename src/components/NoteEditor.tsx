import { useEffect, useMemo, useRef, useState } from "react";
import type { Note, NoteStatus, AIConfig, PromptTemplate } from "../types";
import { NOTE_STATUS_LABELS, NOTE_STATUS_ORDER } from "../types";
import { Icon } from "./Icon";
import { StatusIndicator } from "./StatusBadge";
import { StickyFormatToolbar, FloatingBubble } from "./FormatToolbar";
import { renderMarkdown } from "../lib/markdown";
import { callAI } from "../lib/tauri";
import { formatTime } from "../lib/storage";
import {
  filterImageFiles,
  insertImagesAtCursor,
} from "../lib/image";

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

// Strengthened system prompt — fix for bug #3 (polish was leaking MVP / code).
const POLISH_SYSTEM_PROMPT = `你是 VibeCoder 的「润色助手」。
你的唯一职责是把用户给的文字改写得**更清晰、更通顺、更专业**,仅此而已。

严格要求:
- 严格保留原文的所有事实、观点、立场和数据,**不要新增、删减或改写用户的意思**
- 只能修正错别字、语法、标点、用词、句式
- 可以用 Markdown 优化排版(列表、加粗、标题层级),但不要新增原文没有的章节或小标题
- **绝对不要**输出 MVP 方案、产品设计、技术栈、代码示例、目录、摘要、说明、前后缀
- 直接输出润色后的正文,不要加任何额外内容、解释、引用或包装文字`;

// Strip HTML → plain text (for AI + status counting + preview)
function htmlToText(html: string): string {
  // Render to a detached element to get innerText (preserves line breaks
  // between block-level elements). AI-polish output is stored as HTML
  // (<p>, <br>, etc.) so we parse it; plain-text content without tags
  // passes through unchanged.
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.innerText || "").trim();
}

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
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  // Pick the user's polish-type template (first match). Falls back to none.
  const polishTemplate = useMemo(
    () => templates.find((t) => t.type === "polish"),
    [templates],
  );

  // Fix bug #1: switching notes (including creating a new one) always
  // starts in EDIT mode, not preview mode.
  useEffect(() => {
    setIsPreviewing(false);
  }, [note.id]);

  // Sync editor content when:
  //   - switching to a different note (note.id changed)
  //   - returning from preview to edit (isPreviewing flipped false — the
  //     contentEditable div was unmounted and remounted empty)
  // Fixes bug #2.
  useEffect(() => {
    if (isPreviewing) return;
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== note.content) {
      editorRef.current.innerHTML = note.content || "";
    }
  }, [note.id, isPreviewing]);

  // Auto-grow title textarea
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [note.title]);

  const plainText = htmlToText(note.content);

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ title: e.target.value });
  };

  const handleContentInput = () => {
    const html = editorRef.current?.innerHTML ?? "";
    onChange({ content: html });
  };

  // Paste handler — supports images (screenshots, copied images, files)
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const images = filterImageFiles(e.clipboardData.files);
    if (images.length > 0) {
      e.preventDefault();
      e.currentTarget.focus();
      await insertImagesAtCursor(images);
      return;
    }
    // No images — fall back to plain text only (strip HTML formatting from paste)
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  // Drag & drop image support
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!isDragOver) setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only react when leaving the editor for real (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    const images = filterImageFiles(e.dataTransfer.files);
    if (images.length > 0) {
      e.preventDefault();
      e.currentTarget.focus();
      await insertImagesAtCursor(images);
    }
  };

  const handlePolish = async () => {
    if (!plainText) {
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
      // Use the user's "润色助手" template if defined (fix for bug #3 —
      // previously the hardcoded prompt was used and the template was
      // ignored). Falls back to plain text if no template.
      const userPrompt = polishTemplate
        ? polishTemplate.content.replace(/\{\{content\}\}/g, plainText)
        : plainText;
      const polished = await callAI(config, POLISH_SYSTEM_PROMPT, userPrompt);
      // Wrap the polished result in paragraphs if it doesn't look like HTML already
      const looksLikeHtml = /<[a-z][\s\S]*>/i.test(polished);
      const html = looksLikeHtml
        ? polished
        : polished
            .split(/\n\n+/)
            .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
            .join("");
      onChange({ content: html });
      // Apply to editor immediately
      if (editorRef.current) editorRef.current.innerHTML = html;
      onToast("success", "润色完成 ✨");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      onToast("error", `润色失败: ${msg}`);
    } finally {
      setIsPolishing(false);
    }
  };

  const getEditor = () => editorRef.current;
  return (
    <div className="editor">
      {/* Title + status row */}
      <div className="editor-title-row">
        <textarea
          ref={titleRef}
          className="editor-title"
          rows={1}
          value={note.title}
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
                  {s === note.status && <span className="status-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor toolbar (sticky) */}
      <div className="editor-toolbar-row">
        <StickyFormatToolbar getEditor={getEditor} />
      </div>

      {/* Action bar (AI + meta) */}
      <div className="editor-meta-bar">
        <div className="editor-meta-row">
          <span>更新于 {formatTime(note.updatedAt)}</span>
          <span>·</span>
          <span>{plainText.length} 字</span>
        </div>
        <div className="editor-actions">
          <button
            className="btn-secondary"
            onClick={() => setIsPreviewing((v) => !v)}
            title={isPreviewing ? "切回编辑" : "预览模式"}
          >
            <Icon name={isPreviewing ? "edit" : "eye"} size={14} />
            {isPreviewing ? "编辑" : "预览"}
          </button>
          <button
            className="btn-primary"
            onClick={handlePolish}
            disabled={isPolishing || !plainText}
            title="AI 润色当前笔记"
          >
            {isPolishing ? (
              <>
                <span className="icon-btn loading" style={{ width: 14, height: 14 }}>
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
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(plainText),
            }}
          />
        ) : (
          <div
            ref={editorRef}
            className={`editor-rich ${isDragOver ? "drag-over" : ""}`}
            contentEditable
            suppressContentEditableWarning
            onInput={handleContentInput}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-placeholder="随便写 — 潦草、碎片、念头都可以。&#10;&#10;工具栏可插入图片、加粗、颜色等..."
          />
        )}
        {isDragOver && (
          <div className="drop-overlay">
            <div className="drop-overlay-card">
              <Icon name="plus" size={28} />
              <div>松开鼠标插入图片</div>
            </div>
          </div>
        )}
      </div>

      {/* Floating bubble menu (positioned over selection) */}
      <FloatingBubble getEditor={getEditor} />

      {/* MVP section */}
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}