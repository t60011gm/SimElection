// 遊戲速度倍率：網址加上 ?speed=10 可加速動畫（自動化測試使用）
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
export const SPEED = Math.max(0.1, Number(globalThis.SIM_SPEED ?? params?.get('speed')) || 1);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms / SPEED));
