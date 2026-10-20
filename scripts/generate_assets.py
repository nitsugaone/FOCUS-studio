#!/usr/bin/env python3
import struct, zlib, math, os

def create_png(w, h, rgba_bytes):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter type 0 (None)
        start = y * w * 4
        raw.extend(rgba_bytes[start:start + w * 4])
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')

def render_icon(size, is_maskable=False):
    buf = bytearray(size * size * 4)
    cx, cy = size / 2.0, size / 2.0
    corner_r = 0 if is_maskable else size * 0.22

    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4

            # Check rounded corner if not maskable
            if not is_maskable:
                dx = max(0, abs(x - cx) - (cx - corner_r))
                dy = max(0, abs(y - cy) - (cy - corner_r))
                if math.hypot(dx, dy) > corner_r:
                    buf[idx:idx+4] = (0, 0, 0, 0)
                    continue

            # Base background
            r, g, b, a = 9, 12, 18, 255

            # Subtle radial vignette
            dist_c = math.hypot(x - cx, y - cy)
            diag = math.hypot(cx, cy)
            vignette = max(0.0, 1.0 - (dist_c / diag) * 0.45)
            r = int(14 * vignette + 9 * (1.0 - vignette))
            g = int(22 * vignette + 12 * (1.0 - vignette))
            b = int(36 * vignette + 18 * (1.0 - vignette))

            # Central glow
            glow_r = size * (0.35 if is_maskable else 0.42)
            if dist_c < glow_r:
                g_factor = (1.0 - (dist_c / glow_r)) ** 2 * 0.4
                r = int(r + (155 - r) * g_factor)
                g = int(g + (180 - g) * g_factor)
                b = int(b + (255 - b) * g_factor)

            # Circular rings
            scale = 0.85 if is_maskable else 1.0
            r1 = size * 0.33 * scale
            r2 = size * 0.24 * scale
            r3 = size * 0.16 * scale

            for target_r, width, col, alpha in [
                (r1, size * 0.016, (155, 180, 255), 0.3),
                (r2, size * 0.022, (192, 208, 255), 0.55),
                (r3, size * 0.026, (140, 229, 197), 0.75)
            ]:
                diff = abs(dist_c - target_r)
                if diff < width:
                    edge = 1.0 - (diff / width)
                    k = edge * alpha
                    r = int(r * (1.0 - k) + col[0] * k)
                    g = int(g * (1.0 - k) + col[1] * k)
                    b = int(b * (1.0 - k) + col[2] * k)

            # Elliptical orbits (+35 deg and -35 deg)
            for angle_deg in (35, -35):
                rad = math.radians(angle_deg)
                cos_a, sin_a = math.cos(rad), math.sin(rad)
                xr = (x - cx) * cos_a + (y - cy) * sin_a
                yr = -(x - cx) * sin_a + (y - cy) * cos_a
                a_ax = size * 0.32 * scale
                b_ax = size * 0.18 * scale
                val = (xr / a_ax) ** 2 + (yr / b_ax) ** 2
                diff = abs(val - 1.0)
                if diff < 0.09:
                    edge = (1.0 - diff / 0.09) * 0.28
                    r = int(r * (1.0 - edge) + 155 * edge)
                    g = int(g * (1.0 - edge) + 180 * edge)
                    b = int(b * (1.0 - edge) + 255 * edge)

            # Center mint core
            core_r = size * 0.085 * scale
            if dist_c < core_r:
                k = 1.0
                if dist_c > core_r - 2:
                    k = max(0.0, core_r - dist_c) / 2.0
                r = int(r * (1.0 - k) + 140 * k)
                g = int(g * (1.0 - k) + 229 * k)
                b = int(b * (1.0 - k) + 197 * k)

            # Central highlight inner circle
            inner_r = size * 0.055 * scale
            if dist_c < inner_r:
                k = 1.0
                if dist_c > inner_r - 2:
                    k = max(0.0, inner_r - dist_c) / 2.0
                r = int(r * (1.0 - k) + 180 * k)
                g = int(g * (1.0 - k) + 245 * k)
                b = int(b * (1.0 - k) + 220 * k)

            # Minimalist brand lines (upper and lower line)
            line_w = size * 0.024 * scale
            # Upper line
            y1_top = cy - size * 0.10 * scale
            y1_bot = y1_top + line_w
            x1_l = cx - size * 0.13 * scale
            x1_r = cx + size * 0.13 * scale
            if y1_top <= y <= y1_bot and x1_l <= x <= x1_r:
                k = 0.95
                r = int(r * (1.0 - k) + 255 * k)
                g = int(g * (1.0 - k) + 255 * k)
                b = int(b * (1.0 - k) + 255 * k)

            # Lower line
            y2_top = cy + size * 0.08 * scale
            y2_bot = y2_top + line_w
            x2_l = cx - size * 0.07 * scale
            x2_r = cx + size * 0.13 * scale
            if y2_top <= y <= y2_bot and x2_l <= x <= x2_r:
                k = 0.8
                r = int(r * (1.0 - k) + 255 * k)
                g = int(g * (1.0 - k) + 255 * k)
                b = int(b * (1.0 - k) + 255 * k)

            buf[idx:idx+4] = (r, g, b, 255)

    return bytes(buf)

