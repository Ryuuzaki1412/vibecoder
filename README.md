# VibeCoder

> 一个**极简桌面灵感工具**,基于 **Tauri 2.0**,UI 采用 Claude 风格的温暖羊皮纸 + 赤土色调性。
> 核心四件事:**快速记录想法 → AI 润色 → 自定义提示词模板 → 一键生成 MVP 方案**。

![Tauri](https://img.shields.io/badge/Tauri-2.0-orange?logo=tauri)
![React](https://img.shields.io/badge/React-18-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ 功能

### 📝 快速记录
- 左侧笔记列表 + 右侧编辑器
- 标题 + 正文(纯文本 / Markdown)
- 实时搜索、删除、新建
- 所有数据存于本地 `localStorage`,不联网、不上传

### ✨ AI 润色
- 点 **✨ AI 润色** 一键把潦草想法变专业表达
- 自动保持原意,只调整语法、用词、排版
- 支持 Markdown 输出(标题、列表、加粗)

### 📋 提示词模板
- 右上角 **📋 模板管理**
- 预设 3 个:**润色助手** / **MVP 产品方案** / **快速原型代码**
- 支持 **新建 / 编辑 / 删除** 任意模板
- 模板里用 `{{content}}` 标记用户笔记位置

### 🚀 一键生成 MVP
- 点 **🚀 生成 MVP** 弹窗
- 选模板 + 写补充说明(可选)
- 流式输出 MVP 产品方案
- 一键 **保存到笔记底部**

### 🤖 多 Provider AI
- ⚙ 设置里切换 7 种 Provider:
  - 🌟 **Anthropic Claude**(推荐)
  - 🤖 OpenAI (GPT-4o / o1)
  - 🔍 DeepSeek
  - 🇨🇳 通义千问 (Qwen)
  - 🏠 Ollama(本地)
  - 💻 LM Studio(本地)
  - ⚙ 自定义(OpenAI 兼容)
- 配置好点 **测试连接** 验证

### 🎨 Claude 风格 UI
- 温暖羊皮纸画布 (`#f5f4ed`)
- 赤土色品牌色 (`#c96442`)
- 衬线标题、Sans UI、Mono 代码
- 自带浅色 / 深色(暖色调深色)切换

---

## 🚀 快速开始

### macOS 用户
1. 在 [Releases](https://github.com/Ryuuzaki1412/vibecoder/releases) 下载最新 `.dmg`
2. 双击挂载,把 `VibeCoder.app` 拖入 `Applications`
3. 从启动台打开

### 从源码构建

#### 前置条件
- macOS / Windows / Linux
- Node.js ≥ 18
- Rust ≥ 1.77
- Tauri 2.0 系统依赖(参见 [Tauri 文档](https://tauri.app/start/prerequisites/))

#### 开发模式
```bash
git clone https://github.com/Ryuuzaki1412/vibecoder.git
cd vibecoder
npm install
npm run tauri:dev
```

#### 构建发布版
```bash
# 当前平台 (默认产物:DMG / MSI / AppImage)
npm run tauri:build

# 仅 macOS 通用包 (Intel + Apple Silicon)
npm run tauri:build:mac-universal
```

构建产物在 `src-tauri/target/release/bundle/` 下:
- macOS:`bundle/dmg/VibeCoder_1.0.0_universal.dmg`
- Windows:`bundle/msi/VibeCoder_1.0.0_x64_en-US.msi`
- Linux:`bundle/appimage/VibeCoder_1.0.0_amd64.AppImage`

---

## 📂 项目结构

```
vibecoder/
├── package.json              # npm 脚本 + 依赖
├── vite.config.ts            # Vite 配置
├── tailwind.config.js        # Claude 风格设计 token
├── tsconfig.json
├── index.html                # HTML 入口
├── scripts/
│   └── make-icon.py          # 生成源图标 (1024×1024 PNG)
├── src/                      # React + TypeScript 前端
│   ├── main.tsx              # 入口
│   ├── App.tsx               # 主应用
│   ├── styles.css            # 全局样式 (Claude 设计 token)
│   ├── types.ts              # 类型 + Provider 预设
│   ├── lib/
│   │   ├── storage.ts        # localStorage 持久化
│   │   ├── tauri.ts          # invoke 包装
│   │   └── markdown.ts       # 轻量 Markdown 渲染
│   ├── hooks/
│   │   ├── useNotes.ts
│   │   ├── useTemplates.ts
│   │   ├── useSettings.ts
│   │   └── useToast.ts
│   └── components/
│       ├── TitleBar.tsx
│       ├── Sidebar.tsx
│       ├── NoteEditor.tsx
│       ├── EmptyState.tsx
│       ├── StatusBar.tsx
│       ├── TemplatesModal.tsx
│       ├── GenerateModal.tsx
│       ├── SettingsModal.tsx
│       ├── Toast.tsx
│       └── Icon.tsx          # 内联 SVG 图标集 + useTheme
└── src-tauri/                # Rust 后端
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    ├── capabilities/default.json
    ├── icons/                # Tauri 生成的图标 (.icns / .ico / png)
    └── src/
        ├── main.rs
        ├── lib.rs            # Tauri 命令: call_ai / test_ai
        └── ai.rs             # Anthropic + OpenAI 兼容协议
```

---

## 🔌 后端 Tauri 命令

| Command | 入参 | 出参 | 用途 |
|---|---|---|---|
| `call_ai` | `config, systemPrompt, userMessage` | `String` | 调用 AI 生成 |
| `test_ai` | `config` | `String` | 测试连接(返回 PONG) |

Provider 路由:
- `anthropic` → Anthropic Messages API (`POST /v1/messages`)
- 其他(openai / deepseek / qwen / ollama / lmstudio / custom)→ OpenAI Chat Completions API (`POST /chat/completions`)

---

## 🏗 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Tauri 2.0 (Rust + WebView) |
| 前端 | React 18 + TypeScript 5 + Vite 5 |
| 样式 | Tailwind CSS 3 + 原生 CSS 变量(Claude 设计 token) |
| 状态存储 | localStorage(命名空间 `vibecoder:v1:*`) |
| AI 协议 | Anthropic Messages API + OpenAI Chat Completions |
| Markdown | 自研轻量渲染器(零依赖) |
| 图标 | Python PIL → `tauri icon` 生成全套 |

---

## ❓ 常见问题

### macOS 提示"无法打开,因为来自身份不明的开发者"

这是 **macOS Gatekeeper** 对未签名应用的正常防护 — App 是好的,**不是损坏**。

**解决方案(任选其一)**:

#### 方案 A:右键打开(最快,3 秒)
1. 双击 DMG 挂载
2. 把 `VibeCoder.app` 拖进 Applications
3. 在 Finder 找到 App,**右键 → 打开**
4. 弹出确认框点 **"打开"**
5. ✅ 以后双击就正常了

#### 方案 B:系统设置里"仍要打开"
1. 双击 App 触发拦截
2. 弹出"无法打开"对话框 → 点 **"取消"**
3. 打开 **系统设置 → 隐私与安全**
4. 往下滚到底部,会看到一行:
   > "VibeCoder" 被阻止,因为来自身份不明的开发者
5. 点旁边的 **"仍要打开"** → 输登录密码 → 弹窗再点 **"打开"**
6. ✅ 以后双击就正常了

### AI 调用失败
1. 打开 ⚙ 设置
2. 确认 Provider / Base URL / Model ID / API Key 都对
3. 点 **测试连接** 看返回
4. 常见错误:
   - `401` → API Key 无效
   - `404` → Model ID 拼错或 Base URL 末尾多了 `/`
   - `超时` → 提高超时秒数,或换更快的模型

### 数据存在哪里?
所有笔记、模板、AI 配置都在你电脑的浏览器 localStorage 里:
- **macOS**: `~/Library/WebKit/com.vibecoder.app/`
- 通过 WebView 隔离,其他 app 读不到
- 清浏览器数据会丢 — 后续会加导入/导出

### Windows / Linux 怎么装
当前 release 主推 macOS。要装其他平台:
- **Windows**: 在 Windows 上 clone 源码 + `npm install` + `npm run tauri:build`
- **Linux**: 同上,需要装 webkit2gtk 等系统依赖(参考 [Tauri 文档](https://tauri.app/start/prerequisites/))

---

## 🛠 开发路线图

- [ ] 笔记导入 / 导出(Markdown / JSON)
- [ ] 多窗口 + 跨窗口笔记同步
- [ ] 全局快捷键(`Cmd+Shift+V` 唤起快速记录)
- [ ] 笔记标签 / 分类
- [ ] 流式输出(目前是非流式,等 Anthropic SSE 稳定后再加)
- [ ] 多语言(i18n)

---

## 📄 License

[MIT](./LICENSE) — Copyright (c) 2026 ryuuzaki1412