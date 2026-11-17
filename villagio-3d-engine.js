/* ═══════════════════════════════════════════════════════════════════════════
   VILLAGIO 3D DIGITAL TWIN ENGINE (Three.js r128)
   Stage-by-stage procedural 3D building construction + Masterplan environment
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const CX = 580;
  const CY = 505;

  window.Villagio3DEngine = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    raycaster: null,
    mouse: null,
    container: null,
    labelContainer: null,
    villaGroups: {},      // unitNumber -> THREE.Group
    villaPickables: [],   // Meshes for raycasting
    labelElements: {},    // unitNumber -> DOM element
    treeGroup: null,
    roadGroup: null,
    lagoonGroup: null,
    aptGroup: null,
    gridHelper: null,
    groundMesh: null,
    compoundPad: null,
    dirLight: null,
    ambientLight: null,
    hemiLight: null,
    hoveredUnit: null,
    selectedUnit: null,
    envMode: 'day',       // 'day' | 'night' | 'blueprint'
    showLabels: true,
    showTrees: true,
    showApartments: true,
    animTarget: null,     // { camPos, targetPos, progress }
    clock: null,
    waterMeshes: [],
    onSelectCallback: null,
    onHoverCallback: null,

    init: function(containerId, labelContainerId, data, onSelect, onHover) {
      this.container = document.getElementById(containerId);
      this.labelContainer = document.getElementById(labelContainerId);
      this.onSelectCallback = onSelect;
      this.onHoverCallback = onHover;
      this.clock = new THREE.Clock();

      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;

      // 1. Scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0b1528);
      this.scene.fog = new THREE.FogExp2(0x0b1528, 0.00042);

      // 2. Camera
      this.camera = new THREE.PerspectiveCamera(42, w / h, 2, 4500);
      this.camera.position.set(0, 620, 720);

      // 3. Renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
      this.container.appendChild(this.renderer.domElement);

      // 4. OrbitControls
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.03; // Stay above ground
      this.controls.minDistance = 40;
      this.controls.maxDistance = 1800;
      this.controls.target.set(-40, 0, -20);

      // 5. Lighting
      this.setupLights();

      // 6. Shared Materials
      this.initMaterials();

      // 7. Build Environment (Terrain, Greenery, Roads, Lagoons, Apartments, Trees)
      this.buildEnvironment(data);

      // 8. Build All 110 Villas in 3D
      this.buildAllVillas(data.layers.villas);

      // 9. Apply initial Day theme
      this.setEnvironmentMode('day');

      // 10. Interaction Events
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      this.bindEvents();

      // 11. Start Render Loop
      this.animate();
    },

    setupLights: function() {
      this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.65);
      this.hemiLight.position.set(0, 500, 0);
      this.scene.add(this.hemiLight);

      this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
      this.scene.add(this.ambientLight);

      this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.15);
      this.dirLight.position.set(420, 680, 380);
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.width = 2048;
      this.dirLight.shadow.mapSize.height = 2048;
      const d = 750;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.camera.near = 100;
      this.dirLight.shadow.camera.far = 1800;
      this.dirLight.shadow.bias = -0.0005;
      this.scene.add(this.dirLight);
    },

    initMaterials: function() {
      this.mats = {
        excavationSoil: new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.95, metalness: 0.05 }),
        pcFooting: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, metalness: 0.05 }),
        rcFooting: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.75, metalness: 0.1 }),
        insulationBitumen: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.2 }),
        concreteCol: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.6, metalness: 0.1 }),
        concreteSlab: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55, metalness: 0.1 }),
        redBrick: new THREE.MeshStandardMaterial({ color: 0xc2593f, roughness: 0.85, metalness: 0.05 }),
        plasterCream: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.05 }),
        facadeAccent: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.2 }),
        woodLouvers: new THREE.MeshStandardMaterial({ color: 0x9a5b32, roughness: 0.5, metalness: 0.1 }),
        windowGlass: new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.25,
          roughness: 0.1,
          metalness: 0.85,
          transparent: true,
          opacity: 0.82
        }),
        mepPipe: new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.3, metalness: 0.6 }),
        hvacUnit: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.5 }),
        rebarSteel: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.8 }),
        blueprintWire: new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.45 })
      };
    },

    svgTo3D: function(sx, sy) {
      return { x: sx - CX, z: sy - CY };
    },

    createPolygonShape: function(pts) {
      const shape = new THREE.Shape();
      if (!pts || pts.length < 3) return null;
      // Note: When rotating shape.extrudeGeometry by Math.PI/2 around X,
      // shape (x, y) maps to 3D (x, z) if we use (x, -y) and rotate -Math.PI/2
      const p0 = this.svgTo3D(pts[0][0], pts[0][1]);
      shape.moveTo(p0.x, -p0.z);
      for (let i = 1; i < pts.length; i++) {
        const pi = this.svgTo3D(pts[i][0], pts[i][1]);
        shape.lineTo(pi.x, -pi.z);
      }
      shape.closePath();
      return shape;
    },

    createLocalCenteredShape: function(pts, cx, cy, scaleFactor) {
      const sf = scaleFactor || 1.0;
      const shape = new THREE.Shape();
      if (!pts || pts.length < 3) return null;
      const dx0 = (pts[0][0] - cx) * sf;
      const dz0 = (pts[0][1] - cy) * sf;
      shape.moveTo(dx0, -dz0);
      for (let i = 1; i < pts.length; i++) {
        const dxi = (pts[i][0] - cx) * sf;
        const dzi = (pts[i][1] - cy) * sf;
        shape.lineTo(dxi, -dzi);
      }
      shape.closePath();
      return shape;
    },

    buildEnvironment: function(data) {
      // 1. Base World Ground Plane
      const groundGeo = new THREE.PlaneGeometry(4200, 4200);
      groundGeo.rotateX(-Math.PI / 2);
      this.groundMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95, metalness: 0.02 });
      this.groundMesh = new THREE.Mesh(groundGeo, this.groundMat);
      this.groundMesh.position.y = -1.2;
      this.groundMesh.receiveShadow = true;
      this.scene.add(this.groundMesh);

      // 2. Subtle Engineering Grid
      this.gridHelper = new THREE.GridHelper(2200, 88, 0x1e3a8a, 0x1e293b);
      this.gridHelper.position.y = -0.9;
      this.gridHelper.material.transparent = true;
      this.gridHelper.material.opacity = 0.35;
      this.scene.add(this.gridHelper);

      // 3. Compound Landscaped Platform (from greenery perimeter)
      this.compoundMat = new THREE.MeshStandardMaterial({ color: 0x14332b, roughness: 0.9, metalness: 0.05 });
      const compoundPts = [
        [20, 480], [340, 60], [640, 60], [1140, 260],
        [1140, 740], [650, 960], [415, 960], [20, 520]
      ];
      const compShape = this.createPolygonShape(compoundPts);
      if (compShape) {
        const compGeo = new THREE.ExtrudeGeometry(compShape, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 1.5, bevelSegments: 2 });
        compGeo.rotateX(-Math.PI / 2);
        this.compoundPad = new THREE.Mesh(compGeo, this.compoundMat);
        this.compoundPad.position.y = -0.8;
        this.compoundPad.receiveShadow = true;
        this.scene.add(this.compoundPad);
      }

      // 4. Greenery Border & Park Ribbons
      this.roadGroup = new THREE.Group();
      const greenLineMat = new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.65 });
      (data.layers.greeneryPts || []).forEach(pts => {
        const vecs = pts.map(p => {
          const c = this.svgTo3D(p[0], p[1]);
          return new THREE.Vector3(c.x, 0.35, c.z);
        });
        const gGeo = new THREE.BufferGeometry().setFromPoints(vecs);
        this.roadGroup.add(new THREE.Line(gGeo, greenLineMat));
      });

      // 5. Road Network (3D Asphalt Strips & Crisp Curbs)
      this.roadAsphaltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85, metalness: 0.1 });
      this.roadLineMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.6 });

      (data.layers.roadsPts || []).forEach(pts => {
        if (pts.length < 2) return;
        const vecs = [];
        for (let i = 0; i < pts.length; i++) {
          const c = this.svgTo3D(pts[i][0], pts[i][1]);
          vecs.push(new THREE.Vector3(c.x, 0.18, c.z));

          // Create 3D road segment ribbon between consecutive points
          if (i < pts.length - 1) {
            const c2 = this.svgTo3D(pts[i + 1][0], pts[i + 1][1]);
            const dx = c2.x - c.x;
            const dz = c2.z - c.z;
            const len = Math.hypot(dx, dz);
            if (len > 1.5 && len < 650) {
              const segGeo = new THREE.BoxGeometry(len, 0.18, 2.2);
              const segMesh = new THREE.Mesh(segGeo, this.roadAsphaltMat);
              segMesh.position.set((c.x + c2.x) / 2, 0.08, (c.z + c2.z) / 2);
              segMesh.rotation.y = -Math.atan2(dz, dx);
              segMesh.receiveShadow = true;
              this.roadGroup.add(segMesh);
            }
          }
        }
        const lineGeo = new THREE.BufferGeometry().setFromPoints(vecs);
        this.roadGroup.add(new THREE.Line(lineGeo, this.roadLineMat));
      });
      this.scene.add(this.roadGroup);

      // 6. Crystal Lagoons & Resort Pools
      this.lagoonGroup = new THREE.Group();
      this.waterMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.35,
        roughness: 0.12,
        metalness: 0.65,
        transparent: true,
        opacity: 0.88
      });
      const poolBorderMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });

      (data.layers.lagoonsPts || []).forEach(pts => {
        const lShape = this.createPolygonShape(pts);
        if (!lShape) return;
        // Pool basin border
        const borderGeo = new THREE.ExtrudeGeometry(lShape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 1.2, bevelSegments: 1 });
        borderGeo.rotateX(-Math.PI / 2);
        const borderMesh = new THREE.Mesh(borderGeo, poolBorderMat);
        borderMesh.position.y = -0.15;
        borderMesh.receiveShadow = true;
        this.lagoonGroup.add(borderMesh);

        // Glowing animated water surface
        const waterGeo = new THREE.ExtrudeGeometry(lShape, { depth: 0.35, bevelEnabled: false });
        waterGeo.rotateX(-Math.PI / 2);
        const waterMesh = new THREE.Mesh(waterGeo, this.waterMat);
        waterMesh.position.y = 0.12;
        this.lagoonGroup.add(waterMesh);
        this.waterMeshes.push(waterMesh);
      });
      this.scene.add(this.lagoonGroup);

      // 7. Apartment Complexes (AP01 - AP16) on East Resort Zone
      this.aptGroup = new THREE.Group();
      this.aptBodyMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.4,
        metalness: 0.3,
        transparent: true,
        opacity: 0.88
      });
      this.aptGlassMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.2,
        roughness: 0.15,
        metalness: 0.8
      });
      const aptEdgeMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 });

      (data.layers.apartments || []).forEach((ap) => {
        const shape = this.createPolygonShape(ap.pts);
        if (!shape) return;
        const totalH = 26;
        const extGeo = new THREE.ExtrudeGeometry(shape, { depth: totalH, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 1 });
        extGeo.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(extGeo, this.aptBodyMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.aptGroup.add(mesh);

        // Floor slab accent lines for 4 stories
        for (let f = 1; f <= 4; f++) {
          const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false });
          slabGeo.rotateX(-Math.PI / 2);
          const slabMesh = new THREE.Mesh(slabGeo, this.aptGlassMat);
          slabMesh.position.y = f * 6.2;
          this.aptGroup.add(slabMesh);
        }

        const edges = new THREE.EdgesGeometry(extGeo);
        this.aptGroup.add(new THREE.LineSegments(edges, aptEdgeMat));
      });
      this.scene.add(this.aptGroup);

      // 8. Procedural Landscaped Trees along Avenues & Lagoons
      this.treeGroup = new THREE.Group();
      const trunkGeo = new THREE.CylinderGeometry(0.45, 0.65, 3.2, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
      const foliageGeo1 = new THREE.ConeGeometry(2.8, 6.5, 7);
      const foliageGeo2 = new THREE.DodecahedronGeometry(2.6, 1);
      const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
      const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7 });

      // Place trees around lagoons and along greenery corridors evitando villas
      const villas = data.layers.villas || [];
      const isNearVilla = (x3d, z3d) => {
        for (let i = 0; i < villas.length; i++) {
          const vc = this.svgTo3D(villas[i].svgX, villas[i].svgY);
          if (Math.hypot(x3d - vc.x, z3d - vc.z) < 28) return true;
        }
        return false;
      };

      const treeCoords = [];
      // Along greenery lines
      (data.layers.greeneryPts || []).forEach(pts => {
        for (let i = 0; i < pts.length - 1; i++) {
          const c1 = this.svgTo3D(pts[i][0], pts[i][1]);
          const c2 = this.svgTo3D(pts[i + 1][0], pts[i + 1][1]);
          const dist = Math.hypot(c2.x - c1.x, c2.z - c1.z);
          const steps = Math.floor(dist / 28);
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const tx = c1.x + (c2.x - c1.x) * t + (Math.sin(s * 17) * 4);
            const tz = c1.z + (c2.z - c1.z) * t + (Math.cos(s * 23) * 4);
            if (!isNearVilla(tx, tz)) treeCoords.push({ x: tx, z: tz, type: s % 2 });
          }
        }
      });

      // Around lagoons
      (data.layers.lagoonsPts || []).forEach(pts => {
        for (let i = 0; i < pts.length; i += 2) {
          const c = this.svgTo3D(pts[i][0], pts[i][1]);
          if (!isNearVilla(c.x + 8, c.z + 8)) {
            treeCoords.push({ x: c.x + 8, z: c.z + 8, type: i % 2 });
          }
        }
      });

      treeCoords.forEach((tc, idx) => {
        const tGrp = new THREE.Group();
        const scale = 0.85 + (idx % 5) * 0.12;
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.6;
        trunk.castShadow = true;
        tGrp.add(trunk);

        const crown = new THREE.Mesh(tc.type === 0 ? foliageGeo1 : foliageGeo2, tc.type === 0 ? foliageMat1 : foliageMat2);
        crown.position.y = tc.type === 0 ? 5.2 : 4.6;
        crown.castShadow = true;
        tGrp.add(crown);

        tGrp.position.set(tc.x, 0, tc.z);
        tGrp.scale.set(scale, scale, scale);
        this.treeGroup.add(tGrp);
      });
      this.scene.add(this.treeGroup);
    },

    buildAllVillas: function(villas) {
      this.villaPickables = [];
      villas.forEach(v => {
        this.buildOrUpdateVilla3D(v);
      });
    },

    /**
     * PROCEDURAL STAGE-BY-STAGE 3D VILLA GENERATOR
     * Physically constructs the 9 engineering milestones from Villagio.xlsx:
     * m1_excavation -> m2_footings -> m6_insulation -> m3_gf_struct -> m4_ff_struct ->
     * m5_roof_struct -> m7_gf_masonry -> m8_ff_masonry -> m9_mep_rough + Final Finish
     */
    buildOrUpdateVilla3D: function(v) {
      // Remove existing group if rebuilding
      if (this.villaGroups[v.unitNumber]) {
        const oldGrp = this.villaGroups[v.unitNumber];
        // Remove old pickables
        this.villaPickables = this.villaPickables.filter(m => m.userData.unitNumber !== v.unitNumber);
        this.scene.remove(oldGrp);
      }

      const grp = new THREE.Group();
      const pos3d = this.svgTo3D(v.svgX, v.svgY);
      grp.position.set(pos3d.x, 0, pos3d.z);
      grp.userData = { unitNumber: v.unitNumber, villa: v };

      const m = v.milestones || {};
      const stageColor = new THREE.Color(v.cadStage ? v.cadStage.color : '#38bdf8');
      const isTwin = v.unitType === 'Twin House';

      // Local footprint shapes at various scales
      const outerShape = this.createLocalCenteredShape(v.pts, v.svgX, v.svgY, 1.0);
      const structShape = this.createLocalCenteredShape(v.pts, v.svgX, v.svgY, 0.84);
      const wallShape = this.createLocalCenteredShape(v.pts, v.svgX, v.svgY, 0.80);
      const roofPenthouseShape = this.createLocalCenteredShape(v.pts, v.svgX, v.svgY, 0.46);

      if (!outerShape || !structShape) return;

      // Height constants (in 3D scene units)
      const GF_H = 6.2;
      const FF_H = 6.2;
      const ROOF_H = 4.6;
      const SLAB_T = 0.75;

      // 1. BASE PLOT BOUNDARY RING & STATUS GLOW PAD (Always visible so even 0% plots are clickable)
      const padGeo = new THREE.ExtrudeGeometry(outerShape, { depth: 0.35, bevelEnabled: false });
      padGeo.rotateX(-Math.PI / 2);
      const padMat = new THREE.MeshStandardMaterial({
        color: stageColor,
        roughness: 0.4,
        metalness: 0.2,
        transparent: true,
        opacity: v.progress <= 0 ? 0.32 : 0.78
      });
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.y = 0.05;
      padMesh.receiveShadow = true;
      padMesh.userData = { unitNumber: v.unitNumber };
      grp.add(padMesh);
      this.villaPickables.push(padMesh);

      // Crisp CAD plot outline
      const edgeGeo = new THREE.EdgesGeometry(padGeo);
      const edgeMat = new THREE.LineBasicMaterial({ color: stageColor, transparent: true, opacity: 0.95 });
      const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat);
      edgeLine.position.y = 0.25;
      grp.add(edgeLine);
      grp.userData.edgeMat = edgeMat;
      grp.userData.padMat = padMat;

      // 2. MILESTONE 1: EXCAVATION & REPLACEMENT (حفر + إحلال - 10%)
      if ((m.m1_excavation || 0) > 0) {
        const excGeo = new THREE.ExtrudeGeometry(structShape, { depth: 1.2, bevelEnabled: false });
        excGeo.rotateX(-Math.PI / 2);
        const excMesh = new THREE.Mesh(excGeo, this.mats.excavationSoil);
        excMesh.position.y = -0.35;
        excMesh.receiveShadow = true;
        excMesh.userData = { unitNumber: v.unitNumber };
        grp.add(excMesh);
        this.villaPickables.push(excMesh);
      }

      // Compute local column positions inside oriented bounding box
      const colOffsets = [];
      const hw = Math.max(4, v.width * 0.32);
      const hd = Math.max(4, v.depth * 0.32);
      const cosA = Math.cos(v.angle);
      const sinA = Math.sin(v.angle);
      const gridX = [-hw, 0, hw];
      const gridZ = [-hd, hd];
      for (let gx of gridX) {
        for (let gz of gridZ) {
          colOffsets.push({
            x: gx * cosA - gz * sinA,
            z: gx * sinA + gz * cosA
          });
        }
      }

      // 3. MILESTONE 2: PC & RC FOUNDATIONS (أساسات عاديه + مسلحه - 10%)
      if ((m.m2_footings || 0) > 0) {
        const isFullRC = m.m2_footings >= 0.08;
        const footGeo = new THREE.ExtrudeGeometry(structShape, { depth: isFullRC ? 1.5 : 0.8, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.2, bevelSegments: 1 });
        footGeo.rotateX(-Math.PI / 2);
        const footMesh = new THREE.Mesh(footGeo, isFullRC ? this.mats.rcFooting : this.mats.pcFooting);
        footMesh.position.y = 0.2;
        footMesh.castShadow = true;
        footMesh.receiveShadow = true;
        footMesh.userData = { unitNumber: v.unitNumber };
        grp.add(footMesh);
        this.villaPickables.push(footMesh);

        // Individual RC footing pads & starter rebars if columns haven't started
        if (isFullRC && (m.m3_gf_struct || 0) <= 0) {
          const padBox = new THREE.BoxGeometry(2.6, 1.1, 2.6);
          const rebarCyl = new THREE.CylinderGeometry(0.18, 0.18, 2.8, 5);
          colOffsets.forEach(co => {
            const pMesh = new THREE.Mesh(padBox, this.mats.rcFooting);
            pMesh.position.set(co.x, 1.3, co.z);
            pMesh.castShadow = true;
            grp.add(pMesh);

            const rMesh = new THREE.Mesh(rebarCyl, this.mats.rebarSteel);
            rMesh.position.set(co.x, 2.4, co.z);
            grp.add(rMesh);
          });
        }
      }

      // 4. MILESTONE 6: FOUNDATION INSULATION & BACKFILL (عزل القواعد + ردم القصيه - 5%)
      if ((m.m6_insulation || 0) > 0) {
        const insGeo = new THREE.ExtrudeGeometry(structShape, { depth: 0.7, bevelEnabled: false });
        insGeo.rotateX(-Math.PI / 2);
        const insMesh = new THREE.Mesh(insGeo, this.mats.insulationBitumen);
        insMesh.position.y = 1.45;
        insMesh.receiveShadow = true;
        grp.add(insMesh);
      }

      const baseElev = 2.0;

      // 5. MILESTONE 3: GROUND FLOOR COLUMNS & SLAB (أعمدة أرضي + سقف أرضي - 25%)
      if ((m.m3_gf_struct || 0) > 0) {
        const hasGFSlab = m.m3_gf_struct >= 0.20;
        const colGeo = new THREE.BoxGeometry(0.95, GF_H, 0.95);
        colOffsets.forEach(co => {
          const cMesh = new THREE.Mesh(colGeo, this.mats.concreteCol);
          cMesh.position.set(co.x, baseElev + GF_H / 2, co.z);
          cMesh.rotation.y = -v.angle;
          cMesh.castShadow = true;
          cMesh.receiveShadow = true;
          cMesh.userData = { unitNumber: v.unitNumber };
          grp.add(cMesh);
          this.villaPickables.push(cMesh);
        });

        if (hasGFSlab) {
          const gfSlabGeo = new THREE.ExtrudeGeometry(structShape, { depth: SLAB_T, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.15, bevelSegments: 1 });
          gfSlabGeo.rotateX(-Math.PI / 2);
          const gfSlabMesh = new THREE.Mesh(gfSlabGeo, this.mats.concreteSlab);
          gfSlabMesh.position.y = baseElev + GF_H;
          gfSlabMesh.castShadow = true;
          gfSlabMesh.receiveShadow = true;
          gfSlabMesh.userData = { unitNumber: v.unitNumber };
          grp.add(gfSlabMesh);
          this.villaPickables.push(gfSlabMesh);
        }
      }

      // 6. MILESTONE 7: GROUND FLOOR BRICKWORK (مباني الدور الأرضي - 5%)
      const isFinished = v.progress >= 99.5 || (m.m9_mep_rough || 0) >= 0.04;
      if ((m.m7_gf_masonry || 0) > 0) {
        const gfWallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: GF_H - 0.1, bevelEnabled: false });
        gfWallGeo.rotateX(-Math.PI / 2);
        const gfWallMesh = new THREE.Mesh(gfWallGeo, isFinished ? this.mats.plasterCream : this.mats.redBrick);
        gfWallMesh.position.y = baseElev + 0.05;
        gfWallMesh.castShadow = true;
        gfWallMesh.receiveShadow = true;
        gfWallMesh.userData = { unitNumber: v.unitNumber };
        grp.add(gfWallMesh);
        this.villaPickables.push(gfWallMesh);
      }

      const ffElev = baseElev + GF_H + SLAB_T;

      // 7. MILESTONE 4: FIRST FLOOR COLUMNS & SLAB (أعمدة أول + سقف أول - 25%)
      if ((m.m4_ff_struct || 0) > 0) {
        const hasFFSlab = m.m4_ff_struct >= 0.20;
        const ffColGeo = new THREE.BoxGeometry(0.9, FF_H, 0.9);
        colOffsets.forEach(co => {
          const cMesh = new THREE.Mesh(ffColGeo, this.mats.concreteCol);
          cMesh.position.set(co.x, ffElev + FF_H / 2, co.z);
          cMesh.rotation.y = -v.angle;
          cMesh.castShadow = true;
          cMesh.receiveShadow = true;
          cMesh.userData = { unitNumber: v.unitNumber };
          grp.add(cMesh);
          this.villaPickables.push(cMesh);
        });

        if (hasFFSlab) {
          const ffSlabGeo = new THREE.ExtrudeGeometry(structShape, { depth: SLAB_T, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.2, bevelSegments: 1 });
          ffSlabGeo.rotateX(-Math.PI / 2);
          const ffSlabMesh = new THREE.Mesh(ffSlabGeo, this.mats.concreteSlab);
          ffSlabMesh.position.y = ffElev + FF_H;
          ffSlabMesh.castShadow = true;
          ffSlabMesh.receiveShadow = true;
          ffSlabMesh.userData = { unitNumber: v.unitNumber };
          grp.add(ffSlabMesh);
          this.villaPickables.push(ffSlabMesh);
        }
      }

      // 8. MILESTONE 8: FIRST FLOOR & ROOF BRICKWORK (مباني الدور الأول + غرف السطح - 5%)
      if ((m.m8_ff_masonry || 0) > 0) {
        const ffWallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: FF_H - 0.1, bevelEnabled: false });
        ffWallGeo.rotateX(-Math.PI / 2);
        const ffWallMesh = new THREE.Mesh(ffWallGeo, isFinished ? this.mats.plasterCream : this.mats.redBrick);
        ffWallMesh.position.y = ffElev + 0.05;
        ffWallMesh.castShadow = true;
        ffWallMesh.receiveShadow = true;
        ffWallMesh.userData = { unitNumber: v.unitNumber };
        grp.add(ffWallMesh);
        this.villaPickables.push(ffWallMesh);
      }

      const roofElev = ffElev + FF_H + SLAB_T;

      // 9. MILESTONE 5: ROOF ROOM COLUMNS & SLAB (أعمدة غرفة السطح + سقف السطح - 10%)
      if ((m.m5_roof_struct || 0) > 0 && roofPenthouseShape) {
        const hasRoofSlab = m.m5_roof_struct >= 0.08;
        const rColGeo = new THREE.BoxGeometry(0.8, ROOF_H, 0.8);
        colOffsets.slice(0, 4).forEach(co => {
          const cMesh = new THREE.Mesh(rColGeo, this.mats.concreteCol);
          cMesh.position.set(co.x * 0.55, roofElev + ROOF_H / 2, co.z * 0.55);
          cMesh.rotation.y = -v.angle;
          cMesh.castShadow = true;
          grp.add(cMesh);
        });

        if (hasRoofSlab) {
          const rSlabGeo = new THREE.ExtrudeGeometry(roofPenthouseShape, { depth: SLAB_T, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.15, bevelSegments: 1 });
          rSlabGeo.rotateX(-Math.PI / 2);
          const rSlabMesh = new THREE.Mesh(rSlabGeo, this.mats.concreteSlab);
          rSlabMesh.position.y = roofElev + ROOF_H;
          rSlabMesh.castShadow = true;
          rSlabMesh.userData = { unitNumber: v.unitNumber };
          grp.add(rSlabMesh);
          this.villaPickables.push(rSlabMesh);
        }

        // Roof room brickwork if m8_ff_masonry is active
        if ((m.m8_ff_masonry || 0) > 0) {
          const rWallGeo = new THREE.ExtrudeGeometry(roofPenthouseShape, { depth: ROOF_H - 0.1, bevelEnabled: false });
          rWallGeo.rotateX(-Math.PI / 2);
          const rWallMesh = new THREE.Mesh(rWallGeo, isFinished ? this.mats.facadeAccent : this.mats.redBrick);
          rWallMesh.position.y = roofElev + 0.05;
          rWallMesh.castShadow = true;
          rWallMesh.userData = { unitNumber: v.unitNumber };
          grp.add(rWallMesh);
          this.villaPickables.push(rWallMesh);
        }
      }

      // 10. MILESTONE 9 & HANDOVER FINISH: MEP ROUGH-IN, GLAZING, PARAPETS & PERGOLA
      if ((m.m9_mep_rough || 0) > 0 || isFinished) {
        // Architectural Glazing Windows on GF & FF
        const winW = Math.max(3, v.width * 0.52);
        const winD = Math.max(3, v.depth * 0.84);
        const gfWinGeo = new THREE.BoxGeometry(winW, GF_H * 0.65, winD);
        const gfWinMesh = new THREE.Mesh(gfWinGeo, this.mats.windowGlass);
        gfWinMesh.position.set(0, baseElev + GF_H * 0.5, 0);
        gfWinMesh.rotation.y = -v.angle;
        grp.add(gfWinMesh);

        const ffWinGeo = new THREE.BoxGeometry(winW * 1.05, FF_H * 0.68, winD * 1.02);
        const ffWinMesh = new THREE.Mesh(ffWinGeo, this.mats.windowGlass);
        ffWinMesh.position.set(0, ffElev + FF_H * 0.52, 0);
        ffWinMesh.rotation.y = -v.angle;
        grp.add(ffWinMesh);

        // Twin House Party Wall Divider Accent
        if (isTwin) {
          const divGeo = new THREE.BoxGeometry(0.45, GF_H + FF_H + 3, v.depth * 0.88);
          const divMesh = new THREE.Mesh(divGeo, this.mats.facadeAccent);
          divMesh.position.set(0, baseElev + (GF_H + FF_H) / 2, 0);
          divMesh.rotation.y = -v.angle;
          grp.add(divMesh);
        }

        // Roof MEP HVAC Condenser Units & Solar Water Tank
        const hvacGeo = new THREE.BoxGeometry(1.8, 1.4, 1.2);
        const hvac1 = new THREE.Mesh(hvacGeo, this.mats.hvacUnit);
        hvac1.position.set(1.5, roofElev + ROOF_H + SLAB_T + 0.7, 0);
        grp.add(hvac1);

        const pipeGeo = new THREE.CylinderGeometry(0.25, 0.25, GF_H + FF_H + ROOF_H, 6);
        const pipeMesh = new THREE.Mesh(pipeGeo, this.mats.mepPipe);
        pipeMesh.position.set(-hw * 0.7, baseElev + (GF_H + FF_H + ROOF_H) / 2, -hd * 0.7);
        grp.add(pipeMesh);
      }

      // 11. STAGE COLOR STATUS CROWN / BEACON BAR AT TOP OF CURRENT STRUCTURE
      let topY = 2.0;
      if ((m.m5_roof_struct || 0) > 0) topY = roofElev + ROOF_H + 1.5;
      else if ((m.m4_ff_struct || 0) > 0) topY = ffElev + FF_H + 1.5;
      else if ((m.m3_gf_struct || 0) > 0) topY = baseElev + GF_H + 1.5;
      else if ((m.m2_footings || 0) > 0) topY = 3.5;

      grp.userData.topY = topY;

      this.villaGroups[v.unitNumber] = grp;
      this.scene.add(grp);

      // Create or update floating HTML badge label
      this.createOrUpdateLabel(v, pos3d.x, topY + 3.2, pos3d.z);
    },

    createOrUpdateLabel: function(v, x3d, y3d, z3d) {
      if (!this.labelContainer) return;
      let el = this.labelElements[v.unitNumber];
      if (!el) {
        el = document.createElement('div');
        el.className = 'v3d-label';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectVilla(v.unitNumber, true);
        });
        this.labelContainer.appendChild(el);
        this.labelElements[v.unitNumber] = el;
      }
      const col = v.cadStage ? v.cadStage.color : '#38bdf8';
      el.style.setProperty('--stage-col', col);
      el.innerHTML = `<span class="v3d-lbl-num">${v.unitNumber}</span><span class="v3d-lbl-pct">${Math.round(v.progress)}%</span>`;
      el.dataset.x = x3d;
      el.dataset.y = y3d;
      el.dataset.z = z3d;
    },

    updateLabelsProjection: function() {
      if (!this.labelContainer) return;
      if (!this.showLabels) {
        this.labelContainer.style.display = 'none';
        return;
      }
      this.labelContainer.style.display = 'block';

      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      const camPos = this.camera.position;
      const tempV = new THREE.Vector3();

      for (const unum in this.labelElements) {
        const el = this.labelElements[unum];
        const grp = this.villaGroups[unum];
        if (!grp || !grp.visible || grp.userData.dimmed) {
          el.style.display = 'none';
          continue;
        }

        tempV.set(
          parseFloat(el.dataset.x),
          parseFloat(el.dataset.y),
          parseFloat(el.dataset.z)
        );

        const dist = camPos.distanceTo(tempV);
        // Hide labels if camera is very far away unless selected/hovered
        const isFocus = (this.selectedUnit === unum || this.hoveredUnit === unum);
        if (dist > 1350 && !isFocus) {
          el.style.display = 'none';
          continue;
        }

        tempV.project(this.camera);
        if (tempV.z > 1 || tempV.z < -1) {
          el.style.display = 'none';
          continue;
        }

        const x = (tempV.x * 0.5 + 0.5) * w;
        const y = (-(tempV.y * 0.5) + 0.5) * h;

        if (x < -40 || x > w + 40 || y < -40 || y > h + 40) {
          el.style.display = 'none';
          continue;
        }

        el.style.display = 'inline-flex';
        el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        el.classList.toggle('selected', this.selectedUnit === unum);
        el.classList.toggle('hovered', this.hoveredUnit === unum);
      }
    },

    setEnvironmentMode: function(mode) {
      this.envMode = mode;
      if (mode === 'day') {
        this.scene.background.setHex(0xdbeafe);
        this.scene.fog.color.setHex(0xdbeafe);
        this.scene.fog.density = 0.00032;
        this.groundMat.color.setHex(0xcbd5e1);
        this.compoundMat.color.setHex(0x86efac);
        this.roadAsphaltMat.color.setHex(0x334155);
        this.hemiLight.intensity = 0.85;
        this.dirLight.intensity = 1.25;
        this.dirLight.color.setHex(0xfffbeb);
        this.mats.windowGlass.emissiveIntensity = 0.15;
        this.gridHelper.visible = false;
      } else if (mode === 'night') {
        this.scene.background.setHex(0x060b16);
        this.scene.fog.color.setHex(0x060b16);
        this.scene.fog.density = 0.00045;
        this.groundMat.color.setHex(0x090d16);
        this.compoundMat.color.setHex(0x0d2622);
        this.roadAsphaltMat.color.setHex(0x1e293b);
        this.hemiLight.intensity = 0.4;
        this.dirLight.intensity = 0.7;
        this.dirLight.color.setHex(0x93c5fd);
        this.mats.windowGlass.emissiveIntensity = 0.85;
        this.gridHelper.visible = true;
      } else if (mode === 'blueprint') {
        this.scene.background.setHex(0x030712);
        this.scene.fog.color.setHex(0x030712);
        this.scene.fog.density = 0.00035;
        this.groundMat.color.setHex(0x030712);
        this.compoundMat.color.setHex(0x08142c);
        this.roadAsphaltMat.color.setHex(0x0f2942);
        this.hemiLight.intensity = 0.75;
        this.dirLight.intensity = 0.9;
        this.dirLight.color.setHex(0x38bdf8);
        this.mats.windowGlass.emissiveIntensity = 0.6;
        this.gridHelper.visible = true;
      }
    },

    setCameraPreset: function(preset) {
      if (preset === 'isometric') {
        this.flyToPosition(new THREE.Vector3(-40, 560, 680), new THREE.Vector3(-40, 0, -20));
      } else if (preset === 'top') {
        this.flyToPosition(new THREE.Vector3(-40, 980, 10), new THREE.Vector3(-40, 0, 0));
      } else if (preset === 'lagoon') {
        this.flyToPosition(new THREE.Vector3(-180, 185, 160), new THREE.Vector3(-120, 10, -40));
      } else if (preset === 'west') {
        this.flyToPosition(new THREE.Vector3(-560, 260, 220), new THREE.Vector3(-320, 10, -30));
      }
    },

    flyToVilla: function(unitNumber) {
      const grp = this.villaGroups[unitNumber];
      if (!grp) return;
      const target = new THREE.Vector3(grp.position.x, 8, grp.position.z);
      const camPos = new THREE.Vector3(grp.position.x + 65, 78, grp.position.z + 95);
      this.flyToPosition(camPos, target);
    },

    flyToPosition: function(camPos, targetPos) {
      this.animTarget = {
        startCam: this.camera.position.clone(),
        endCam: camPos,
        startTarget: this.controls.target.clone(),
        endTarget: targetPos,
        t: 0
      };
    },

    selectVilla: function(unitNumber, shouldFly) {
      this.selectedUnit = unitNumber;
      for (const unum in this.villaGroups) {
        const g = this.villaGroups[unum];
        const isSel = (unum === unitNumber);
        if (g.userData.padMat) {
          g.userData.padMat.emissive = isSel ? new THREE.Color(0x38bdf8) : new THREE.Color(0x000000);
          g.userData.padMat.emissiveIntensity = isSel ? 0.65 : 0;
        }
      }
      if (shouldFly && unitNumber) {
        this.flyToVilla(unitNumber);
      }
      if (this.onSelectCallback) {
        const grp = this.villaGroups[unitNumber];
        this.onSelectCallback(grp ? grp.userData.villa : null);
      }
    },

    applyFilterVisibility: function(matchFn) {
      for (const unum in this.villaGroups) {
        const grp = this.villaGroups[unum];
        const v = grp.userData.villa;
        const matched = matchFn(v);
        grp.userData.dimmed = !matched;
        grp.traverse(child => {
          if (child.isMesh && child.material) {
            if (!matched) {
              child.visible = true;
            }
          }
        });
        grp.scale.setScalar(matched ? 1.0 : 0.25);
      }
    },

    bindEvents: function() {
      let downX = 0, downY = 0;
      const dom = this.renderer.domElement;

      dom.addEventListener('pointerdown', (e) => {
        downX = e.clientX;
        downY = e.clientY;
        // Cancel automatic camera fly if user grabs the scene
        this.animTarget = null;
      });

      dom.addEventListener('pointermove', (e) => {
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.villaPickables, false);
        if (hits.length > 0) {
          const unum = hits[0].object.userData.unitNumber;
          if (this.hoveredUnit !== unum) {
            this.hoveredUnit = unum;
            dom.style.cursor = 'pointer';
            if (this.onHoverCallback) {
              const grp = this.villaGroups[unum];
              this.onHoverCallback(grp ? grp.userData.villa : null, e.clientX, e.clientY);
            }
          } else if (this.onHoverCallback) {
            const grp = this.villaGroups[unum];
            this.onHoverCallback(grp ? grp.userData.villa : null, e.clientX, e.clientY);
          }
        } else {
          if (this.hoveredUnit !== null) {
            this.hoveredUnit = null;
            dom.style.cursor = 'grab';
            if (this.onHoverCallback) this.onHoverCallback(null, 0, 0);
          }
        }
      });

      dom.addEventListener('pointerup', (e) => {
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.villaPickables, false);
        if (hits.length > 0) {
          const unum = hits[0].object.userData.unitNumber;
          this.selectVilla(unum, true);
        }
      });

      window.addEventListener('resize', () => this.handleResize());
    },

    handleResize: function() {
      if (!this.container || !this.renderer) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w === 0 || h === 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    },

    animate: function() {
      requestAnimationFrame(() => this.animate());

      const dt = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      // Smooth camera fly-to interpolation
      if (this.animTarget) {
        this.animTarget.t += dt * 2.2;
        const t = Math.min(1, this.animTarget.t);
        const ease = 1 - Math.pow(1 - t, 3);
        this.camera.position.lerpVectors(this.animTarget.startCam, this.animTarget.endCam, ease);
        this.controls.target.lerpVectors(this.animTarget.startTarget, this.animTarget.endTarget, ease);
        if (t >= 1) this.animTarget = null;
      }

      // Subtle lagoon water shimmer
      if (this.waterMat) {
        this.waterMat.emissiveIntensity = 0.3 + Math.sin(elapsed * 2.2) * 0.08;
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.updateLabelsProjection();
    }
  };
})();

