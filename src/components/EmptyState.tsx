export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty">
      <div className="empty-card">
        <svg
          className="empty-ornament"
          viewBox="0 0 80 80"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 8h32l16 16v40a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" />
          <path d="M48 8v16h16" />
          <path d="M22 36h28M22 46h28M22 56h20" />
        </svg>
        <h2>把你的灵感,写下来</h2>
        <p>一个安静的角落,记录你脑子里所有一闪而过的想法。</p>
        <p>写完后,点 <strong style={{ color: "var(--accent)" }}>✨ AI 润色</strong> 让它变专业,或点 <strong style={{ color: "var(--accent)" }}>🚀 生成 MVP</strong> 出一份产品方案。</p>
        <button className="btn-primary" style={{ marginTop: 24 }} onClick={onCreate}>
          写下第一个想法
        </button>
        <p className="hint">
          所有数据存在本地 <code>localStorage</code>,不联网、不上传。
        </p>
      </div>
    </div>
  );
}