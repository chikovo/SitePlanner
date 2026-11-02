import os
import math
import json

MP_PATH = os.path.join("Villagio", "Masterplan Final.dxf")
CS_PATH = os.path.join("Villagio", "project current state.dxf")

# 12 Construction Stages matching AutoCAD legend (Image 2)
STAGES = {
    1: {
        "id": "fully_finished",
        "name_ar": "فيلات منتهيه تماما",
        "name_en": "Fully Finished / Handover",
        "color": "#EF4444", # Red
        "progress": 100
    },
    2: {
        "id": "concrete_brickwork",
        "name_ar": "فيلات منتهيه خرسانات ومباني دور أول وغرف سطح",
        "name_en": "Concrete + Brickwork Done",
        "color": "#FACC15", # Yellow
        "progress": 95
    },
    4: {
        "id": "concrete_structure",
        "name_ar": "فيلات منتهيه خرسانات",
        "name_en": "Concrete Structure Completed",
        "color": "#06B6D4", # Cyan
        "progress": 90
    },
    32: {
        "id": "roof_columns",
        "name_ar": "أعمده غرف السطح",
        "name_en": "Roof Room Columns",
        "color": "#B45309", # Brown / Rust
        "progress": 82
    },
    11: {
        "id": "ff_slab",
        "name_ar": "سقف الدور الأول",
        "name_en": "First Floor Slab",
        "color": "#FB7185", # Salmon / Light Coral
        "progress": 75
    },
    5: {
        "id": "ff_columns",
        "name_ar": "أعمده الدور الأول",
        "name_en": "First Floor Columns",
        "color": "#2563EB", # Blue
        "progress": 65
    },
    3: {
        "id": "gf_slab",
        "name_ar": "سقف الدور الأرضي",
        "name_en": "Ground Floor Slab",
        "color": "#22C55E", # Bright Green
        "progress": 55
    },
    253: {
        "id": "gf_columns",
        "name_ar": "أعمده الدور الأرضي",
        "name_en": "Ground Floor Columns",
        "color": "#A5B4FC", # Lavender / Periwinkle
        "progress": 45
    },
    6: {
        "id": "rc_footings",
        "name_ar": "قواعد مسلحة",
        "name_en": "Reinforced Concrete Footings",
        "color": "#EC4899", # Magenta / Hot Pink
        "progress": 35
    },
    8: {
        "id": "pc_footings",
        "name_ar": "قواعد عادية",
        "name_en": "Plain Concrete Footings",
        "color": "#94A3B8", # Slate Gray
        "progress": 25
    },
    55: {
        "id": "ready_concrete",
        "name_ar": "فيلات جاهزه لأعمال الخرسانات",
        "name_en": "Ready for Concrete Works",
        "color": "#A3A635", # Olive / Khaki
        "progress": 18
    },
    165: {
        "id": "excavation",
        "name_ar": "إنتهاء أعمال الحفر",
        "name_en": "Excavation Completed",
        "color": "#6366F1", # Slate Blue
        "progress": 10
    }
}

DEFAULT_STAGE = {
    "id": "unhatched",
    "name_ar": "تجهيز الموقع / غير مبدوء",
    "name_en": "Site Preparation / Not Started",
    "color": "#1E293B",
    "progress": 5
}

# --- 1. EXTRACT 115 VILLAS FROM 'project current state.dxf' ---
print("1. Extracting villas from project current state.dxf...")
with open(CS_PATH, "r", encoding="utf-8", errors="ignore") as f:
    cs_lines = [l.strip() for l in f]

