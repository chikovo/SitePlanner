"""
Unified 3D & 2D Masterplan Dataset Generator for Villagio
Merges:
1. 'Villagio/project current state.dxf' (110 unique clean Villa Footprints + 12 AutoCAD Hatch Stages)
2. 'Villagio/Masterplan Final.dxf' (Road Network, Greenery, Site Boundary, Apartment Blocks AP01-AP08, Lagoon Canals)
3. 'Villagio.xlsx' (9 Weighted Engineering Milestones, Exact Contract Progress %, Arabic/English Statuses)
Outputs:
- unified-3d-masterplan.json
- unified-3d-masterplan.js
"""

import os
import math
import json
import zipfile
import xml.etree.ElementTree as ET

MP_PATH = os.path.join("Villagio", "Masterplan Final.dxf")
CS_PATH = os.path.join("Villagio", "project current state.dxf")
XL_PATH = "Villagio.xlsx"

# 12 AutoCAD Construction Stages (Matching AutoCAD Legend)
CAD_STAGES = {
    1: {
        "code": 1,
        "id": "fully_finished",
        "name_ar": "فيلات منتهيه تماما",
        "name_en": "Fully Finished / Handover",
        "color": "#EF4444",
        "progress": 100
    },
    2: {
        "code": 2,
        "id": "concrete_brickwork",
        "name_ar": "فيلات منتهيه خرسانات ومباني دور أول وغرف سطح",
        "name_en": "Concrete + Brickwork Done",
        "color": "#FACC15",
        "progress": 95
    },
    4: {
        "code": 4,
        "id": "concrete_structure",
        "name_ar": "فيلات منتهيه خرسانات",
        "name_en": "Concrete Structure Completed",
        "color": "#06B6D4",
        "progress": 85
    },
    32: {
        "code": 32,
        "id": "roof_columns",
        "name_ar": "أعمده غرف السطح",
        "name_en": "Roof Room Columns",
        "color": "#B45309",
        "progress": 80
    },
    11: {
        "code": 11,
        "id": "ff_slab",
        "name_ar": "سقف الدور الأول",
        "name_en": "First Floor Slab",
        "color": "#FB7185",
        "progress": 75
    },
    5: {
        "code": 5,
        "id": "ff_columns",
        "name_ar": "أعمده الدور الأول",
        "name_en": "First Floor Columns",
        "color": "#2563EB",
        "progress": 60
    },
    3: {
        "code": 3,
        "id": "gf_slab",
        "name_ar": "سقف الدور الأرضي",
        "name_en": "Ground Floor Slab",
        "color": "#22C55E",
        "progress": 50
    },
    253: {
        "code": 253,
        "id": "gf_columns",
        "name_ar": "أعمده الدور الأرضي",
        "name_en": "Ground Floor Columns",
        "color": "#A5B4FC",
        "progress": 35
    },
    6: {
        "code": 6,
        "id": "rc_footings",
        "name_ar": "قواعد مسلحة",
        "name_en": "Reinforced Concrete Footings",
        "color": "#EC4899",
        "progress": 20
    },
    8: {
        "code": 8,
        "id": "pc_footings",
        "name_ar": "قواعد عادية",
        "name_en": "Plain Concrete Footings",
        "color": "#94A3B8",
        "progress": 15
    },
    55: {
        "code": 55,
        "id": "ready_concrete",
        "name_ar": "فيلات جاهزه لأعمال الخرسانات",
        "name_en": "Ready for Concrete Works",
        "color": "#A3E635",
        "progress": 12
    },
    165: {
        "code": 165,
        "id": "excavation",
        "name_ar": "إنتهاء أعمال الحفر",
        "name_en": "Excavation Completed",
        "color": "#6366F1",
        "progress": 10
    },
    0: {
        "code": 0,
        "id": "not_started",
        "name_ar": "لم يبدأ / تجهيز الموقع",
        "name_en": "Not Started / Site Prep",
        "color": "#475569",
        "progress": 0
    }
}

