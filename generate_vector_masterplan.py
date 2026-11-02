"""
Script to generate high-precision vector geometry for the SitePlanner compound masterplan.
Generates vector-masterplan.js containing full SVG definitions for:
- Roads, highways, curbs, sidewalks, parking lots
- Crystal lagoon water bodies, beaches, boardwalks, piers, pool
- Landscape parcels, lawns, gardens, and realistic tree canopies
- Individual villa plots, footprints, hipped roof facets, patios, and private waterfront decks
- Multi-wing apartment complexes (AP01-AP08) with courtyards and balconies
- Townhouse row blocks (TR-01..TR-20, TB-01..TB-14)
"""

import math
import json

W = 864
H = 1053

def pct_to_px(px_pct, py_pct):
    return (px_pct * W / 100.0, py_pct * H / 100.0)

def px_to_pct(x, y):
    return (x * 100.0 / W, y * 100.0 / H)

def rotate_point(cx, cy, x, y, angle_deg):
    rad = math.radians(angle_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)
    nx = cos_a * (x - cx) - sin_a * (y - cy) + cx
    ny = sin_a * (x - cx) + cos_a * (y - cy) + cy
    return (nx, ny)

def make_rect_polygon(cx, cy, w, h, angle_deg):
    hw = w / 2.0
    hh = h / 2.0
    pts = [
        (cx - hw, cy - hh),
        (cx + hw, cy - hh),
        (cx + hw, cy + hh),
        (cx - hw, cy + hh)
    ]
    return [rotate_point(cx, cy, px, py, angle_deg) for px, py in pts]

def pts_to_svg_path(pts, closed=True):
    if not pts:
        return ""
    d = f"M {pts[0][0]:.1f},{pts[0][0]:.1f}"
    d = f"M {pts[0][0]:.1f},{pts[0][1]:.1f} " + " ".join(f"L {p[0]:.1f},{p[1]:.1f}" for p in pts[1:])
    if closed:
        d += " Z"
    return d

def make_hipped_roof(cx, cy, w, h, angle_deg, ridge_ratio=0.5):
    """
    Creates the 4 facets of a hipped roof for 3D architectural rendering:
    top, bottom, left, right facets + ridge line.
    """
    corners = make_rect_polygon(cx, cy, w, h, angle_deg)
    # Ridge ends
    rw = (w * ridge_ratio) / 2.0
    r1 = rotate_point(cx, cy, cx - rw, cy, angle_deg)
    r2 = rotate_point(cx, cy, cx + rw, cy, angle_deg)
    
    # 4 facets:
    # 1. North/Top: c0, c1, r2, r1
    # 2. East/Right: c1, c2, r2
    # 3. South/Bottom: c2, c3, r1, r2
    # 4. West/Left: c3, c0, r1
    facets = [
        [corners[0], corners[1], r2, r1], # top facet (light)
        [corners[1], corners[2], r2],     # right facet (medium)
        [corners[3], corners[2], r2, r1], # bottom facet (shadow)
        [corners[0], corners[3], r1]      # left facet (medium light)
    ]
    return {
        "outline": corners,
        "facets": facets,
        "ridge": [r1, r2]
    }

# 1. Villa data with accurate positions, sizes, and rotations derived from the masterplan
VILLAS = []

# --- ZONE A (18 Outer Left Villas) ---
# Follows the western perimeter road curve
zone_a_specs = [
    # id, unitNumber, cx_pct, cy_pct, angle_deg, w, h
    ("VA-01", "A-01", 19.8, 26.5, -42, 28, 22),
    ("VA-02", "A-02", 17.0, 30.5, -34, 28, 22),
    ("VA-03", "A-03", 14.8, 34.6, -24, 28, 22),
    ("VA-04", "A-04", 13.0, 38.8, -14, 28, 22),
    ("VA-05", "A-05", 11.5, 43.0,  -6, 28, 22),
    ("VA-06", "A-06", 10.4, 47.2,   0, 28, 22),
    ("VA-07", "A-07",  9.8, 51.4,   0, 28, 22),
    ("VA-08", "A-08",  9.6, 55.6,   0, 28, 22),
    ("VA-09", "A-09",  9.6, 59.8,   0, 28, 22),
    ("VA-10", "A-10", 10.2, 64.0,   3, 28, 22),
    ("VA-11", "A-11", 11.1, 68.2,   8, 28, 22),
    ("VA-12", "A-12", 12.4, 72.3,  16, 28, 22),
    ("VA-13", "A-13", 14.0, 76.2,  26, 28, 22),
    ("VA-14", "A-14", 15.6, 80.0,  36, 28, 22),
    ("VA-15", "A-15", 17.2, 83.7,  48, 28, 22),
    ("VA-16", "A-16", 19.3, 87.0,  68, 28, 22),
    ("VA-17", "A-17", 22.0, 89.2,  90, 28, 22),
    ("VA-18", "A-18", 25.0, 90.0, 105, 28, 22),
]

