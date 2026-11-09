// 單元測試用的假 3D 世界與假介面（不需要瀏覽器）
globalThis.SIM_SPEED = 1000;

export function mockWorld() {
  return {
    tokens: { get: () => ({ group: { position: { clone: () => ({ setY: () => ({}) }) } } }) },
    popText() {},
    tokenSpot() { return { x: 0, y: 0, z: 0 }; },
    async moveToken(id, path, onStep) { for (const i of path) onStep?.(i); },
    async teleportToken() {},
    async rollDice() {},
    hideDice() {},
    setOffice() {},
    pulseTile() {},
    setActiveToken() {},
    followToken() {},
    overview() {},
    confetti() {},
  };
}

// 永遠選第一個可用選項的假介面
export function mockUI() {
  const ui = {
    logs: [],
    election: null,
    tag: (p) => p.name,
    log(html) { this.logs.push(html); },
    update() {},
    banner() {},
    diceResult() {},
    async waitAction() { return 'roll'; },
    async choose({ options }) { return options.find((o) => !o.disabled).value; },
    async chooseDistrict() { return 'daan'; },
    async card() {},
    async pollModal() {},
    async showElection(game, results, totals, winner) { this.election = { results, totals, winner }; },
  };
  return ui;
}

export function makePlayers(n, { allAI = false } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    id: i, name: `P${i}`, party: 'X', color: '#fff', isAI: allAI || i > 0,
    funds: 3000, position: 0, skip: 0, offices: [],
  }));
}
