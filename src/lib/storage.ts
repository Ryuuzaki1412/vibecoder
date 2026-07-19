import type { Note, NoteStatus, PromptTemplate, AIConfig } from "../types";

// ============================================================
// localStorage layer — zero-config persistence
// Each store is namespaced by app version to avoid collision.
// ============================================================

const NAMESPACE = "vibecoder:v1";

const KEYS = {
  notes: `${NAMESPACE}:notes`,
  templates: `${NAMESPACE}:templates`,
  settings: `${NAMESPACE}:settings`,
  ui: `${NAMESPACE}:ui`,
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage write failed:", e);
  }
}

// ============================================================
// Notes
// ============================================================

/** Strip legacy HTML content to plain text. Idempotent — plain text input
 *  passes through unchanged (detected via absence of `<tag>` patterns). */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  if (typeof document === "undefined") return html;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  tmp.querySelectorAll("br").forEach((b) =>
    b.replaceWith(document.createTextNode("\n")),
  );
  tmp
    .querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr")
    .forEach((el) => {
      if (el.nextSibling) el.appendChild(document.createTextNode("\n"));
    });
  return (tmp.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
}

export function loadNotes(): Note[] {
  const raw = read<Note[]>(KEYS.notes, []);
  return raw.map((n) => ({
    ...n,
    status: n.status ?? "not_started",
    content: htmlToPlainText(n.content ?? ""),
  }));
}
export function saveNotes(notes: Note[]): void {
  write(KEYS.notes, notes);
}

// ============================================================
// Templates — first run seed with the 3 presets from the spec
// ============================================================
const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: "tpl-polish-default",
    name: "润色助手",
    type: "polish",
    content:
      "请润色以下内容,保持原意,使表达更清晰、专业、有条理:\n\n{{content}}",
    createdAt: Date.now(),
  },
  {
    id: "tpl-mvp-default",
    name: "MVP 产品方案",
    type: "mvp",
    content: `你是一位资深产品经理和全栈工程师。请根据以下想法生成 MVP 产品方案:

想法:{{content}}

请输出:
1. **产品名称** + 一句话介绍
2. **核心功能** (3-5 个,按优先级排序)
3. **目标用户** (谁会用?解决什么痛点?)
4. **技术栈建议** (前端/后端/数据库/部署)
5. **开发步骤** (按 MVP 最小可发布单元拆分,估算工时)
6. **预期上线时间** (假设 1 人全职开发)`,
    createdAt: Date.now() + 1,
  },
  {
    id: "tpl-code-default",
    name: "快速原型代码",
    type: "custom",
    content: `根据以下需求生成可运行的原型代码:

需求:{{content}}

要求:
- 优先使用 Python 或 JavaScript / TypeScript
- 代码完整可运行,包含必要注释
- 提供使用示例 (一段调用代码)
- 如有外部依赖,列出 pip install / npm install 命令`,
    createdAt: Date.now() + 2,
  },
];

export function loadTemplates(): PromptTemplate[] {
  const existing = read<PromptTemplate[] | null>(KEYS.templates, null);
  if (existing && existing.length > 0) return existing;
  // First run — seed defaults
  write(KEYS.templates, DEFAULT_TEMPLATES);
  return DEFAULT_TEMPLATES;
}
export function saveTemplates(templates: PromptTemplate[]): void {
  write(KEYS.templates, templates);
}

// ============================================================
// AI settings
// ============================================================
export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  apiKey: "",
  model: "claude-3-5-sonnet-latest",
  timeoutSecs: 120,
};

export function loadAIConfig(): AIConfig {
  const cfg = read<Partial<AIConfig> | null>(KEYS.settings, null);
  if (!cfg) return { ...DEFAULT_AI_CONFIG };
  return { ...DEFAULT_AI_CONFIG, ...cfg };
}
export function saveAIConfig(cfg: AIConfig): void {
  write(KEYS.settings, cfg);
}

// ============================================================
// UI prefs (theme etc.)
// ============================================================
export type EditorFont =
  | "default"   // Georgia / serif (current default)
  | "songti"    // Chinese serif (Songti / Noto Serif CJK)
  | "sans"      // System sans (PingFang / SF)
  | "mono";     // Monospace

export const EDITOR_FONT_OPTIONS: { id: EditorFont; label: string; sample: string }[] = [
  { id: "default", label: "衬线 (Georgia)", sample: "Aa  衬线" },
  { id: "songti",  label: "宋体 (Songti)",  sample: "Aa  宋体" },
  { id: "sans",    label: "无衬线 (System)", sample: "Aa  Sans" },
  { id: "mono",    label: "等宽 (Mono)",    sample: "Aa  Mono" },
];

export interface UIPrefs {
  theme: "light" | "dark";
  selectedNoteId: string | null;
  editorFont: EditorFont;
}

export function loadUIPrefs(): UIPrefs {
  return read<UIPrefs>(KEYS.ui, {
    theme: "light",
    selectedNoteId: null,
    editorFont: "default",
  });
}
export function saveUIPrefs(prefs: UIPrefs): void {
  write(KEYS.ui, prefs);
}

// ============================================================
// Misc helpers
// ============================================================
export function uid(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

export function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}