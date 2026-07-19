import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note, NoteStatus, AIConfig, PromptTemplate } from "../types";
import { NOTE_STATUS_LABELS, NOTE_STATUS_ORDER } from "../types";
import { Icon } from "./Icon";
import { StatusIndicator } from "./StatusBadge";
import { renderMarkdown } from "../lib/markdown";
import { callAI } from "../lib/tauri";
import { formatTime } from "../lib/storage";
import {
  buildImgMarkdown,
  filterImageFiles,
  readImageAsCompressedDataUrl,
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

const POLISH_SYSTEM_PROMPT = `你是 VibeCoder 的「润色助手」。
你的唯一职责是把用户给的文字改写得**更清晰、更通顺、更专业**,仅此而已。

严格要求:
- 严格保留原文的所有事实、观点、立场和数据,**不要新增、删减或改写用户的意思**
- 只能修正错别字、语法、标点、用词、句式
- **不要使用 Markdown 格式**(不要加粗、不要列表、不要标题、不要代码块),输出纯文本段落
- **绝对不要**输出 MVP 方案、产品设计、技术栈、代码示例、目录、摘要、说明、前后缀
- 直接输出润色后的正文,不要加任何额外内容、解释、引用或包装文字`;

const PERSIST_DEBOUNCE_MS = 250;

// ============================================================
// contenteditable markdown source editor
//
// The editor is a contentEditable div. We render the markdown source
// as plain text, EXCEPT `![alt](data:image/...)` tokens which we replace
// with contenteditable=false "chips" that show the actual image
// thumbnail + alt text. This way:
//   - User sees the rendered image (not raw base64) in the editor
//   - The underlying source is still pure markdown (round-trips cleanly)
//   - The preview pane uses the same `renderMarkdown` for full rendering
// ============================================================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert markdown source to HTML for the contenteditable. Image
 *  tokens become chip spans; other text is HTML-escaped; newlines
 *  become <br>. */
function markdownToEditorHtml(md: string): string {
  let out = escapeHtml(md);
  // Image: ![alt](url) — must match BEFORE the link regex (which
  // also matches [..](..)). Only convert data: URLs to chips (those
  // are the ones with the long base64 the user wants hidden). For
  // http(s) URLs, just keep the markdown text — preview will render.
  out = out.replace(
    /!\[([^\]]*)\]\((data:image\/[a-z0-9+.-]+;base64,[A-Za-z0-9+/=]+)\)/g,
    (_m, altEsc, srcEsc) =>
      `<span class="md-img-chip" contenteditable="false" data-src="${srcEsc}">` +
      `<img class="md-img-thumb" src="${srcEsc}" alt="${altEsc}" />` +
      `<span class="md-img-meta">📷 ${altEsc || "image"}</span>` +
      `</span>`,
  );
  out = out.replace(/\n/g, "<br>");
  return out;
}

