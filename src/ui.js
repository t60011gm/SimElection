// HTML 介面：HUD、對話框、事件卡、開票畫面
import { DISTRICTS, EVENT_TYPES, LEVEL_NAMES, RULES } from './data.js';

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => n.toLocaleString('zh-TW');

export class UI {
  constructor() {
    this.logEl = $('#log-list');
    this.modalRoot = $('#modal-root');
    this.game = null;
  }

  tag(p) {
    return `<span class="tag" style="--pc:${p.color}">${p.name}</span>`;
  }

  log(html) {
    const li = document.createElement('li');
    li.innerHTML = html;
    this.logEl.prepend(li);
    while (this.logEl.children.length > 80) this.logEl.lastChild.remove();
  }

  // ---------- HUD ----------
  update(game) {
    this.game = game;
    const left = Math.max(0, game.maxRounds - game.round + 1);
    $('#week').innerHTML = game.over
      ? '投票日'
      : `第 <b>${game.round}</b> / ${game.maxRounds} 週<small>距投票日 ${left} 週</small>`;

    const pct = game.pollPercent();
    const leader = game.leaderIndex();
    $('#players').innerHTML = game.players.map((p, i) => `
      <div class="pcard ${i === game.turn && !game.over ? 'active' : ''}" style="--pc:${p.color}">
        <div class="pc-head">
          <span class="dot"></span>
          <span class="pname">${p.name}${p.isAI ? '' : ' <em>（你）</em>'}</span>
          ${i === leader ? '<span class="crown" title="民調領先">👑</span>' : ''}
        </div>
        <div class="pc-party">${p.party}${p.skip ? '・<span class="warn">暫停中</span>' : ''}</div>
        <div class="pc-stats">
          <span title="競選經費">💰 ${fmt(p.funds)} 萬</span>
          <span title="辦公室數">🏢 ${p.offices.length}</span>
        </div>
        <div class="pc-poll"><div class="bar" style="width:${pct[i].toFixed(1)}%"></div><span>${pct[i].toFixed(1)}%</span></div>
      </div>`).join('');

    // 選區民調
    $('#district-list').innerHTML = Object.entries(DISTRICTS).map(([id, d]) => {
      const s = game.shares(id);
      const lead = game.districtLeader(id);
      const bars = s.map((x, i) => `<div style="width:${(x * 100).toFixed(1)}%;background:${game.players[i].color}" title="${game.players[i].name} ${(x * 100).toFixed(1)}%"></div>`).join('');
      return `<div class="drow">
        <span class="dname" style="--dc:${d.color}">${d.name}</span>
        <span class="dvoters">${d.voters}萬</span>
        <div class="dbar">${bars}</div>
        <span class="dlead">${lead >= 0 ? `<i style="background:${game.players[lead].color}"></i>` : '<i class="tie"></i>'}</span>
      </div>`;
    }).join('');
  }

