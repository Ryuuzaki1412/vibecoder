import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import cjkFontUrl from "./assets/NotoSansSC-Regular.ttf?url";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { NoteEditor } from "./components/NoteEditor";
import { EmptyState } from "./components/EmptyState";
import { StatusBar } from "./components/StatusBar";
import { TemplatesModal } from "./components/TemplatesModal";
import { GenerateModal } from "./components/GenerateModal";
import { SettingsModal } from "./components/SettingsModal";
import { ToastContainer } from "./components/Toast";
import { Icon } from "./components/Icon";
import { useNotes } from "./hooks/useNotes";
import { useTemplates } from "./hooks/useTemplates";
import { useSettings } from "./hooks/useSettings";
import { useUISettings } from "./hooks/useUISettings";
import { useToast } from "./hooks/useToast";
import { PROVIDER_PRESETS, type NoteStatus, NOTE_STATUS_ORDER, NOTE_STATUS_LABELS } from "./types";

// ============================================================
// CJK font setup — jsPDF's built-in fonts are WinAnsi-encoded and
// render Chinese as garbage. We embed Noto Sans SC (Regular, ~2.5 MB)
// so every character (Latin + 70k+ CJK glyphs) renders correctly.
// ============================================================
let _fontBase64Promise: Promise<string> | null = null;

async function getCJKFontBase64(): Promise<string> {
  if (!_fontBase64Promise) {
    _fontBase64Promise = (async () => {
      const resp = await fetch(cjkFontUrl);
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      // Chunk to avoid blowing call-stack on very large buffers
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(
          null,
          bytes.subarray(i, i + CHUNK) as unknown as number[],
        );
      }
      return btoa(binary);
    })();
  }
  return _fontBase64Promise;
}

function ensureCJKFont(doc: jsPDF, base64: string): void {
  if (doc.getFontList && doc.getFontList()["NotoSansSC"]) return;
  doc.addFileToVFS("NotoSansSC.ttf", base64);
  doc.addFont("NotoSansSC.ttf", "NotoSansSC", "normal");
  // jsPDF can fake bold by drawing twice if no separate bold TTF is loaded.
  doc.addFont("NotoSansSC.ttf", "NotoSansSC", "bold");
}

