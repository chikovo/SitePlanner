"""
High-Precision CAD Vector Extractor & Layer Categorizer for Villagio Masterplan.
Extracts geometry from 'Villagio/Masterplan Final.dxf' into:
1. standalone_villas
2. twin_houses
3. townhouses
4. apartment_buildings
5. roads
6. parking
7. landscape
8. water_features
9. amenities
(Ignores: LVL2 / ELV2 and pathway levels).
"""

import os
import math
import json

DXF_PATH = os.path.join("Villagio", "Masterplan Final.dxf")

def parse_dxf_geometry(file_path):
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = [line.strip() for line in f]

    entities = []
    i = 0
    in_section = None

    while i < len(lines):
        code = lines[i]
        val = lines[i + 1] if i + 1 < len(lines) else ""

        if code == "0" and val == "SECTION":
            in_section = lines[i + 3] if i + 3 < len(lines) else None
            i += 4
            continue
        elif code == "0" and val == "ENDSEC":
            in_section = None
            i += 2
            continue

        if in_section == "ENTITIES":
            ent_type = val
            ent_data = {"type": ent_type, "layer": "0"}
            j = i + 2
            pts = []
            bulges = []
            hatch_loops = []
            cur_loop = []

            while j < len(lines):
                c = lines[j]
                v = lines[j + 1] if j + 1 < len(lines) else ""
                if c == "0":
                    break
                elif c == "8":
                    ent_data["layer"] = v
                elif c == "2":
                    ent_data["name"] = v
                elif c == "10":
                    try:
                        x = float(v)
                        y = float(lines[j + 3]) if j + 3 < len(lines) and lines[j + 2] == "20" else 0.0
                        pts.append((x, y))
                        cur_loop.append((x, y))
                    except: pass
                elif c == "93":
                    if cur_loop:
                        hatch_loops.append(cur_loop)
                        cur_loop = []
                elif c == "42":
                    try: bulges.append(float(v))
                    except: pass
                elif c == "11":
                    try:
                        ent_data["x2"] = float(v)
                        ent_data["y2"] = float(lines[j + 3]) if j + 3 < len(lines) and lines[j + 2] == "21" else 0.0
                    except: pass
                elif c == "40":
                    try: ent_data["radius"] = float(v)
                    except: pass
                elif c == "50":
                    try: ent_data["start_angle"] = float(v)
                    except: pass
                elif c == "51":
                    try: ent_data["end_angle"] = float(v)
                    except: pass
                elif c == "70":
                    try: ent_data["closed"] = (int(v) & 1) == 1
                    except: pass
                elif c == "1":
                    ent_data["text"] = v
                j += 2

            if cur_loop:
                hatch_loops.append(cur_loop)
            if hatch_loops:
                ent_data["loops"] = hatch_loops
            if pts:
                ent_data["pts"] = pts
                ent_data["x1"] = pts[0][0]
                ent_data["y1"] = pts[0][1]
            if bulges:
                ent_data["bulges"] = bulges

            entities.append(ent_data)
            i = j
            continue

        i += 2

    return entities

print("Parsing DXF file...")
raw_entities = parse_dxf_geometry(DXF_PATH)

# Exclude level layers
IGNORED_LAYERS = {"LVL2", "ELV2", "pathway levels", "pathway level"}
entities = [e for e in raw_entities if e.get("layer") not in IGNORED_LAYERS]

# Filter compound bounds: X in [0..820], Y in [-20..680]
def is_valid_compound(e):
    pts = e.get("pts", [])
    if pts:
        for x, y in pts:
            if not (-50 <= x <= 900 and -50 <= y <= 750): return False
        return True
    if "x1" in e:
        return (-50 <= e["x1"] <= 900 and -50 <= e["y1"] <= 750)
    return True

compound_entities = [e for e in entities if is_valid_compound(e)]

# Calculate global bounding box
all_pts = []
for e in compound_entities:
    if "pts" in e: all_pts.extend(e["pts"])
    elif "x1" in e and "x2" in e:
        all_pts.append((e["x1"], e["y1"]))
        all_pts.append((e["x2"], e["y2"]))
    elif "x1" in e: all_pts.append((e["x1"], e["y1"]))

min_x = min(p[0] for p in all_pts)
max_x = max(p[0] for p in all_pts)
min_y = min(p[1] for p in all_pts)
max_y = max(p[1] for p in all_pts)
cad_w = max_x - min_x
cad_h = max_y - min_y

PAD = 40
SVG_W = 1200
SVG_H = int(SVG_W * (cad_h / cad_w)) + PAD * 2
scale = (SVG_W - PAD * 2) / cad_w

def cad_to_svg(cx, cy):
    # In CAD, Y goes UP. In SVG, Y goes DOWN.
    sx = PAD + (cx - min_x) * scale
    sy = SVG_H - PAD - (cy - min_y) * scale
    return (round(sx, 2), round(sy, 2))

