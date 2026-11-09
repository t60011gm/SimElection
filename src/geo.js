// 地理投影與棋盤配置
import * as THREE from 'three';
import { LANDMARKS, EVENT_PATTERN, EVENT_TYPES, DISTRICTS } from './data.js';

const CENTER = { lat: 25.06, lng: 121.545 };
const SCALE = 600; // 每 1 度經緯度對應的場景單位

export function project(lat, lng) {
  const x = (lng - CENTER.lng) * SCALE * Math.cos((CENTER.lat * Math.PI) / 180);
  const z = -(lat - CENTER.lat) * SCALE;
  return new THREE.Vector3(x, 0, z);
}

// 台北市大略行政界線（經緯度）
export const TAIPEI_OUTLINE = [
  [25.2100, 121.5700], [25.1950, 121.6050], [25.1600, 121.6150], [25.1150, 121.6300],
  [25.0950, 121.6550], [25.0700, 121.6650], [25.0400, 121.6650], [25.0200, 121.6350],
  [24.9900, 121.6200], [24.9600, 121.6150], [24.9550, 121.5800], [24.9750, 121.5550],
  [24.9950, 121.5350], [25.0150, 121.5150], [25.0250, 121.4950], [25.0450, 121.4900],
  [25.0750, 121.5000], [25.1050, 121.4550], [25.1250, 121.4500], [25.1500, 121.4750],
  [25.1800, 121.5000], [25.2050, 121.5300],
];

// 主要河川（淡水河—新店溪、基隆河）
export const RIVERS = [
  { width: 2.6, points: [
    [25.1800, 121.4150], [25.1500, 121.4350], [25.1200, 121.4580], [25.0950, 121.4800],
    [25.0700, 121.4980], [25.0500, 121.4930], [25.0300, 121.4930], [25.0150, 121.5100],
    [25.0000, 121.5300], [24.9800, 121.5400], [24.9500, 121.5420],
  ] },
  { width: 1.6, points: [
    [25.1200, 121.4580], [25.1050, 121.4900], [25.0920, 121.5150], [25.0820, 121.5300],
    [25.0760, 121.5500], [25.0780, 121.5700], [25.0700, 121.5850], [25.0620, 121.6000],
    [25.0560, 121.6200], [25.0620, 121.6450], [25.0750, 121.6800],
  ] },
];

// 山丘（陽明山、四獸山、貓空、內湖山區）
export const HILLS = [
  { lat: 25.175, lng: 121.545, r: 9, h: 9 },
  { lat: 25.190, lng: 121.575, r: 8, h: 7 },
  { lat: 25.160, lng: 121.515, r: 7, h: 6 },
  { lat: 25.150, lng: 121.590, r: 6, h: 5 },
  { lat: 25.110, lng: 121.605, r: 6, h: 4.5 },
  { lat: 25.025, lng: 121.590, r: 5, h: 4 },
  { lat: 25.010, lng: 121.615, r: 5, h: 4 },
  { lat: 24.972, lng: 121.605, r: 6, h: 5 },
  { lat: 24.985, lng: 121.560, r: 4, h: 3 },
];

/**
 * 依地標順序建立平滑迴圈，再於地標之間均勻插入事件格。
 * 回傳 tiles 陣列：{ index, kind:'start'|'property'|'event', ..., pos:Vector3, dir:Vector3 }
 */
export function buildBoard(targetTiles = 44) {
  const anchors = LANDMARKS.map((l) => project(l.lat, l.lng));
  const curve = new THREE.CatmullRomCurve3(anchors, true, 'centripetal', 0.5);
  const n = anchors.length;

  // 細密取樣以計算弧長
  const SAMPLES = 4000;
  const pts = [];
  const cum = [0];
  for (let i = 0; i <= SAMPLES; i++) {
    pts.push(curve.getPoint(i / SAMPLES));
    if (i > 0) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  const total = cum[SAMPLES];
  const spacing = total / targetTiles;

  const arcAtT = (t) => {
    const f = t * SAMPLES;
    const i = Math.min(SAMPLES - 1, Math.floor(f));
    return cum[i] + (cum[i + 1] - cum[i]) * (f - i);
  };
  const pointAtArc = (s) => {
    s = ((s % total) + total) % total;
    let lo = 0, hi = SAMPLES;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < s) lo = mid; else hi = mid;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const k = (s - cum[lo]) / seg;
    return { p: pts[lo].clone().lerp(pts[hi], k), t: (lo + k) / SAMPLES };
  };

  const tiles = [];
  let ev = 0;
  for (let j = 0; j < n; j++) {
    const L = LANDMARKS[j];
    const s0 = arcAtT(j / n);
    const s1 = j === n - 1 ? total : arcAtT((j + 1) / n);
    tiles.push({
      kind: L.type === 'start' ? 'start' : 'property',
      ...L,
      arc: s0,
    });
    const count = Math.max(0, Math.round((s1 - s0) / spacing) - 1);
    for (let k = 1; k <= count; k++) {
      const type = EVENT_PATTERN[ev++ % EVENT_PATTERN.length];
      tiles.push({
        kind: 'event',
        type,
        name: EVENT_TYPES[type].name,
        arc: s0 + ((s1 - s0) * k) / (count + 1),
      });
    }
  }

  // 鬆弛：讓格子間距更平均，但地標不偏離真實位置太遠
  const N = tiles.length;
  const orig = tiles.map((t) => t.arc);
  for (let it = 0; it < 80; it++) {
    for (let i = 1; i < N; i++) {
      const prev = tiles[i - 1].arc;
      const next = i === N - 1 ? total : tiles[i + 1].arc;
      let a = tiles[i].arc + ((prev + next) / 2 - tiles[i].arc) * 0.5;
      if (tiles[i].kind !== 'event') {
        const lim = spacing * 0.45;
        a = Math.min(orig[i] + lim, Math.max(orig[i] - lim, a));
      }
      tiles[i].arc = a;
    }
  }

  tiles.forEach((t, i) => {
    t.index = i;
    const { p, t: u } = pointAtArc(t.arc);
    t.pos = p;
    const tan = curve.getTangent(u).setY(0).normalize();
    t.dir = tan;
    // 指向環外的法線（依迴圈方向）
    t.outward = new THREE.Vector3(tan.z, 0, -tan.x);
  });

  // 判斷外側方向：以多邊形中心為準
  const c = new THREE.Vector3();
  tiles.forEach((t) => c.add(t.pos));
  c.divideScalar(tiles.length);
  tiles.forEach((t) => {
    const away = t.pos.clone().sub(c);
    if (away.dot(t.outward) < 0) t.outward.negate();
  });

  return { tiles, curve, total };
}

export function outlineShape() {
  const shape = new THREE.Shape();
  TAIPEI_OUTLINE.forEach(([lat, lng], i) => {
    const p = project(lat, lng);
    // Shape 在 XY 平面，之後旋轉 -90° 到 XZ，所以 y = -z
    if (i === 0) shape.moveTo(p.x, -p.z);
    else shape.lineTo(p.x, -p.z);
  });
  shape.closePath();
  return shape;
}

export function outlinePoints2D() {
  return TAIPEI_OUTLINE.map(([lat, lng]) => {
    const p = project(lat, lng);
    return { x: p.x, z: p.z };
  });
}

export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, zi = poly[i].z, xj = poly[j].x, zj = poly[j].z;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function districtName(id) {
  return DISTRICTS[id]?.name ?? '';
}