/** Walk the contenteditable DOM and reconstruct the markdown source. */
function editorHtmlToMarkdown(root: HTMLElement): string {
  let result = "";
  const walk = (el: Node): void => {
    if (el.nodeType === Node.TEXT_NODE) {
      result += el.textContent;
      return;
    }
    if (el.nodeType !== Node.ELEMENT_NODE) return;
    const elem = el as HTMLElement;
    const tag = elem.tagName.toLowerCase();
    if (tag === "br") {
      result += "\n";
    } else if (tag === "div" || tag === "p") {
      // Browsers may wrap blocks in <div> or <p>
      for (const child of Array.from(elem.childNodes)) walk(child);
      result += "\n";
    } else if (
      tag === "span" &&
      elem.classList.contains("md-img-chip")
    ) {
      const src = elem.dataset.src || "";
      const labelEl = elem.querySelector(".md-img-meta");
      let alt = labelEl?.textContent || "image";
      alt = alt.replace(/^📷\s*/, "").trim();
      result += `![${alt}](${src})`;
    } else {
      for (const child of Array.from(elem.childNodes)) walk(child);
    }
  };
  for (const child of Array.from(root.childNodes)) walk(child);
  return result;
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
  const wordCountRef = useRef<HTMLSpanElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPolishing, setIsPolishing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  /** Markdown source — the single source of truth for the note body. */
  const [markdown, setMarkdown] = useState<string>(note.content || "");

  /** Mirrors markdown for the duration of a single input cycle. Used by
   *  the sync effect to decide whether the DOM is already up to date
   *  (so we don't blow away the cursor position). */
  const lastMarkdownRef = useRef<string>(note.content || "");

  // Pick the user's polish-type template.
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

  // Switch note → flush old, reset state, sync DOM
  useEffect(() => {
    flushPending();
    const initial = note.content || "";
    setMarkdown(initial);
    lastMarkdownRef.current = initial;
    if (editorRef.current) {
      editorRef.current.innerHTML = markdownToEditorHtml(initial);
    }
    if (titleRef.current) {
      titleRef.current.value = note.title || "";
      titleRef.current.style.height = "auto";
      titleRef.current.style.height =
        titleRef.current.scrollHeight + "px";
    }
    if (wordCountRef.current)
      wordCountRef.current.textContent = `${initial.length} 字`;
    setIsPreviewing(false);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync DOM when markdown state changes externally (polish, paste-as-markdown, etc.)
  useEffect(() => {
    if (!editorRef.current) return;
    if (markdown === lastMarkdownRef.current) return;
    editorRef.current.innerHTML = markdownToEditorHtml(markdown);
    lastMarkdownRef.current = markdown;
  }, [markdown]);

  // ============================================================
  // Handlers
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

  /** Update markdown state from the DOM and persist (debounced). */
  const commitFromDom = useCallback(() => {
    if (!editorRef.current) return;
    const md = editorHtmlToMarkdown(editorRef.current);
    if (md === lastMarkdownRef.current) return;
    lastMarkdownRef.current = md;
    setMarkdown(md);
    if (wordCountRef.current)
      wordCountRef.current.textContent = `${md.length} 字`;
    schedulePersist(md);
  }, [schedulePersist]);

  /** Insert a chip element at the current selection. */
  const insertChipAtCursor = useCallback((dataUrl: string, name: string) => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    // If the selection is outside the editor, place at end
    if (!el.contains(range.commonAncestorContainer)) {
      el.focus();
      const newRange = document.createRange();
      newRange.selectNodeContents(el);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);
      insertChipAtCursor(dataUrl, name);
      return;
    }

    const chip = document.createElement("span");
    chip.className = "md-img-chip";
    chip.contentEditable = "false";
    chip.dataset.src = dataUrl;

    const img = document.createElement("img");
    img.className = "md-img-thumb";
    img.src = dataUrl;
    img.alt = name;

    const meta = document.createElement("span");
    meta.className = "md-img-meta";
    meta.textContent = `📷 ${name || "image"}`;

    chip.appendChild(img);
    chip.appendChild(meta);

    // Replace selection with chip + space
    range.deleteContents();
    const space = document.createTextNode("\u00A0");
    range.insertNode(space);
    range.insertNode(chip);

    // Move cursor after the trailing space
    const after = document.createRange();
    after.setStartAfter(space);
    after.setEndAfter(space);
    sel.removeAllRanges();
    sel.addRange(after);
  }, []);

  /** Handle pasted / dropped / picked image files. */
  const handleImageFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      // Read in parallel and insert chips one by one
      for (const f of files) {
        const dataUrl = await readImageAsCompressedDataUrl(f);
        insertChipAtCursor(dataUrl, f.name);
      }
      commitFromDom();
      onToast("success", `已插入 ${files.length} 张图片`);
    },
    [insertChipAtCursor, commitFromDom, onToast],
  );

  const handlePaste = async (
    e: React.ClipboardEvent<HTMLDivElement>,
  ) => {
    const images = filterImageFiles(e.clipboardData.files);
    if (images.length > 0) {
      e.preventDefault();
      await handleImageFiles(images);
      return;
    }
    // For HTML, strip to plain text (avoids rich-format paste noise)
    const html = e.clipboardData.getData("text/html");
    if (html) {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      return;
    }
    // Plain text: let default happen, then commit
    // (no preventDefault — browser inserts as text)
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer.files);
    const images = filterImageFiles(files);
    if (images.length === 0) return;
    e.preventDefault();
    await handleImageFiles(images);
  };

  const handleFilePick = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    await handleImageFiles(files);
  };

  const togglePreview = () => {
    setIsPreviewing((v) => !v);
  };

  const handlePolish = async () => {
    if (!markdown.trim()) {
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
        ? polishTemplate.content.replace(/\{\{content\}\}/g, markdown)
        : markdown;
      const polished = await callAI(config, POLISH_SYSTEM_PROMPT, userPrompt);
      const cleaned = polished
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/```\s*$/, "")
        .trim();
      // Update both state and DOM
      setMarkdown(cleaned);
      lastMarkdownRef.current = cleaned;
      if (editorRef.current) {
        editorRef.current.innerHTML = markdownToEditorHtml(cleaned);
      }
      if (wordCountRef.current)
        wordCountRef.current.textContent = `${cleaned.length} 字`;
      // Commit immediately (AI rewrite bypasses debounce)
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

  // Live preview (recomputed on every markdown change while open)
  const previewHtml = useMemo(
    () => (isPreviewing ? renderMarkdown(markdown) : ""),
    [isPreviewing, markdown],
  );

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
                  {s === note.status && (
                    <span className="status-check">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="editor-meta-bar">
        <div className="editor-meta-row">
          <span>更新于 {formatTime(note.updatedAt)}</span>
          <span>·</span>
          <span ref={wordCountRef}>{(note.content || "").length} 字</span>
          <span className="editor-hint">· 支持 Markdown · 粘贴/拖入图片直接预览</span>
        </div>
        <div className="editor-actions">
          <button
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            title="插入图片(也支持粘贴 / 拖入)"
          >
            🖼 图片
          </button>
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
          <div
            ref={editorRef}
            className="editor-source"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onInput={commitFromDom}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          />
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFilePick}
      />

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