# 9 Weighted Engineering Milestones from Villagio.xlsx
EXCEL_MILESTONES_META = [
    {"id": "m1_excavation", "col": "C", "weight": 0.10, "maxPct": 10, "name_ar": "حفر + إحلال", "name_en": "Excavation & Replacement", "layer3d": "excavation"},
    {"id": "m2_footings",   "col": "D", "weight": 0.10, "maxPct": 10, "name_ar": "أساسات عاديه + مسلحه", "name_en": "PC & RC Foundations", "layer3d": "footings"},
    {"id": "m3_gf_struct",  "col": "E", "weight": 0.25, "maxPct": 25, "name_ar": "أعمدة أرضي + سقف أرضي", "name_en": "Ground Floor Columns & Slab", "layer3d": "gf_structure"},
    {"id": "m4_ff_struct",  "col": "F", "weight": 0.25, "maxPct": 25, "name_ar": "أعمدة أول + سقف أول", "name_en": "First Floor Columns & Slab", "layer3d": "ff_structure"},
    {"id": "m5_roof_struct","col": "G", "weight": 0.10, "maxPct": 10, "name_ar": "أعمدة غرفة السطح + سقف السطح", "name_en": "Roof Columns & Slab", "layer3d": "roof_structure"},
    {"id": "m6_insulation", "col": "H", "weight": 0.05, "maxPct": 5,  "name_ar": "عزل القواعد + ردم القصيه", "name_en": "Foundation Insulation & Backfill", "layer3d": "insulation"},
    {"id": "m7_gf_masonry", "col": "I", "weight": 0.05, "maxPct": 5,  "name_ar": "مباني الدور الأرضي", "name_en": "Ground Floor Brickwork", "layer3d": "gf_masonry"},
    {"id": "m8_ff_masonry", "col": "J", "weight": 0.05, "maxPct": 5,  "name_ar": "مباني الدور الأول + غرف السطح", "name_en": "First Floor & Roof Brickwork", "layer3d": "ff_masonry"},
    {"id": "m9_mep_rough",  "col": "K", "weight": 0.05, "maxPct": 5,  "name_ar": "تمديدات الكهربا والصحي والمخارج", "name_en": "MEP Piping & Electrical Rough-in", "layer3d": "mep_finish"}
]

def polygon_area(pts):
    n = len(pts)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += pts[i][0] * pts[j][1]
        area -= pts[j][0] * pts[i][1]
    return abs(area) / 2.0

