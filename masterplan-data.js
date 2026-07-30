/**
 * SitePlanner — Digitized Masterplan Data
 *
 * Coordinates are x, y as percentages (0–100) of the masterplan image
 * dimensions, where (0,0) = top-left and (100,100) = bottom-right.
 *
 * Unit Types:
 *   "Apartment Block"  — AP01–AP08 buildings (top zone)
 *   "Villa"            — Individual villas around the central lagoon
 *   "Townhouse"        — Strip/row units (right side + bottom)
 *
 * How to use:
 *   1. Save your masterplan image as  masterplan.jpg  in this folder.
 *   2. Open  demo.html  — the image will load automatically and all
 *      hotspots will appear on the correct positions.
 */

const MASTERPLAN_UNITS = [

  // ─────────────────────────────────────────────────────
  //  AP ZONE — Apartment Buildings (top section)
  // ─────────────────────────────────────────────────────

  { id:'AP07', unitNumber:'AP07', unitType:'Apartment Block', block:'AP Zone', hotspot:{ x:26, y:12 } },
  { id:'AP06', unitNumber:'AP06', unitType:'Apartment Block', block:'AP Zone', hotspot:{ x:36, y: 5 } },
  { id:'AP08', unitNumber:'AP08', unitType:'Apartment Block', block:'AP Zone', hotspot:{ x:42, y: 4 } },
  { id:'AP05', unitNumber:'AP05', unitType:'Apartment Block', block:'AP Zone', hotspot:{ x:57, y: 7 } },
  { id:'AP02', unitNumber:'AP02', unitType:'Apartment Block', block:'AP Zone', hotspot:{ x:55, y:18 } },
  { id:'AP01', unitNumber:'AP01', unitType:'Apartment Block', block:'AP Zone', hotspot:{ x:46, y:29 } },
  { id:'AP03', unitNumber:'AP03', unitType:'Apartment Block', block:'AP Zone', hotspot:{ x:80, y:18 } },

  // ─────────────────────────────────────────────────────
  //  VILLA ZONE A — Left Outer Row (along outer perimeter road)
  //  ~18 villas following the western curved road top → bottom
  // ─────────────────────────────────────────────────────

  { id:'VA-01', unitNumber:'A-01', unitType:'Villa', block:'Block A', hotspot:{ x:20, y:27 } },
  { id:'VA-02', unitNumber:'A-02', unitType:'Villa', block:'Block A', hotspot:{ x:17, y:31 } },
  { id:'VA-03', unitNumber:'A-03', unitType:'Villa', block:'Block A', hotspot:{ x:15, y:35 } },
  { id:'VA-04', unitNumber:'A-04', unitType:'Villa', block:'Block A', hotspot:{ x:13, y:39 } },
  { id:'VA-05', unitNumber:'A-05', unitType:'Villa', block:'Block A', hotspot:{ x:11, y:43 } },
  { id:'VA-06', unitNumber:'A-06', unitType:'Villa', block:'Block A', hotspot:{ x:10, y:47 } },
  { id:'VA-07', unitNumber:'A-07', unitType:'Villa', block:'Block A', hotspot:{ x: 9, y:51 } },
  { id:'VA-08', unitNumber:'A-08', unitType:'Villa', block:'Block A', hotspot:{ x: 9, y:55 } },
  { id:'VA-09', unitNumber:'A-09', unitType:'Villa', block:'Block A', hotspot:{ x: 9, y:59 } },
  { id:'VA-10', unitNumber:'A-10', unitType:'Villa', block:'Block A', hotspot:{ x:10, y:63 } },
  { id:'VA-11', unitNumber:'A-11', unitType:'Villa', block:'Block A', hotspot:{ x:11, y:67 } },
  { id:'VA-12', unitNumber:'A-12', unitType:'Villa', block:'Block A', hotspot:{ x:12, y:71 } },
  { id:'VA-13', unitNumber:'A-13', unitType:'Villa', block:'Block A', hotspot:{ x:13, y:75 } },
  { id:'VA-14', unitNumber:'A-14', unitType:'Villa', block:'Block A', hotspot:{ x:14, y:79 } },
  { id:'VA-15', unitNumber:'A-15', unitType:'Villa', block:'Block A', hotspot:{ x:15, y:83 } },
  { id:'VA-16', unitNumber:'A-16', unitType:'Villa', block:'Block A', hotspot:{ x:17, y:87 } },
  { id:'VA-17', unitNumber:'A-17', unitType:'Villa', block:'Block A', hotspot:{ x:19, y:90 } },
  { id:'VA-18', unitNumber:'A-18', unitType:'Villa', block:'Block A', hotspot:{ x:21, y:92 } },

  // ─────────────────────────────────────────────────────
  //  VILLA ZONE B — Left Inner Row (villas facing lagoon, left side)
  //  ~14 villas along the left bank of the lagoon
  // ─────────────────────────────────────────────────────

  { id:'VB-01', unitNumber:'B-01', unitType:'Villa', block:'Block B', hotspot:{ x:25, y:29 } },
  { id:'VB-02', unitNumber:'B-02', unitType:'Villa', block:'Block B', hotspot:{ x:23, y:33 } },
  { id:'VB-03', unitNumber:'B-03', unitType:'Villa', block:'Block B', hotspot:{ x:21, y:37 } },
  { id:'VB-04', unitNumber:'B-04', unitType:'Villa', block:'Block B', hotspot:{ x:20, y:41 } },
  { id:'VB-05', unitNumber:'B-05', unitType:'Villa', block:'Block B', hotspot:{ x:19, y:45 } },
  { id:'VB-06', unitNumber:'B-06', unitType:'Villa', block:'Block B', hotspot:{ x:19, y:49 } },
  { id:'VB-07', unitNumber:'B-07', unitType:'Villa', block:'Block B', hotspot:{ x:19, y:53 } },
  { id:'VB-08', unitNumber:'B-08', unitType:'Villa', block:'Block B', hotspot:{ x:20, y:57 } },
  { id:'VB-09', unitNumber:'B-09', unitType:'Villa', block:'Block B', hotspot:{ x:21, y:61 } },
  { id:'VB-10', unitNumber:'B-10', unitType:'Villa', block:'Block B', hotspot:{ x:22, y:65 } },
  { id:'VB-11', unitNumber:'B-11', unitType:'Villa', block:'Block B', hotspot:{ x:24, y:69 } },
  { id:'VB-12', unitNumber:'B-12', unitType:'Villa', block:'Block B', hotspot:{ x:26, y:73 } },
  { id:'VB-13', unitNumber:'B-13', unitType:'Villa', block:'Block B', hotspot:{ x:28, y:77 } },
  { id:'VB-14', unitNumber:'B-14', unitType:'Villa', block:'Block B', hotspot:{ x:30, y:81 } },

  // ─────────────────────────────────────────────────────
  //  VILLA ZONE C — Central Strip (between the two lagoon arms)
  //  ~12 villas in the central island between lagoon branches
  // ─────────────────────────────────────────────────────

  { id:'VC-01', unitNumber:'C-01', unitType:'Villa', block:'Block C', hotspot:{ x:33, y:37 } },
  { id:'VC-02', unitNumber:'C-02', unitType:'Villa', block:'Block C', hotspot:{ x:35, y:41 } },
  { id:'VC-03', unitNumber:'C-03', unitType:'Villa', block:'Block C', hotspot:{ x:36, y:45 } },
  { id:'VC-04', unitNumber:'C-04', unitType:'Villa', block:'Block C', hotspot:{ x:37, y:49 } },
  { id:'VC-05', unitNumber:'C-05', unitType:'Villa', block:'Block C', hotspot:{ x:37, y:53 } },
  { id:'VC-06', unitNumber:'C-06', unitType:'Villa', block:'Block C', hotspot:{ x:37, y:57 } },
  { id:'VC-07', unitNumber:'C-07', unitType:'Villa', block:'Block C', hotspot:{ x:36, y:61 } },
  { id:'VC-08', unitNumber:'C-08', unitType:'Villa', block:'Block C', hotspot:{ x:36, y:65 } },
  { id:'VC-09', unitNumber:'C-09', unitType:'Villa', block:'Block C', hotspot:{ x:37, y:69 } },
  { id:'VC-10', unitNumber:'C-10', unitType:'Villa', block:'Block C', hotspot:{ x:38, y:73 } },
  { id:'VC-11', unitNumber:'C-11', unitType:'Villa', block:'Block C', hotspot:{ x:40, y:77 } },
  { id:'VC-12', unitNumber:'C-12', unitType:'Villa', block:'Block C', hotspot:{ x:42, y:81 } },

  // ─────────────────────────────────────────────────────
  //  VILLA ZONE D — Right Lagoon Side (villas facing right side of lagoon)
  //  ~12 villas along the right bank going south
  // ─────────────────────────────────────────────────────

  { id:'VD-01', unitNumber:'D-01', unitType:'Villa', block:'Block D', hotspot:{ x:44, y:35 } },
  { id:'VD-02', unitNumber:'D-02', unitType:'Villa', block:'Block D', hotspot:{ x:46, y:39 } },
  { id:'VD-03', unitNumber:'D-03', unitType:'Villa', block:'Block D', hotspot:{ x:48, y:43 } },
  { id:'VD-04', unitNumber:'D-04', unitType:'Villa', block:'Block D', hotspot:{ x:50, y:47 } },
  { id:'VD-05', unitNumber:'D-05', unitType:'Villa', block:'Block D', hotspot:{ x:51, y:51 } },
  { id:'VD-06', unitNumber:'D-06', unitType:'Villa', block:'Block D', hotspot:{ x:51, y:55 } },
  { id:'VD-07', unitNumber:'D-07', unitType:'Villa', block:'Block D', hotspot:{ x:51, y:59 } },
  { id:'VD-08', unitNumber:'D-08', unitType:'Villa', block:'Block D', hotspot:{ x:51, y:63 } },
  { id:'VD-09', unitNumber:'D-09', unitType:'Villa', block:'Block D', hotspot:{ x:50, y:67 } },
  { id:'VD-10', unitNumber:'D-10', unitType:'Villa', block:'Block D', hotspot:{ x:50, y:71 } },
  { id:'VD-11', unitNumber:'D-11', unitType:'Villa', block:'Block D', hotspot:{ x:49, y:75 } },
  { id:'VD-12', unitNumber:'D-12', unitType:'Villa', block:'Block D', hotspot:{ x:47, y:79 } },

  // ─────────────────────────────────────────────────────
  //  VILLA ZONE E — Right Outer Row (along right side of compound)
  //  ~12 villas forming the eastern villa row
  // ─────────────────────────────────────────────────────

  { id:'VE-01', unitNumber:'E-01', unitType:'Villa', block:'Block E', hotspot:{ x:59, y:31 } },
  { id:'VE-02', unitNumber:'E-02', unitType:'Villa', block:'Block E', hotspot:{ x:61, y:35 } },
  { id:'VE-03', unitNumber:'E-03', unitType:'Villa', block:'Block E', hotspot:{ x:63, y:39 } },
  { id:'VE-04', unitNumber:'E-04', unitType:'Villa', block:'Block E', hotspot:{ x:64, y:43 } },
  { id:'VE-05', unitNumber:'E-05', unitType:'Villa', block:'Block E', hotspot:{ x:65, y:47 } },
  { id:'VE-06', unitNumber:'E-06', unitType:'Villa', block:'Block E', hotspot:{ x:65, y:51 } },
  { id:'VE-07', unitNumber:'E-07', unitType:'Villa', block:'Block E', hotspot:{ x:65, y:55 } },
  { id:'VE-08', unitNumber:'E-08', unitType:'Villa', block:'Block E', hotspot:{ x:64, y:59 } },
  { id:'VE-09', unitNumber:'E-09', unitType:'Villa', block:'Block E', hotspot:{ x:63, y:63 } },
  { id:'VE-10', unitNumber:'E-10', unitType:'Villa', block:'Block E', hotspot:{ x:62, y:67 } },
  { id:'VE-11', unitNumber:'E-11', unitType:'Villa', block:'Block E', hotspot:{ x:61, y:71 } },
  { id:'VE-12', unitNumber:'E-12', unitType:'Villa', block:'Block E', hotspot:{ x:60, y:75 } },

  // ─────────────────────────────────────────────────────
  //  TOWNHOUSE ZONE R — Right Strip (attached row housing, right side)
  //  5 rows × 4 units = 20 units
  // ─────────────────────────────────────────────────────

  { id:'TR-01', unitNumber:'R-01', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:70, y:30 } },
  { id:'TR-02', unitNumber:'R-02', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:74, y:30 } },
  { id:'TR-03', unitNumber:'R-03', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:78, y:30 } },
  { id:'TR-04', unitNumber:'R-04', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:82, y:30 } },

  { id:'TR-05', unitNumber:'R-05', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:70, y:37 } },
  { id:'TR-06', unitNumber:'R-06', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:74, y:37 } },
  { id:'TR-07', unitNumber:'R-07', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:78, y:37 } },
  { id:'TR-08', unitNumber:'R-08', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:82, y:37 } },

  { id:'TR-09', unitNumber:'R-09', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:70, y:44 } },
  { id:'TR-10', unitNumber:'R-10', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:74, y:44 } },
  { id:'TR-11', unitNumber:'R-11', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:78, y:44 } },
  { id:'TR-12', unitNumber:'R-12', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:82, y:44 } },

  { id:'TR-13', unitNumber:'R-13', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:70, y:51 } },
  { id:'TR-14', unitNumber:'R-14', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:74, y:51 } },
  { id:'TR-15', unitNumber:'R-15', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:78, y:51 } },
  { id:'TR-16', unitNumber:'R-16', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:82, y:51 } },

  { id:'TR-17', unitNumber:'R-17', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:70, y:58 } },
  { id:'TR-18', unitNumber:'R-18', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:74, y:58 } },
  { id:'TR-19', unitNumber:'R-19', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:78, y:58 } },
  { id:'TR-20', unitNumber:'R-20', unitType:'Townhouse', block:'Right Strip', hotspot:{ x:82, y:58 } },

  // ─────────────────────────────────────────────────────
  //  TOWNHOUSE ZONE B — Bottom Strip (row units, bottom of compound)
  //  2 rows × 7 units = 14 units
  // ─────────────────────────────────────────────────────

  { id:'TB-01', unitNumber:'B-01T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:33, y:88 } },
  { id:'TB-02', unitNumber:'B-02T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:38, y:88 } },
  { id:'TB-03', unitNumber:'B-03T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:43, y:88 } },
  { id:'TB-04', unitNumber:'B-04T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:48, y:88 } },
  { id:'TB-05', unitNumber:'B-05T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:53, y:88 } },
  { id:'TB-06', unitNumber:'B-06T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:58, y:88 } },
  { id:'TB-07', unitNumber:'B-07T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:63, y:88 } },

  { id:'TB-08', unitNumber:'B-08T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:33, y:93 } },
  { id:'TB-09', unitNumber:'B-09T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:38, y:93 } },
  { id:'TB-10', unitNumber:'B-10T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:43, y:93 } },
  { id:'TB-11', unitNumber:'B-11T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:48, y:93 } },
  { id:'TB-12', unitNumber:'B-12T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:53, y:93 } },
  { id:'TB-13', unitNumber:'B-13T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:58, y:93 } },
  { id:'TB-14', unitNumber:'B-14T', unitType:'Townhouse', block:'Bottom Strip', hotspot:{ x:63, y:93 } },

];

// Total: 7 AP + 18 + 14 + 12 + 12 + 12 + 20 + 14 = 109 units