export default function App() {
  const {
    notes,
    createNote,
    updateNote,
    setNoteStatus,
    deleteNote,
    setNoteMVP,
  } = useNotes();
  const { templates, addTemplate, updateTemplate, deleteTemplate, resetDefaults } =
    useTemplates();
  const { config, updateConfig, resetConfig } = useSettings();
  const ui = useUISettings();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState<{
    text: string;
    state: "idle" | "busy" | "error";
  }>({ text: "就绪", state: "idle" });

  // Keep selection valid as notes change
  useEffect(() => {
    if (!selectedId && notes.length > 0) {
      setSelectedId(notes[0].id);
    } else if (selectedId && !notes.find((n) => n.id === selectedId)) {
      setSelectedId(notes[0]?.id ?? null);
    }
  }, [notes, selectedId]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  const providerName = useMemo(
    () => PROVIDER_PRESETS.find((p) => p.id === config.provider)?.label ?? config.provider,
    [config.provider],
  );

  const hasAPIKey =
    config.apiKey.trim().length > 0 ||
    config.provider === "ollama" ||
    config.provider === "lmstudio";

  const handleCreate = useCallback(() => {
    const note = createNote();
    setSelectedId(note.id);
  }, [createNote]);

  const handleEditorChange = useCallback(
    (
      patch: Partial<
        Pick<{ title: string; content: string }, "title" | "content">
      >,
    ) => {
      if (!selectedId) return;
      updateNote(selectedId, patch);
    },
    [selectedId, updateNote],
  );

  const handleStatusChange = useCallback(
    (s: NoteStatus) => {
      if (!selectedId) return;
      setNoteStatus(selectedId, s);
    },
    [selectedId, setNoteStatus],
  );

  /** Cycle a note's status (used by sidebar click on status indicator) */
  const handleCycleStatus = useCallback(
    (id: string) => {
      setNoteStatus(id, (cur) => {
        const idx = NOTE_STATUS_ORDER.indexOf(cur);
        return NOTE_STATUS_ORDER[(idx + 1) % NOTE_STATUS_ORDER.length];
      });
    },
    [setNoteStatus],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteNote(id);
      toast.success("已删除");
    },
    [deleteNote, toast],
  );

  const handleGenerateMVP = (mvp: string) => {
    if (!selectedId) return;
    setNoteMVP(selectedId, mvp);
  };

  /** Plain text from the note (note.content is markdown source). */
  const plainContent = useMemo(() => {
    if (!selectedNote) return "";
    const tmp = document.createElement("div");
    tmp.textContent = selectedNote.content;
    return (tmp.innerText || "").trim();
  }, [selectedNote?.content]);

  const openGenerate = () => {
    if (!selectedNote) {
      toast.warn("先创建或选中一条笔记");
      return;
    }
    if (!plainContent) {
      toast.warn("当前笔记为空,先写点东西");
      return;
    }
    setShowGenerate(true);
  };

  /** Export the current note as a PDF via jsPDF native text API.
   *  We tried html2canvas-based rendering but it produced empty PDFs
   *  in the Tauri webview (canvas clipping issues). Direct jsPDF text
   *  is bulletproof — content always shows. */
  const exportPDF = async () => {
    if (!selectedNote) {
      toast.warn("先选中一条笔记");
      return;
    }
    if (!selectedNote.title.trim() && !plainContent) {
      toast.warn("笔记为空,无法导出");
      return;
    }

    const filename = sanitizeFilename(selectedNote.title || "未命名笔记");
    const title = selectedNote.title || "未命名笔记";
    const dateStr = new Date(selectedNote.updatedAt * 1000).toLocaleString();
    const statusLabel = NOTE_STATUS_LABELS[selectedNote.status];

    setStatus({ text: "正在生成 PDF...", state: "busy" });

    try {
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      // Load + register CJK font (2.5 MB, lazy + cached after first call)
      const base64 = await getCJKFontBase64();
      ensureCJKFont(doc, base64);

      const margin = 18;
      const maxW = 210 - 2 * margin;
      const pageH = 297;
      let y = margin;

      const ensureSpace = (need: number) => {
        if (y + need > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };

      // --- Title ---
      doc.setFont("NotoSansSC", "bold");
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 18);
      const titleLines = doc.splitTextToSize(title, maxW);
      doc.text(titleLines, margin, y + 8);
      y += titleLines.length * 9 + 4;

      // --- Meta line ---
      doc.setFont("NotoSansSC", "normal");
      doc.setFontSize(8);
      doc.setTextColor(140, 130, 110);
      doc.text(
        `VibeCoder  ·  ${dateStr}  ·  ${statusLabel}`,
        margin,
        y + 3,
      );
      y += 6;

      // Divider
      doc.setDrawColor(220, 210, 195);
      doc.setLineWidth(0.2);
      doc.line(margin, y, 210 - margin, y);
      y += 8;

      // --- Body ---
      doc.setFont("NotoSansSC", "normal");
      doc.setFontSize(11);
      doc.setTextColor(40, 35, 30);
      const lineH = 5.2;

      const blocks = plainContent.split(/\n\s*\n/).filter((b) => b.trim());
      for (const block of blocks) {
        const lines = doc.splitTextToSize(block.trim(), maxW);
        for (const line of lines) {
          ensureSpace(lineH);
          doc.text(line, margin, y + lineH - 1);
          y += lineH;
        }
        y += 3; // paragraph gap
      }

      // --- MVP ---
      if (selectedNote.mvp && selectedNote.mvp.trim()) {
        // Divider with terracotta accent
        ensureSpace(20);
        doc.setDrawColor(201, 100, 66);
        doc.setLineWidth(0.8);
        doc.line(margin, y, 210 - margin, y);
        y += 8;

        // MVP label
        doc.setFont("NotoSansSC", "bold");
        doc.setFontSize(13);
        doc.setTextColor(201, 100, 66);
        doc.text("MVP 产品方案", margin, y + 4);
        y += 8;

        // MVP body
        doc.setFont("NotoSansSC", "normal");
        doc.setFontSize(10);
        doc.setTextColor(40, 35, 30);
        const mvpBlocks = selectedNote.mvp.split(/\n\s*\n/).filter((b) => b.trim());
        for (const block of mvpBlocks) {
          const lines = doc.splitTextToSize(block.trim(), maxW);
          for (const line of lines) {
            ensureSpace(lineH);
            doc.text(line, margin, y + lineH - 1);
            y += lineH;
          }
          y += 3;
        }
      }

      const pdfBytes = doc.output("arraybuffer") as ArrayBuffer;

      // Hand bytes to native save dialog
      const { invoke } = await import("@tauri-apps/api/core");
      const savedPath = await invoke<string | null>("save_pdf", {
        filename: `${filename}.pdf`,
        bytes: Array.from(new Uint8Array(pdfBytes)),
      });

      if (savedPath) {
        toast.success(`PDF 已保存 📄  ${pathBasename(savedPath)}`);
      } else {
        toast.info("已取消保存");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`导出失败: ${msg}`);
    } finally {
      setStatus({ text: "就绪", state: "idle" });
    }
  };

  return (
    <>
      <TitleBar
        theme={ui.theme}
        onToggleTheme={() =>
          ui.setTheme(ui.theme === "light" ? "dark" : "light")
        }
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="layout">
        <Sidebar
          notes={notes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onCycleStatus={handleCycleStatus}
        />

        <section className="content">
          {selectedNote ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  padding: "10px 28px 0",
                  flexShrink: 0,
                }}
              >
                <button
                  className="btn-secondary"
                  onClick={exportPDF}
                  title="打印或导出为 PDF"
                >
                  <Icon name="copy" size={14} />
                  导出 PDF
                </button>
                <button
                  className="btn-primary"
                  onClick={openGenerate}
                  title="基于当前笔记生成 MVP 方案"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                  }}
                >
                  <Icon name="rocket" size={14} />
                  生成 MVP
                </button>
              </div>
              <NoteEditor
                note={selectedNote}
                config={config}
                hasAPIKey={hasAPIKey}
                templates={templates}
                onChange={handleEditorChange}
                onStatusChange={handleStatusChange}
                onRequestOpenSettings={() => setShowSettings(true)}
                onToast={(k, m) => toast[k === "warning" ? "warn" : k](m)}
              />
            </>
          ) : (
            <EmptyState onCreate={handleCreate} />
          )}
        </section>
      </main>

      <StatusBar
        notesCount={notes.length}
        templatesCount={templates.length}
        status={status}
        providerName={providerName}
        modelName={config.model || "(未设置)"}
        hasAPIKey={hasAPIKey}
      />

      <ToastContainer toasts={toast.toasts} />

      {showTemplates && (
        <TemplatesModal
          templates={templates}
          onClose={() => setShowTemplates(false)}
          onAdd={addTemplate}
          onUpdate={updateTemplate}
          onDelete={(id) => {
            deleteTemplate(id);
            toast.success("模板已删除");
          }}
          onResetDefaults={() => {
            resetDefaults();
            toast.success("已恢复预设模板");
          }}
        />
      )}

      {showGenerate && selectedNote && (
        <GenerateModal
          templates={templates}
          noteContent={plainContent}
          config={config}
          hasAPIKey={hasAPIKey}
          onClose={() => setShowGenerate(false)}
          onGenerated={(mvp) => {
            handleGenerateMVP(mvp);
            toast.success("已保存到笔记底部");
          }}
          onToast={(k, m) => toast[k === "warning" ? "warn" : k](m)}
          onRequestOpenSettings={() => {
            setShowGenerate(false);
            setShowSettings(true);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          config={config}
          onChange={updateConfig}
          onReset={() => {
            resetConfig();
            toast.info("已重置为默认配置");
          }}
          onClose={() => setShowSettings(false)}
          onToast={(k, m) => toast[k === "warning" ? "warn" : k](m)}
        />
      )}
    </>
  );
}

// ============================================================
// HTML helpers for PDF generation
// ============================================================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Sanitize a string for use as a filesystem filename. */
function sanitizeFilename(s: string): string {
  const cleaned = s.replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned || "untitled";
}

/** Last path segment for display in toasts. */
function pathBasename(p: string): string {
  const m = p.replace(/\\/g, "/").split("/");
  return m[m.length - 1] || p;
}