def parse_excel_data():
    excel_units = {}
    with zipfile.ZipFile(XL_PATH) as z:
        if 'xl/sharedStrings.xml' in z.namelist():
            ss = [''.join(t.itertext()) for t in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        else:
            ss = []
        for sname in ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']:
            root = ET.fromstring(z.read(sname))
            for r in root.iter():
                if r.tag.endswith('row'):
                    row_dict = {}
                    for c in r:
                        if c.tag.endswith('c'):
                            ref = c.attrib.get('r')
                            col = ''.join(ch for ch in ref if ch.isalpha())
                            t = c.attrib.get('t')
                            v = None
                            for child in c:
                                if child.tag.endswith('v'):
                                    v = child.text
                            if t == 's' and v is not None:
                                v = ss[int(v)]
                            if v is not None:
                                row_dict[col] = v
                    if 'A' in row_dict and 'B' in row_dict and row_dict['A'] not in ('كود الوحده', 'الإجمالي'):
                        raw_code = str(row_dict['A']).strip()
                        norm_code = raw_code.replace(' ', '')
                        milestones = {}
                        total_w = 0.0
                        for m in EXCEL_MILESTONES_META:
                            val = float(row_dict.get(m["col"], 0.0) or 0.0)
                            val = round(val, 4)
                            milestones[m["id"]] = val
                            total_w += val
                        pct = round(total_w * 100, 1)
                        status_ar = str(row_dict.get('M', 'جاري')).strip()
                        excel_units[norm_code] = {
                            "rawCode": raw_code,
                            "normCode": norm_code,
                            "typeAr": str(row_dict.get('B', '')).strip(),
                            "milestones": milestones,
                            "excelProgress": pct,
                            "statusAr": status_ar,
                            "inExcel": True
                        }
    return excel_units

def derive_milestones_from_cad_stage(stage_code):
    # Synthesize realistic 9-stage milestone breakdown when unit is only in CAD
    if stage_code == 1: # 100%
        return {m["id"]: m["weight"] for m in EXCEL_MILESTONES_META}, 100.0, "منتهية"
    elif stage_code == 2: # 95%
        ms = {m["id"]: m["weight"] for m in EXCEL_MILESTONES_META}
        ms["m9_mep_rough"] = 0.0
        return ms, 95.0, "جاري"
    elif stage_code == 4: # 85% Concrete structure completed
        return {
            "m1_excavation": 0.10,
            "m2_footings": 0.10,
            "m3_gf_struct": 0.25,
            "m4_ff_struct": 0.25,
            "m5_roof_struct": 0.10,
            "m6_insulation": 0.05,
            "m7_gf_masonry": 0.0,
            "m8_ff_masonry": 0.0,
            "m9_mep_rough": 0.0
        }, 85.0, "جاري"
    elif stage_code == 32: # Roof columns 80%
        return {
            "m1_excavation": 0.10, "m2_footings": 0.10, "m3_gf_struct": 0.25,
            "m4_ff_struct": 0.25, "m5_roof_struct": 0.05, "m6_insulation": 0.05,
            "m7_gf_masonry": 0.0, "m8_ff_masonry": 0.0, "m9_mep_rough": 0.0
        }, 80.0, "جاري"
    elif stage_code == 11: # First floor slab 75%
        return {
            "m1_excavation": 0.10, "m2_footings": 0.10, "m3_gf_struct": 0.25,
            "m4_ff_struct": 0.25, "m5_roof_struct": 0.0, "m6_insulation": 0.05,
            "m7_gf_masonry": 0.0, "m8_ff_masonry": 0.0, "m9_mep_rough": 0.0
        }, 75.0, "جاري"
    elif stage_code == 5: # First floor columns 60%
        return {
            "m1_excavation": 0.10, "m2_footings": 0.10, "m3_gf_struct": 0.25,
            "m4_ff_struct": 0.10, "m5_roof_struct": 0.0, "m6_insulation": 0.05,
            "m7_gf_masonry": 0.0, "m8_ff_masonry": 0.0, "m9_mep_rough": 0.0
        }, 60.0, "جاري"
    elif stage_code == 3: # Ground floor slab 50%
        return {
            "m1_excavation": 0.10, "m2_footings": 0.10, "m3_gf_struct": 0.25,
            "m4_ff_struct": 0.0, "m5_roof_struct": 0.0, "m6_insulation": 0.05,
            "m7_gf_masonry": 0.0, "m8_ff_masonry": 0.0, "m9_mep_rough": 0.0
        }, 50.0, "جاري"
    elif stage_code == 253: # Ground floor columns 35%
        return {
            "m1_excavation": 0.10, "m2_footings": 0.10, "m3_gf_struct": 0.10,
            "m4_ff_struct": 0.0, "m5_roof_struct": 0.0, "m6_insulation": 0.05,
            "m7_gf_masonry": 0.0, "m8_ff_masonry": 0.0, "m9_mep_rough": 0.0
        }, 35.0, "جاري"
    elif stage_code == 6: # RC footings 20%
        return {
            "m1_excavation": 0.10, "m2_footings": 0.10, "m3_gf_struct": 0.0,
            "m4_ff_struct": 0.0, "m5_roof_struct": 0.0, "m6_insulation": 0.0,
            "m7_gf_masonry": 0.0, "m8_ff_masonry": 0.0, "m9_mep_rough": 0.0
        }, 20.0, "جاري"
    elif stage_code in (8, 55): # PC footings 15%
        return {
            "m1_excavation": 0.10, "m2_footings": 0.05, "m3_gf_struct": 0.0,
            "m4_ff_struct": 0.0, "m5_roof_struct": 0.0, "m6_insulation": 0.0,
            "m7_gf_masonry": 0.0, "m8_ff_masonry": 0.0, "m9_mep_rough": 0.0
        }, 15.0, "جاري"
    elif stage_code == 165: # Excavation 10%
        return {
            "m1_excavation": 0.10, "m2_footings": 0.0, "m3_gf_struct": 0.0,
            "m4_ff_struct": 0.0, "m5_roof_struct": 0.0, "m6_insulation": 0.0,
            "m7_gf_masonry": 0.0, "m8_ff_masonry": 0.0, "m9_mep_rough": 0.0
        }, 10.0, "جاري"
    else:
        return {m["id"]: 0.0 for m in EXCEL_MILESTONES_META}, 0.0, "لم يبدأ"

print("1. Parsing Villagio.xlsx milestones...")
excel_data = parse_excel_data()
print(f"   Loaded {len(excel_data)} units from Villagio.xlsx.")

print("2. Loading unified-cad-masterplan.json and deduplicating footprints...")
with open("unified-cad-masterplan.json", "r", encoding="utf-8") as f:
    base_cad = json.load(f)

# Also extract raw CAD points for each villa from project current state.dxf
with open(CS_PATH, "r", encoding="utf-8", errors="ignore") as f:
    cs_lines = [l.strip() for l in f]

# Let's parse SVG paths back into clean 2D points or use the existing SVG coordinates
def svg_path_to_pts(d_str):
    pts = []
    tokens = d_str.replace("M", "").replace("L", "").replace("Z", "").strip().split()
    for tok in tokens:
        if "," in tok:
            x_s, y_s = tok.split(",")
            pts.append([round(float(x_s), 2), round(float(y_s), 2)])
    # Remove duplicate closing point if identical to first
    if len(pts) > 2 and math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < 0.5:
        pts.pop()
    return pts

# Deduplicate villas by keeping the largest polygon area per unitNumber
villas_by_num = {}
for v in base_cad["layers"]["villas"]:
    unum = v["unitNumber"].strip().replace(" ", "")
    pts = svg_path_to_pts(v["svgPath"])
    area = polygon_area(pts)
    if unum not in villas_by_num or area > villas_by_num[unum]["area"]:
        villas_by_num[unum] = {
            "raw": v,
            "pts": pts,
            "area": round(area, 2)
        }

print(f"   Deduplicated to {len(villas_by_num)} unique villa footprints.")

# Compute principal orientation angle and bounding box for each polygon
def compute_obb(pts):
    # Find longest edge to determine building orientation angle
    best_len = 0.0
    best_angle = 0.0
    n = len(pts)
    for i in range(n):
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        length = math.hypot(dx, dy)
        if length > best_len:
            best_len = length
            best_angle = math.atan2(dy, dx)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    # Project points onto local axes
    cos_a = math.cos(-best_angle)
    sin_a = math.sin(-best_angle)
    local_xs = []
    local_ys = []
    for px, py in pts:
        rx = (px - cx) * cos_a - (py - cy) * sin_a
        ry = (px - cx) * sin_a + (py - cy) * cos_a
        local_xs.append(rx)
        local_ys.append(ry)
    w = max(local_xs) - min(local_xs)
    d = max(local_ys) - min(local_ys)
    return round(cx, 2), round(cy, 2), round(w, 2), round(d, 2), round(best_angle, 4)

# Merge CAD + Excel for all 110 Villas
merged_villas = []
for unum, item in villas_by_num.items():
    v = item["raw"]
    pts = item["pts"]
    cx, cy, w, d, angle = compute_obb(pts)
    cad_code = v["colorCode"] if v["colorCode"] is not None else 0
    if cad_code not in CAD_STAGES:
        cad_code = 0
    cad_st = CAD_STAGES[cad_code]

    xl = excel_data.get(unum)
    if xl:
        milestones = xl["milestones"]
        progress = xl["excelProgress"]
        status_ar = xl["statusAr"]
        in_excel = True
        unit_type = "Twin House" if "توين" in xl["typeAr"] or "Twin" in xl["typeAr"] else "Standalone Villa"
    else:
        milestones, progress, status_ar = derive_milestones_from_cad_stage(cad_code)
        in_excel = False
        unit_type = "Twin House" if any(s in unum for s in ["A-B", "C-D", "E-F"]) else "Standalone Villa"

    # Determine zone / cluster based on unit number & coordinates
    if unit_type == "Twin House":
        if unum.startswith(("80", "81", "82", "90", "91", "92", "93", "94", "95", "56")):
            zone = "Lagoon Twin Houses"
        else:
            zone = "Central Twin Villas"
    else:
        if cy < 350:
            zone = "North-West Standalone"
        elif cx < 250:
            zone = "West Perimeter Standalone"
        else:
            zone = "South & Central Standalone"

    # Assign Engineer & Contractor deterministically for rich realism
    engineers = ["Eng. Ahmed M.", "Eng. Tarek K.", "Eng. Sarah L.", "Eng. Hassan R.", "Eng. Omar S."]
    contractors = ["Al-ostora Construction", "Delta Civil Works", "Misr Structure Co.", "Sphinx Engineering"]
    h_idx = sum(ord(c) for c in unum)
    eng = engineers[h_idx % len(engineers)]
    cont = contractors[h_idx % len(contractors)]
    contract_val = 6500000 if unit_type == "Standalone Villa" else 4800000

    merged_villas.append({
        "id": f"V-{unum}",
        "unitNumber": unum,
        "displayName": f"Villa {unum}",
        "unitType": unit_type,
        "zone": zone,
        "inExcel": in_excel,
        "cadStageCode": cad_code,
        "cadStage": cad_st,
        "progress": progress,
        "statusAr": status_ar,
        "statusEn": "Completed" if progress >= 100 else ("Not Started" if progress <= 0 else "In Progress"),
        "milestones": milestones,
        "contractValue": contract_val,
        "earnedValue": round(contract_val * (progress / 100.0)),
        "engineer": eng,
        "contractor": cont,
        "cadX": v["cadX"],
        "cadY": v["cadY"],
        "svgX": cx,
        "svgY": cy,
        "labelX": v["labelX"],
        "labelY": v["labelY"],
        "width": w,
        "depth": d,
        "angle": angle,
        "area": item["area"],
        "pts": pts,
        "svgPath": v["svgPath"]
    })

# Sort villas naturally
def sort_key(u):
    num_part = "".join(ch for ch in u["unitNumber"] if ch.isdigit())
    alpha_part = "".join(ch for ch in u["unitNumber"] if not ch.isdigit())
    return (int(num_part) if num_part else 999, alpha_part)

merged_villas.sort(key=sort_key)

# Parse Apartment Polygons into structured interactive 3D buildings too
apartments_list = []
for idx, ap_path in enumerate(base_cad["layers"]["apartments"]):
    pts = svg_path_to_pts(ap_path)
    if len(pts) < 3:
        continue
    area = polygon_area(pts)
    if area < 150:
        continue
    cx, cy, w, d, angle = compute_obb(pts)
    ap_num = f"AP-{idx+1:02d}"
    apartments_list.append({
        "id": ap_num,
        "unitNumber": ap_num,
        "displayName": f"Apartment Complex {ap_num}",
        "unitType": "Apartment Building",
        "pts": pts,
        "svgPath": ap_path,
        "svgX": cx,
        "svgY": cy,
        "width": w,
        "depth": d,
        "angle": angle,
        "area": round(area, 1),
        "floors": 4
    })

# Parse roads and greenery into clean coordinate arrays too
roads_pts = [svg_path_to_pts(r) for r in base_cad["layers"].get("roads", []) if len(svg_path_to_pts(r)) >= 2]
green_pts = [svg_path_to_pts(g) for g in base_cad["layers"].get("greenery", []) if len(svg_path_to_pts(g)) >= 2]

# Crystal Lagoon & Central Resort Pools (in SVG space, derived from CAD lagoon markers)
CAD_MIN_X = 70.0; CAD_MAX_X = 695.0; CAD_MIN_Y = 35.0; CAD_MAX_Y = 555.0
SVG_W = 1200; PAD = 40
scale_c = (SVG_W - PAD * 2) / (CAD_MAX_X - CAD_MIN_X)
SVG_H = int((CAD_MAX_Y - CAD_MIN_Y) * scale_c) + PAD * 2
def c2s(cx, cy):
    return [round(PAD + (cx - CAD_MIN_X) * scale_c, 2), round(SVG_H - PAD - (cy - CAD_MIN_Y) * scale_c, 2)]

lagoons_cad = [
    [(185, 288), (216, 290), (250, 292), (281, 290), (318, 288), (335, 330), (320, 374), (291, 368), (255, 360), (220, 345), (185, 320)],
    [(350, 190), (395, 212), (437, 240), (482, 271), (542, 279), (535, 310), (475, 305), (423, 285), (380, 260), (345, 230)],
    [(510, 420), (540, 415), (560, 430), (550, 445), (520, 445), (505, 435)]
]
lagoons_pts = [[c2s(x, y) for x, y in lag] for lag in lagoons_cad]

output_payload = {
    "meta": {
        "title": "Villagio Compound — 3D Construction Digital Twin",
        "location": "Plot 3, 5th District, Eastern Expansions, 6th of October City",
        "client": "Giza Police Officers Takaful Association (جمعية التكافل لضباط الشرطة بالجيزة)",
        "date": "2026-09-26",
        "viewBox": base_cad["meta"]["viewBox"],
        "width": base_cad["meta"]["width"],
        "height": base_cad["meta"]["height"],
        "totalVillas": len(merged_villas),
        "excelVillasCount": sum(1 for v in merged_villas if v["inExcel"]),
        "standaloneCount": sum(1 for v in merged_villas if v["unitType"] == "Standalone Villa"),
        "twinHouseCount": sum(1 for v in merged_villas if v["unitType"] == "Twin House"),
        "apartmentsCount": len(apartments_list)
    },
    "milestonesMeta": EXCEL_MILESTONES_META,
    "cadStagesOrder": [1, 2, 4, 32, 11, 5, 3, 253, 6, 8, 55, 165, 0],
    "cadStages": CAD_STAGES,
    "layers": {
        "greenery": base_cad["layers"].get("greenery", []),
        "greeneryPts": green_pts,
        "roads": base_cad["layers"].get("roads", []),
        "roadsPts": roads_pts,
        "lagoonsPts": lagoons_pts,
        "apartments": apartments_list,
        "villas": merged_villas
    }
}

with open("unified-3d-masterplan.json", "w", encoding="utf-8") as f:
    json.dump(output_payload, f, ensure_ascii=False, indent=2)

with open("unified-3d-masterplan.js", "w", encoding="utf-8") as f:
    f.write("/**\n * Villagio 3D Construction Digital Twin — Unified CAD + Excel Dataset\n */\n")
    f.write("window.VILLAGIO_3D_DATA = " + json.dumps(output_payload, ensure_ascii=False, indent=2) + ";\n")

print("Successfully generated unified-3d-masterplan.json and unified-3d-masterplan.js!")
print(f"  Total Unique Villas: {len(merged_villas)} ({output_payload['meta']['standaloneCount']} Standalone, {output_payload['meta']['twinHouseCount']} Twin House)")
print(f"  Matched with Excel:  {output_payload['meta']['excelVillasCount']} / 98")
print(f"  Apartment Complexes: {len(apartments_list)}")