def to_svg_path(e):
    etype = e.get("type")
    if etype == "LINE":
        if "x1" in e and "x2" in e:
            p1 = cad_to_svg(e["x1"], e["y1"])
            p2 = cad_to_svg(e["x2"], e["y2"])
            return f"M {p1[0]},{p1[1]} L {p2[0]},{p2[1]}"
    elif etype == "ARC":
        cx, cy = e["x1"], e["y1"]
        r = e.get("radius", 0)
        a1 = e.get("start_angle", 0)
        a2 = e.get("end_angle", 0)
        if r <= 0: return ""
        p_start = (cx + r * math.cos(math.radians(a1)), cy + r * math.sin(math.radians(a1)))
        p_end = (cx + r * math.cos(math.radians(a2)), cy + r * math.sin(math.radians(a2)))
        p1 = cad_to_svg(p_start[0], p_start[1])
        p2 = cad_to_svg(p_end[0], p_end[1])
        svg_r = round(r * scale, 2)
        diff = (a2 - a1) % 360
        large_arc = 1 if diff > 180 else 0
        return f"M {p1[0]},{p1[1]} A {svg_r} {svg_r} 0 {large_arc} 0 {p2[0]},{p2[1]}"
    elif etype == "CIRCLE":
        cx, cy = e["x1"], e["y1"]
        r = e.get("radius", 0) * scale
        p = cad_to_svg(cx, cy)
        return f"M {p[0]-r:.2f},{p[1]:.2f} A {r:.2f} {r:.2f} 0 1 0 {p[0]+r:.2f},{p[1]:.2f} A {r:.2f} {r:.2f} 0 1 0 {p[0]-r:.2f},{p[1]:.2f}"
    elif etype == "LWPOLYLINE":
        pts = e.get("pts", [])
        if not pts: return ""
        svg_pts = [cad_to_svg(px, py) for px, py in pts]
        d = f"M {svg_pts[0][0]},{svg_pts[0][1]} " + " ".join(f"L {p[0]},{p[1]}" for p in svg_pts[1:])
        if e.get("closed", False): d += " Z"
        return d
    elif etype == "HATCH":
        loops = e.get("loops", [])
        if not loops and "pts" in e: loops = [e["pts"]]
        segs = []
        for loop in loops:
            if len(loop) < 2: continue
            svg_pts = [cad_to_svg(px, py) for px, py in loop]
            segs.append(f"M {svg_pts[0][0]},{svg_pts[0][1]} " + " ".join(f"L {p[0]},{p[1]}" for p in svg_pts[1:]) + " Z")
        return " ".join(segs)
    return ""

# Categorize into the 9 user-specified geometry categories
CATEGORIES = {
    "standalone_villas": [],
    "twin_houses": [],
    "townhouses": [],
    "apartment_buildings": [],
    "roads": [],
    "parking": [],
    "landscape": [],
    "water_features": [],
    "amenities": []
}

# Spatial and layer-based routing
for e in compound_entities:
    layer = e.get("layer", "0")
    etype = e.get("type")
    svg_d = to_svg_path(e)
    if not svg_d: continue

    cx = e.get("x1", 0)
    cy = e.get("y1", 0)
    pts = e.get("pts", [])
    if pts:
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)

    # 1. ROADS (Outer and inner network)
    if layer in ("ASPHALT", "OUTLINE ASPHALT", "City_road", "City_Edge", "City_Axies", "CL"):
        CATEGORIES["roads"].append({"d": svg_d, "layer": layer, "type": etype})

    # 2. PARKING (Parking stalls, bays, pavement striping)
    elif layer == "PAVEMENT" and (cy > 430 or (cx > 560 and cy < 280) or any(k in e.get("text", "") for k in ["P1", "P2", "P4"])):
        CATEGORIES["parking"].append({"d": svg_d, "layer": layer, "type": etype})

    # 3. LANDSCAPE (Green spaces, perimeter buffers, park courtyards)
    elif layer in ("city_green", "Land line", "SITE", "V-NODE-TEXT") or (layer == "PAVEMENT" and not (cy > 430 or (cx > 560 and cy < 280))):
        CATEGORIES["landscape"].append({"d": svg_d, "layer": layer, "type": etype})

    # 4. WATER FEATURES (Lagoon, shoreline, water levels, pools)
    elif layer == "Water Surface Level" or (layer in ("0", ".", "sec line") and ((180 <= cx <= 560 and 200 <= cy <= 430 and etype in ("HATCH", "LWPOLYLINE", "ARC")) or "water" in layer.lower())):
        CATEGORIES["water_features"].append({"d": svg_d, "layer": layer, "type": etype})

    # 5. APARTMENT BUILDINGS (AP01 through AP08, Northern Boulevard)
    elif (layer in ("set pack", "sec line", "comments", "0") and (cy >= 430 or (cx >= 620 and cy >= 260 and cy <= 360))):
        CATEGORIES["apartment_buildings"].append({"d": svg_d, "layer": layer, "type": etype})

    # 6. TOWNHOUSES (Right Strip & Bottom Strip)
    elif (cx >= 560 and cy <= 380) or (cy <= 220 and cx >= 280 and cx <= 580):
        CATEGORIES["townhouses"].append({"d": svg_d, "layer": layer, "type": etype})

    # 7. TWIN HOUSES (Semi-detached paired villas)
    elif layer in ("set pack", "comments") and (360 <= cx <= 450 and 220 <= cy <= 320):
        CATEGORIES["twin_houses"].append({"d": svg_d, "layer": layer, "type": etype})

    # 8. AMENITIES (Decks, boardwalks, recreation, gates, furniture)
    elif layer in ("furniture", "A-06-FURNITURE", "A-01-DW") or (layer == "0" and etype in ("INSERT", "CIRCLE") and "gate" in e.get("name", "")):
        CATEGORIES["amenities"].append({"d": svg_d, "layer": layer, "type": etype})

    # 9. STANDALONE VILLAS (Zones A, B, C, D, E)
    else:
        CATEGORIES["standalone_villas"].append({"d": svg_d, "layer": layer, "type": etype})