villa_polies = []
i = 0
in_ent = False
cur_layer = "0"
cur_pts = []
while i < len(cs_lines):
    c = cs_lines[i]
    v = cs_lines[i+1] if i+1 < len(cs_lines) else ""
    if c == "0" and v == "SECTION":
        if i+3 < len(cs_lines) and cs_lines[i+2] == "2" and cs_lines[i+3] == "ENTITIES":
            in_ent = True; i += 4; continue
    if c == "0" and v == "ENDSEC":
        if in_ent: break
    if in_ent:
        if c == "0":
            if cur_pts and cur_layer == "set pack" and len(cur_pts) >= 3:
                cx = sum(p[0] for p in cur_pts)/len(cur_pts)
                cy = sum(p[1] for p in cur_pts)/len(cur_pts)
                villa_polies.append({"pts": cur_pts, "cx": cx, "cy": cy})
            cur_layer = "0"; cur_pts = []
        elif c == "8": cur_layer = v
        elif c == "10":
            try:
                x = float(v)
                if i+3 < len(cs_lines) and cs_lines[i+2] == "20":
                    y = float(cs_lines[i+3])
                    cur_pts.append((x, y))
            except: pass
    i += 2

if cur_pts and cur_layer == "set pack" and len(cur_pts) >= 3:
    cx = sum(p[0] for p in cur_pts)/len(cur_pts)
    cy = sum(p[1] for p in cur_pts)/len(cur_pts)
    villa_polies.append({"pts": cur_pts, "cx": cx, "cy": cy})

# Extract text labels
villa_texts = []
i = 0
in_ent = False
cur_txt = ""
cur_pt = None
while i < len(cs_lines):
    c = cs_lines[i]
    v = cs_lines[i+1] if i+1 < len(cs_lines) else ""
    if c == "0" and v == "SECTION":
        if i+3 < len(cs_lines) and cs_lines[i+2] == "2" and cs_lines[i+3] == "ENTITIES":
            in_ent = True; i += 4; continue
    if c == "0" and v == "ENDSEC":
        if in_ent: break
    if in_ent:
        if c == "0":
            if cur_txt and cur_pt:
                t = cur_txt.strip()
                if not ("2026" in t or "الموقف" in t):
                    villa_texts.append({"text": t, "x": cur_pt[0], "y": cur_pt[1]})
            cur_txt = ""; cur_pt = None
        elif c == "1": cur_txt = v
        elif c == "10":
            try:
                x = float(v)
                if i+3 < len(cs_lines) and cs_lines[i+2] == "20":
                    y = float(cs_lines[i+3])
                    cur_pt = (x, y)
            except: pass
    i += 2

# Extract hatch loops
cs_hatch_loops = []
i = 0
in_ent = False
while i < len(cs_lines):
    c = cs_lines[i]
    v = cs_lines[i+1] if i+1 < len(cs_lines) else ""
    if c == "0" and v == "SECTION":
        if i+3 < len(cs_lines) and cs_lines[i+2] == "2" and cs_lines[i+3] == "ENTITIES":
            in_ent = True; i += 4; continue
    if c == "0" and v == "ENDSEC":
        if in_ent: break
    if in_ent and c == "0" and v == "HATCH":
        j = i + 2
        col = None
        cur_loop = []
        in_loop = False
        while j < len(cs_lines):
            code = cs_lines[j]
            val = cs_lines[j+1] if j+1 < len(cs_lines) else ""
            if code == "0": break
            elif code == "62":
                try: col = int(val)
                except: pass
            elif code == "92":
                if cur_loop: cs_hatch_loops.append({"color": col, "pts": cur_loop}); cur_loop = []
                in_loop = True
            elif code == "10" and in_loop:
                try:
                    x = float(val)
                    if j+3 < len(cs_lines) and cs_lines[j+2] == "20":
                        y = float(cs_lines[j+3])
                        cur_loop.append((x, y))
                except: pass
            j += 2
        if cur_loop: cs_hatch_loops.append({"color": col, "pts": cur_loop})
        i = j; continue
    i += 2

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

