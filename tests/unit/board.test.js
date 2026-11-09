import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard } from '../../src/geo.js';
import { LANDMARKS, DISTRICTS, EVENT_TYPES } from '../../src/data.js';

const { tiles } = buildBoard(44);

test('棋盤起點是台北市政府', () => {
  assert.equal(tiles[0].kind, 'start');
  assert.equal(tiles[0].name, '台北市政府');
});

test('每個地標都在棋盤上且順序不變', () => {
  const names = tiles.filter((t) => t.kind !== 'event').map((t) => t.name);
  assert.deepEqual(names, LANDMARKS.map((l) => l.name));
});

test('12 個行政區都至少有一個地標', () => {
  const ds = new Set(tiles.filter((t) => t.district).map((t) => t.district));
  assert.deepEqual([...ds].sort(), Object.keys(DISTRICTS).sort());
});

test('格子索引連續、事件種類有效', () => {
  tiles.forEach((t, i) => assert.equal(t.index, i));
  for (const t of tiles.filter((x) => x.kind === 'event')) assert.ok(EVENT_TYPES[t.type], t.type);
});

test('至少有兩個捷運站', () => {
  assert.ok(tiles.filter((t) => t.type === 'mrt').length >= 2);
});

test('相鄰格子間距合理（不重疊、不過遠）', () => {
  for (let i = 0; i < tiles.length; i++) {
    const d = tiles[i].pos.distanceTo(tiles[(i + 1) % tiles.length].pos);
    assert.ok(d > 4.5 && d < 11, `格 ${i} 與下一格距離 ${d.toFixed(2)}`);
  }
});
