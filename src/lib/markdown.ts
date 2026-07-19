// Tiny, dependency-free Markdown → safe HTML renderer.
// Supports: headings, bold/italic, code, fenced code blocks,
// nested lists (via indent), blockquotes, links, hr, tables.
// Sanitises against XSS.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(s: string): string {
  // escape first, then apply inline transforms (use placeholder tokens)
  const placeholder = (i: number) => `\u0000CODE${i}\u0000`;
  const codeStash: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c) => {
    codeStash.push(`<code>${escapeHtml(c)}</code>`);
    return placeholder(codeStash.length - 1);
  });

  let out = escapeHtml(s);

  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => {
    const safeUrl = /^(https?:|mailto:|#|\/)/i.test(u) ? u : "#";
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${t}</a>`;
  });

  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, i) => codeStash[Number(i)]);

  return out;
}

export function renderMarkdown(src: string): string {
  if (!src.trim()) return "";

  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1];
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        `<pre><code${lang ? ` class="lang-${escapeHtml(lang)}"` : ""}>${escapeHtml(
          code.join("\n"),
        )}</code></pre>`,
      );
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${renderInline(h[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      out.push("<hr />");
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        q.push(lines[i].slice(2));
        i++;
      }
      out.push(`<blockquote><p>${renderInline(q.join(" "))}</p></blockquote>`);
      continue;
    }

    // Table (simple)
    if (
      /^\|.+\|$/.test(line) &&
      i + 1 < lines.length &&
      /^\|[\s:|-]+\|$/.test(lines[i + 1])
    ) {
      const headerCells = line.slice(1, -1).split("|").map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i])) {
        rows.push(lines[i].slice(1, -1).split("|").map((c) => c.trim()));
        i++;
      }
      const thead = `<thead><tr>${headerCells
        .map((c) => `<th>${renderInline(c)}</th>`)
        .join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(
          (r) =>
            `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // Unordered list — handle nesting by indent
    if (/^(\s*)[-*+]\s+/.test(line)) {
      type Item = { indent: number; text: string };
      const items: Item[] = [];
      const re = /^(\s*)([-*+])\s+(.+)$/;
      const startMatch = line.match(re);
      if (startMatch) {
        items.push({ indent: startMatch[1].length, text: startMatch[3] });
        i++;
        while (i < lines.length) {
          const m = lines[i].match(re);
          if (!m) break;
          items.push({ indent: m[1].length, text: m[3] });
          i++;
        }
      }
      out.push(renderNestedList(items, "ul"));
      continue;
    }

    // Ordered list — handle nesting by indent
    if (/^(\s*)\d+\.\s+/.test(line)) {
      type Item = { indent: number; text: string };
      const items: Item[] = [];
      const re = /^(\s*)(\d+\.)\s+(.+)$/;
      const startMatch = line.match(re);
      if (startMatch) {
        items.push({ indent: startMatch[1].length, text: startMatch[3] });
        i++;
        while (i < lines.length) {
          const m = lines[i].match(re);
          if (!m) break;
          items.push({ indent: m[1].length, text: m[3] });
          i++;
        }
      }
      out.push(renderNestedList(items, "ol"));
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (collect until blank). Single newlines are preserved as
    // <br> so source line breaks render visually (Notion/Typora style).
    // Standard CommonMark joins soft breaks with space; we diverge to
    // match user expectation that Enter creates a new line.
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(\s*)?(#{1,6}\s|```|>\s|[-*+]\s|\d+\.\s|---+|\|)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${para.map((l) => renderInline(l)).join("<br>")}</p>`);
  }

  return out.join("\n");
}

// ============================================================
// Nested list renderer — builds a tree from {indent, text} items
// using indent differences (each indent step = one nesting level).
// ============================================================
type ListItem = { indent: number; text: string; children: ListItem[] };

function renderNestedList(
  items: { indent: number; text: string }[],
  tag: "ul" | "ol",
): string {
  if (items.length === 0) return "";
  // Build a tree: each item's parent is the nearest preceding item with
  // strictly smaller indent. Items at the same indent are siblings.
  const root: ListItem[] = [];
  const stack: ListItem[] = [];
  for (const it of items) {
    const node: ListItem = { indent: it.indent, text: it.text, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].indent >= it.indent) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  const renderItems = (nodes: ListItem[]): string =>
    nodes
      .map(
        (n) =>
          `<li>${renderInline(n.text)}${
            n.children.length > 0 ? renderItems(n.children) : ""
          }</li>`,
      )
      .join("");
  return `<${tag}>${renderItems(root)}</${tag}>`;
}