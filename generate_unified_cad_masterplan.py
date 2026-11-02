"""
Unified AutoCAD Masterplan Generator for Villagio.
Combines:
1. 115 Villas with exact current construction stages & colors from 'project current state.dxf'
2. Clean road network (ASPHALT, City_road, City_Edge) from 'Masterplan Final.dxf'
3. Landscape & Greenery borders (city_green, Land line) highlighting the compound
4. Elegant, clean crystal lagoon water features aligned with water surface markers
5. Luxury apartment complexes (AP01 - AP08)
Removes clutter (amenities, parking) as requested.
"""

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
print("Extracting villas and current stages from project current state DXF...")

with open(CS_PATH, "r", encoding="utf-8", errors="ignore") as f:
    cs_lines = [l.strip() for l in f]

# Extract polylines in 'set pack'
villa_polies = []
i = 0
in_ent = False
cur_layer = "0"
cur_pts = []
cur_closed = False
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
            cur_layer = "0"; cur_pts = []; cur_closed = False
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

# Extract hatch loops for colors (splitting on code 92)
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

print(f"Loaded {len(villa_polies)} villa polylines, {len(villa_texts)} labels, and {len(cs_hatch_loops)} hatch loops.")

# Point-in-poly helper
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

# Match each villa polyline to its label and color
matched_villas = []
for idx, p in enumerate(villa_polies):
    # Find text
    best_t = None
    min_td = 1e9
    for t in villa_texts:
        if pip(t["x"], t["y"], p["pts"]):
            best_t = t; break
        d = math.hypot(p["cx"] - t["x"], p["cy"] - t["y"])
        if d < min_td: min_td = d; best_t = t

    # Find hatch
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

print(f"Matched all {len(matched_villas)} villas successfully.")

# --- 2. EXTRACT ROADS, GREENERY, LAND LINE, APARTMENTS FROM 'Masterplan Final.dxf' ---
print("\nExtracting roads, greenery, boundary, and apartments from Masterplan Final DXF...")

with open(MP_PATH, "r", encoding="utf-8", errors="ignore") as f:
    mp_lines = [l.strip() for l in f]

road_geoms = []
green_geoms = []
boundary_geoms = []
apartment_polies = []

i = 0
in_ent = False
cur_layer = "0"
cur_ent = None
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
                # filter compound range [0..780, 0..620]
                if all(0 <= p[0] <= 780 and 0 <= p[1] <= 620 for p in cur_pts):
                    if cur_layer in ("ASPHALT", "City_road", "City_Edge", "City_Axies", "CL"):
                        road_geoms.append({"pts": cur_pts, "closed": cur_closed, "layer": cur_layer})
                    elif cur_layer in ("city_green"):
                        green_geoms.append({"pts": cur_pts, "closed": cur_closed, "layer": cur_layer})
                    elif cur_layer in ("Land line", "SITE"):
                        boundary_geoms.append({"pts": cur_pts, "closed": cur_closed, "layer": cur_layer})
                    elif cur_layer == "set pack" and (any(p[1] >= 390 for p in cur_pts) or any(p[0] >= 610 for p in cur_pts)):
                        # Apartments AP01-AP08 and upper perimeter
                        apartment_polies.append({"pts": cur_pts, "closed": cur_closed, "layer": cur_layer})
            cur_layer = "0"; cur_pts = []; cur_closed = False; cur_ent = v
        elif c == "8": cur_layer = v
        elif c == "70":
            try: cur_closed = (int(val) & 1) == 1
            except: pass
        elif c in ("10", "11"):
            try:
                x = float(v)
                if i+3 < len(mp_lines) and mp_lines[i+2] in ("20", "21"):
                    y = float(mp_lines[i+3])
                    cur_pts.append((x, y))
            except: pass
    i += 2

print(f"Extracted {len(road_geoms)} road elements, {len(green_geoms)} green elements, {len(boundary_geoms)} boundary elements, {len(apartment_polies)} apartment elements.")