def render_desktop_screenshot():
    w, h = 1280, 720
    buf = bytearray(w * h * 4)

    for y in range(h):
        for x in range(w):
            idx = (y * w + x) * 4

            # Base gradient
            v = y / float(h)
            r = int(9 + 4 * v)
            g = int(12 + 5 * v)
            b = int(18 + 8 * v)

            # Ambient radial spotlights
            d1 = math.hypot(x - 200, y - 100)
            if d1 < 500:
                k = (1.0 - d1 / 500) ** 2 * 0.22
                r = int(r + 89 * k)
                g = int(g + 119 * k)
                b = int(b + 205 * k)

            d2 = math.hypot(x - 1100, y - 600)
            if d2 < 450:
                k = (1.0 - d2 / 450) ** 2 * 0.18
                r = int(r + 83 * k)
                g = int(g + 165 * k)
                b = int(b + 155 * k)

            # Card 1: Player (x: 80 to 580, y: 100 to 520)
            if 80 <= x <= 580 and 100 <= y <= 520:
                # Panel fill
                r, g, b = 18, 23, 34
                # Orbit center in player card
                pcx, pcy = 330, 270
                pdist = math.hypot(x - pcx, y - pcy)
                if abs(pdist - 110) < 2 or abs(pdist - 80) < 2 or abs(pdist - 55) < 2:
                    r, g, b = 70, 95, 170
                # Play button in center
                if pdist < 45:
                    r, g, b = 45, 65, 125
                    if pdist < 43:
                        r, g, b = 75, 105, 195
                        # Play icon pause bars
                        if abs(x - pcx) < 12 and abs(y - pcy) < 14:
                            if abs(x - (pcx - 6)) < 3 or abs(x - (pcx + 6)) < 3:
                                r, g, b = 240, 245, 255

            # Card 2: Mixer (x: 620 to 1200, y: 100 to 520)
            if 620 <= x <= 1200 and 100 <= y <= 520:
                r, g, b = 18, 23, 34
                # Sliders
                for sy, fill_w, col in [
                    (170, 420, (155, 180, 255)),
                    (240, 360, (155, 180, 255)),
                    (310, 310, (155, 180, 255)),
                    (380, 280, (155, 180, 255)),
                ]:
                    if 660 <= x <= 1160 and sy <= y <= sy + 6:
                        if x <= 660 + fill_w:
                            r, g, b = col
                        else:
                            r, g, b = 40, 48, 68

            # Card 3: History chart at bottom (x: 80 to 1200, y: 545 to 680)
            if 80 <= x <= 1200 and 545 <= y <= 680:
                r, g, b = 16, 20, 30
                # Render 7 bars
                slot_w = (1120) / 7.0
                for bi, val in enumerate([30, 45, 60, 35, 50, 70, 25]):
                    bx = int(80 + bi * slot_w + (slot_w - 46) / 2)
                    bh = int((val / 70.0) * 75)
                    by = 650 - bh
                    if bx <= x <= bx + 46:
                        if 575 <= y <= 650:
                            if y >= by:
                                if bi == 6:  # Today
                                    r, g, b = 140, 229, 197
                                else:
                                    r, g, b = 115, 145, 235
                            else:
                                r, g, b = 25, 32, 46

            buf[idx:idx+4] = (min(255, r), min(255, g), min(255, b), 255)

    return bytes(buf)

