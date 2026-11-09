import { World } from './scene.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { buildBoard } from './geo.js';
import { PARTY_PRESETS, AI_NAMES, RULES } from './data.js';

const board = buildBoard(44);
const world = new World(document.getElementById('app'), board);
world.overview();
const ui = new UI();

// ---------- 開始畫面 ----------
let partyIdx = 0;
const pick = document.getElementById('party-pick');
pick.innerHTML = PARTY_PRESETS.map((p, i) => `
  <button class="party ${i === 0 ? 'sel' : ''}" data-i="${i}" style="--pc:${p.color}">
    <i></i>${p.party}
  </button>`).join('');
pick.querySelectorAll('.party').forEach((b) => {
  b.onclick = () => {
    partyIdx = +b.dataset.i;
    pick.querySelectorAll('.party').forEach((x) => x.classList.toggle('sel', x === b));
  };
});

// 開始畫面時讓鏡頭緩慢環繞
let spinning = true;
(function spin() {
  if (!spinning) return;
  const c = world.camera.position, t = world.controls.target;
  const a = 0.0012;
  const x = c.x - t.x, z = c.z - t.z;
  c.x = t.x + x * Math.cos(a) - z * Math.sin(a);
  c.z = t.z + x * Math.sin(a) + z * Math.cos(a);
  requestAnimationFrame(spin);
})();

document.getElementById('btn-start').onclick = () => {
  spinning = false;
  const name = document.getElementById('in-name').value.trim() || '你';
  const aiCount = +document.getElementById('in-ai').value;
  const maxRounds = +document.getElementById('in-rounds').value;

  const me = PARTY_PRESETS[partyIdx];
  const others = PARTY_PRESETS.filter((_, i) => i !== partyIdx);
  const names = [...AI_NAMES].sort(() => Math.random() - 0.5);
  const players = [{ name, party: me.party, color: me.color, isAI: false }];
  for (let i = 0; i < aiCount; i++) {
    players.push({ name: names[i], party: others[i].party, color: others[i].color, isAI: true });
  }
  players.forEach((p, i) => Object.assign(p, {
    id: i, funds: RULES.startFunds, position: 0, skip: 0, offices: [],
  }));

  document.getElementById('start-screen').classList.add('hide');
  document.getElementById('hud').hidden = false;

  players.forEach((p, i) => world.addToken(p, i));
  const game = new Game({ world, ui, tiles: board.tiles, players, maxRounds });
  world.onTileClick = (idx) => ui.showTileInfo(game, idx);
  window.__game = game; // 方便除錯

  document.getElementById('cam-follow').onclick = () => world.followToken(game.current.id);
  document.getElementById('cam-overview').onclick = () => world.overview();
  if (window.innerWidth < 760) document.getElementById('district-panel').classList.add('collapsed');
  document.getElementById('toggle-panel').onclick = () =>
    document.getElementById('district-panel').classList.toggle('collapsed');

  ui.banner('選戰開打！', `${maxRounds} 週後投票，目標：台北市長`);
  game.run();
};
