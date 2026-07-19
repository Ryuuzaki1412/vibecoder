import { VERSION } from "../version";
import { Icon, type ThemeMode } from "./Icon";

interface TitleBarProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenTemplates: () => void;
  onOpenSettings: () => void;
}

export { type ThemeMode };

export function TitleBar({
  theme,
  onToggleTheme,
  onOpenTemplates,
  onOpenSettings,
}: TitleBarProps) {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="brand">
        <div className="brand-mark">V</div>
        <span className="brand-name">VibeCoder</span>
        <span className="brand-tag">v{VERSION}</span>
      </div>
      <div className="titlebar-right">
        <button
          className="icon-btn"
          onClick={onOpenTemplates}
          title="提示词模板"
        >
          <Icon name="templates" size={17} />
        </button>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === "light" ? "切换深色" : "切换浅色"}
        >
          <Icon name={theme === "light" ? "moon" : "sun"} size={17} />
        </button>
        <div className="titlebar-divider" />
        <button
          className="icon-btn"
          onClick={onOpenSettings}
          title="设置"
        >
          <Icon name="settings" size={17} />
        </button>
      </div>
    </header>
  );
}