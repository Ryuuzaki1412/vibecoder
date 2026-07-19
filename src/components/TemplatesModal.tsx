import { useState } from "react";
import type { PromptTemplate, TemplateType } from "../types";
import { Icon } from "./Icon";
import { ConfirmDialog } from "./ConfirmDialog";

interface TemplatesModalProps {
  templates: PromptTemplate[];
  onClose: () => void;
  onAdd: (name: string, content: string, type: TemplateType) => void;
  onUpdate: (id: string, patch: Partial<Omit<PromptTemplate, "id" | "createdAt">>) => void;
  onDelete: (id: string) => void;
  onResetDefaults: () => void;
}

export function TemplatesModal({
  templates,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  onResetDefaults,
}: TemplatesModalProps) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftType, setDraftType] = useState<TemplateType>("custom");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const startNew = () => {
    setEditingId("new");
    setDraftName("");
    setDraftContent("在此写下你的提示词模板,使用 {{content}} 标记要插入用户笔记的位置。\n\n例如:\n---\n请帮我把以下想法改写成一段 {{content}} 风格的描述:\n\n{{content}}\n---");
    setDraftType("custom");
  };

  const startEdit = (t: PromptTemplate) => {
    setEditingId(t.id);
    setDraftName(t.name);
    setDraftContent(t.content);
    setDraftType(t.type);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftName("");
    setDraftContent("");
    setDraftType("custom");
  };

  const saveDraft = () => {
    const name = draftName.trim();
    const content = draftContent.trim();
    if (!name || !content) return;
    if (editingId === "new") {
      onAdd(name, content, draftType);
    } else if (editingId) {
      onUpdate(editingId, { name, content, type: draftType });
    }
    cancelEdit();
  };

  if (editingId) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{editingId === "new" ? "新建模板" : "编辑模板"}</h2>
            <button className="icon-btn" onClick={cancelEdit}>
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <label>
                名称
                <span className="optional">给模板起个简短的名字</span>
              </label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="例如:把想法改写成推特长文"
                autoFocus
              />
            </div>
            <div className="form-row">
              <label>类型</label>
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value as TemplateType)}
              >
                <option value="polish">润色 (polish)</option>
                <option value="mvp">生成 MVP (mvp)</option>
                <option value="custom">自定义 (custom)</option>
              </select>
            </div>
            <div className="form-row">
              <label>
                提示词内容
                <span className="optional">用 {"{{content}}"} 代表用户笔记的位置</span>
              </label>
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={14}
                style={{ fontFamily: "var(--font-sans)", fontSize: 12, lineHeight: 1.55 }}
                placeholder="请润色以下内容,保持原意,使表达更清晰:&#10;&#10;{{content}}"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={cancelEdit}>
              取消
            </button>
            <button className="btn-primary" onClick={saveDraft}>
              <Icon name="check" size={14} />
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>提示词模板</h2>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 14,
              lineHeight: 1.55,
            }}
          >
            预设 3 个模板,你可以任意编辑、删除或新增。
            <br />
            模板里用 <code style={{ fontFamily: "var(--font-sans)" }}>{"{{content}}"}</code> 标记用户笔记插入的位置。
          </p>

          <div className="template-list">
            {templates.map((t) => (
              <div key={t.id} className="template-row">
                <div className="template-row-info">
                  <div className="template-row-name">
                    {t.name}
                    <span className={`template-type-badge ${t.type}`}>{t.type}</span>
                  </div>
                  <div className="template-row-preview">{t.content.split("\n")[0]}</div>
                </div>
                <div className="template-row-actions">
                  <button
                    className="icon-btn"
                    onClick={() => startEdit(t)}
                    title="编辑"
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setPendingDeleteId(t.id)}
                    title="删除"
                    style={{ color: "var(--danger)" }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onResetDefaults}>
            恢复预设
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn-secondary" onClick={onClose}>
            关闭
          </button>
          <button className="btn-primary" onClick={startNew}>
            <Icon name="plus" size={14} />
            新建模板
          </button>
        </div>
      </div>

      {pendingDeleteId && (
        <ConfirmDialog
          title="删除模板?"
          message="模板删除后无法恢复。"
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
    </div>
  );
}