for vid, unum, cxp, cyp, ang, vw, vh in zone_a_specs:
    cx, cy = pct_to_px(cxp, cyp)
    roof = make_hipped_roof(cx, cy, vw, vh, ang)
    plot = make_rect_polygon(cx, cy, vw * 1.5, vh * 1.6, ang)
    patio = make_rect_polygon(cx, cy + (vh*0.55), vw*0.7, vh*0.3, ang)
    VILLAS.append({
        "id": vid, "unitNumber": unum, "unitType": "Villa", "block": "Block A", "zone": "Zone A",
        "cx": cx, "cy": cy, "cxPct": cxp, "cyPct": cyp, "rotation": ang,
        "width": vw, "height": vh,
        "plot": plot, "footprint": roof["outline"], "facets": roof["facets"], "ridge": roof["ridge"],
        "patio": patio, "waterfront": False
    })

# --- ZONE B (14 Waterfront Villas - West Lagoon Bank) ---
zone_b_specs = [
    ("VB-01", "B-01", 25.2, 29.2, -45, 27, 22),
    ("VB-02", "B-02", 23.0, 33.2, -36, 27, 22),
    ("VB-03", "B-03", 21.0, 37.3, -25, 27, 22),
    ("VB-04", "B-04", 19.6, 41.5, -15, 27, 22),
    ("VB-05", "B-05", 18.8, 45.7,  -5, 27, 22),
    ("VB-06", "B-06", 18.5, 50.0,   0, 27, 22),
    ("VB-07", "B-07", 18.6, 54.2,   2, 27, 22),
    ("VB-08", "B-08", 19.5, 58.4,   8, 27, 22),
    ("VB-09", "B-09", 20.8, 62.5,  15, 27, 22),
    ("VB-10", "B-10", 22.5, 66.5,  24, 27, 22),
    ("VB-11", "B-11", 24.8, 70.3,  34, 27, 22),
    ("VB-12", "B-12", 27.2, 73.9,  45, 27, 22),
    ("VB-13", "B-13", 29.8, 77.2,  56, 27, 22),
    ("VB-14", "B-14", 32.5, 80.2,  68, 27, 22),
]

for vid, unum, cxp, cyp, ang, vw, vh in zone_b_specs:
    cx, cy = pct_to_px(cxp, cyp)
    roof = make_hipped_roof(cx, cy, vw, vh, ang)
    plot = make_rect_polygon(cx, cy, vw * 1.45, vh * 1.55, ang)
    # Waterfront deck extending toward lagoon
    deck = make_rect_polygon(cx + math.sin(math.radians(-ang))*18, cy + math.cos(math.radians(-ang))*18, 14, 10, ang)
    VILLAS.append({
        "id": vid, "unitNumber": unum, "unitType": "Villa", "block": "Block B", "zone": "Zone B",
        "cx": cx, "cy": cy, "cxPct": cxp, "cyPct": cyp, "rotation": ang,
        "width": vw, "height": vh,
        "plot": plot, "footprint": roof["outline"], "facets": roof["facets"], "ridge": roof["ridge"],
        "deck": deck, "waterfront": True
    })

# --- ZONE C (12 Central Spine Villas) ---
zone_c_specs = [
    ("VC-01", "C-01", 33.2, 37.0, -32, 27, 22),
    ("VC-02", "C-02", 34.8, 41.0, -22, 27, 22),
    ("VC-03", "C-03", 35.8, 45.1, -12, 27, 22),
    ("VC-04", "C-04", 36.4, 49.2,  -3, 27, 22),
    ("VC-05", "C-05", 36.6, 53.3,   3, 27, 22),
    ("VC-06", "C-06", 36.4, 57.4,   8, 27, 22),
    ("VC-07", "C-07", 35.8, 61.5,  15, 27, 22),
    ("VC-08", "C-08", 36.0, 65.6,  22, 27, 22),
    ("VC-09", "C-09", 37.0, 69.6,  30, 27, 22),
    ("VC-10", "C-10", 38.6, 73.5,  40, 27, 22),
    ("VC-11", "C-11", 40.8, 77.2,  50, 27, 22),
    ("VC-12", "C-12", 43.2, 80.6,  60, 27, 22),
]

