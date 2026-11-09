import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mockWorld, mockUI, makePlayers } from './helpers.js';

const { Game } = await import('../../src/game.js');
const { buildBoard } = await import('../../src/geo.js');
const { RULES, DISTRICTS } = await import('../../src/data.js');
const { tiles } = buildBoard(44);

function newGame(n = 3, opts = {}) {
  const ui = mockUI();
  const game = new Game({ world: mockWorld(), ui, tiles, players: makePlayers(n, opts), maxRounds: 3 });
  return { game, ui };
}

test('初始各區聲量平均、民調總和 100%', () => {
  const { game } = newGame(4);
  const pct = game.pollPercent();
  assert.equal(Math.round(pct.reduce((a, b) => a + b, 0)), 100);
  pct.forEach((x) => assert.ok(Math.abs(x - 25) < 1e-9));
});

test('經過市政府獲得補助', async () => {
  const { game } = newGame(2);
  const p = game.players[0];
  p.position = tiles.length - 2;
  await game.moveSteps(p, 4);
  assert.equal(p.position, 2);
  assert.equal(p.funds, 3000 + RULES.passStartBonus);
});

test('設立辦公室：扣款、登記擁有者、聲量增加', async () => {
  const { game } = newGame(2);
  const p = game.players[0];
  const t = tiles.find((x) => x.id === 'ximen');
  p.position = t.index;
  await game.resolveTile(p);
  assert.equal(p.funds, 3000 - t.price);
  assert.deepEqual(game.owners[t.index], { owner: 0, level: 1 });
  assert.equal(game.influence.wanhua[0], RULES.baseInfluence + RULES.buyInfluence);
});

test('再次停留可升級，最高到 4 級', async () => {
  const { game } = newGame(2);
  const p = game.players[0];
  p.funds = 99999;
  const t = tiles.find((x) => x.id === 'cks');
  p.position = t.index;
  for (let i = 0; i < 6; i++) await game.resolveTile(p);
  assert.equal(game.owners[t.index].level, RULES.maxLevel);
});

test('停在對手地盤：付反制費只扣錢', async () => {
  const { game } = newGame(2);
  const [a, b] = game.players;
  const t = tiles.find((x) => x.id === 'tp101');
  game.owners[t.index] = { owner: 1, level: 2 };
  a.position = t.index;
  const before = game.influence.xinyi.slice();
  await game.resolveTile(a);
  const cost = Math.round((t.price * RULES.counterCostRatio * 2) / 10) * 10;
  assert.equal(a.funds, 3000 - cost);
  assert.deepEqual(game.influence.xinyi, before);
  assert.equal(b.funds, 3000);
});

test('停在對手地盤且沒錢：聲量被拉走', async () => {
  const { game } = newGame(2);
  const [a] = game.players;
  a.funds = 0;
  const t = tiles.find((x) => x.id === 'tp101');
  game.owners[t.index] = { owner: 1, level: 1 };
  a.position = t.index;
  await game.resolveTile(a);
  assert.equal(game.influence.xinyi[0], RULES.baseInfluence - RULES.counterLossPerLevel);
  assert.equal(game.influence.xinyi[1], RULES.baseInfluence + RULES.counterLossPerLevel);
});

test('聲量最低為 1，不會變成負數', () => {
  const { game } = newGame(2);
  game.addInfluence(0, 'daan', -999);
  assert.equal(game.influence.daan[0], 1);
});

test('每週結束時辦公室累積聲量', () => {
  const { game } = newGame(2);
  const t = tiles.find((x) => x.id === 'zoo');
  game.owners[t.index] = { owner: 0, level: 3 };
  game.endOfRound();
  assert.equal(game.influence.wenshan[0], RULES.baseInfluence + RULES.passivePerLevel * 3);
  assert.equal(game.round, 2);
});

test('捷運站會移動到下一個捷運站', async () => {
  const { game } = newGame(2);
  const p = game.players[0];
  const [m1, m2] = game.mrtTiles;
  p.position = m1;
  await game.resolveTile(p);
  assert.equal(p.position, m2);
});

test('完整對局：跑完所有週數並產生當選人', async () => {
  for (let run = 0; run < 5; run++) {
    const { game, ui } = newGame(4, { allAI: true });
    await game.run();
    assert.ok(game.over);
    assert.ok(ui.election, '應該要開票');
    const { results, totals, winner } = ui.election;
    assert.equal(results.length, Object.keys(DISTRICTS).length);
    assert.equal(totals[winner], Math.max(...totals));
    for (const p of game.players) assert.ok(p.funds >= 0);
  }
});
