#!/usr/bin/env python3
"""Generate the VibeCoder source icon (1024x1024 PNG).

Design: terracotta rounded square with a white outline pencil at 45°
(OpenPencil-style). Tip points to lower-left, eraser cap to upper-right.

To avoid the PIL stroke-rendering artifacts at small sizes, we use the
"filled outer + filled inner cutout" technique: draw the full pencil
silhouette in white, then overlay a slightly smaller version in
terracotta to leave a uniform white outline.
"""
import os

from PIL import Image, ImageDraw

SIZE = 1024

# Brand colors (Movo / CmdPolish palette)
CLAY = (201, 100, 66)
CLAY_DEEP = (177, 83, 47)
WHITE = (255, 250, 242)


def make_icon(size: int) -> Image.Image:
    # ============================================================
    # Background: vertical gradient rounded square
    # ============================================================
    grad = Image.new("RGB", (size, size), CLAY)
    gd = ImageDraw.Draw(grad)
    for i in range(64):
        t = i / 63
        c = (
            int(CLAY[0] * (1 - t) + CLAY_DEEP[0] * t),
            int(CLAY[1] * (1 - t) + CLAY_DEEP[1] * t),
            int(CLAY[2] * (1 - t) + CLAY_DEEP[2] * t),
        )
        gd.line([(0, int(i * size / 64)), (size, int(i * size / 64))], fill=c)

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * 0.225), fill=255
    )
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)

    # ============================================================
    # Pencil — drawn on a temp canvas, then rotated + composited
    # ============================================================
    # Working canvas with extra padding so rotated pencil isn't clipped
    pad = size // 2
    work = Image.new("RGBA", (size + pad * 2, size + pad * 2), (0, 0, 0, 0))
    wd = ImageDraw.Draw(work)

    cx_canvas = size // 2 + pad
    cy_canvas = size // 2 + pad

    # Vertical orientation: tip points UP, eraser at BOTTOM
    L = int(size * 0.58)            # total pencil length
    W = int(size * 0.14)            # pencil width (body = eraser)
    OUT = int(size * 0.028)         # outline thickness
    tip_len = int(L * 0.20)         # triangular tip section
    eraser_len = int(L * 0.18)      # eraser cap section
    eraser_radius = int(W * 0.22)   # rounding at the eraser end

    # Y coordinates (relative to pencil center cy_canvas):
    # Tip is at the very top.
    body_top_y = -L // 2 + tip_len       # where body meets tip
    eraser_top_y = L // 2 - eraser_len   # where body meets eraser
    bottom_y = L // 2                    # very bottom of eraser
    half_w = W / 2

    # ============================================================
    # OUTER silhouette — drawn as ONE continuous shape:
    #   rounded_rectangle (body+eraser) + triangle (tip on top)
    # They overlap and merge into a single outline.
    # ============================================================
    # 1) Body+eraser as a rounded rectangle (rounded BOTTOM corners only,
    #    but PIL only supports uniform radius — we'll cover the top with
    #    the triangle anyway).
    wd.rounded_rectangle(
        [cx_canvas - half_w, cy_canvas - L // 2 + tip_len,
         cx_canvas + half_w, cy_canvas + bottom_y],
        radius=eraser_radius,
        fill=WHITE,
    )
    # 2) Triangle tip on top
    wd.polygon(
        [
            (cx_canvas, cy_canvas - L // 2),                # tip point
            (cx_canvas - half_w, cy_canvas + body_top_y),   # left base
            (cx_canvas + half_w, cy_canvas + body_top_y),   # right base
        ],
        fill=WHITE,
    )

    # ============================================================
    # INNER cutout (terracotta) — shrinks everything by OUT
    # ============================================================
    inner_half_w = half_w - OUT
    # Inner tip point: pull DOWN by OUT*2 so the outline at the tip is OUT thick
    inner_tip_y = -L // 2 + OUT * 2.2
    inner_body_top_y = body_top_y + OUT
    inner_eraser_top_y = eraser_top_y + OUT
    inner_bottom_y = bottom_y - OUT
    inner_eraser_radius = max(2, eraser_radius - OUT)

    # Inner body+eraser as a rounded rectangle
    wd.rounded_rectangle(
        [cx_canvas - inner_half_w, cy_canvas + inner_body_top_y,
         cx_canvas + inner_half_w, cy_canvas + inner_bottom_y],
        radius=inner_eraser_radius,
        fill=CLAY,
    )
    # Inner triangle tip
    wd.polygon(
        [
            (cx_canvas, cy_canvas + inner_tip_y),
            (cx_canvas - inner_half_w, cy_canvas + inner_body_top_y),
            (cx_canvas + inner_half_w, cy_canvas + inner_body_top_y),
        ],
        fill=CLAY,
    )

    # ============================================================
    # Separator line — the "eraser / body" division
    # (drawn as a white stripe across the body)
    # ============================================================
    # Make it a thin horizontal rectangle (in the un-rotated orientation)
    # A bit thicker than the outline so it reads clearly.
    sep_h = max(2, int(OUT * 0.9))
    sep_y_center = cy_canvas + eraser_top_y
    # Draw two thin rectangles (one above the line, one below) in CLAY
    # to create a gap, then a WHITE rectangle in the middle.
    # Simpler: just a horizontal white stripe (the outline is already
    # visible from the cutout gap).
    wd.rectangle(
        [cx_canvas - inner_half_w - OUT, cy_canvas + eraser_top_y - sep_h // 2,
         cx_canvas + inner_half_w + OUT, cy_canvas + eraser_top_y + sep_h // 2],
        fill=WHITE,
    )

    # ============================================================
    # Rotate — tip goes to lower-left
    # PIL's rotate is CCW. Tip is currently at top (0°).
    # Lower-left = 135° CCW.
    # ============================================================
    rotated = work.rotate(135, resample=Image.BICUBIC, expand=False)

    # Crop to icon canvas
    pencil = rotated.crop((pad, pad, pad + size, pad + size))

    # Composite onto the main icon
    img.alpha_composite(pencil)

    # Re-apply the rounded mask for clean edges
    final_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(final_mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * 0.225), fill=255
    )
    final = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    final.paste(img, (0, 0), final_mask)

    return final


def main():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    src = os.path.normpath(os.path.join(out_dir, "..", "src-tauri", "icons", "icon.png"))
    os.makedirs(os.path.dirname(src), exist_ok=True)
    image = make_icon(SIZE)
    image.save(src, "PNG", optimize=True)
    print(f"Wrote {src}")


if __name__ == "__main__":
    main()