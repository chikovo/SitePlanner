"""
Complete DXF Parser and Vector Geometry Generator for Villagio Masterplan.
Extracts geometry from 'Villagio/Masterplan Final.dxf' into high-precision vector features:
- standalone villas
- twin houses
- townhouses
- apartment buildings
- roads
- parking
- landscape
- water features
- amenities
Excludes: LVL2 / ELV2 and pathway levels.
"""

import os
import math
import json

DXF_PATH = os.path.join("Villagio", "Masterplan Final.dxf")

def parse_dxf(file_path):
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = [line.strip() for line in f]

    entities = []
    blocks = {}
    i = 0
    in_section = None
    cur_block_name = None
    cur_block_ents = []

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

        if in_section == "BLOCKS":
            if code == "0" and val == "BLOCK":
                cur_block_name = None
                cur_block_ents = []
                # read block header
                j = i + 2
                while j < len(lines):
                    if lines[j] == "2" and cur_block_name is None:
                        cur_block_name = lines[j + 1]
                    elif lines[j] == "0":
                        break
                    j += 2
                i = j
                continue
            elif code == "0" and val == "ENDBLK":
                if cur_block_name:
                    blocks[cur_block_name] = cur_block_ents
                cur_block_name = None
                cur_block_ents = []
                i += 2
                continue
            elif cur_block_name is not None:
                # Read entity inside block
                ent_type = val
                ent_data = {"type": ent_type, "layer": "0"}
                j = i + 2
                pts = []
                while j < len(lines):
                    c = lines[j]
                    v = lines[j + 1] if j + 1 < len(lines) else ""
                    if c == "0":
                        break
                    elif c == "8":
                        ent_data["layer"] = v
                    elif c == "10":
                        try:
                            x = float(v)
                            y = float(lines[j + 3]) if j + 3 < len(lines) and lines[j + 2] == "20" else 0.0
                            pts.append((x, y))
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
                if pts:
                    ent_data["pts"] = pts
                    ent_data["x1"] = pts[0][0]
                    ent_data["y1"] = pts[0][1]
                cur_block_ents.append(ent_data)
                i = j
                continue

        elif in_section == "ENTITIES":
            ent_type = val
            ent_data = {"type": ent_type, "layer": "0"}
            j = i + 2
            pts = []
            bulges = []
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
                    except: pass
                elif c == "42": # Polyline vertex bulge
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

    return entities, blocks

print("Parsing DXF file...")
entities, blocks = parse_dxf(DXF_PATH)
print(f"Parsed {len(entities)} entities and {len(blocks)} block definitions.")

# Filter out ignored layers: LVL2, ELV2, pathway levels
IGNORED_LAYERS = {"LVL2", "ELV2", "pathway levels", "pathway level"}
valid_entities = [e for e in entities if e.get("layer") not in IGNORED_LAYERS]
print(f"Valid entities after excluding level layers: {len(valid_entities)}")

# Group entities by category
# Categories:
# 1. standalone villas & twin houses & townhouses: set pack, comments, sec line, .
# 2. apartment buildings: set pack, ASPHALT, comments (AP01-AP08)
# 3. roads: ASPHALT, OUTLINE ASPHALT, City_road, CL, City_Axies
# 4. parking: PAVEMENT, ASPHALT parking slots
# 5. landscape: city_green, Land line, PAVEMENT greenery, SITE
# 6. water features: Water Surface Level, lagoon
# 7. amenities: furniture, A-06-FURNITURE, courtyard pools, sports/recreation courts

# Let's write helper functions to convert DXF entities to SVG paths
def arc_to_path(cx, cy, r, a1_deg, a2_deg):
    a1_rad = math.radians(a1_deg)
    a2_rad = math.radians(a2_deg)
    x1 = cx + r * math.cos(a1_rad)
    y1 = cy + r * math.sin(a1_rad)
    x2 = cx + r * math.cos(a2_rad)
    y2 = cy + r * math.sin(a2_rad)
    
    # SVG sweep and large-arc
    diff = (a2_deg - a1_deg) % 360
    large_arc = 1 if diff > 180 else 0
    sweep = 1 # counterclockwise in CAD (which becomes clockwise when inverted Y)
    return f"M {x1:.2f},{y1:.2f} A {r:.2f} {r:.2f} 0 {large_arc} {sweep} {x2:.2f},{y2:.2f}"

# Collect all layer categories
layers_summary = {}
for e in valid_entities:
    l = e.get("layer", "0")
    t = e.get("type", "UNKNOWN")
    if l not in layers_summary:
        layers_summary[l] = {}
    layers_summary[l][t] = layers_summary[l].get(t, 0) + 1

for l, ts in sorted(layers_summary.items()):
    print(f"Layer {l:25s}: {ts}")
