"""
Render the GetText AI mark to PNG at any size, with no third-party dependencies.

Used for both the web favicons and the macOS .iconset (see build-macapp.sh).
PNGs are written by hand with zlib because the runtime has no imaging library,
and shapes are supersampled 4x for smooth edges.

  python3 tools/make_icon.py web static
  python3 tools/make_icon.py iconset build/GetText.iconset
"""
import math
import struct
import sys
import zlib

C0 = (0xFF, 0x44, 0x38)   # gradient start (top-left)
C1 = (0xD7, 0x00, 0x15)   # gradient end (bottom-right)

# Geometry is defined on a 180-unit canvas and scaled to the requested size.
BASE = 180.0
TRI = [(70.0, 59.0), (127.0, 90.0), (70.0, 121.0)]
PLAY_OUTSET = 7.0         # half of stroke-width 14 -> rounded triangle joins
SS = 4                    # supersampling factor


def _dist_to_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _inside_triangle(px, py):
    def side(ax, ay, bx, by, cx, cy):
        return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy)
    d1 = side(px, py, *TRI[0], *TRI[1])
    d2 = side(px, py, *TRI[1], *TRI[2])
    d3 = side(px, py, *TRI[2], *TRI[0])
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def _play_covers(px, py):
    if _inside_triangle(px, py):
        return True
    edges = ((TRI[0], TRI[1]), (TRI[1], TRI[2]), (TRI[2], TRI[0]))
    return min(_dist_to_segment(px, py, *a, *b) for a, b in edges) <= PLAY_OUTSET


def _rounded_rect_covers(px, py, x0, y0, x1, y1, radius):
    """Signed-distance test for a rounded rectangle."""
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    hx, hy = (x1 - x0) / 2.0 - radius, (y1 - y0) / 2.0 - radius
    qx = max(abs(px - cx) - hx, 0.0)
    qy = max(abs(py - cy) - hy, 0.0)
    return math.hypot(qx, qy) <= radius


def render(size, inset_ratio=0.0, radius_ratio=0.0, opaque=True):
    """
    Return raw PNG scanlines.

    inset_ratio  fraction of the canvas left transparent around the mark
                 (macOS icons sit inside a margin; favicons are full-bleed)
    radius_ratio corner radius as a fraction of the drawn square's width
    opaque       True -> RGB, False -> RGBA with a transparent margin
    """
    scale = BASE / size
    inset = size * inset_ratio
    x0, y0, x1, y1 = inset, inset, size - inset, size - inset
    radius = (x1 - x0) * radius_ratio
    rounded = radius > 0

    rows = []
    for y in range(size):
        row = bytearray([0])  # PNG filter type 0
        for x in range(size):
            hits_shape = 0
            hits_play = 0
            for sy in range(SS):
                for sx in range(SS):
                    fx = x + (sx + 0.5) / SS
                    fy = y + (sy + 0.5) / SS
                    inside = (
                        _rounded_rect_covers(fx, fy, x0, y0, x1, y1, radius)
                        if rounded else True
                    )
                    if not inside:
                        continue
                    hits_shape += 1
                    if _play_covers(fx * scale, fy * scale):
                        hits_play += 1

            samples = SS * SS
            shape_a = hits_shape / samples
            t = (x + y) / (2.0 * size - 2)
            base = tuple(round(C0[i] + (C1[i] - C0[i]) * t) for i in range(3))
            play_a = (hits_play / hits_shape) if hits_shape else 0.0
            rgb = tuple(round(base[i] + (255 - base[i]) * play_a) for i in range(3))

            if opaque:
                row += bytes(rgb)
            else:
                row += bytes(rgb) + bytes([round(shape_a * 255)])
        rows.append(bytes(row))
    return b"".join(rows)


def write_png(path, size, **kwargs):
    opaque = kwargs.get("opaque", True)
    raw = render(size, **kwargs)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    color_type = 2 if opaque else 6
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, color_type, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)
    return len(png)


def build_web(out_dir):
    write_png(f"{out_dir}/apple-touch-icon.png", 180)
    write_png(f"{out_dir}/favicon-32.png", 32)
    print(f"wrote web icons to {out_dir}")


def build_iconset(out_dir):
    """macOS wants each size at 1x and 2x, rounded, inside a transparent margin."""
    for base_size in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            px = base_size * scale
            name = f"icon_{base_size}x{base_size}{'@2x' if scale == 2 else ''}.png"
            write_png(
                f"{out_dir}/{name}", px,
                inset_ratio=0.09, radius_ratio=0.225, opaque=False,
            )
            print(f"  {name} ({px}x{px})")
    print(f"wrote iconset to {out_dir}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    mode, target = sys.argv[1], sys.argv[2].rstrip("/")
    if mode == "web":
        build_web(target)
    elif mode == "iconset":
        build_iconset(target)
    else:
        sys.exit(f"unknown mode: {mode}")
