// 문서고 지도 계산: 걸을 수 있는 곳, 경비원 위치, 손전등에 들켰는지
import { FLOORS, BLOCKS, SHADOWS, ROOMS, GUARD_PATHS } from '../data/game.js';

const inRect = (p, r, m = 0) => p.x >= r.x - m && p.x <= r.x + r.w + m && p.y >= r.y - m && p.y <= r.y + r.h + m;

export const R = 12; // 아바타 발 크기(반지름)

/** 발이 놓일 수 있는 곳인가 */
export function canStand(p) {
  // 발 둘레 네 점이 모두 바닥 위여야 하고, 가구와 겹치면 안 됨
  const pts = [{ x: p.x - R, y: p.y }, { x: p.x + R, y: p.y }, { x: p.x, y: p.y - R * 0.6 }, { x: p.x, y: p.y + R * 0.4 }];
  if (!pts.every((q) => FLOORS.some((f) => inRect(q, f)))) return false;
  return !BLOCKS.some((b) => p.x + R > b.x && p.x - R < b.x + b.w && p.y + R * 0.4 > b.y && p.y - R * 0.6 < b.y + b.h);
}

/** 미끄러지듯 움직이기: 막히면 한 축으로만 */
export function moveFrom(p, dx, dy) {
  const n = { x: p.x + dx, y: p.y + dy };
  if (canStand(n)) return n;
  const a = { x: p.x + dx, y: p.y };
  if (dx && canStand(a)) return a;
  const b = { x: p.x, y: p.y + dy };
  if (dy && canStand(b)) return b;
  return p;
}

export const roomOf = (p) => (ROOMS.find((r) => inRect(p, r)) || { id: 'none', name: '' });
export const inShadow = (p) => SHADOWS.some((s) => inRect(p, s));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- 경비원 ----------
// 모든 기기에서 같은 시각에 같은 자리에 있도록, 경비원 위치는 시계로 계산합니다.
const WALK = 64; // 보통 빠르기의 걸음(px/초)
const plans = GUARD_PATHS.map((g) => {
  const pts = g.loop;
  const segs = [];
  let t = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (a.wait) { segs.push({ kind: 'wait', a, t0: t, dur: a.wait, dir: null }); t += a.wait; }
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dur = len / WALK;
    if (dur > 0) { segs.push({ kind: 'walk', a, b, t0: t, dur, dir: Math.atan2(b.y - a.y, b.x - a.x) }); t += dur; }
  }
  // 멈춰 있는 동안 바라볼 방향: 바로 앞 걸음의 방향
  segs.forEach((s, i) => {
    if (s.kind === 'wait') {
      const prev = segs[(i - 1 + segs.length) % segs.length];
      s.dir = prev.kind === 'walk' ? prev.dir : 0;
    }
  });
  return { name: g.name, segs, period: t };
});

export function guardAt(i, timeSec, speed = 1) {
  const plan = plans[i];
  const offset = i * 7.3; // 경비원마다 출발 시각을 어긋나게
  const t = (((timeSec * speed + offset) % plan.period) + plan.period) % plan.period;
  const s = plan.segs.find((x) => t >= x.t0 && t < x.t0 + x.dur) || plan.segs[0];
  const k = (t - s.t0) / s.dur;
  if (s.kind === 'wait') {
    return { x: s.a.x, y: s.a.y, dir: s.dir + Math.sin(k * Math.PI * 2) * 1.1, moving: false, name: plan.name };
  }
  return { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k, dir: s.dir, moving: true, name: plan.name };
}

export const GUARD_COUNT = plans.length;
export const LIGHT = { range: 165, half: 0.52 }; // 손전등이 닿는 거리와 반각(라디안)

/** 경비원이 이 자리를 보고 있나: 'bump'(부딪힘) | 'light'(손전등) | null */
export function spotted(g, p) {
  const d = dist(g, p);
  if (d < 28) return 'bump';
  if (d > LIGHT.range) return null;
  if (roomOf(g).id !== roomOf(p).id) return null; // 벽 너머는 보이지 않음
  if (inShadow(p)) return null;
  let a = Math.atan2(p.y - g.y, p.x - g.x) - g.dir;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return Math.abs(a) <= LIGHT.half ? 'light' : null;
}

export function wedge(g, range = LIGHT.range, half = LIGHT.half) {
  const a1 = g.dir - half, a2 = g.dir + half;
  return `M${g.x} ${g.y} L${g.x + Math.cos(a1) * range} ${g.y + Math.sin(a1) * range} A${range} ${range} 0 0 1 ${g.x + Math.cos(a2) * range} ${g.y + Math.sin(a2) * range} Z`;
}
