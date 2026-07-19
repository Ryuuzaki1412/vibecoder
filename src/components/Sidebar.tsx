import { memo, useMemo, useState } from "react";
import type { Note, NoteStatus } from "../types";
import { Icon } from "./Icon";
import { StatusIndicator } from "./StatusBadge";
import { ConfirmDialog } from "./ConfirmDialog";
import { formatRelative } from "../lib/storage";

interface SidebarProps {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onCycleStatus: (id: string) => void;
}

export function Sidebar({
  notes,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onCycleStatus,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q),
    );
  }, [notes, query]);

  // Group counts by status
  const statusCounts = useMemo(() => {
    const counts: Record<NoteStatus, number> = {
      not_started: 0,
      in_progress: 0,
      completed: 0,
    };
    for (const n of filtered) counts[n.status]++;
    return counts;
  }, [filtered]);

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">笔记</span>
        <span className="sidebar-count">{filtered.length}</span>
      </div>

      <div className="sidebar-search">
        <Icon name="search" size={14} />
        <input
          type="text"
          placeholder="搜索笔记..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="note-list">
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--text-subtle)",
              fontSize: 13,
              fontStyle: "italic",
              fontFamily: "var(--font-serif)",
            }}
          >
            {query ? "没有匹配的笔记" : "还没有任何笔记"}
          </div>
        ) : (
          filtered.map((n) => (
            <NoteItem
              key={n.id}
              note={n}
              active={selectedId === n.id}
              onSelect={onSelect}
              onCycleStatus={onCycleStatus}
            />
          ))
        )}
      </div>

      {notes.length > 0 && (
        <div className="sidebar-status-bar">
          <span className="status-stat" data-status="completed">
            <StatusIndicator status="completed" showLabel={false} size="sm" />
            {statusCounts.completed}
          </span>
          <span className="status-stat" data-status="in_progress">
            <StatusIndicator status="in_progress" showLabel={false} size="sm" />
            {statusCounts.in_progress}
          </span>
          <span className="status-stat" data-status="not_started">
            <StatusIndicator status="not_started" showLabel={false} size="sm" />
            {statusCounts.not_started}
          </span>
        </div>
      )}

      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 6,
        }}
      >
        <button
          className="btn-primary"
          onClick={onCreate}
          style={{ flex: 1, justifyContent: "center" }}
        >
          <Icon name="plus" size={14} />
          新建笔记
        </button>
        {selectedId && (
          <button
            className="icon-btn"
            onClick={() => setPendingDeleteId(selectedId)}
            title="删除当前笔记"
            style={{ color: "var(--danger)" }}
          >
            <Icon name="trash" size={15} />
          </button>
        )}
      </div>

      {pendingDeleteId && (
        <ConfirmDialog
          title="删除笔记?"
          message="这条笔记会被永久删除,无法找回。"
          confirmLabel="删除"
          danger
          onConfirm={() => {
            const id = pendingDeleteId;
            setPendingDeleteId(null);
            onDelete(id);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </aside>
  );
}

// ============================================================
// NoteItem — memoized so unrelated re-renders (e.g. typing in the
// editor) don't re-render every note in the sidebar.
// ============================================================

interface NoteItemProps {
  note: Note;
  active: boolean;
  onSelect: (id: string) => void;
  onCycleStatus: (id: string) => void;
}

const NoteItem = memo(function NoteItem({
  note,
  active,
  onSelect,
  onCycleStatus,
}: NoteItemProps) {
  return (
    <div
      className={`note-item ${active ? "active" : ""}`}
      onClick={() => onSelect(note.id)}
    >
      <div className="note-item-row">
        <div className="note-item-title">{note.title || "未命名"}</div>
        <div
          className="note-item-status"
          onClick={(e) => {
            e.stopPropagation();
            onCycleStatus(note.id);
          }}
        >
          <StatusIndicator status={note.status} showLabel={false} />
        </div>
      </div>
      <div className="note-item-snippet">
        {note.content.slice(0, 120) || "(空)"}
      </div>
      <div className="note-item-meta">
        <span>{formatRelative(note.updatedAt)}</span>
        {note.mvp && <span className="mvp-tag">MVP</span>}
      </div>
    </div>
  );
});