matched_villas = []
for idx, p in enumerate(villa_polies):
    best_t = None
    min_td = 1e9
    for t in villa_texts:
        if pip(t["x"], t["y"], p["pts"]):
            best_t = t; break
        d = math.hypot(p["cx"] - t["x"], p["cy"] - t["y"])
        if d < min_td: min_td = d; best_t = t

    best_h = None
    min_hd = 1e9
    for h in cs_hatch_loops:
        hpts = h["pts"]
        if not hpts: continue
        hcx = sum(pt[0] for pt in hpts)/len(hpts)
        hcy = sum(pt[1] for pt in hpts)/len(hpts)
        if pip(hcx, hcy, p["pts"]):
            best_h = h; break
        d = math.hypot(p["cx"] - hcx, p["cy"] - hcy)
        if d < min_hd: min_hd = d; best_h = h

    if min_hd > 12.0 and not (best_h and pip(sum(pt[0] for pt in best_h["pts"])/len(best_h["pts"]), sum(pt[1] for pt in best_h["pts"])/len(best_h["pts"]), p["pts"])):
        h_color = None
    else:
        h_color = best_h["color"] if best_h else None

    unit_num = best_t["text"] if best_t else f"U-{idx+1}"
    unit_type = "Twin House" if any(k in unit_num for k in ["A-B", "C-D", "E-F"]) else ("Townhouse" if ("-" in unit_num or "T" in unit_num) else "Standalone Villa")
    stage = STAGES.get(h_color, DEFAULT_STAGE)

    matched_villas.append({
        "id": f"V-{unit_num}",
        "unitNumber": unit_num,
        "unitType": unit_type,
        "stage": stage,
        "colorCode": h_color,
        "cadPts": p["pts"],
        "cadX": round(p["cx"], 2),
        "cadY": round(p["cy"], 2),
        "labelCadX": best_t["x"] if best_t else p["cx"],
        "labelCadY": best_t["y"] if best_t else p["cy"],
    })

print(f"-> Extracted {len(matched_villas)} villas successfully.")

# --- 2. EXTRACT CLEAN ROADS, GREENERY PERIMETER, AND APARTMENT BUILDINGS ---
print("\n2. Extracting clean masterplan context from Masterplan Final.dxf...")
with open(MP_PATH, "r", encoding="utf-8", errors="ignore") as f:
    mp_lines = [l.strip() for l in f]

road_lines = []
greenery_lines = []
apartment_polies = []

i = 0
in_ent = False
cur_layer = "0"
cur_etype = ""
cur_pts = []
cur_closed = False

while i < len(mp_lines):
    c = mp_lines[i]
    v = mp_lines[i+1] if i+1 < len(mp_lines) else ""
    if c == "0" and v == "SECTION":
        if i+3 < len(mp_lines) and mp_lines[i+2] == "2" and mp_lines[i+3] == "ENTITIES":
            in_ent = True; i += 4; continue
    if c == "0" and v == "ENDSEC":
        if in_ent: break
    if in_ent:
        if c == "0":
            if cur_pts and len(cur_pts) >= 2:
                # Filter to valid site coordinates
                if all(70 <= p[0] <= 700 and 35 <= p[1] <= 560 for p in cur_pts):
                    xs = [p[0] for p in cur_pts]
                    ys = [p[1] for p in cur_pts]
                    dx = max(xs) - min(xs)
                    dy = max(ys) - min(ys)

                    # Greenery Perimeter Outline (city_green, SITE)
                    if cur_layer in ("city_green", "SITE"):
                        greenery_lines.append(cur_pts)

                    # Road Network (City_road, City_Edge, ASPHALT, CL) - strictly stroke, no fill
                    elif cur_layer in ("City_road", "City_Edge", "ASPHALT", "CL"):
                        if len(cur_pts) >= 2:
                            road_lines.append(cur_pts)

                    # Apartment Footprints: ONLY closed shapes with reasonable building dimensions (15m to 85m)
                    # Located on the east side (x >= 400, y >= 300)
                    elif cur_layer in ("set pack", "comments") and cur_closed and (15 <= dx <= 85 and 15 <= dy <= 85):
                        if min(xs) >= 400 and min(ys) >= 300 and len(cur_pts) >= 4:
                            apartment_polies.append(cur_pts)

            cur_layer = "0"; cur_pts = []; cur_closed = False; cur_etype = v
        elif c == "8": cur_layer = v
        elif c == "70":
            try: cur_closed = (int(v) & 1) == 1
            except: pass
        elif c in ("10", "11"):
            try:
                x = float(v)
                if i+3 < len(mp_lines) and mp_lines[i+2] in ("20", "21"):
                    y = float(mp_lines[i+3])
                    cur_pts.append((x, y))
            except: pass
    i += 2

