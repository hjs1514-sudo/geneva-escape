// 실시간 진행판 서버(역사교사 아카이브의 /api/sechaek)와 주고받기.
// 세책점 진행판과 같은 서버를 쓰고, 학생 한 명을 '모둠' 하나로 보냅니다.
// 서버가 없는 곳에서는 실패하고, 게임은 혼자 그대로 작동합니다.
import { useEffect, useRef, useState } from 'react';
import { SETTINGS } from '../data/game.js';

const BASE = SETTINGS.apiBase;

async function call(path, { method = 'GET', body, key } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (key) headers['x-teacher-key'] = key;
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  } catch {
    throw new Error('서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || '진행판 서버를 찾지 못했어요. 역사교사 아카이브 주소로 열었는지 확인해 주세요.');
  return data;
}

export const createClass = (title, minutes) => call('/classes', { method: 'POST', body: { title, minutes } });
export const getClass = (code, key) => call(`/classes/${encodeURIComponent(code)}`, { key });
export const giveTime = (code, key, teamId, minutes) => call(`/classes/${encodeURIComponent(code)}`, { method: 'PATCH', key, body: { team_id: teamId, minutes } });
// 통행증 돌려주기: 세책점의 '결론 판정' 자리를 빌려 씁니다
export const giveLife = (code, key, teamId) => call(`/classes/${encodeURIComponent(code)}`, { method: 'PATCH', key, body: { team_id: teamId, verdict: { pass: true, comment: 'life' } } });
const pushProgress = (code, body) => call(`/classes/${encodeURIComponent(code)}/progress`, { method: 'POST', body });

// 진행판으로 보낼 만큼만 줄인 상태
function slim(g) {
  return {
    nick: g.nick, avatar: g.avatar, startedAt: g.startedAt, endAt: g.endAt, minutes: g.minutes,
    pos: { x: Math.round(g.pos.x), y: Math.round(g.pos.y) }, lives: g.lives, caught: g.caught, outUntil: g.outUntil,
    found: g.found, cluesRead: g.cluesRead, boxes: g.boxes, vault: g.vault, outcome: g.outcome, escapedAt: g.escapedAt,
    addedMinutes: g.addedMinutes, remoteMinutes: g.remoteMinutes, lastGift: g.lastGift, at: Date.now(),
  };
}

/** 학생 기기: 3초마다 위치와 기록을 보내고, 교사가 준 시간·통행증을 받아 온다 */
export function useSync(game, update) {
  const [status, setStatus] = useState('off');
  const latest = useRef(game);
  latest.current = game;
  const code = game.classCode;
  const send = useRef(null);
  send.current = async () => {
    const g = latest.current;
    if (!g.classCode || !g.teamId || !g.startedAt) return;
    try {
      const r = await pushProgress(g.classCode, { team_id: g.teamId, team: g.nick, klass: g.avatar, state: slim(g) });
      setStatus('ok');
      const extra = r.extra_min || 0;
      if (extra > (g.remoteMinutes || 0)) {
        update((x) => {
          const add = extra - (x.remoteMinutes || 0);
          if (add <= 0) return x;
          x.remoteMinutes = extra;
          x.addedMinutes = (x.addedMinutes || 0) + add;
          x.endAt = Math.max(x.endAt || 0, Date.now()) + add * 60000;
          if (x.outcome === 'timeout') x.outcome = null;
          return x;
        });
      }
      const v = r.verdict;
      if (v && v.comment === 'life' && v.at > (g.lastGift || 0)) {
        update((x) => {
          if (v.at <= (x.lastGift || 0)) return x;
          x.lastGift = v.at;
          x.lives = Math.min(SETTINGS.lives, (x.lives || 0) + 1);
          x.outUntil = null;
          x.toast = '선생님이 통행증 1장을 돌려주셨어요!';
          return x;
        });
      }
    } catch {
      setStatus('error');
    }
  };
  useEffect(() => {
    if (!code) { setStatus('off'); return; }
    send.current();
    const t = setInterval(() => send.current(), 3000);
    return () => clearInterval(t);
  }, [code]);
  return status;
}