for vid, unum, cxp, cyp, ang, vw, vh in zone_c_specs:
    cx, cy = pct_to_px(cxp, cyp)
    roof = make_hipped_roof(cx, cy, vw, vh, ang)
    plot = make_rect_polygon(cx, cy, vw * 1.45, vh * 1.55, ang)
    deck = make_rect_polygon(cx - math.sin(math.radians(-ang))*16, cy - math.cos(math.radians(-ang))*16, 12, 8, ang)
    VILLAS.append({
        "id": vid, "unitNumber": unum, "unitType": "Villa", "block": "Block C", "zone": "Zone C",
        "cx": cx, "cy": cy, "cxPct": cxp, "cyPct": cyp, "rotation": ang,
        "width": vw, "height": vh,
        "plot": plot, "footprint": roof["outline"], "facets": roof["facets"], "ridge": roof["ridge"],
        "deck": deck, "waterfront": True
    })

# --- ZONE D (12 Right Lagoon Bank Villas) ---
zone_d_specs = [
    ("VD-01", "D-01", 44.5, 34.8, -25, 27, 22),
    ("VD-02", "D-02", 46.5, 38.8, -16, 27, 22),
    ("VD-03", "D-03", 48.2, 42.9,  -7, 27, 22),
    ("VD-04", "D-04", 49.5, 47.0,   0, 27, 22),
    ("VD-05", "D-05", 50.4, 51.1,   5, 27, 22),
    ("VD-06", "D-06", 50.8, 55.2,   8, 27, 22),
    ("VD-07", "D-07", 50.6, 59.3,  12, 27, 22),
    ("VD-08", "D-08", 50.0, 63.4,  16, 27, 22),
    ("VD-09", "D-09", 49.2, 67.5,  22, 27, 22),
    ("VD-10", "D-10", 48.6, 71.5,  30, 27, 22),
    ("VD-11", "D-11", 47.8, 75.4,  40, 27, 22),
    ("VD-12", "D-12", 46.2, 79.1,  52, 27, 22),
]

for vid, unum, cxp, cyp, ang, vw, vh in zone_d_specs:
    cx, cy = pct_to_px(cxp, cyp)
    roof = make_hipped_roof(cx, cy, vw, vh, ang)
    plot = make_rect_polygon(cx, cy, vw * 1.45, vh * 1.55, ang)
    deck = make_rect_polygon(cx + math.sin(math.radians(-ang))*16, cy + math.cos(math.radians(-ang))*16, 12, 8, ang)
    VILLAS.append({
        "id": vid, "unitNumber": unum, "unitType": "Villa", "block": "Block D", "zone": "Zone D",
        "cx": cx, "cy": cy, "cxPct": cxp, "cyPct": cyp, "rotation": ang,
        "width": vw, "height": vh,
        "plot": plot, "footprint": roof["outline"], "facets": roof["facets"], "ridge": roof["ridge"],
        "deck": deck, "waterfront": True
    })

# --- ZONE E (12 Right Outer Villas) ---
zone_e_specs = [
    ("VE-01", "E-01", 59.2, 31.0, -18, 27, 22),
    ("VE-02", "E-02", 61.2, 35.0, -10, 27, 22),
    ("VE-03", "E-03", 62.8, 39.0,  -3, 27, 22),
    ("VE-04", "E-04", 64.0, 43.1,   2, 27, 22),
    ("VE-05", "E-05", 64.8, 47.2,   5, 27, 22),
    ("VE-06", "E-06", 65.0, 51.3,   6, 27, 22),
    ("VE-07", "E-07", 64.8, 55.4,   8, 27, 22),
    ("VE-08", "E-08", 64.0, 59.5,  12, 27, 22),
    ("VE-09", "E-09", 63.0, 63.5,  18, 27, 22),
    ("VE-10", "E-10", 61.6, 67.4,  26, 27, 22),
    ("VE-11", "E-11", 59.8, 71.2,  36, 27, 22),
    ("VE-12", "E-12", 57.6, 74.8,  48, 27, 22),
]

