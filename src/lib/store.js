// 이 기기(학생 한 명의 기기)에 게임 상태를 저장합니다. 새로고침해도 이어집니다.
import { useEffect, useState, useCallback } from 'react';
import { SETTINGS, SPAWN } from '../data/game.js';

const GAME_KEY = 'geneva-escape-game-v1';
const SET_KEY = 'geneva-escape-settings-v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 불가 환경 */ }
}

export const emptyGame = () => ({
  nick: '',
  avatar: '',
  startedAt: null,
  endAt: null,
  minutes: null,
  pos: { ...SPAWN },
  lives: SETTINGS.lives,
  caught: 0,            // 경비원에게 들킨 횟수
  outUntil: null,       // 통행증을 다 잃고 쉬는 중이면 끝나는 시각
  found: [],            // 발견한 보관함 id
  cluesRead: [],        // 읽은 단서 id
  findHints: {},        // 보관함(또는 vault) id -> 받은 길 찾기 힌트 단계(1·2)
  boxes: {},            // boxId -> { opened, lockWrong, quizzes: { qid -> { step, done, wrong, hints } }, keyAt }
  vault: { found: false, placed: false, open: false, wrong: 0, sentence: '', at: null },
  outcome: null,        // 'escaped' | 'timeout' | null
  escapedAt: null,
  addedMinutes: 0,
  classCode: '',
  teamId: '',
  remoteMinutes: 0,
  lastGift: 0,          // 진행판에서 돌려받은 통행증의 시각
  cfg: null,            // 수업 설정 { guards, speed } (QR 주소로 받음)
});

export function useGame() {
  const [game, setGame] = useState(() => read(GAME_KEY, emptyGame()));
  useEffect(() => write(GAME_KEY, game), [game]);
  const update = useCallback((fn) => setGame((g) => fn(structuredClone(g))), []);
  const reset = useCallback(() => setGame(emptyGame()), []);
  return [game, update, reset];
}

export function useSettings() {
  const [s, setS] = useState(() => read(SET_KEY, { minutes: SETTINGS.minutes, pin: SETTINGS.teacherPin, guards: SETTINGS.guards, speed: SETTINGS.guardSpeed }));
  useEffect(() => write(SET_KEY, s), [s]);
  return [s, setS];
}

export function boxState(g, id) {
  g.boxes[id] ||= { opened: false, lockWrong: 0, quizzes: {}, keyAt: null };
  return g.boxes[id];
}
export function quizState(g, boxId, qid) {
  const b = boxState(g, boxId);
  b.quizzes[qid] ||= { step: 0, done: false, wrong: 0, hints: 0, startAt: Date.now() };
  return b.quizzes[qid];
}
export const keysOf = (g) => Object.values(g.boxes || {}).filter((b) => b.keyAt).length;

export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const cache = {};
export function useImageOk(file) {
  const [ok, setOk] = useState(file ? cache[file] ?? null : false);
  useEffect(() => {
    if (!file) return;
    if (cache[file] !== undefined) { setOk(cache[file]); return; }
    const img = new Image();
    img.onload = () => { cache[file] = true; setOk(true); };
    img.onerror = () => { cache[file] = false; setOk(false); };
    img.src = `sources/${file}`;
  }, [file]);
  return ok;
}

export function shuffle(arr, seed = 7) {
  const a = arr.map((v, i) => [v, i]);
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newId() {
  const a = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
