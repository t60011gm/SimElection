// three.js 3D 世界：台北地圖、棋盤、棋子、競選辦公室、骰子
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { DISTRICTS, EVENT_TYPES, LEVEL_NAMES } from './data.js';
import {
  project, outlineShape, outlinePoints2D, pointInPolygon, RIVERS, HILLS,
} from './geo.js';

const TILE_R = 2.1;
import { sleep, SPEED } from './speed.js';
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class World {
  constructor(container, board) {
    this.container = container;
    this.tiles = board.tiles;
    this.curve = board.curve;
    this.tokens = new Map();
    this.offices = new Map();
    this.tileMeshes = [];
    this.animations = new Set();
    this.follow = null;
    this.onTileClick = null;
    this.clock = new THREE.Clock();

    this.#initRenderer();
    this.#buildEnvironment();
    this.#buildTaipei();
    this.#buildBoard();
    this.#buildCity();
    this.#buildDice();
    this.#bindEvents();

    this.renderer.setAnimationLoop(() => this.#tick());
  }

  // ---------- 初始化 ----------
  #initRenderer() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    this.labelRenderer.domElement.className = 'label-layer';
    this.container.appendChild(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#9fd3f0');
    this.scene.fog = new THREE.Fog('#9fd3f0', 140, 320);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.5, 800);
    this.camera.position.set(0, 120, 95);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 5);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.44;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 220;
    this.controls.screenSpacePanning = false;
  }

  #buildEnvironment() {
    const hemi = new THREE.HemisphereLight('#dff4ff', '#4a6b3a', 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff3dd', 2.2);
    sun.position.set(-60, 110, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.far = 300;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.sun = sun;

    // 新北市地面
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(400, 64),
      new THREE.MeshLambertMaterial({ color: '#7fa66a' }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  #buildTaipei() {
    // 台北市範圍
    const geo = new THREE.ShapeGeometry(outlineShape());
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#cfd8c4' }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // 市界線
    const pts = outlinePoints2D().map((p) => new THREE.Vector3(p.x, 0.06, p.z));
    pts.push(pts[0].clone());
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: '#6d4c41', dashSize: 1.2, gapSize: 0.8 }),
    );
    line.computeLineDistances();
    this.scene.add(line);

    // 河川
    const riverMat = new THREE.MeshPhongMaterial({ color: '#3d8fd1', shininess: 80, specular: '#bfe3ff' });
    for (const r of RIVERS) {
      const curve = new THREE.CatmullRomCurve3(r.points.map(([la, ln]) => project(la, ln)));
      this.scene.add(this.#ribbon(curve, r.width, 0.03, riverMat, 200));
    }
    this.riverSamples = RIVERS.flatMap((r) => {
      const c = new THREE.CatmullRomCurve3(r.points.map(([la, ln]) => project(la, ln)));
      return c.getPoints(160).map((p) => ({ p, w: r.width }));
    });

    // 山丘
    const hillMat = new THREE.MeshLambertMaterial({ color: '#4f8a3c', flatShading: true });
    const hillMat2 = new THREE.MeshLambertMaterial({ color: '#3f7531', flatShading: true });
    const rnd = seededRandom(7);
    this.hillSpots = [];
    HILLS.forEach((h, i) => {
      const p = project(h.lat, h.lng);
      const g = new THREE.ConeGeometry(h.r, h.h, 9, 3);
      const pos = g.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        if (pos.getY(k) < h.h / 2 - 0.01) {
          pos.setX(k, pos.getX(k) * (0.85 + rnd() * 0.3));
          pos.setZ(k, pos.getZ(k) * (0.85 + rnd() * 0.3));
          pos.setY(k, pos.getY(k) + (rnd() - 0.5) * 0.6);
        }
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, i % 2 ? hillMat : hillMat2);
      m.position.set(p.x, h.h / 2 - 0.2, p.z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      this.hillSpots.push({ p, r: h.r });
    });

    // 地區名稱標籤（行政區）
    const centers = {};
    for (const t of this.tiles) {
      if (!t.district) continue;
      (centers[t.district] ||= []).push(t.pos);
    }
    this.districtLabels = {};
    for (const [id, arr] of Object.entries(centers)) {
      const c = arr.reduce((a, b) => a.clone().add(b), new THREE.Vector3()).divideScalar(arr.length);
      // 往市中心內側偏移，避免與格子重疊
      const toCenter = new THREE.Vector3(0, 0, 5).sub(c).setY(0).normalize().multiplyScalar(7);
      c.add(toCenter);
      const el = document.createElement('div');
      el.className = 'district-label';
      el.textContent = DISTRICTS[id].name;
      el.style.setProperty('--dc', DISTRICTS[id].color);
      const obj = new CSS2DObject(el);
      obj.position.set(c.x, 0.5, c.z);
      this.scene.add(obj);
      this.districtLabels[id] = el;
    }
  }

  #ribbon(curve, width, y, mat, segs = 200, closed = false) {
    const pts = curve.getSpacedPoints(segs);
    const verts = [];
    const idx = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const t = b.clone().sub(a).setY(0).normalize();
      const nrm = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(width / 2);
      verts.push(pts[i].x + nrm.x, y, pts[i].z + nrm.z, pts[i].x - nrm.x, y, pts[i].z - nrm.z);
      if (i < pts.length - 1 || closed) {
        const j = (i + 1) % pts.length;
        idx.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    return m;
  }

  #buildBoard() {
    // 道路
    const roadMat = new THREE.MeshLambertMaterial({ color: '#55595f' });
    const loopCurve = new THREE.CatmullRomCurve3(this.tiles.map((t) => t.pos.clone()), true, 'centripetal');
    this.scene.add(this.#ribbon(loopCurve, 1.6, 0.05, roadMat, 600, true));
    const dashMat = new THREE.MeshBasicMaterial({ color: '#f5f5f5' });
    this.scene.add(this.#ribbon(loopCurve, 0.12, 0.07, dashMat, 600, true));

    const sideGeo = new THREE.CylinderGeometry(TILE_R, TILE_R + 0.15, 0.5, 6);
    const ringGeo = new THREE.TorusGeometry(TILE_R - 0.25, 0.16, 8, 6);

    for (const t of this.tiles) {
      const group = new THREE.Group();
      group.position.copy(t.pos);
      group.rotation.y = Math.atan2(t.dir.x, t.dir.z);

      let topColor = '#fafafa', sideColor = '#bdbdbd';
      if (t.kind === 'property') { sideColor = DISTRICTS[t.district].color; topColor = '#fffdf6'; }
      else if (t.kind === 'event') { topColor = EVENT_TYPES[t.type].color; sideColor = '#eeeeee'; }
      else if (t.kind === 'start') { topColor = '#ffd54f'; sideColor = '#ff8f00'; }

      const mats = [
        new THREE.MeshLambertMaterial({ color: sideColor }),
        new THREE.MeshLambertMaterial({ color: topColor }),
        new THREE.MeshLambertMaterial({ color: sideColor }),
      ];
      const tile = new THREE.Mesh(sideGeo, mats);
      tile.position.y = 0.25;
      tile.castShadow = true;
      tile.receiveShadow = true;
      tile.userData.tileIndex = t.index;
      group.add(tile);
      this.tileMeshes.push(tile);

      // 擁有者光環（預設隱藏）
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshLambertMaterial({ color: '#fff', emissive: '#000' }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.52;
      ring.visible = false;
      group.add(ring);
      t.ring = ring;

      // 高亮圈
      const hl = new THREE.Mesh(
        new THREE.RingGeometry(TILE_R + 0.3, TILE_R + 0.7, 6),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
      );
      hl.rotation.x = -Math.PI / 2;
      hl.rotation.z = Math.PI / 6;
      hl.position.y = 0.08;
      group.add(hl);
      t.highlight = hl;

      this.scene.add(group);
      t.group = group;

      // 標籤
      const el = document.createElement('div');
      el.className = `tile-label ${t.kind}`;
      if (t.kind === 'event') {
        el.innerHTML = `<span class="ico">${EVENT_TYPES[t.type].icon}</span><span class="nm">${t.name}</span>`;
      } else if (t.kind === 'start') {
        el.innerHTML = `<span class="ico">🏛️</span><span class="nm">${t.name}</span><span class="sub">起點・領補助</span>`;
      } else {
        el.innerHTML = `<span class="nm">${t.name}</span><span class="sub" style="--dc:${DISTRICTS[t.district].color}">${DISTRICTS[t.district].name}・${t.price}萬</span>`;
      }
      el.addEventListener('click', () => this.onTileClick?.(t.index));
      const label = new CSS2DObject(el);
      label.position.set(t.pos.x, 1.6, t.pos.z);
      this.scene.add(label);
      t.labelEl = el;

      if (t.id === 'tp101') this.#build101(t);
      if (t.kind === 'start') this.#buildCityHall(t);
    }
  }

  #build101(t) {
    const g = new THREE.Group();
    const glass = new THREE.MeshPhongMaterial({ color: '#5fa8a0', shininess: 90, specular: '#e0fff8' });
    const frame = new THREE.MeshLambertMaterial({ color: '#2f5f5a' });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, 2.6), glass);
    base.position.y = 1.5;
    g.add(base);
    let y = 3;
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.05, 1.6, 4, 1), glass);
      seg.rotation.y = Math.PI / 4;
      seg.position.y = y + 0.8;
      g.add(seg);
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.5), frame);
      band.position.y = y + 0.02;
      g.add(band);
      y += 1.6;
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 1.4, 4), glass);
    top.rotation.y = Math.PI / 4;
    top.position.y = y + 0.7;
    g.add(top);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 3, 6), frame);
    spire.position.y = y + 2.9;
    g.add(spire);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const p = t.pos.clone().add(t.outward.clone().multiplyScalar(-5.5)).add(t.dir.clone().multiplyScalar(2));
    g.position.copy(p);
    this.scene.add(g);
  }

  #buildCityHall(t) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: '#efe6d2' });
    const roof = new THREE.MeshLambertMaterial({ color: '#8d6e63' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 2), mat);
    body.position.y = 1.2;
    g.add(body);
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 4), mat);
    wingL.position.set(-2.1, 1.2, 1.5);
    g.add(wingL);
    const wingR = wingL.clone();
    wingR.position.x = 2.1;
    g.add(wingR);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4, 1.6), mat);
    tower.position.y = 2;
    g.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1, 4), roof);
    cap.rotation.y = Math.PI / 4;
    cap.position.y = 4.5;
    g.add(cap);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4), new THREE.MeshLambertMaterial({ color: '#999' }));
    pole.position.set(0, 6, 0);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshLambertMaterial({ color: '#e53935', side: THREE.DoubleSide }));
    flag.position.set(0.5, 6.8, 0);
    g.add(flag);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.copy(t.pos.clone().add(t.outward.clone().multiplyScalar(5)));
    g.lookAt(t.pos.x, 0, t.pos.z);
    this.scene.add(g);
  }

  #buildCity() {
    // 以 InstancedMesh 隨機生成城市建築
    const poly = outlinePoints2D();
    const rnd = seededRandom(2024);
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const MAX = 1400;
    const inst = new THREE.InstancedMesh(box, mat, MAX);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const palette = ['#e8e4dc', '#d7d2c8', '#c9cfd6', '#b8c4cc', '#e6d9c3', '#d9c7b0', '#f1ece2', '#a9b6bf'];
    const col = new THREE.Color();
    const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const center = new THREE.Vector3(0, 0, 0);
    let count = 0, guard = 0;
    while (count < MAX && guard++ < 30000) {
      const x = minX + rnd() * (maxX - minX);
      const z = minZ + rnd() * (maxZ - minZ);
      if (!pointInPolygon(x, z, poly)) continue;
      const v = new THREE.Vector3(x, 0, z);
      if (this.tiles.some((t) => t.pos.distanceToSquared(v) < 30)) continue;
      if (this.riverSamples.some((s) => s.p.distanceToSquared(v) < (s.w / 2 + 0.9) ** 2)) continue;
      if (this.hillSpots.some((h) => h.p.distanceToSquared(v) < (h.r + 0.5) ** 2)) continue;
      // 越靠近市中心（信義、中山）越高
      const dCenter = v.distanceTo(center);
      const tall = Math.max(0.4, 1 - dCenter / 70);
      const h = 0.6 + rnd() * rnd() * 7 * tall;
      const w = 0.7 + rnd() * 1.1, d = 0.7 + rnd() * 1.1;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
      m.compose(v, q, new THREE.Vector3(w, h, d));
      inst.setMatrixAt(count, m);
      inst.setColorAt(count, col.set(palette[Math.floor(rnd() * palette.length)]));
      count++;
    }
    inst.count = count;
    this.scene.add(inst);

    // 行道樹
    const treeGeo = new THREE.IcosahedronGeometry(0.6, 0);
    treeGeo.translate(0, 0.9, 0);
    const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ color: '#5b9a46', flatShading: true }), 500);
    trees.castShadow = true;
    let tc = 0;
    guard = 0;
    while (tc < 500 && guard++ < 20000) {
      const x = minX - 20 + rnd() * (maxX - minX + 40);
      const z = minZ - 20 + rnd() * (maxZ - minZ + 40);
      const v = new THREE.Vector3(x, 0, z);
      const inside = pointInPolygon(x, z, poly);
      if (inside && rnd() < 0.7) continue;
      if (this.tiles.some((t) => t.pos.distanceToSquared(v) < 12)) continue;
      if (this.riverSamples.some((s) => s.p.distanceToSquared(v) < (s.w / 2 + 0.5) ** 2)) continue;
      const s = 0.7 + rnd() * 1.2;
      m.compose(v, q.identity(), new THREE.Vector3(s, s, s));
      trees.setMatrixAt(tc++, m);
    }
    trees.count = tc;
    this.scene.add(trees);
  }

  // ---------- 骰子 ----------
  #buildDice() {
    const faceTex = (n) => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#fffaf0';
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#ddd';
      g.lineWidth = 6;
      g.strokeRect(3, 3, 122, 122);
      g.fillStyle = n === 1 || n === 4 ? '#d32f2f' : '#222';
      const P = { a: 32, b: 64, c: 96 };
      const spots = {
        1: [[P.b, P.b]], 2: [[P.a, P.a], [P.c, P.c]], 3: [[P.a, P.a], [P.b, P.b], [P.c, P.c]],
        4: [[P.a, P.a], [P.c, P.a], [P.a, P.c], [P.c, P.c]],
        5: [[P.a, P.a], [P.c, P.a], [P.b, P.b], [P.a, P.c], [P.c, P.c]],
        6: [[P.a, P.a], [P.c, P.a], [P.a, P.b], [P.c, P.b], [P.a, P.c], [P.c, P.c]],
      };
      for (const [x, y] of spots[n]) {
        g.beginPath();
        g.arc(x, y, n === 1 ? 16 : 11, 0, Math.PI * 2);
        g.fill();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    // BoxGeometry 面順序：+x, -x, +y, -y, +z, -z
    this.diceFaces = [1, 6, 2, 5, 3, 4];
    const mats = this.diceFaces.map((n) => new THREE.MeshLambertMaterial({ map: faceTex(n) }));
    const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    this.dice = [new THREE.Mesh(geo, mats), new THREE.Mesh(geo, mats)];
    this.dice.forEach((d) => { d.castShadow = true; d.visible = false; this.scene.add(d); });
  }

  #faceUpQuat(value) {
    const e = new THREE.Euler();
    switch (value) {
      case 1: e.set(0, 0, Math.PI / 2); break;
      case 6: e.set(0, 0, -Math.PI / 2); break;
      case 2: e.set(0, 0, 0); break;
      case 5: e.set(Math.PI, 0, 0); break;
      case 3: e.set(-Math.PI / 2, 0, 0); break;
      case 4: e.set(Math.PI / 2, 0, 0); break;
    }
    const q = new THREE.Quaternion().setFromEuler(e);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.2);
    return yaw.multiply(q);
  }

  async rollDice(values, near) {
    // 在鏡頭與目標之間丟骰子
    const camDir = this.camera.position.clone().sub(this.controls.target).setY(0).normalize();
    const side = new THREE.Vector3(camDir.z, 0, -camDir.x);
    const base = near.clone().add(camDir.multiplyScalar(5));
    const dur = 1100;
    const jobs = this.dice.map((d, i) => {
      const final = this.#faceUpQuat(values[i]);
      const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const spins = 3 + Math.random() * 2;
      const end = base.clone().add(side.clone().multiplyScalar(i === 0 ? -1.2 : 1.2));
      const startPos = end.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 9, (Math.random() - 0.5) * 3));
      d.visible = true;
      return this.#animate(dur, (k) => {
        const e = easeOut(k);
        const rem = (1 - e) * spins * Math.PI * 2;
        d.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(axis, rem).multiply(final));
        d.position.lerpVectors(startPos, end, Math.min(1, k * 1.6));
        const bounce = Math.abs(Math.cos(k * Math.PI * 2.5)) * Math.pow(1 - k, 2) * 4;
        d.position.y = 0.7 + (k < 0.4 ? (1 - k / 0.4) * 8 : 0) + bounce;
      });
    });
    await Promise.all(jobs);
    await sleep(650);
  }

  hideDice() {
    this.dice.forEach((d) => { d.visible = false; });
  }

  // ---------- 棋子 ----------
  addToken(player, slot) {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color: player.color, shininess: 60 });
    const baseMat = new THREE.MeshLambertMaterial({ color: '#333' });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.25, 20), baseMat);
    base.position.y = 0.12;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 1.3, 20), mat);
    body.position.y = 0.9;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16), mat);
    head.position.y = 1.75;
    // 彩帶（選舉背帶）
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 6, 20), new THREE.MeshLambertMaterial({ color: '#fff' }));
    sash.position.y = 0.95;
    sash.rotation.set(Math.PI / 2.6, 0, 0.5);
    g.add(base, body, head, sash);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    const el = document.createElement('div');
    el.className = 'token-label';
    el.style.setProperty('--pc', player.color);
    el.textContent = player.name;
    const label = new CSS2DObject(el);
    label.position.y = 2.7;
    g.add(label);

    this.scene.add(g);
    this.tokens.set(player.id, { group: g, slot, label: el });
    this.placeToken(player.id, player.position);
  }

  tokenSpot(tileIndex, slot) {
    const t = this.tiles[tileIndex];
    const offs = [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]][slot % 4];
    const side = new THREE.Vector3(t.dir.z, 0, -t.dir.x);
    return t.pos.clone()
      .add(t.dir.clone().multiplyScalar(offs[0]))
      .add(side.multiplyScalar(offs[1]))
      .setY(0.5);
  }

  placeToken(id, tileIndex) {
    const tok = this.tokens.get(id);
    tok.group.position.copy(this.tokenSpot(tileIndex, tok.slot));
  }

  async moveToken(id, path, onStep) {
    const tok = this.tokens.get(id);
    for (const idx of path) {
      const from = tok.group.position.clone();
      const to = this.tokenSpot(idx, tok.slot);
      const t = this.tiles[idx];
      tok.group.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      await this.#animate(230, (k) => {
        tok.group.position.lerpVectors(from, to, k);
        tok.group.position.y = 0.5 + Math.sin(k * Math.PI) * 1.4;
      });
      this.pulseTile(idx);
      onStep?.(idx, t);
    }
  }

  async teleportToken(id, tileIndex) {
    const tok = this.tokens.get(id);
    const g = tok.group;
    await this.#animate(300, (k) => { g.scale.setScalar(1 - k); g.position.y = 0.5 + k * 3; });
    this.placeToken(id, tileIndex);
    await this.#animate(300, (k) => { g.scale.setScalar(k); });
    g.scale.setScalar(1);
  }

  setActiveToken(id) {
    for (const [pid, tok] of this.tokens) tok.label.classList.toggle('active', pid === id);
  }

  // ---------- 競選辦公室 ----------
  setOffice(tileIndex, player, level) {
    const t = this.tiles[tileIndex];
    const old = this.offices.get(tileIndex);
    if (old) this.scene.remove(old);
    t.ring.visible = !!player;
    if (!player) { this.offices.delete(tileIndex); return; }
    t.ring.material.color.set(player.color);
    t.ring.material.emissive.set(player.color).multiplyScalar(0.35);

    const g = new THREE.Group();
    const wall = new THREE.MeshLambertMaterial({ color: '#f5f5f5' });
    const accent = new THREE.MeshLambertMaterial({ color: player.color });
    const h = 0.8 + level * 0.9;
    const main = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.4), wall);
    main.position.y = h / 2;
    g.add(main);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.25, 1.55), accent);
    roof.position.y = h + 0.12;
    g.add(roof);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.45, 1.42), accent);
    banner.position.y = h * 0.55;
    g.add(banner);
    if (level >= 3) {
      const stage = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 1.6), accent);
      stage.position.set(0, 0.15, 1.7);
      g.add(stage);
      for (const sx of [-1.1, 1.1]) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), new THREE.MeshLambertMaterial({ color: '#222' }));
        sp.position.set(sx, 0.9, 1.7);
        g.add(sp);
      }
    }
    if (level >= 4) {
      const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), accent);
      balloon.position.set(0, h + 3, 0);
      balloon.userData.float = true;
      g.add(balloon);
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.5), wall);
      string.position.set(0, h + 1.4, 0);
      g.add(string);
    }
    // 旗幟
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6), new THREE.MeshLambertMaterial({ color: '#888' }));
    pole.position.set(0.6, h + 0.9, 0.5);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshLambertMaterial({ color: player.color, side: THREE.DoubleSide }));
    flag.position.set(1.0, h + 1.45, 0.5);
    flag.userData.flag = true;
    g.add(flag);

    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.copy(t.pos.clone().add(t.outward.clone().multiplyScalar(3.3)));
    g.lookAt(t.pos.x, 0, t.pos.z);
    this.scene.add(g);
    this.offices.set(tileIndex, g);
    g.scale.setScalar(0.01);
    this.#animate(500, (k) => {
      const s = k < 0.7 ? (k / 0.7) * 1.15 : 1.15 - ((k - 0.7) / 0.3) * 0.15;
      g.scale.setScalar(Math.max(0.01, s));
    });
  }

  // ---------- 特效 ----------
  pulseTile(idx, color = '#ffffff') {
    const hl = this.tiles[idx].highlight;
    hl.material.color.set(color);
    this.#animate(450, (k) => { hl.material.opacity = 0.8 * (1 - k); });
  }

  highlightTiles(indices, color) {
    for (const t of this.tiles) {
      const on = indices.includes(t.index);
      t.highlight.material.color.set(color || '#fff');
      t.highlight.material.opacity = on ? 0.75 : 0;
    }
  }

  popText(pos, text, color = '#fff') {
    const el = document.createElement('div');
    el.className = 'pop-text';
    el.style.color = color;
    el.textContent = text;
    const obj = new CSS2DObject(el);
    obj.position.copy(pos).setY(3);
    this.scene.add(obj);
    this.#animate(1500, (k) => {
      obj.position.y = 3 + k * 3;
      el.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
    }).then(() => { this.scene.remove(obj); el.remove(); });
  }

  confetti(pos, colors) {
    const group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(0.25, 0.4);
    const parts = [];
    for (let i = 0; i < 120; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }));
      m.position.copy(pos).setY(2);
      const v = new THREE.Vector3((Math.random() - 0.5) * 10, 8 + Math.random() * 8, (Math.random() - 0.5) * 10);
      parts.push({ m, v, r: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0) });
      group.add(m);
    }
    this.scene.add(group);
    let last = 0;
    this.#animate(3000, (k) => {
      const dt = (k - last) * 3;
      last = k;
      for (const p of parts) {
        p.v.y -= 12 * dt;
        p.v.multiplyScalar(0.985);
        p.m.position.addScaledVector(p.v, dt);
        p.m.rotation.x += p.r.x * dt;
        p.m.rotation.y += p.r.y * dt;
      }
    }).then(() => this.scene.remove(group));
  }

  // ---------- 鏡頭 ----------
  focusOn(pos, distance = 38) {
    this.follow = { pos: pos.clone(), distance };
  }

  followToken(id) {
    const tok = this.tokens.get(id);
    if (!tok) return;
    const cur = this.camera.position.distanceTo(this.controls.target);
    // 只有在鏡頭太遠時才拉近；之後保留使用者自己調整的距離
    this.follow = { obj: tok.group, distance: cur > 70 ? 52 : null };
  }

  overview() {
    this.follow = { pos: new THREE.Vector3(0, 0, 5), distance: 160 };
  }

  stopFollow() {
    this.follow = null;
  }

  // ---------- 動畫迴圈 ----------
  #animate(duration, fn) {
    return new Promise((resolve) => {
      this.animations.add({ start: performance.now(), duration: duration / SPEED, fn, resolve });
    });
  }

  #tick() {
    const now = performance.now();
    const dt = this.clock.getDelta();
    for (const a of [...this.animations]) {
      const k = Math.min(1, (now - a.start) / a.duration);
      a.fn(k);
      if (k >= 1) { this.animations.delete(a); a.resolve(); }
    }

    if (this.follow) {
      const target = this.follow.obj ? this.follow.obj.position.clone().setY(0) : this.follow.pos;
      const before = this.controls.target.clone();
      this.controls.target.lerp(target, 0.07);
      const delta = this.controls.target.clone().sub(before);
      this.camera.position.add(delta);
      if (this.follow.distance) {
        const off = this.camera.position.clone().sub(this.controls.target);
        const len = off.length();
        const want = THREE.MathUtils.lerp(len, this.follow.distance, 0.05);
        this.camera.position.copy(this.controls.target).add(off.setLength(want));
        if (Math.abs(want - this.follow.distance) < 0.5) {
          if (this.follow.obj) this.follow.distance = null;
          else if (this.controls.target.distanceTo(this.follow.pos) < 0.3) this.follow = null;
        }
      }
    }

    const time = now / 1000;
    for (const g of this.offices.values()) {
      g.traverse((o) => {
        if (o.userData.flag) o.rotation.y = Math.sin(time * 3 + g.position.x) * 0.35;
        if (o.userData.float) o.position.y = o.parent.children[0].geometry.parameters.height + 3 + Math.sin(time * 2) * 0.25;
      });
    }

    this.controls.update(dt);
    const far = this.camera.position.distanceTo(this.controls.target) > 85;
    if (far !== this.isFar) {
      this.isFar = far;
      this.labelRenderer.domElement.classList.toggle('far', far);
    }
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  #bindEvents() {
    window.addEventListener('resize', () => {
      const w = this.container.clientWidth, h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.labelRenderer.setSize(w, h);
    });

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    const el = this.renderer.domElement;
    const layer = el;
    layer.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    layer.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      const hit = ray.intersectObjects(this.tileMeshes, false)[0];
      if (hit) this.onTileClick?.(hit.object.userData.tileIndex);
    });
    // 使用者手動操作鏡頭時停止跟隨
    layer.addEventListener('wheel', () => { if (this.follow && !this.follow.obj) this.follow = null; }, { passive: true });
  }

  levelName(level) {
    return LEVEL_NAMES[level];
  }
}