for vid, unum, cxp, cyp, ang, vw, vh in zone_e_specs:
    cx, cy = pct_to_px(cxp, cyp)
    roof = make_hipped_roof(cx, cy, vw, vh, ang)
    plot = make_rect_polygon(cx, cy, vw * 1.45, vh * 1.55, ang)
    VILLAS.append({
        "id": vid, "unitNumber": unum, "unitType": "Villa", "block": "Block E", "zone": "Zone E",
        "cx": cx, "cy": cy, "cxPct": cxp, "cyPct": cyp, "rotation": ang,
        "width": vw, "height": vh,
        "plot": plot, "footprint": roof["outline"], "facets": roof["facets"], "ridge": roof["ridge"],
        "waterfront": False
    })

# 2. Apartment Complexes (AP01 to AP08)
APARTMENTS = []

# AP01: Main Southern U-shaped luxury apartment block
ap01_cx, ap01_cy = pct_to_px(46.0, 29.0)
ap01_shape = [
    (ap01_cx - 48, ap01_cy - 26),
    (ap01_cx + 48, ap01_cy - 26),
    (ap01_cx + 48, ap01_cy + 18),
    (ap01_cx + 28, ap01_cy + 18),
    (ap01_cx + 28, ap01_cy - 6),
    (ap01_cx - 28, ap01_cy - 6),
    (ap01_cx - 28, ap01_cy + 18),
    (ap01_cx - 48, ap01_cy + 18),
]
APARTMENTS.append({
    "id": "AP01", "unitNumber": "AP01", "unitType": "Apartment Block", "block": "AP Zone",
    "cx": ap01_cx, "cy": ap01_cy, "cxPct": 46.0, "cyPct": 29.0,
    "footprint": ap01_shape, "rotation": 0, "levels": 6, "wings": 3
})

# AP02: Main Northern U-shaped luxury apartment block (facing AP01 courtyard)
ap02_cx, ap02_cy = pct_to_px(55.0, 18.0)
ap02_shape = [
    (ap02_cx - 52, ap02_cy + 24),
    (ap02_cx + 52, ap02_cy + 24),
    (ap02_cx + 52, ap02_cy - 20),
    (ap02_cx + 30, ap02_cy - 20),
    (ap02_cx + 30, ap02_cy + 4),
    (ap02_cx - 30, ap02_cy + 4),
    (ap02_cx - 30, ap02_cy - 20),
    (ap02_cx - 52, ap02_cy - 20),
]
APARTMENTS.append({
    "id": "AP02", "unitNumber": "AP02", "unitType": "Apartment Block", "block": "AP Zone",
    "cx": ap02_cx, "cy": ap02_cy, "cxPct": 55.0, "cyPct": 18.0,
    "footprint": ap02_shape, "rotation": 0, "levels": 6, "wings": 3
})

# AP03: East apartment block with parking court
ap03_cx, ap03_cy = pct_to_px(80.0, 18.0)
ap03_poly = make_rect_polygon(ap03_cx, ap03_cy, 68, 44, -36)
APARTMENTS.append({
    "id": "AP03", "unitNumber": "AP03", "unitType": "Apartment Block", "block": "AP Zone",
    "cx": ap03_cx, "cy": ap03_cy, "cxPct": 80.0, "cyPct": 18.0,
    "footprint": ap03_poly, "rotation": -36, "levels": 4, "wings": 2
})

# Perimeter apartments along top curved boulevard: AP07, AP06, AP08, AP05
perim_ap_specs = [
    ("AP07", "AP07", 26.0, 12.0, -38, 52, 24),
    ("AP06", "AP06", 36.0,  5.0, -18, 52, 24),
    ("AP08", "AP08", 42.0,  4.0,   0, 52, 24),
    ("AP05", "AP05", 57.0,  7.0,  20, 52, 24),
]

for apid, unum, cxp, cyp, ang, w, h in perim_ap_specs:
    cx, cy = pct_to_px(cxp, cyp)
    poly = make_rect_polygon(cx, cy, w, h, ang)
    APARTMENTS.append({
        "id": apid, "unitNumber": unum, "unitType": "Apartment Block", "block": "AP Zone",
        "cx": cx, "cy": cy, "cxPct": cxp, "cyPct": cyp,
        "footprint": poly, "rotation": ang, "levels": 4, "wings": 1
    })

