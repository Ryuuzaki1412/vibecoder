// Build-time helper: decompress Noto Sans SC woff2 subset → TTF
// for jsPDF embedding. Run via `node scripts/build-pdf-font.mjs`
// once to produce src/assets/NotoSansSC.ttf.
import fs from "node:fs/promises";
import path from "node:path";
import wawoff2 from "wawoff2";

const woff2 = path.resolve(
  "node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff2",
);
const out = path.resolve("src/assets/NotoSansSC-Regular.ttf");

async function main() {
  const buf = await fs.readFile(woff2);
  const decompressed = await wawoff2.decompress(buf);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, Buffer.from(decompressed));
  console.log(`Wrote ${out} (${decompressed.byteLength} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});