  diceResult(a, b) {
    const el = $('#dice-result');
    el.textContent = `🎲 ${a} + ${b} = ${a + b}`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  banner(title, sub = '') {
    const el = $('#banner');
    el.innerHTML = `<h2>${title}</h2><p>${sub}</p>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  // ---------- 行動列 ----------
  waitAction(p, { canAd }) {
    const bar = $('#action-bar');
    bar.innerHTML = `
      <div class="turn-hint">輪到 ${this.tag(p)}</div>
      <button class="btn ghost" id="act-ad" ${canAd ? '' : 'disabled'} title="指定一區聲量 +${RULES.adInfluence}">📣 投放廣告 <small>${RULES.adCost} 萬</small></button>
      <button class="btn primary big" id="act-roll">🎲 擲骰子</button>`;
    bar.classList.add('show');
    return new Promise((resolve) => {
      const done = (v) => { bar.classList.remove('show'); window.removeEventListener('keydown', key); resolve(v); };
      const key = (e) => { if (e.code === 'Space' && !this.modalOpen) { e.preventDefault(); done('roll'); } };
      window.addEventListener('keydown', key);
      $('#act-roll').onclick = () => done('roll');
      $('#act-ad').onclick = () => done('ad');
    });
  }

  // ---------- 對話框 ----------
  #modal(html, cls = '') {
    const wrap = document.createElement('div');
    wrap.className = `modal-wrap ${cls}`;
    wrap.innerHTML = `<div class="modal">${html}</div>`;
    this.modalRoot.appendChild(wrap);
    this.modalOpen = true;
    requestAnimationFrame(() => wrap.classList.add('show'));
    return {
      el: wrap,
      close: () => {
        wrap.classList.remove('show');
        this.modalOpen = this.modalRoot.children.length > 1;
        setTimeout(() => wrap.remove(), 200);
      },
    };
  }

  choose({ title, text, options, tile }) {
    const head = tile ? this.#tileHeader(tile) : '';
    const m = this.#modal(`
      ${head}
      <h3>${title}</h3>
      <p class="mtext">${text}</p>
      <div class="opts">
        ${options.map((o, i) => `
          <button class="btn ${o.primary ? 'primary' : 'ghost'} opt" data-i="${i}" ${o.disabled ? 'disabled' : ''}>
            ${o.label}${o.desc ? `<small>${o.desc}</small>` : ''}
          </button>`).join('')}
      </div>`);
    return new Promise((resolve) => {
      m.el.querySelectorAll('.opt').forEach((b) => {
        b.onclick = () => { m.close(); resolve(options[+b.dataset.i].value); };
      });
    });
  }

  #tileHeader(t) {
    const d = DISTRICTS[t.district];
    return `<div class="tile-head" style="--dc:${d.color}"><span>${d.name}</span><span>選民約 ${d.voters} 萬</span></div>`;
  }

  chooseDistrict(game, { title, text, pi, noCancel }) {
    const rows = Object.entries(DISTRICTS).map(([id, d]) => {
      const s = game.shares(id)[pi] * 100;
      return `<button class="dpick" data-id="${id}" style="--dc:${d.color}">
        <b>${d.name}</b><span>${d.voters} 萬選民</span><span class="mine">你的支持 ${s.toFixed(1)}%</span>
      </button>`;
    }).join('');
    const m = this.#modal(`
      <h3>${title}</h3>
      <p class="mtext">${text}</p>
      <div class="dgrid">${rows}</div>
      ${noCancel ? '' : '<div class="opts"><button class="btn ghost" id="dcancel">取消</button></div>'}`, 'wide');
    return new Promise((resolve) => {
      m.el.querySelectorAll('.dpick').forEach((b) => {
        b.onclick = () => { m.close(); resolve(b.dataset.id); };
      });
      const c = m.el.querySelector('#dcancel');
      if (c) c.onclick = () => { m.close(); resolve(null); };
    });
  }

  async card(p, { icon, kind, title, text, effect }) {
    const html = `
      <div class="card-face">
        <div class="card-kind">${icon} ${kind}</div>
        <h3>${title}</h3>
        <p class="mtext">${text}</p>
        ${effect ? `<div class="card-effect">${effect}</div>` : ''}
        <div class="card-who">${this.tag(p)}</div>
      </div>
      ${p.isAI ? '' : '<div class="opts"><button class="btn primary" id="card-ok">確定</button></div>'}`;
    const m = this.#modal(html, 'card');
    if (p.isAI) {
      await sleep(1600);
      m.close();
      return;
    }
    await new Promise((resolve) => {
      const ok = m.el.querySelector('#card-ok');
      ok.focus();
      ok.onclick = () => { m.close(); resolve(); };
    });
  }

  pollModal(game) {
    const pct = game.pollPercent();
    const order = game.players.map((p, i) => ({ p, v: pct[i] })).sort((a, b) => b.v - a.v);
    const m = this.#modal(`
      <div class="card-kind">📊 民調中心</div>
      <h3>最新全市民調</h3>
      <div class="poll">
        ${order.map(({ p, v }) => `
          <div class="poll-row">
            <span class="tag" style="--pc:${p.color}">${p.name}</span>
            <div class="poll-bar"><div style="width:${v}%;background:${p.color}"></div></div>
            <b>${v.toFixed(1)}%</b>
          </div>`).join('')}
      </div>
      <p class="mtext small">誤差範圍 ±3%。民調領先者可獲得捐款；落後者可指定一區加強催票。</p>
      <div class="opts"><button class="btn primary" id="poll-ok">繼續</button></div>`);
    return new Promise((resolve) => {
      m.el.querySelector('#poll-ok').onclick = () => { m.close(); resolve(); };
    });
  }

  // ---------- 格子資訊 ----------
  showTileInfo(game, idx) {
    const t = game.tiles[idx];
    const box = $('#tile-info');
    let html = '';
    if (t.kind === 'event') {
      const e = EVENT_TYPES[t.type];
      html = `<h4>${e.icon} ${e.name}</h4><p>${e.desc}</p>`;
    } else if (t.kind === 'start') {
      html = `<h4>🏛️ 台北市政府（起點）</h4><p>每次經過可獲得政黨補助 ${RULES.passStartBonus} 萬；停留時召開記者會，全市聲量 +1。</p>`;
    } else {
      const d = DISTRICTS[t.district];
      const own = game.owners[idx];
      const s = game.shares(t.district);
      html = `<h4>${t.name}</h4>
        <div class="tile-head" style="--dc:${d.color}"><span>${d.name}</span><span>選民約 ${d.voters} 萬</span></div>
        <p>設立辦公室：${t.price} 萬<br>
        ${own ? `進駐：${this.tag(game.players[own.owner])}「${LEVEL_NAMES[own.level]}」(Lv.${own.level})` : '尚無候選人進駐'}</p>
        <div class="mini-poll">${game.players.map((p, i) => `<div><span class="tag" style="--pc:${p.color}">${p.name}</span> ${(s[i] * 100).toFixed(1)}%</div>`).join('')}</div>`;
    }
    box.innerHTML = `<button class="x" aria-label="關閉">×</button>${html}`;
    box.classList.add('show');
    box.querySelector('.x').onclick = () => box.classList.remove('show');
  }

  // ---------- 開票 ----------
  async showElection(game, results, totals, winner) {
    const root = $('#election');
    root.classList.add('show');
    const players = game.players;
    const running = players.map(() => 0);
    const grand = totals.reduce((a, b) => a + b, 0);

    root.innerHTML = `
      <div class="el-inner">
        <h2>🗳️ 台北市長選舉 開票中</h2>
        <div class="el-totals">
          ${players.map((p, i) => `
            <div class="el-cand" style="--pc:${p.color}">
              <div class="el-name">${p.name}<small>${p.party}</small></div>
              <div class="el-bar"><div class="fill" id="elbar-${i}"></div></div>
              <div class="el-num" id="elnum-${i}">0 票</div>
            </div>`).join('')}
        </div>
        <div class="el-grid" id="el-grid"></div>
        <div class="el-final" id="el-final"></div>
      </div>`;

    const grid = $('#el-grid');
    for (const r of results) {
      const d = DISTRICTS[r.d];
      r.votes.forEach((v, i) => { running[i] += v; });
      const w = players[r.winner];
      const cell = document.createElement('div');
      cell.className = 'el-cell';
      cell.style.setProperty('--pc', w.color);
      cell.innerHTML = `<b>${d.name}</b><span>${w.name}</span><small>${(r.votes[r.winner] / r.votes.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%</small>`;
      grid.appendChild(cell);
      game.world.districtLabels?.[r.d]?.style.setProperty('--dc', w.color);
      game.world.districtLabels?.[r.d]?.classList.add('won');
      const maxRun = Math.max(...running);
      running.forEach((v, i) => {
        $(`#elbar-${i}`).style.width = `${(v / Math.max(maxRun, 1)) * 100}%`;
        $(`#elnum-${i}`).textContent = `${fmt(v)} 票`;
      });
      await sleep(550);
    }

    const w = players[winner];
    const pct = (totals[winner] / grand) * 100;
    const won = !w.isAI;
    $('#el-final').innerHTML = `
      <div class="winner" style="--pc:${w.color}">
        <div class="medal">🏆</div>
        <div>
          <h3>${w.name}（${w.party}）當選台北市長！</h3>
          <p>得票 ${fmt(totals[winner])} 票，得票率 ${pct.toFixed(2)}%</p>
          <p class="verdict">${won ? '恭喜你！明天開始到市政府上班 🎉' : '很遺憾，這次差一點點……四年後再挑戰！'}</p>
        </div>
      </div>
      <div class="opts">
        <button class="btn ghost" id="el-hide">查看地圖</button>
        <button class="btn primary" id="el-again">再玩一次</button>
      </div>`;
    $('#el-again').onclick = () => location.reload();
    $('#el-hide').onclick = () => {
      root.classList.remove('show');
      $('#show-result').hidden = false;
    };
    $('#show-result').onclick = () => {
      root.classList.add('show');
      $('#show-result').hidden = true;
    };
  }
}