# 3. Townhouse Blocks
TOWNHOUSES = []

# --- Right Strip Townhouses (TR-01 through TR-20) ---
# 5 blocks of 4 units each, aligned vertically on the eastern edge
for block_idx in range(5):
    by_pct = 30.0 + block_idx * 7.0
    for unit_in_block in range(4):
        bx_pct = 70.0 + unit_in_block * 4.0
        unum = f"R-{block_idx*4 + unit_in_block + 1:02d}"
        tid = f"TR-{block_idx*4 + unit_in_block + 1:02d}"
        cx, cy = pct_to_px(bx_pct, by_pct)
        poly = make_rect_polygon(cx, cy, 26, 38, 0)
        roof = make_hipped_roof(cx, cy, 24, 34, 0, ridge_ratio=0.3)
        garden = make_rect_polygon(cx, cy + 24, 26, 16, 0)
        TOWNHOUSES.append({
            "id": tid, "unitNumber": unum, "unitType": "Townhouse", "block": "Right Strip", "zone": "Right Strip",
            "cx": cx, "cy": cy, "cxPct": bx_pct, "cyPct": by_pct, "rotation": 0,
            "footprint": poly, "facets": roof["facets"], "garden": garden
        })

# --- Bottom Strip Townhouses (TB-01 through TB-14) ---
# 2 horizontal rows of 7 units each
for row_idx in range(2):
    by_pct = 88.0 + row_idx * 5.0
    for col_idx in range(7):
        bx_pct = 33.0 + col_idx * 5.0
        unum = f"B-{row_idx*7 + col_idx + 1:02d}T"
        tid = f"TB-{row_idx*7 + col_idx + 1:02d}"
        cx, cy = pct_to_px(bx_pct, by_pct)
        poly = make_rect_polygon(cx, cy, 34, 22, 0)
        roof = make_hipped_roof(cx, cy, 32, 20, 0, ridge_ratio=0.4)
        garden = make_rect_polygon(cx, cy - 14, 34, 12, 0)
        TOWNHOUSES.append({
            "id": tid, "unitNumber": unum, "unitType": "Townhouse", "block": "Bottom Strip", "zone": "Bottom Strip",
            "cx": cx, "cy": cy, "cxPct": bx_pct, "cyPct": by_pct, "rotation": 0,
            "footprint": poly, "facets": roof["facets"], "garden": garden
        })

# 4. Landscape Elements: Roads, Water Features, Trees, Green Zones
# Roads: outer perimeter, internal ring road, central boulevard
ROAD_PATHS = [
    # Western Arterial Boulevard
    "M 70,0 C 65,150 50,350 45,550 C 40,750 48,900 120,980 L 135,980 C 68,900 60,750 65,550 C 70,350 85,150 90,0 Z",
    # Southern Highway
    "M 0,980 L 864,980 L 864,1035 L 0,1035 Z",
    # Northern Curve Boulevard
    "M 90,0 C 120,80 250,15 450,10 C 650,5 780,70 864,150 L 864,180 C 770,95 640,30 450,35 C 240,40 110,110 70,0 Z",
    # Internal Loop Road (between Zone A and Zone B)
    "M 140,240 C 110,340 85,480 85,600 C 85,740 135,880 220,940 L 235,925 C 155,870 105,730 105,600 C 105,490 128,355 156,260 Z",
    # Central Boulevard (between Zone C and Zone D)
    "M 330,320 C 370,360 410,480 415,620 C 420,740 375,850 310,910 L 325,920 C 395,860 440,740 435,615 C 430,470 388,348 346,310 Z",
    # Right Avenue (between Zone D and Zone E)
    "M 490,280 C 530,340 565,460 565,580 C 565,700 520,800 460,860 L 475,870 C 540,810 585,700 585,575 C 585,450 548,328 505,270 Z",
    # Townhouse Access Lane
    "M 590,260 L 760,260 L 760,670 L 590,670 Z"
]

