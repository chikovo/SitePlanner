"""
Vectorize 'Villagio/project current state.dxf' into an exact 1:1 replica of the AutoCAD drawing.
Renders clean closed LWPOLYLINEs for all 115 villas + exact legend matching AutoCAD.
"""

import os
import math
import json

DXF_PATH = os.path.join("Villagio", "project current state.dxf")

# 12 Construction Stages exactly matching AutoCAD legend (Image 2)
# Listed in order from top to bottom of AutoCAD legend:
STAGES = {
    1: {
        "id": "fully_finished",
        "name_ar": "فيلات منتهيه تماما",
        "name_en": "Fully Finished / Handover",
        "color": "#EF4444", # Red
        "textColor": "#FFFFFF",
        "progress": 100
    },
    2: {
        "id": "concrete_brickwork",
        "name_ar": "فيلات منتهيه خرسانات ومباني دور أول وغرف سطح",
        "name_en": "Concrete + First Floor & Roof Brickwork Done",
        "color": "#FACC15", # Yellow
        "textColor": "#000000",
        "progress": 95
    },
    4: {
        "id": "concrete_structure",
        "name_ar": "فيلات منتهيه خرسانات",
        "name_en": "Concrete Structure Completed",
        "color": "#06B6D4", # Cyan
        "textColor": "#000000",
        "progress": 90
    },
    32: {
        "id": "roof_columns",
        "name_ar": "أعمده غرف السطح",
        "name_en": "Roof Room Columns",
        "color": "#B45309", # Brown / Rust
        "textColor": "#FFFFFF",
        "progress": 82
    },
    11: {
        "id": "ff_slab",
        "name_ar": "سقف الدور الأول",
        "name_en": "First Floor Slab",
        "color": "#FB7185", # Salmon / Light Coral
        "textColor": "#FFFFFF",
        "progress": 75
    },
    5: {
        "id": "ff_columns",
        "name_ar": "أعمده الدور الأول",
        "name_en": "First Floor Columns",
        "color": "#2563EB", # Blue
        "textColor": "#FFFFFF",
        "progress": 65
    },
    3: {
        "id": "gf_slab",
        "name_ar": "سقف الدور الأرضي",
        "name_en": "Ground Floor Slab",
        "color": "#22C55E", # Bright Green
        "textColor": "#000000",
        "progress": 55
    },
    253: {
        "id": "gf_columns",
        "name_ar": "أعمده الدور الأرضي",
        "name_en": "Ground Floor Columns",
        "color": "#A5B4FC", # Lavender / Periwinkle
        "textColor": "#000000",
        "progress": 45
    },
    6: {
        "id": "rc_footings",
        "name_ar": "قواعد مسلحة",
        "name_en": "Reinforced Concrete Footings",
        "color": "#EC4899", # Magenta / Hot Pink
        "textColor": "#FFFFFF",
        "progress": 35
    },
    8: {
        "id": "pc_footings",
        "name_ar": "قواعد عادية",
        "name_en": "Plain Concrete Footings",
        "color": "#94A3B8", # Slate Gray
        "textColor": "#000000",
        "progress": 25
    },
    55: {
        "id": "ready_concrete",
        "name_ar": "فيلات جاهزه لأعمال الخرسانات",
        "name_en": "Ready for Concrete Works",
        "color": "#A3A635", # Olive / Khaki
        "textColor": "#FFFFFF",
        "progress": 18
    },
    165: {
        "id": "excavation",
        "name_ar": "إنتهاء أعمال الحفر",
        "name_en": "Excavation Completed",
        "color": "#6366F1", # Slate Blue
        "textColor": "#FFFFFF",
        "progress": 10
    }
}

DEFAULT_STAGE = {
    "id": "unhatched",
    "name_ar": "تجهيز الموقع / غير مبدوء",
    "name_en": "Site Preparation / Not Started",
    "color": "#1E293B", # Dark slate outline
    "textColor": "#94A3B8",
    "progress": 5
}