print(f"-> Extracted {len(road_lines)} road line segments (fill: none).")
print(f"-> Extracted {len(greenery_lines)} greenery perimeter segments (highlighting the plan).")
print(f"-> Extracted {len(apartment_polies)} genuine apartment building footprints (NO purple shroud!).")

# --- 3. UNIFIED SVG COORDINATE TRANSFORMATION ---
# Site Bounding Box: [70, 35] to [695, 555]
CAD_MIN_X = 70.0
CAD_MAX_X = 695.0
CAD_MIN_Y = 35.0
CAD_MAX_Y = 555.0

SVG_W = 1200
PAD = 40
cad_w = CAD_MAX_X - CAD_MIN_X
cad_h = CAD_MAX_Y - CAD_MIN_Y
scale = (SVG_W - PAD * 2) / cad_w
SVG_H = int(cad_h * scale) + PAD * 2

def cad_to_svg(cx, cy):
    sx = PAD + (cx - CAD_MIN_X) * scale
    sy = SVG_H - PAD - (cy - CAD_MIN_Y) * scale
    return (round(sx, 2), round(sy, 2))

def pts_to_path(pts, closed=False):
    if not pts: return ""
    svg_pts = [cad_to_svg(px, py) for px, py in pts]
    d = f"M {svg_pts[0][0]},{svg_pts[0][1]} " + " ".join(f"L {p[0]},{p[1]}" for p in svg_pts[1:])
    if closed: d += " Z"
    return d

final_villas = []
for v in matched_villas:
    lbl = cad_to_svg(v["labelCadX"], v["labelCadY"])
    final_villas.append({
        "id": v["id"],
        "unitNumber": v["unitNumber"],
        "unitType": v["unitType"],
        "stage": v["stage"],
        "colorCode": v["colorCode"],
        "cadX": v["cadX"],
        "cadY": v["cadY"],
        "labelX": lbl[0],
        "labelY": lbl[1],
        "svgPath": pts_to_path(v["cadPts"], closed=True)
    })

final_roads = [pts_to_path(r, closed=False) for r in road_lines]
final_green = [pts_to_path(g, closed=False) for g in greenery_lines]
final_apartments = [pts_to_path(a, closed=True) for a in apartment_polies]

output_data = {
    "meta": {
        "title": "Villagio — Precision Masterplan & Construction Progress",
        "date": "2026-09-26",
        "viewBox": f"0 0 {SVG_W} {SVG_H}",
        "width": SVG_W,
        "height": SVG_H,
        "totalVillas": len(final_villas),
        "totalRoads": len(final_roads),
        "totalGreenery": len(final_green),
        "totalApartments": len(final_apartments)
    },
    "stagesOrder": [1, 2, 4, 32, 11, 5, 3, 253, 6, 8, 55, 165],
    "stages": STAGES,
    "layers": {
        "greenery": final_green,
        "roads": final_roads,
        "apartments": final_apartments,
        "villas": final_villas
    }
}

with open("unified-cad-masterplan.json", "w", encoding="utf-8") as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

js_content = f"""/**
 * Villagio Masterplan — Precision Vector Dataset
 * Extracted from AutoCAD Masterplan Final & project current state DXFs
 * Fully cleaned: No purple shroud, no fake water blobs, no parking clutter.
 */

const UNIFIED_MASTERPLAN = {json.dumps(output_data, ensure_ascii=False, indent=2)};

if (typeof module !== 'undefined' && module.exports) {{
  module.exports = UNIFIED_MASTERPLAN;
}}
"""

with open("unified-cad-masterplan.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"\nGenerated unified-cad-masterplan.js successfully!")
print(f"  Villas: {len(final_villas)}")
print(f"  Road segments: {len(final_roads)}")
print(f"  Greenery highlight segments: {len(final_green)}")
print(f"  Apartment footprints: {len(final_apartments)}")