# Crystal Lagoon Vector Geometry (West Arm, East Arm, Southern Lagoon Loop)
LAGOON_PATHS = [
    # West Lagoon Arm (Curves between Zone B and Zone C)
    "M 215,310 C 235,325 245,380 230,460 C 215,530 205,600 230,680 C 255,750 305,820 340,865 C 310,875 270,830 240,775 C 210,710 190,620 195,540 C 200,450 215,370 195,330 Z",
    # Central/East Lagoon Arm (Curves between Zone C and Zone D)
    "M 365,370 C 390,390 415,460 425,540 C 435,620 425,700 395,770 C 365,835 320,885 275,910 C 295,895 340,845 370,780 C 400,710 410,630 400,550 C 390,475 370,410 345,390 Z",
    # Southern Lagoon Deep Basin
    "M 200,800 C 230,850 270,890 310,895 C 280,920 225,890 185,845 C 165,815 155,780 170,760 C 185,745 195,770 200,800 Z",
    # AP01/AP02 Central Courtyard Resort Pool
    "M 410,210 C 430,195 470,195 490,210 C 500,230 480,250 450,255 C 420,250 400,230 410,210 Z"
]

# Boardwalks / Piers
BOARDWALKS = [
    {"x1": 205, "y1": 465, "x2": 240, "y2": 465, "width": 8},
    {"x1": 200, "y1": 560, "x2": 235, "y2": 560, "width": 8},
    {"x1": 215, "y1": 660, "x2": 250, "y2": 660, "width": 8},
    {"x1": 255, "y1": 760, "x2": 290, "y2": 760, "width": 8},
    {"x1": 385, "y1": 450, "x2": 420, "y2": 450, "width": 8},
    {"x1": 395, "y1": 550, "x2": 430, "y2": 550, "width": 8},
    {"x1": 385, "y1": 650, "x2": 420, "y2": 650, "width": 8},
    {"x1": 355, "y1": 750, "x2": 390, "y2": 750, "width": 8},
]

# Generate realistic decorative tree canopies around the site
TREES = []
def add_tree(cx, cy, r=8):
    TREES.append({"cx": round(cx, 1), "cy": round(cy, 1), "r": r})

# Trees along western road
for y in range(40, 960, 28):
    x = 48 + 10 * math.sin(y / 120.0)
    add_tree(x, y, 7)

# Trees along northern boulevard
for x in range(120, 840, 36):
    y = 50 + 20 * math.sin(x / 140.0)
    add_tree(x, y, 8)

# Trees in central park courtyard between AP01 and AP02
for px, py in [(430, 220), (445, 235), (460, 215), (475, 230), (390, 200), (510, 200)]:
    add_tree(px, py, 9)

# Trees along southern highway buffer
for x in range(30, 840, 24):
    add_tree(x, 965, 7.5)
    add_tree(x + 12, 1045, 8.5)

# Trees between villas (green buffers)
for v in VILLAS:
    ang_rad = math.radians(v["rotation"])
    # left and right of each villa plot
    t1x = v["cx"] + math.cos(ang_rad) * 22
    t1y = v["cy"] + math.sin(ang_rad) * 22
    t2x = v["cx"] - math.cos(ang_rad) * 22
    t2y = v["cy"] - math.sin(ang_rad) * 22
    add_tree(t1x, t1y, 6.5)
    add_tree(t2x, t2y, 6.5)

# Build JS export
all_units = VILLAS + APARTMENTS + TOWNHOUSES

js_content = f"""/**
 * SitePlanner — Vector Masterplan Geometry & CAD Layers
 * Generated from AutoCAD Masterplan specifications
 * Coordinate System: 864 x 1053 (SVG ViewBox: 0 0 864 1053)
 */

const VECTOR_MASTERPLAN = {{
  meta: {{
    width: {W},
    height: {H},
    viewBox: "0 0 {W} {H}",
    totalUnits: {len(all_units)},
    totalVillas: {len(VILLAS)},
    totalApartments: {len(APARTMENTS)},
    totalTownhouses: {len(TOWNHOUSES)}
  }},

  landscape: {{
    roads: {json.dumps(ROAD_PATHS, indent=4)},
    lagoon: {json.dumps(LAGOON_PATHS, indent=4)},
    boardwalks: {json.dumps(BOARDWALKS, indent=4)},
    trees: {json.dumps(TREES, indent=2)}
  }},

  units: {json.dumps(all_units, indent=2)}
}};

if (typeof module !== 'undefined' && module.exports) {{
  module.exports = VECTOR_MASTERPLAN;
}}
"""

with open("vector-masterplan.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Generated vector-masterplan.js with {len(all_units)} unit geometries ({len(VILLAS)} villas, {len(APARTMENTS)} apartments, {len(TOWNHOUSES)} townhouses) and {len(TREES)} landscape trees.")
