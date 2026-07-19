// ============================================================
// VibeCoder — shared TypeScript types
// ============================================================

export type NoteStatus = "not_started" | "in_progress" | "completed";

export interface Note {
  id: string;
  title: string;
  /** Rich HTML content (contenteditable output). Plain text is `innerText`. */
  content: string;
  status: NoteStatus;
  mvp?: string;
  createdAt: number;
  updatedAt: number;
}

export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
};

export const NOTE_STATUS_ORDER: NoteStatus[] = [
  "not_started",
  "in_progress",
  "completed",
];

export type TemplateType = "polish" | "mvp" | "custom";

export interface PromptTemplate {
  id: string;
  name: string;
  content: string; // supports {{content}} placeholder
  type: TemplateType;
  createdAt: number;
}

export type AIProvider =
  | "anthropic"
  | "openai"
  | "deepseek"
  | "qwen"
  | "ollama"
  | "lmstudio"
  | "custom";

export interface AIConfig {
  provider: AIProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutSecs: number;
}

export interface ProviderPreset {
  id: AIProvider;
  label: string;
  baseUrl: string;
  model: string;
  note?: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "anthropic",
    label: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com",
    model: "claude-3-5-sonnet-latest",
    note: "推荐 — 最符合 VibeCoder 的设计哲学",
  },
  {
    id: "openai",
    label: "OpenAI (GPT-4o, o1 等)",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
  },
  {
    id: "deepseek",
    label: "DeepSeek (深度求索)",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    note: "中文友好、价格低",
  },
  {
    id: "qwen",
    label: "通义千问 (Qwen / DashScope)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
  },
  {
    id: "ollama",
    label: "Ollama (本地)",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.2",
    note: "本地推理,无需 API Key",
  },
  {
    id: "lmstudio",
    label: "LM Studio (本地)",
    baseUrl: "http://localhost:1234/v1",
    model: "local-model",
  },
  {
    id: "custom",
    label: "自定义 (OpenAI 兼容)",
    baseUrl: "",
    model: "",
  },
];