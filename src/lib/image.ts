// ============================================================
// Image utilities — shared between toolbar and editor
// ============================================================

/** Read an image file as a data URL, re-encoding through canvas
 *  to normalize format and downscale if needed. Strips EXIF. */
export async function readImageAsCompressedDataUrl(
  file: File,
  maxDim = 1280,
  quality = 0.85,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const k = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * k);
        h = Math.round(h * k);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const out =
        file.type === "image/png" || file.type === "image/gif"
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", quality);
      resolve(out);
    };
    img.onerror = () => resolve(dataUrl); // fallback: use original
    img.src = dataUrl;
  });
}

/** Filter to only image files. Returns true if any images were found. */
export function filterImageFiles(
  files: FileList | File[] | null | undefined,
): File[] {
  if (!files) return [];
  const out: File[] = [];
  for (const f of Array.from(files)) {
    if (f.type.startsWith("image/")) out.push(f);
  }
  return out;
}

/** Build an <img> tag for insertion into a contenteditable. */
export function buildImgHtml(dataUrl: string, alt: string): string {
  const safeAlt = alt
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  return `<img src="${dataUrl}" alt="${safeAlt}" />`;
}

/** Insert image into the currently-focused contenteditable. */
export async function insertImageAtCursor(file: File): Promise<void> {
  const dataUrl = await readImageAsCompressedDataUrl(file);
  const html = buildImgHtml(dataUrl, file.name);
  // execCommand naturally operates on the current selection
  document.execCommand("insertHTML", false, html);
}

/** Insert multiple images sequentially. */
export async function insertImagesAtCursor(files: File[]): Promise<void> {
  for (const f of files) {
    await insertImageAtCursor(f);
  }
}