def render_mobile_screenshot():
    w, h = 640, 1136
    buf = bytearray(w * h * 4)

    for y in range(h):
        for x in range(w):
            idx = (y * w + x) * 4

            # Base gradient
            v = y / float(h)
            r = int(9 + 5 * v)
            g = int(12 + 6 * v)
            b = int(18 + 10 * v)

            # Mobile player card (x: 30 to 610, y: 80 to 580)
            if 30 <= x <= 610 and 80 <= y <= 580:
                r, g, b = 18, 23, 34
                pcx, pcy = 320, 310
                pdist = math.hypot(x - pcx, y - pcy)
                if abs(pdist - 110) < 2 or abs(pdist - 80) < 2 or abs(pdist - 55) < 2:
                    r, g, b = 70, 95, 170
                if pdist < 46:
                    r, g, b = 75, 105, 195
                    if abs(x - pcx) < 12 and abs(y - pcy) < 14:
                        if abs(x - (pcx - 6)) < 3 or abs(x - (pcx + 6)) < 3:
                            r, g, b = 240, 245, 255

            # Mobile mixer card (x: 30 to 610, y: 600 to 920)
            if 30 <= x <= 610 and 600 <= y <= 920:
                r, g, b = 18, 23, 34
                for sy, fill_w in [(660, 360), (730, 320), (800, 270), (870, 240)]:
                    if 60 <= x <= 580 and sy <= y <= sy + 6:
                        if x <= 60 + fill_w:
                            r, g, b = 155, 180, 255
                        else:
                            r, g, b = 40, 48, 68

            # Mobile history chart (x: 30 to 610, y: 940 to 1100)
            if 30 <= x <= 610 and 940 <= y <= 1100:
                r, g, b = 16, 20, 30
                slot_w = (560) / 7.0
                for bi, val in enumerate([30, 45, 60, 35, 50, 70, 25]):
                    bx = int(40 + bi * slot_w + (slot_w - 24) / 2)
                    bh = int((val / 70.0) * 80)
                    by = 1075 - bh
                    if bx <= x <= bx + 24 and by <= y <= 1075:
                        r, g, b = (140, 229, 197) if bi == 6 else (115, 145, 235)

            buf[idx:idx+4] = (min(255, r), min(255, g), min(255, b), 255)

    return bytes(buf)

def main():
    os.makedirs('icons', exist_ok=True)
    os.makedirs('public/icons', exist_ok=True)
    os.makedirs('screenshots', exist_ok=True)
    os.makedirs('public/screenshots', exist_ok=True)

    print("Generating icon 192x192...")
    data_192 = render_icon(192, is_maskable=False)
    png_192 = create_png(192, 192, data_192)
    with open('icons/icon-192.png', 'wb') as f: f.write(png_192)
    with open('public/icons/icon-192.png', 'wb') as f: f.write(png_192)

    print("Generating icon 512x512...")
    data_512 = render_icon(512, is_maskable=False)
    png_512 = create_png(512, 512, data_512)
    with open('icons/icon-512.png', 'wb') as f: f.write(png_512)
    with open('public/icons/icon-512.png', 'wb') as f: f.write(png_512)

    print("Generating maskable icon 512x512...")
    data_maskable = render_icon(512, is_maskable=True)
    png_maskable = create_png(512, 512, data_maskable)
    with open('icons/icon-maskable-512.png', 'wb') as f: f.write(png_maskable)
    with open('public/icons/icon-maskable-512.png', 'wb') as f: f.write(png_maskable)

    print("Generating apple-touch-icon 180x180...")
    data_180 = render_icon(180, is_maskable=False)
    png_180 = create_png(180, 180, data_180)
    with open('icons/apple-touch-icon.png', 'wb') as f: f.write(png_180)
    with open('public/icons/apple-touch-icon.png', 'wb') as f: f.write(png_180)

    print("Generating desktop screenshot 1280x720...")
    desk_data = render_desktop_screenshot()
    desk_png = create_png(1280, 720, desk_data)
    with open('screenshots/screenshot-desktop.png', 'wb') as f: f.write(desk_png)
    with open('public/screenshots/screenshot-desktop.png', 'wb') as f: f.write(desk_png)

    print("Generating mobile screenshot 640x1136...")
    mob_data = render_mobile_screenshot()
    mob_png = create_png(640, 1136, mob_data)
    with open('screenshots/screenshot-mobile.png', 'wb') as f: f.write(mob_png)
    with open('public/screenshots/screenshot-mobile.png', 'wb') as f: f.write(mob_png)

    print("All PNG assets successfully generated!")

if __name__ == '__main__':
    main()
