import { useEffect, useRef, useState } from "react";
import { insertImageAtCursor } from "../lib/image";

// ============================================================
// FormatToolbar — Notion-style sticky + floating menu.
// - Sticky toolbar above the editor (always visible).
// - Floating inline menu that appears above the user's selection
//   when text is selected (mimics Notion's "bubble menu").
//
// Both operate via document.execCommand on the contenteditable
// focused element. Callers pass a `getEditor()` function so we
// always operate on the latest editor ref.
// ============================================================

export type BlockType =
  | "P"
  | "H1"
  | "H2"
  | "H3"
  | "PRE"
  | "BLOCKQUOTE"
  | "UL"
  | "OL";

const BLOCK_LABELS: Record<BlockType, string> = {
  P: "正文",
  H1: "一级标题",
  H2: "二级标题",
  H3: "三级标题",
  PRE: "代码块",
  BLOCKQUOTE: "引用",
  UL: "无序列表",
  OL: "有序列表",
};

const TEXT_COLORS = [
  { name: "默认", value: "var(--text)" },
  { name: "赤土", value: "#c96442" },
  { name: "红", value: "#b53333" },
  { name: "琥珀", value: "#c89b3c" },
  { name: "墨绿", value: "#476047" },
  { name: "蓝", value: "#2c7bc4" },
  { name: "紫", value: "#7a4fb8" },
  { name: "灰", value: "#5e5a51" },
];

const BG_COLORS = [
  { name: "无背景", value: "transparent" },
  { name: "米色", value: "#fbe9df" },
  { name: "淡红", value: "#fbe4e4" },
  { name: "淡黄", value: "#fdf3d6" },
  { name: "淡绿", value: "#e3f0db" },
  { name: "淡蓝", value: "#dde9f6" },
  { name: "淡紫", value: "#ebe3f4" },
  { name: "暖灰", value: "#ebe7dd" },
];

interface ToolbarProps {
  getEditor: () => HTMLDivElement | null;
}