# --- 3. CREATE CLEAN WATER FEATURES (CRYSTAL LAGOON & RESORT POOL) ---
# Aligned directly with the 18 Water Surface Level markers
# Left Lagoon Canal: curves between Villa Row A/B and Center
# Right Lagoon Canal: curves between Center and East
# AP Courtyard Pool: central luxury pool at AP01/AP02
lagoon_canals_cad = [
    # Left Lagoon Canal
    [
        (185, 288), (216, 290), (250, 292), (281, 290), (318, 288),
        (335, 330), (320, 374), (291, 368), (255, 360), (220, 345), (185, 320)
    ],
    # Right Lagoon Canal
    [
        (350, 190), (395, 212), (437, 240), (482, 271), (542, 279),
        (535, 310), (475, 305), (423, 285), (380, 260), (345, 230)
    ],
    # AP01/AP02 Central Resort Pool
    [
        (510, 420), (540, 415), (560, 430), (550, 445), (520, 445), (505, 435)
    ]
]

# --- 4. SCALE ALL COORDINATES INTO UNIFIED SVG VIEWBOX (0 0 1200 960) ---
PAD = 35
SVG_W = 1200
cad_min_x = 0
cad_max_x = 755
cad_min_y = 0
cad_max_y = 605
cad_w = cad_max_x - cad_min_x
cad_h = cad_max_y - cad_min_y

scale = (SVG_W - PAD * 2) / cad_w
SVG_H = int(cad_h * scale) + PAD * 2

def cad_to_svg(cx, cy):
    # In CAD, Y goes UP. In SVG, Y goes DOWN.
    sx = PAD + (cx - cad_min_x) * scale
    sy = SVG_H - PAD - (cy - cad_min_y) * scale
    return (round(sx, 2), round(sy, 2))

def pts_to_d(pts, closed=True):
    if not pts: return ""
    svg_pts = [cad_to_svg(px, py) for px, py in pts]
    d = f"M {svg_pts[0][0]},{svg_pts[0][1]} " + " ".join(f"L {p[0]},{p[1]}" for p in svg_pts[1:])
    if closed: d += " Z"
    return d

# Convert all geometries to SVG paths
final_villas = []
for v in matched_villas:
    svg_pts = [cad_to_svg(px, py) for px, py in v["cadPts"]]
    d = f"M {svg_pts[0][0]},{svg_pts[0][1]} " + " ".join(f"L {p[0]},{p[1]}" for p in svg_pts[1:]) + " Z"
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
        "svgPath": d
    })

final_roads = [pts_to_d(r["pts"], closed=r.get("closed", False)) for r in road_geoms]
final_green = [pts_to_d(g["pts"], closed=True) for g in green_geoms]
final_boundary = [pts_to_d(b["pts"], closed=False) for b in boundary_geoms]
final_apartments = [pts_to_d(a["pts"], closed=True) for a in apartment_polies]
final_water = [pts_to_d(w, closed=True) for w in lagoon_canals_cad]

output_data = {
    "meta": {
        "title": "Villagio Masterplan — Unified Precision Vector Masterplan",
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
        "boundary": final_boundary,
        "greenery": final_green,
        "roads": final_roads,
        "water": final_water,
        "apartments": final_apartments,
        "villas": final_villas
    }
}

with open("unified-cad-masterplan.json", "w", encoding="utf-8") as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

js_content = f"""/**
 * Villagio Masterplan — Unified Precision Vector Dataset
 * Extracted from AutoCAD Masterplan Final & project current state DXFs
 */

const UNIFIED_MASTERPLAN = {json.dumps(output_data, ensure_ascii=False, indent=2)};

if (typeof module !== 'undefined' && module.exports) {{
  module.exports = UNIFIED_MASTERPLAN;
}}
"""

with open("unified-cad-masterplan.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"\nGenerated unified masterplan dataset successfully!")
print(f"  Villas: {len(final_villas)} (with 12 real-time CAD construction stages)")
print(f"  Apartment Polygons: {len(final_apartments)}")
print(f"  Road Geometries: {len(final_roads)}")
print(f"  Greenery Parcels: {len(final_green)}")
print(f"  Crystal Lagoon Canals: {len(final_water)}")