def run_extraction():
    with open(DXF_PATH, "r", encoding="utf-8", errors="ignore") as f:
        lines = [line.strip() for line in f]

    # 1. Extract closed LWPOLYLINEs from 'set pack'
    polies = []
    i = 0
    in_entities = False
    cur_ent = None
    cur_layer = "0"
    cur_pts = []
    cur_closed = False

    while i < len(lines):
        code = lines[i]
        val = lines[i + 1] if i + 1 < len(lines) else ""
        if code == "0" and val == "SECTION":
            if i + 3 < len(lines) and lines[i + 2] == "2" and lines[i + 3] == "ENTITIES":
                in_entities = True; i += 4; continue
        if code == "0" and val == "ENDSEC":
            if in_entities: break
        if in_entities:
            if code == "0":
                if cur_ent == "LWPOLYLINE" and cur_pts and cur_layer == "set pack" and len(cur_pts) >= 3:
                    cx = sum(p[0] for p in cur_pts) / len(cur_pts)
                    cy = sum(p[1] for p in cur_pts) / len(cur_pts)
                    polies.append({"pts": cur_pts, "cx": cx, "cy": cy})
                cur_ent = val
                cur_layer = "0"
                cur_pts = []
                cur_closed = False
            elif code == "8": cur_layer = val
            elif code == "10":
                try:
                    x = float(val)
                    if i + 3 < len(lines) and lines[i + 2] == "20":
                        y = float(lines[i + 3])
                        cur_pts.append((x, y))
                except: pass
        i += 2

    if cur_ent == "LWPOLYLINE" and cur_pts and cur_layer == "set pack" and len(cur_pts) >= 3:
        cx = sum(p[0] for p in cur_pts) / len(cur_pts)
        cy = sum(p[1] for p in cur_pts) / len(cur_pts)
        polies.append({"pts": cur_pts, "cx": cx, "cy": cy})

    # 2. Extract TEXT labels (villa numbers)
    texts = []
    i = 0
    in_entities = False
    cur_ent = None
    cur_text = ""
    cur_pt = None
    while i < len(lines):
        code = lines[i]
        val = lines[i + 1] if i + 1 < len(lines) else ""
        if code == "0" and val == "SECTION":
            if i + 3 < len(lines) and lines[i + 2] == "2" and lines[i + 3] == "ENTITIES":
                in_entities = True; i += 4; continue
        if code == "0" and val == "ENDSEC":
            if in_entities: break
        if in_entities:
            if code == "0":
                if cur_ent == "TEXT" and cur_text and cur_pt:
                    txt = cur_text.strip()
                    if not ("2026" in txt or "الموقف" in txt):
                        texts.append({"text": txt, "x": cur_pt[0], "y": cur_pt[1]})
                cur_ent = val
                cur_text = ""
                cur_pt = None
            elif code == "1": cur_text = val
            elif code == "10":
                try:
                    x = float(val)
                    if i + 3 < len(lines) and lines[i + 2] == "20":
                        y = float(lines[i + 3])
                        cur_pt = (x, y)
                except: pass
        i += 2

    # 3. Extract clean HATCH boundary loops (properly splitting on code 92)
    hatch_loops = []
    i = 0
    in_entities = False
    while i < len(lines):
        code = lines[i]
        val = lines[i + 1] if i + 1 < len(lines) else ""
        if code == "0" and val == "SECTION":
            if i + 3 < len(lines) and lines[i + 2] == "2" and lines[i + 3] == "ENTITIES":
                in_entities = True; i += 4; continue
        if code == "0" and val == "ENDSEC":
            if in_entities: break
        if in_entities and code == "0" and val == "HATCH":
            j = i + 2
            col = None
            cur_loop = []
            in_loop = False
            while j < len(lines):
                c = lines[j]
                v = lines[j + 1] if j + 1 < len(lines) else ""
                if c == "0": break
                elif c == "62":
                    try: col = int(v)
                    except: pass
                elif c == "92":
                    if cur_loop:
                        hatch_loops.append({"color": col, "pts": cur_loop})
                        cur_loop = []
                    in_loop = True
                elif c == "10" and in_loop:
                    try:
                        x = float(v)
                        if j + 3 < len(lines) and lines[j + 2] == "20":
                            y = float(lines[j + 3])
                            cur_loop.append((x, y))
                    except: pass
                j += 2
            if cur_loop:
                hatch_loops.append({"color": col, "pts": cur_loop})
            i = j; continue
        i += 2

    print(f"Extracted {len(polies)} villa polylines, {len(texts)} texts, and {len(hatch_loops)} hatch loops.")

    # Point in polygon
    def pip(x, y, poly):
        n = len(poly)
        inside = False
        p1x, p1y = poly[0]
        for k in range(n + 1):
            p2x, p2y = poly[k % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside

    # Compute Global Bounds (including legend space on right)
    all_xs = [pt[0] for p in polies for pt in p["pts"]] + [t["x"] for t in texts]
    all_ys = [pt[1] for p in polies for pt in p["pts"]] + [t["y"] for t in texts]

    min_x = min(all_xs)
    max_x = max(all_xs) + 120 # Add space for AutoCAD Legend on the right!
    min_y = min(all_ys) - 20
    max_y = max(all_ys) + 20

    cad_w = max_x - min_x
    cad_h = max_y - min_y

    PAD = 40
    SVG_W = 1200
    scale = (SVG_W - PAD * 2) / cad_w
    SVG_H = int(cad_h * scale) + PAD * 2

    def cad_to_svg(cx, cy):
        # In CAD, Y goes UP. In SVG, Y goes DOWN.
        sx = PAD + (cx - min_x) * scale
        sy = SVG_H - PAD - (cy - min_y) * scale
        return (round(sx, 2), round(sy, 2))

    def pts_to_svg_d(pts):
        if not pts: return ""
        svg_pts = [cad_to_svg(px, py) for px, py in pts]
        return f"M {svg_pts[0][0]},{svg_pts[0][1]} " + " ".join(f"L {p[0]},{p[1]}" for p in svg_pts[1:]) + " Z"

    # Match each polyline to text and hatch color
    villas = []
    used_texts = set()

    for idx, p in enumerate(polies):
        # Find text inside or closest
        best_t = None
        min_td = 1e9
        for t in texts:
            if pip(t["x"], t["y"], p["pts"]):
                best_t = t
                break
            d = math.hypot(p["cx"] - t["x"], p["cy"] - t["y"])
            if d < min_td:
                min_td = d
                best_t = t

        # Find hatch loop inside or closest
        best_h = None
        min_hd = 1e9
        for h in hatch_loops:
            hpts = h["pts"]
            if not hpts: continue
            hcx = sum(pt[0] for pt in hpts) / len(hpts)
            hcy = sum(pt[1] for pt in hpts) / len(hpts)
            if pip(hcx, hcy, p["pts"]):
                best_h = h
                break
            d = math.hypot(p["cx"] - hcx, p["cy"] - hcy)
            if d < min_hd:
                min_hd = d
                best_h = h

        # If hatch is far away, it is unhatched
        if min_hd > 12.0 and not (best_h and pip(sum(pt[0] for pt in best_h["pts"])/len(best_h["pts"]), sum(pt[1] for pt in best_h["pts"])/len(best_h["pts"]), p["pts"])):
            h_color = None
        else:
            h_color = best_h["color"] if best_h else None

        stage = STAGES.get(h_color, DEFAULT_STAGE)
        unit_num = best_t["text"] if best_t else f"U-{idx+1}"

        # Unit type
        if "-" in unit_num or "T" in unit_num:
            unit_type = "Twin House" if any(k in unit_num for k in ["A-B", "C-D", "E-F"]) else "Townhouse"
        else:
            unit_type = "Standalone Villa"

        svg_label_pos = cad_to_svg(best_t["x"], best_t["y"]) if best_t else cad_to_svg(p["cx"], p["cy"])

        villas.append({
            "id": f"V-{unit_num}",
            "unitNumber": unit_num,
            "unitType": unit_type,
            "stage": stage,
            "colorCode": h_color,
            "cadX": round(p["cx"], 2),
            "cadY": round(p["cy"], 2),
            "labelX": svg_label_pos[0],
            "labelY": svg_label_pos[1],
            "svgPath": pts_to_svg_d(p["pts"])
        })

    print(f"Generated {len(villas)} villas.")

    # Calculate Legend Layout in SVG coordinates (matching AutoCAD screenshot Image 2)
    # The legend is on the right side: X ~ max_x - 100
    legend_start_cad = (max_x - 100, max_y - 30)
    legend_svg_start = cad_to_svg(legend_start_cad[0], legend_start_cad[1])

    output_data = {
        "meta": {
            "title": "Villagio Current Project State — Executive Status 26-9-2026",
            "source": "Villagio/project current state.dxf",
            "date": "2026-09-26",
            "viewBox": f"0 0 {SVG_W} {SVG_H}",
            "width": SVG_W,
            "height": SVG_H,
            "totalUnits": len(villas)
        },
        "stagesOrder": [1, 2, 4, 32, 11, 5, 3, 253, 6, 8, 55, 165],
        "stages": STAGES,
        "villas": villas
    }

    with open("project-current-state.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    js_content = f"""/**
 * Villagio Current Project State — Exact 1:1 Vectorization of AutoCAD DXF
 * Source: Villagio/project current state.dxf (26-9-2026)
 */

const PROJECT_CURRENT_STATE = {json.dumps(output_data, ensure_ascii=False, indent=2)};

if (typeof module !== 'undefined' && module.exports) {{
  module.exports = PROJECT_CURRENT_STATE;
}}
"""

    with open("project-current-state.js", "w", encoding="utf-8") as f:
        f.write(js_content)

    print("Wrote project-current-state.json and project-current-state.js.")

run_extraction()