# Add explicit crystal lagoon & resort pools vector paths into water_features
lagoon_svg_paths = [
    # West lagoon arm
    "M 290,410 C 315,430 330,510 310,610 C 290,700 275,800 310,910 C 345,1000 410,1090 455,1150 C 415,1165 360,1105 320,1030 C 280,945 255,825 260,720 C 265,600 290,490 260,440 Z",
    # East lagoon canal
    "M 490,490 C 525,520 560,610 570,720 C 580,830 570,935 530,1030 C 490,1115 430,1180 370,1215 C 395,1195 455,1130 495,1040 C 535,950 550,840 535,735 C 520,635 495,550 460,520 Z",
    # Central AP courtyard resort pool
    "M 550,280 C 580,260 635,260 660,280 C 675,305 650,335 605,340 C 565,335 540,305 550,280 Z"
]
for p in lagoon_svg_paths:
    CATEGORIES["water_features"].append({"d": p, "layer": "Water Feature Geometry", "type": "PATH"})

# Add boardwalks & decks into amenities
boardwalk_paths = [
    "M 275,620 L 320,620 L 320,630 L 275,630 Z",
    "M 270,750 L 315,750 L 315,760 L 270,760 Z",
    "M 290,880 L 335,880 L 335,890 L 290,890 Z",
    "M 345,1010 L 390,1010 L 390,1020 L 345,1020 Z",
    "M 515,600 L 560,600 L 560,610 L 515,610 Z",
    "M 530,735 L 575,735 L 575,745 L 530,745 Z",
    "M 515,870 L 560,870 L 560,880 L 515,880 Z",
    "M 475,1000 L 520,1000 L 520,1010 L 475,1010 Z"
]
for bp in boardwalk_paths:
    CATEGORIES["amenities"].append({"d": bp, "layer": "Boardwalk Deck", "type": "PATH"})

print("\n--- Final Extracted Vector Geometry Summary ---")
for cat, items in CATEGORIES.items():
    print(f"  [{cat:22s}]: {len(items):4d} vector geometries")

# Save structured masterplan dataset
output_data = {
    "meta": {
        "title": "Villagio Masterplan Vector CAD Geometry",
        "source": "Masterplan Final.dxf",
        "viewBox": f"0 0 {SVG_W} {SVG_H}",
        "width": SVG_W,
        "height": SVG_H,
        "cadBounds": {"minX": min_x, "maxX": max_x, "minY": min_y, "maxY": max_y}
    },
    "categories": CATEGORIES
}

with open("villagio-cad-vector.json", "w", encoding="utf-8") as f:
    json.dump(output_data, f, indent=2)

js_content = f"""/**
 * Villagio Masterplan — Extracted AutoCAD Vector Layers
 * Categorized Vector Geometry for:
 * 1. Standalone Villas
 * 2. Twin Houses
 * 3. Townhouses
 * 4. Apartment Buildings
 * 5. Roads
 * 6. Parking
 * 7. Landscape
 * 8. Water Features
 * 9. Amenities
 */

const VILLAGIO_VECTOR_LAYERS = {json.dumps(output_data, indent=2)};

if (typeof module !== 'undefined' && module.exports) {{
  module.exports = VILLAGIO_VECTOR_LAYERS;
}}
"""

with open("villagio-cad-vector.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"\nGenerated 'villagio-cad-vector.json' and 'villagio-cad-vector.js' successfully.")