export function StickyFormatToolbar({ getEditor }: ToolbarProps) {
  const [showTextColors, setShowTextColors] = useState(false);
  const [showBgColors, setShowBgColors] = useState(false);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setShowTextColors(false);
        setShowBgColors(false);
        setShowBlockMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const ensureFocus = () => {
    const ed = getEditor();
    if (!ed) return;
    ed.focus();
  };

  const exec = (cmd: string, value?: string) => {
    ensureFocus();
    document.execCommand(cmd, false, value);
  };

  const setBlock = (block: BlockType) => {
    ensureFocus();
    document.execCommand("formatBlock", false, block);
    setShowBlockMenu(false);
  };

  const setTextColor = (color: string) => {
    setShowTextColors(false);
    ensureFocus();
    if (color === "transparent" || color === "var(--text)") {
      document.execCommand("removeFormat");
    } else {
      document.execCommand("foreColor", false, color);
    }
  };

  const setBgColor = (color: string) => {
    setShowBgColors(false);
    ensureFocus();
    if (color === "transparent") {
      document.execCommand("hiliteColor", false, "transparent");
    } else {
      document.execCommand("hiliteColor", false, color);
    }
  };

  const insertLink = () => {
    ensureFocus();
    const url = prompt("输入链接 URL:", "https://");
    if (!url) return;
    document.execCommand("createLink", false, url);
  };

  const triggerImageInsert = () => {
    fileInputRef.current?.click();
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be picked again
    if (!file) return;

    const ed = getEditor();
    if (!ed) return;
    ed.focus();
    await insertImageAtCursor(file);
  };

  return (
    <div className="format-toolbar" ref={containerRef}>
      {/* Block type */}
      <div className="ft-popover-anchor">
        <button
          className="ft-btn"
          title="块类型"
          onClick={() => {
            setShowBlockMenu((v) => !v);
            setShowTextColors(false);
            setShowBgColors(false);
          }}
        >
          <span className="ft-block-label">正文</span>
          <span className="ft-chevron">▾</span>
        </button>
        {showBlockMenu && (
          <div className="ft-popover ft-popover-block">
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((b) => (
              <button
                key={b}
                className="ft-block-item"
                onClick={() => setBlock(b)}
              >
                {BLOCK_LABELS[b]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ft-sep" />

      <button className="ft-btn" title="加粗 (⌘B)" onClick={() => exec("bold")}>
        <strong>B</strong>
      </button>
      <button
        className="ft-btn ft-italic"
        title="斜体 (⌘I)"
        onClick={() => exec("italic")}
      >
        I
      </button>
      <button
        className="ft-btn"
        title="下划线 (⌘U)"
        onClick={() => exec("underline")}
      >
        <u>U</u>
      </button>
      <button
        className="ft-btn"
        title="删除线"
        onClick={() => exec("strikeThrough")}
      >
        <s>S</s>
      </button>

      <button
        className="ft-btn ft-mono"
        title="标记为代码"
        onClick={() => {
          ensureFocus();
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) return;
          const range = sel.getRangeAt(0);
          const text = range.toString();
          if (!text) return;
          // Remove the selected text first
          range.deleteContents();
          const code = document.createElement("code");
          code.textContent = text;
          range.insertNode(code);
        }}
      >
        &lt;/&gt;
      </button>

      <div className="ft-sep" />

      {/* Text color */}
      <div className="ft-popover-anchor">
        <button
          className="ft-btn ft-color-btn"
          title="文字颜色"
          onClick={() => {
            setShowTextColors((v) => !v);
            setShowBgColors(false);
            setShowBlockMenu(false);
          }}
        >
          <span style={{ position: "relative" }}>
            <strong style={{ fontSize: 14 }}>A</strong>
            <span className="ft-color-underline" />
          </span>
          <span className="ft-chevron">▾</span>
        </button>
        {showTextColors && (
          <div className="ft-popover">
            <div className="ft-popover-label">文字颜色</div>
            <div className="ft-swatch-grid">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.name}
                  className="ft-swatch"
                  title={c.name}
                  onClick={() => setTextColor(c.value)}
                  style={{ color: c.value }}
                >
                  <strong style={{ fontSize: 13 }}>A</strong>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Background color */}
      <div className="ft-popover-anchor">
        <button
          className="ft-btn ft-bgcolor-btn"
          title="背景颜色"
          onClick={() => {
            setShowBgColors((v) => !v);
            setShowTextColors(false);
            setShowBlockMenu(false);
          }}
        >
          <span style={{
            display: "inline-block",
            padding: "0 4px",
            background: "#fbe9df",
            borderRadius: 2,
            fontSize: 13,
            fontWeight: 600,
          }}>
            A
          </span>
          <span className="ft-chevron">▾</span>
        </button>
        {showBgColors && (
          <div className="ft-popover">
            <div className="ft-popover-label">背景颜色</div>
            <div className="ft-swatch-grid">
              {BG_COLORS.map((c) => (
                <button
                  key={c.name}
                  className="ft-swatch ft-swatch-bg"
                  title={c.name}
                  onClick={() => setBgColor(c.value)}
                  style={{ background: c.value }}
                >
                  <strong style={{ fontSize: 13, color: c.value === "transparent" ? "var(--text-subtle)" : "var(--text)" }}>A</strong>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="ft-sep" />

      <button className="ft-btn" title="插入链接" onClick={insertLink}>
        🔗
      </button>
      <button className="ft-btn" title="插入图片" onClick={triggerImageInsert}>
        🖼
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageFile}
      />
    </div>
  );
}

// ============================================================
// FloatingBubble — appears above text selection (Notion-style)
// ============================================================

interface FloatingBubbleProps {
  getEditor: () => HTMLDivElement | null;
}

export function FloatingBubble({ getEditor }: FloatingBubbleProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    const update = () => {
      const ed = getEditor();
      const sel = window.getSelection();
      if (!ed || !sel || sel.isCollapsed) {
        setPos(null);
        return;
      }
      // Only react to selections inside the editor
      if (!ed.contains(sel.anchorNode)) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPos(null);
        return;
      }
      setPos({
        top: rect.top + window.scrollY - 44,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    };

    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [getEditor]);

  const exec = (cmd: string, value?: string) => {
    const ed = getEditor();
    ed?.focus();
    document.execCommand(cmd, false, value);
  };

  if (!pos) return null;

  return (
    <div
      className="bubble-menu"
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className="bubble-btn" title="加粗" onClick={() => exec("bold")}>
        <strong>B</strong>
      </button>
      <button className="bubble-btn" title="斜体" onClick={() => exec("italic")}>
        <em>I</em>
      </button>
      <button className="bubble-btn" title="下划线" onClick={() => exec("underline")}>
        <u>U</u>
      </button>
      <button className="bubble-btn bubble-mono" title="行内代码"
        onClick={() => {
          const ed = getEditor();
          ed?.focus();
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) return;
          const range = sel.getRangeAt(0);
          const text = range.toString();
          if (!text) return;
          range.deleteContents();
          const code = document.createElement("code");
          code.textContent = text;
          range.insertNode(code);
        }}
      >
        &lt;/&gt;
      </button>
      <button className="bubble-btn" title="链接" onClick={() => {
        const ed = getEditor();
        ed?.focus();
        const url = prompt("链接:", "https://");
        if (url) document.execCommand("createLink", false, url);
      }}>🔗</button>
      <span className="bubble-sep" />
      <button
        className="bubble-btn"
        title="颜色"
        onClick={() => setShowColors((v) => !v)}
      >
        A
      </button>
      {showColors && (
        <div className="bubble-color-pop">
          {[
            ...TEXT_COLORS,
            ...BG_COLORS.filter((c) => c.value !== "transparent"),
          ].map((c, i) => (
            <button
              key={i}
              title={c.name}
              onClick={() => {
                const ed = getEditor();
                ed?.focus();
                if (i < TEXT_COLORS.length) {
                  document.execCommand("foreColor", false, c.value);
                } else {
                  document.execCommand("hiliteColor", false, c.value);
                }
                setShowColors(false);
              }}
              className="bubble-color-chip"
              style={{
                color: i < TEXT_COLORS.length ? c.value : "var(--text)",
                background:
                  i < TEXT_COLORS.length ? "transparent" : c.value,
              }}
            >
              A
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ============================================================
// Utils
// ============================================================

// (image utilities now live in ../lib/image.ts)