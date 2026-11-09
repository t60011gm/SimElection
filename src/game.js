// 遊戲規則與流程
import {
  DISTRICTS, EVENT_TYPES, NEWS_CARDS, DEBATE_OPTIONS, RULES, LEVEL_NAMES,
} from './data.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (n) => Math.floor(Math.random() * n);
const DIST_IDS = Object.keys(DISTRICTS);

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Game {
  constructor({ world, ui, tiles, players, maxRounds }) {
    this.world = world;
    this.ui = ui;
    this.tiles = tiles;
    this.players = players;
    this.maxRounds = maxRounds;
    this.round = 1;
    this.turn = 0;
    this.owners = {}; // tileIndex -> { owner, level }
    this.influence = {};
    for (const d of DIST_IDS) this.influence[d] = players.map(() => RULES.baseInfluence);
    this.deck = shuffle([...NEWS_CARDS]);
    this.over = false;
    this.mrtTiles = tiles.filter((t) => t.kind === 'event' && t.type === 'mrt').map((t) => t.index);
  }

  get current() { return this.players[this.turn]; }

  // ---------- 計算 ----------
  shares(d) {
    const arr = this.influence[d];
    const sum = arr.reduce((a, b) => a + b, 0);
    return arr.map((v) => v / sum);
  }

  projectedVotes() {
    const totals = this.players.map(() => 0);
    for (const d of DIST_IDS) {
      const s = this.shares(d);
      const v = DISTRICTS[d].voters * 10000 * RULES.turnout;
      s.forEach((x, i) => { totals[i] += x * v; });
    }
    return totals;
  }

  pollPercent() {
    const v = this.projectedVotes();
    const sum = v.reduce((a, b) => a + b, 0);
    return v.map((x) => (x / sum) * 100);
  }

  leaderIndex() {
    const v = this.projectedVotes();
    return v.indexOf(Math.max(...v));
  }

  districtLeader(d) {
    const arr = this.influence[d];
    const max = Math.max(...arr);
    const idx = arr.indexOf(max);
    return arr.filter((x) => x === max).length > 1 ? -1 : idx;
  }

  // 對該候選人而言，加碼某區 n 點最有效益的選區
  bestDistrict(pi, n = 5) {
    let best = DIST_IDS[0], bestGain = -Infinity;
    for (const d of DIST_IDS) {
      const arr = this.influence[d];
      const sum = arr.reduce((a, b) => a + b, 0);
      const before = arr[pi] / sum;
      const after = (arr[pi] + n) / (sum + n);
      const gain = (after - before) * DISTRICTS[d].voters * (0.9 + Math.random() * 0.2);
      if (gain > bestGain) { bestGain = gain; best = d; }
    }
    return best;
  }

  addInfluence(pi, d, n, { silent = false } = {}) {
    const arr = this.influence[d];
    arr[pi] = Math.max(1, arr[pi] + n);
    if (!silent) {
      const t = this.tiles.find((x) => x.district === d);
      if (t) this.world.popText(t.pos, `${n > 0 ? '+' : ''}${n} ${DISTRICTS[d].name}`, n > 0 ? this.players[pi].color : '#ff5252');
    }
  }

  addAll(pi, n) {
    for (const d of DIST_IDS) this.addInfluence(pi, d, n, { silent: true });
    const p = this.players[pi];
    this.world.popText(this.world.tokenSpot(p.position, pi), `全市 ${n > 0 ? '+' : ''}${n}`, n > 0 ? '#ffeb3b' : '#ff5252');
  }

  addFunds(p, n) {
    p.funds = Math.max(0, p.funds + n);
    this.world.popText(this.world.tokenSpot(p.position, p.id), `${n > 0 ? '+' : ''}${n} 萬`, n > 0 ? '#69f0ae' : '#ff8a80');
  }

  // ---------- 主流程 ----------
  async run() {
    this.ui.update(this);
    this.ui.log(`🗳️ 選戰開打！距離投票日還有 <b>${this.maxRounds}</b> 週。`);
    while (!this.over) {
      const p = this.current;
      await this.playTurn(p);
      this.ui.update(this);
      this.turn++;
      if (this.turn >= this.players.length) {
        this.turn = 0;
        this.endOfRound();
        if (this.round > this.maxRounds) {
          await this.election();
          return;
        }
      }
    }
  }

  endOfRound() {
    // 各辦公室持續累積聲量
    for (const [idx, o] of Object.entries(this.owners)) {
      const t = this.tiles[idx];
      this.addInfluence(o.owner, t.district, RULES.passivePerLevel * o.level, { silent: true });
    }
    this.round++;
    if (this.round <= this.maxRounds) {
      const left = this.maxRounds - this.round + 1;
      this.ui.log(`📅 <b>第 ${this.round} 週</b>開始 — 距離投票日還有 ${left} 週。各地辦公室持續累積聲量。`);
      if (left === 3) this.ui.banner('選戰進入最後衝刺！', '剩下 3 週');
    }
    this.ui.update(this);
  }

  async playTurn(p) {
    this.world.setActiveToken(p.id);
    this.world.followToken(p.id);
    this.ui.update(this);

    if (p.skip > 0) {
      p.skip--;
      this.ui.log(`${this.ui.tag(p)} 受交通管制影響，本回合暫停。`);
      await sleep(p.isAI ? 900 : 1200);
      return;
    }

    // 擲骰前行動
    if (!p.isAI) {
      let adUsed = false;
      while (true) {
        const act = await this.ui.waitAction(p, { canAd: !adUsed && p.funds >= RULES.adCost });
        if (act === 'roll') break;
        if (act === 'ad') {
          const d = await this.ui.chooseDistrict(this, {
            title: `投放廣告（${RULES.adCost} 萬）`,
            text: `選擇要投放廣告的選區，聲量 +${RULES.adInfluence}`,
            pi: p.id,
          });
          if (d) {
            this.addFunds(p, -RULES.adCost);
            this.addInfluence(p.id, d, RULES.adInfluence);
            this.ui.log(`${this.ui.tag(p)} 在 ${DISTRICTS[d].name} 投放廣告，聲量 +${RULES.adInfluence}。`);
            adUsed = true;
            this.ui.update(this);
          }
        }
      }
    } else {
      await sleep(500);
      if (p.funds > 2200 && Math.random() < 0.55) {
        const d = this.bestDistrict(p.id, RULES.adInfluence);
        this.addFunds(p, -RULES.adCost);
        this.addInfluence(p.id, d, RULES.adInfluence);
        this.ui.log(`${this.ui.tag(p)} 在 ${DISTRICTS[d].name} 投放廣告。`);
        this.ui.update(this);
        await sleep(600);
      }
    }

    const d1 = 1 + rand(6), d2 = 1 + rand(6);
    await this.world.rollDice([d1, d2], this.world.tokens.get(p.id).group.position.clone().setY(0));
    this.ui.diceResult(d1, d2);
    const steps = d1 + d2;
    this.ui.log(`${this.ui.tag(p)} 擲出 🎲 ${d1} + ${d2} = <b>${steps}</b>`);
    this.world.hideDice();

    await this.moveSteps(p, steps);
    await this.resolveTile(p);
    this.ui.update(this);
    await sleep(p.isAI ? 500 : 200);
  }

  async moveSteps(p, steps) {
    const path = [];
    for (let i = 1; i <= steps; i++) path.push((p.position + i) % this.tiles.length);
    await this.world.moveToken(p.id, path, (idx) => {
      if (idx === 0) this.passStart(p);
    });
    p.position = path[path.length - 1];
  }

  passStart(p) {
    this.addFunds(p, RULES.passStartBonus);
    this.ui.log(`${this.ui.tag(p)} 經過台北市政府，獲得政黨補助 <b>${RULES.passStartBonus} 萬</b>。`);
    this.ui.update(this);
  }

  async teleport(p, idx, { passStart = true } = {}) {
    if (passStart && idx < p.position) this.passStart(p);
    await this.world.teleportToken(p.id, idx);
    p.position = idx;
  }

  // ---------- 落點處理 ----------
  async resolveTile(p) {
    const t = this.tiles[p.position];
    this.world.pulseTile(t.index, p.color);
    if (t.kind === 'start') {
      this.ui.log(`${this.ui.tag(p)} 停在台北市政府，召開記者會：全市聲量 +1。`);
      this.addAll(p.id, 1);
      return;
    }
    if (t.kind === 'property') return this.resolveProperty(p, t);
    switch (t.type) {
      case 'news': return this.drawNews(p);
      case 'fund': return this.fundraiser(p);
      case 'poll': return this.pollCenter(p);
      case 'debate': return this.debate(p);
      case 'media': return this.media(p);
      case 'mrt': return this.mrt(p);
      case 'traffic': return this.traffic(p);
    }
  }

  async resolveProperty(p, t) {
    const own = this.owners[t.index];
    const dname = DISTRICTS[t.district].name;
    if (!own) {
      if (p.funds < t.price) {
        this.ui.log(`${this.ui.tag(p)} 來到 ${t.name}，但經費不足以設立辦公室。`);
        return;
      }
      let buy;
      if (p.isAI) {
        buy = p.funds - t.price >= 300 + rand(400);
        await sleep(400);
      } else {
        buy = await this.ui.choose({
          title: `${t.name}（${dname}）`,
          text: `此處尚無候選人進駐。要花 <b>${t.price} 萬</b> 設立競選辦公室嗎？<br>
                 ${dname}聲量 +${RULES.buyInfluence}，之後每週自動累積聲量。`,
          options: [
            { label: `設立辦公室（-${t.price} 萬）`, value: true, primary: true },
            { label: '暫不設立', value: false },
          ],
          tile: t,
        });
      }
      if (buy) {
        this.addFunds(p, -t.price);
        this.owners[t.index] = { owner: p.id, level: 1 };
        p.offices.push(t.index);
        this.addInfluence(p.id, t.district, RULES.buyInfluence);
        this.world.setOffice(t.index, p, 1);
        this.ui.log(`${this.ui.tag(p)} 在 <b>${t.name}</b> 設立競選辦公室！${dname}聲量 +${RULES.buyInfluence}`);
      } else {
        this.ui.log(`${this.ui.tag(p)} 路過 ${t.name}，決定先不進駐。`);
      }
      return;
    }

    if (own.owner === p.id) {
      if (own.level >= RULES.maxLevel) {
        this.addInfluence(p.id, t.district, 3);
        this.ui.log(`${this.ui.tag(p)} 回到 ${t.name} 的 ${LEVEL_NAMES[own.level]} 與支持者同樂，聲量 +3。`);
        return;
      }
      const cost = Math.round((t.price * RULES.upgradeCostRatio) / 10) * 10;
      const next = LEVEL_NAMES[own.level + 1];
      let up = false;
      if (p.funds >= cost) {
        if (p.isAI) {
          up = p.funds - cost >= 400 + rand(400);
          await sleep(400);
        } else {
          up = await this.ui.choose({
            title: `${t.name}：升級為「${next}」`,
            text: `花費 <b>${cost} 萬</b> 擴大造勢，${dname}聲量 +${RULES.upgradeInfluence}，每週累積聲量也會提升。`,
            options: [
              { label: `升級（-${cost} 萬）`, value: true, primary: true },
              { label: '下次再說', value: false },
            ],
            tile: t,
          });
        }
      }
      if (up) {
        this.addFunds(p, -cost);
        own.level++;
        this.addInfluence(p.id, t.district, RULES.upgradeInfluence);
        this.world.setOffice(t.index, p, own.level);
        this.ui.log(`${this.ui.tag(p)} 將 ${t.name} 升級為 <b>${next}</b>！`);
      } else {
        this.addInfluence(p.id, t.district, 2);
        this.ui.log(`${this.ui.tag(p)} 回到 ${t.name} 掃街拜票，聲量 +2。`);
      }
      return;
    }

    // 對手的地盤
    const owner = this.players[own.owner];
    const cost = Math.round((t.price * RULES.counterCostRatio * own.level) / 10) * 10;
    const loss = RULES.counterLossPerLevel * own.level;
    let pay;
    if (p.isAI) {
      pay = p.funds - cost >= 600;
      await sleep(400);
    } else {
      pay = await this.ui.choose({
        title: `闖入 ${owner.name} 的地盤！`,
        text: `${t.name} 有 ${this.ui.tag(owner)} 的「${LEVEL_NAMES[own.level]}」。<br>
               支付 <b>${cost} 萬</b> 反制文宣，或是放任對方拉走 ${dname} <b>${loss}</b> 點聲量。`,
        options: [
          { label: `反制文宣（-${cost} 萬）`, value: true, primary: true, disabled: p.funds < cost },
          { label: `不理會（${dname}聲量 -${loss}，對手 +${loss}）`, value: false },
        ],
        tile: t,
      });
    }
    if (pay && p.funds >= cost) {
      this.addFunds(p, -cost);
      this.ui.log(`${this.ui.tag(p)} 在 ${this.ui.tag(owner)} 的地盤 ${t.name} 花 ${cost} 萬反制文宣。`);
    } else {
      this.addInfluence(p.id, t.district, -loss);
      this.addInfluence(owner.id, t.district, loss, { silent: true });
      this.ui.log(`${this.ui.tag(owner)} 在 ${t.name} 的造勢吸走 ${this.ui.tag(p)} 的支持者（${dname} ±${loss}）。`);
    }
  }

  // ---------- 事件 ----------
  async drawNews(p) {
    if (!this.deck.length) this.deck = shuffle([...NEWS_CARDS]);
    const card = this.deck.pop();
    const e = card.effect;
    const parts = [];
    if (e.all) parts.push(`全市聲量 ${e.all > 0 ? '+' : ''}${e.all}`);
    if (e.districts) {
      for (const [d, n] of Object.entries(e.districts)) parts.push(`${DISTRICTS[d].name} ${n > 0 ? '+' : ''}${n}`);
    }
    if (e.randomDistricts) parts.push(`隨機 ${e.randomDistricts[0]} 區 +${e.randomDistricts[1]}`);
    if (e.funds) parts.push(`經費 ${e.funds > 0 ? '+' : ''}${e.funds} 萬`);
    if (e.skip) parts.push('暫停一回合');
    if (e.moveTo === 'mrt') parts.push('移動到下一個捷運站');
    if (e.moveTo === 'start') parts.push('移動到台北市政府');

    await this.ui.card(p, { icon: '📰', kind: '新聞事件', title: card.title, text: card.text, effect: parts.join('、') });
    this.ui.log(`${this.ui.tag(p)} 📰 ${card.title}：${parts.join('、')}`);

    if (e.all) this.addAll(p.id, e.all);
    if (e.districts) for (const [d, n] of Object.entries(e.districts)) this.addInfluence(p.id, d, n);
    if (e.randomDistricts) {
      const ds = shuffle([...DIST_IDS]).slice(0, e.randomDistricts[0]);
      ds.forEach((d) => this.addInfluence(p.id, d, e.randomDistricts[1]));
      this.ui.log(`　→ 拉抬了 ${ds.map((d) => DISTRICTS[d].name).join('、')}`);
    }
    if (e.funds) this.addFunds(p, e.funds);
    if (e.skip) p.skip += e.skip;
    if (e.moveTo === 'mrt') await this.teleport(p, this.nextMrt(p.position));
    if (e.moveTo === 'start') await this.teleport(p, 0);
  }

  async fundraiser(p) {
    const amt = 250 + rand(7) * 50;
    await this.ui.card(p, { icon: '💰', kind: '募款餐會', title: '募款餐會座無虛席', text: '支持者熱情響應，小額捐款源源不絕。', effect: `經費 +${amt} 萬` });
    this.addFunds(p, amt);
    this.ui.log(`${this.ui.tag(p)} 💰 舉辦募款餐會，募得 <b>${amt} 萬</b>。`);
  }

  async pollCenter(p) {
    const pct = this.pollPercent();
    const leader = this.leaderIndex();
    if (!p.isAI) await this.ui.pollModal(this);
    if (leader === p.id) {
      this.addFunds(p, 200);
      this.ui.log(`${this.ui.tag(p)} 📊 民調領先（${pct[p.id].toFixed(1)}%），聲勢看漲，捐款 +200 萬。`);
    } else {
      let d;
      if (p.isAI) d = this.bestDistrict(p.id, 4);
      else {
        d = await this.ui.chooseDistrict(this, {
          title: '民調落後，加強催票！',
          text: '選擇一個選區加強催票，聲量 +4',
          pi: p.id,
          noCancel: true,
        });
      }
      this.addInfluence(p.id, d, 4);
      this.ui.log(`${this.ui.tag(p)} 📊 民調 ${pct[p.id].toFixed(1)}%，在 ${DISTRICTS[d].name} 加強催票 +4。`);
    }
  }

  async debate(p) {
    let key;
    const leader = this.leaderIndex();
    if (p.isAI) {
      key = leader === p.id ? 'steady' : (Math.random() < 0.5 ? 'bold' : 'attack');
      await sleep(400);
    } else {
      key = await this.ui.choose({
        title: '🎤 政見辯論會',
        text: '電視辯論會即將開始，你要採取什麼策略？',
        options: DEBATE_OPTIONS.map((o) => ({ label: o.label, desc: o.desc, value: o.key })),
      });
    }
    const opt = DEBATE_OPTIONS.find((o) => o.key === key);
    let result;
    if (key === 'steady') {
      this.addAll(p.id, 2);
      result = '表現穩健，全市 +2';
    } else if (key === 'bold') {
      if (Math.random() < 0.55) { this.addAll(p.id, 5); result = '願景打動人心，全市 +5！'; }
      else { this.addAll(p.id, -3); result = '被質疑畫大餅，全市 -3'; }
    } else {
      if (leader === p.id) {
        this.addAll(p.id, 1);
        result = '你自己就是領先者，只好自我肯定，全市 +1';
      } else if (Math.random() < 0.3) {
        this.addAll(p.id, -3);
        result = '攻擊過頭引發反感，全市 -3';
      } else {
        for (const d of DIST_IDS) this.addInfluence(leader, d, -3, { silent: true });
        this.addAll(p.id, 1);
        result = `成功打擊 ${this.players[leader].name}（全市 -3），你 +1`;
      }
    }
    await this.ui.card(p, { icon: '🎤', kind: '政見辯論會', title: opt.label, text: result, effect: '' });
    this.ui.log(`${this.ui.tag(p)} 🎤 辯論會「${opt.label}」：${result}`);
  }

  async media(p) {
    if (p.funds < RULES.mediaCost) {
      this.ui.log(`${this.ui.tag(p)} 📺 想上節目但經費不足。`);
      return;
    }
    let d = null;
    if (p.isAI) {
      if (p.funds > 700) d = this.bestDistrict(p.id, RULES.mediaInfluence);
      await sleep(300);
    } else {
      d = await this.ui.chooseDistrict(this, {
        title: `📺 媒體專訪（${RULES.mediaCost} 萬）`,
        text: `花 ${RULES.mediaCost} 萬上地方節目，選擇一個選區聲量 +${RULES.mediaInfluence}（可取消）`,
        pi: p.id,
      });
    }
    if (d) {
      this.addFunds(p, -RULES.mediaCost);
      this.addInfluence(p.id, d, RULES.mediaInfluence);
      this.ui.log(`${this.ui.tag(p)} 📺 接受專訪，主打 ${DISTRICTS[d].name}，聲量 +${RULES.mediaInfluence}。`);
    } else {
      this.ui.log(`${this.ui.tag(p)} 📺 婉拒了媒體專訪。`);
    }
  }

  nextMrt(from) {
    const after = this.mrtTiles.find((i) => i > from);
    return after ?? this.mrtTiles[0];
  }

  async mrt(p) {
    const to = this.nextMrt(p.position);
    if (to === p.position) return;
    this.ui.log(`${this.ui.tag(p)} 🚇 搭乘捷運前往下一站，沿途與通勤族握手（全市 +1）。`);
    this.addAll(p.id, 1);
    await this.teleport(p, to);
  }

  async traffic(p) {
    p.skip += 1;
    await this.ui.card(p, { icon: '🚧', kind: '交通管制', title: '遊行封路', text: '凱道大型遊行，車隊動彈不得。', effect: '暫停一回合' });
    this.ui.log(`${this.ui.tag(p)} 🚧 遇上交通管制，下回合暫停。`);
  }

  // ---------- 投開票 ----------
  async election() {
    this.over = true;
    this.ui.update(this);
    this.ui.log('🗳️ <b>投票日到了！</b>開票中……');
    this.world.overview();
    const results = DIST_IDS.map((d) => {
      const s = this.shares(d);
      const noise = s.map((x) => x * (0.96 + Math.random() * 0.08));
      const ns = noise.reduce((a, b) => a + b, 0);
      const total = Math.round(DISTRICTS[d].voters * 10000 * (RULES.turnout + (Math.random() - 0.5) * 0.06));
      const votes = noise.map((x) => Math.round((x / ns) * total));
      return { d, votes, winner: votes.indexOf(Math.max(...votes)) };
    });
    const totals = this.players.map((_, i) => results.reduce((a, r) => a + r.votes[i], 0));
    const winner = totals.indexOf(Math.max(...totals));
    await this.ui.showElection(this, results, totals, winner);
    const w = this.players[winner];
    this.world.confetti(this.world.tokens.get(w.id).group.position.clone(), [w.color, '#ffffff', '#ffd54f']);
    this.world.followToken(w.id);
  }
}
