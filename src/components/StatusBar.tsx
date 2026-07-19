import { useState } from "react";
import { Icon } from "./Icon";

export interface StatusInfo {
  text: string;
  state: "idle" | "busy" | "error";
}

interface StatusBarProps {
  notesCount: number;
  templatesCount: number;
  status: StatusInfo;
  providerName: string;
  modelName: string;
  hasAPIKey: boolean;
}

export function StatusBar({
  notesCount,
  templatesCount,
  status,
  providerName,
  modelName,
  hasAPIKey,
}: StatusBarProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <div className="status-tab active">
          <span>笔记 {notesCount}</span>
          <span style={{ color: "var(--text-subtle)" }}>·</span>
          <span>模板 {templatesCount}</span>
        </div>
        <div
          className="status-tab"
          onClick={() => setShowDetail((v) => !v)}
          title="点击切换显示"
        >
          <Icon name="lightbulb" size={12} />
          {hasAPIKey ? `${providerName}` : "未配置 AI"}
        </div>
      </div>
      <div className="status-indicator" data-state={status.state}>
        <span
          className={`status-indicator ${status.state === "busy" ? "busy" : status.state === "error" ? "error" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span className="dot" />
          <span>{status.text}</span>
        </span>
      </div>
      {showDetail && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(var(--statusbar-h) + 4px)",
            right: 14,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "10px 14px",
            fontSize: 11,
            color: "var(--text-muted)",
            boxShadow: "var(--shadow-paper)",
            fontFamily: "var(--font-mono)",
            zIndex: 100,
          }}
        >
          <div>Provider: {providerName}</div>
          <div>Model: {modelName}</div>
          <div>API Key: {hasAPIKey ? "已配置" : "未配置"}</div>
        </div>
      )}
    </footer>
  );
}