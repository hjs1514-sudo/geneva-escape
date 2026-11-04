// 실시간 진행판: 학생들의 위치와 진행을 교사 화면(TV) 하나에서 봅니다.
// 수업을 열면 4자리 코드와 입장 QR이 나오고, 학생이 그 QR로 들어오면 지도 위에 나타납니다.
import { useCallback, useEffect, useState } from 'react';
import { SETTINGS, BOXES, WORLD, ROOMS, AVATARS } from '../data/game.js';
import { fmtTime, useNow } from '../lib/store.js';
import { createClass, getClass, giveTime, giveLife, avatarFrom } from '../lib/api.js';
import { guardAt, GUARD_COUNT, wedge } from '../lib/world.js';
import { Qr, appUrl } from '../components/Qr.jsx';
import { MusicButton } from '../lib/music.jsx';

const SAVE_KEY = 'geneva-board-v1';
const POLL_MS = 3000;
const STALE_MS = 30000;

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || []; } catch { return []; }
}
function storeSaved(list) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(list.slice(0, 8))); } catch { /* 저장 불가 */ }
}

export default function Board({ q }) {
  const [saved, setSaved] = useState(() => {
    const list = loadSaved();
    const code = q.get('c'), key = q.get('k');
    if (code && key && !list.some((c) => c.code === code)) list.unshift({ code, key, guards: Number(q.get('g') ?? SETTINGS.guards), speed: Number(q.get('s') ?? SETTINGS.guardSpeed) });
    storeSaved(list);
    return list;
  });
  const [current, setCurrent] = useState(() => q.get('c') || saved[0]?.code || null);
  const remember = (list) => { storeSaved(list); setSaved(list); };
  const cls = saved.find((c) => c.code === current);
  return (
    <div className="board">
      <header className="board-head">
        <h1>실시간 진행판 · {SETTINGS.title}</h1>
        <div className="row">
          <MusicButton />
          {cls && <button className="btn ghost small" onClick={() => setCurrent(null)}>수업 목록</button>}
          <a className="btn ghost small" href="#/teacher">교사 화면</a>
        </div>
      </header>
      {cls ? (
        <ClassView cls={cls} onForget={() => { remember(saved.filter((c) => c.code !== cls.code)); setCurrent(null); }} />
      ) : (
        <ClassPicker saved={saved} onPick={setCurrent} onCreate={(c) => { remember([c, ...saved.filter((x) => x.code !== c.code)]); setCurrent(c.code); }} />
      )}
    </div>
  );
}

function ClassPicker({ saved, onPick, onCreate }) {
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(SETTINGS.minutes);
  const [guards, setGuards] = useState(SETTINGS.guards);
  const [speed, setSpeed] = useState(SETTINGS.guardSpeed);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const make = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const c = await createClass(title.trim(), minutes);
      onCreate({ code: c.code, key: c.key, title: c.title, minutes: c.minutes, guards, speed, created_at: Date.now() });
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <div className="board-pick">
      <form className="t-box" onSubmit={make}>
        <h2>새 수업 열기</h2>
        <div className="t-form">
          <label>수업 이름<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 2학년 3반 4교시" /></label>
          <label>제한 시간(분)<input type="number" min={10} max={90} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
          <label>경비원 수<select value={guards} onChange={(e) => setGuards(Number(e.target.value))}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}명</option>)}</select></label>
          <label>경비원 빠르기<select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={0.7}>느림</option><option value={1}>보통</option><option value={1.3}>빠름</option></select></label>
        </div>
        <button className="btn" disabled={busy}>{busy ? '여는 중…' : '수업 열기'}</button>
        {err && <p className="err">{err}</p>}
      </form>
      {saved.length > 0 && (
        <div className="t-box">
          <h2>이 기기에서 연 수업</h2>
          <div className="row wrap">{saved.map((c) => <button key={c.code} className="btn ghost" onClick={() => onPick(c.code)}>{c.code} {c.title || ''}</button>)}</div>
        </div>
      )}
    </div>
  );
}

function summarize(t, now) {
  const g = t.state || {};
  const keys = BOXES.filter((b) => g.boxes?.[b.id]?.keyAt).length;
  const status = g.outcome === 'escaped' ? 'escaped' : g.outcome === 'timeout' ? 'timeout' : g.outUntil && g.outUntil > now ? 'out' : g.startedAt ? 'playing' : 'waiting';
  const stale = status === 'playing' && now - t.updated_at > STALE_MS;
  const wrong = BOXES.reduce((n, b) => n + Object.values(g.boxes?.[b.id]?.quizzes || {}).reduce((m, s) => m + (s.totalWrong || 0), 0), 0);
  const open = BOXES.find((b) => g.boxes?.[b.id]?.opened && !g.boxes?.[b.id]?.keyAt);
  const left = status === 'playing' && g.endAt ? g.endAt - now : null;
  return { g, keys, status, stale, wrong, open, left };
}

const STATUS = { escaped: '탈출', timeout: '시간 초과', out: '쫓겨나 쉬는 중', playing: '탐색 중', waiting: '입장 전' };

function ClassView({ cls, onForget }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [guards, setGuards] = useState(cls.guards ?? SETTINGS.guards);
  const [speed, setSpeed] = useState(cls.speed ?? SETTINGS.guardSpeed);
  const [pdfBusy, setPdfBusy] = useState(false);
  const now = useNow(250);
  const load = useCallback(async () => {
    try { setData(await getClass(cls.code, cls.key)); setErr(''); } catch (x) { setErr(x.message); }
  }, [cls.code, cls.key]);
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t); }, [load]);

  const act = async (fn) => { try { await fn(); load(); } catch (x) { setErr(x.message); } };
  const teams = (data?.teams || []).map((t) => ({ ...t, s: summarize(t, now) }))
    .sort((a, b) => b.s.keys - a.s.keys || (a.team || '').localeCompare(b.team || ''));
  const minutes = data?.minutes ?? cls.minutes ?? SETTINGS.minutes;
  const studentUrl = `${appUrl()}#/?c=${cls.code}&m=${minutes}&g=${guards}&s=${speed}`;
  const boardUrl = `${appUrl()}#/board?c=${cls.code}&k=${encodeURIComponent(cls.key)}&g=${guards}&s=${speed}`;
  const nickCount = teams.reduce((m, t) => ({ ...m, [t.team]: (m[t.team] || 0) + 1 }), {});
  const sentences = teams.filter((t) => t.s.g.vault?.sentence);
  const tt = now / 1000;
  const gs = Array.from({ length: Math.min(guards, GUARD_COUNT) }, (_, i) => guardAt(i, tt, speed));

  return (
    <>
      <section className="board-class">
        <div className="board-code"><small>수업 코드</small><strong>{cls.code}</strong></div>
        <div className="board-meta">
          <div className="board-title">{data?.title || cls.title || '이름 없는 수업'}</div>
          <div className="small">제한 시간 {minutes}분 · 경비원 {guards}명({speed < 1 ? '느림' : speed > 1 ? '빠름' : '보통'}) · 학생 {teams.length}명 · 탈출 {teams.filter((t) => t.s.status === 'escaped').length}명
            {' · '}{err ? <span className="err">{err}</span> : data ? '3초마다 새로고침' : '불러오는 중…'}</div>
          <div className="row wrap">
            <label className="inline">경비원<select value={guards} onChange={(e) => setGuards(Number(e.target.value))}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}명</option>)}</select></label>
            <label className="inline">빠르기<select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={0.7}>느림</option><option value={1}>보통</option><option value={1.3}>빠름</option></select></label>
            <span className="small">바꾼 설정은 바뀐 QR로 새로 들어오는 학생부터 적용돼요.</span>
          </div>
          <div className="row wrap">
            <button className="btn small" disabled={pdfBusy || !data} onClick={async () => {
              setPdfBusy(true);
              try { const { downloadReport } = await import('../lib/report.jsx'); await downloadReport({ cls, data, teams }); } catch (x) { setErr(`PDF를 만들지 못했어요: ${x.message}`); }
              setPdfBusy(false);
            }}>{pdfBusy ? 'PDF 만드는 중…' : '수업 결과 PDF 내려받기'}</button>
            <button className="btn ghost small" onClick={() => act(() => Promise.all(teams.filter((t) => t.s.status === 'playing' || t.s.status === 'timeout').map((t) => giveTime(cls.code, cls.key, t.team_id, 5))))}>모두에게 +5분</button>
            <button className="btn ghost small" onClick={async () => { try { await navigator.clipboard.writeText(boardUrl); alert('주소를 복사했어요. TV에서 열어 주세요.'); } catch { prompt('이 주소를 다른 기기에서 열어 주세요', boardUrl); } }}>다른 기기(TV)에서 열 주소</button>
            <button className="btn ghost small" onClick={() => { if (confirm('이 기기 목록에서 이 수업을 지울까요? (학생 기록은 서버에 3일 동안 남아요)')) onForget(); }}>목록에서 지우기</button>
          </div>
        </div>
        <Qr url={studentUrl} label="학생 입장 QR" big={`수업 코드 ${cls.code} · 각자 기기의 카메라로 찍으세요`} sub="닉네임을 적고 조사관을 골라 입장해요" />
      </section>

      <section className="live-map">
        <div className="live-wrap" style={{ aspectRatio: `${WORLD.w} / ${WORLD.h}` }}>
          <img src="art/map.webp" alt="문서고 지도" />
          <svg viewBox={`0 0 ${WORLD.w} ${WORLD.h}`}>
            {gs.map((g, i) => <path key={i} d={wedge(g)} className="light" />)}
            {gs.map((g, i) => <circle key={`g${i}`} cx={g.x} cy={g.y} r="14" className="guard-dot" />)}
          </svg>
          {ROOMS.map((r) => <span key={r.id} className="mini-room" style={{ left: `${((r.x + r.w / 2) / WORLD.w) * 100}%`, top: `${((r.y + 20) / WORLD.h) * 100}%` }}>{r.name}</span>)}
          {teams.filter((t) => t.s.status === 'playing' && t.s.g.pos).map((t) => (
            <div key={t.team_id} className={`live-stu ${t.s.stale ? 'stale' : ''}`} style={{ left: `${(t.s.g.pos.x / WORLD.w) * 100}%`, top: `${(t.s.g.pos.y / WORLD.h) * 100}%` }}>
              <img src={`art/av_${avatarFrom(t.klass).id}.webp`} alt="" />
              <span>{t.team}<b>{'🔑'.repeat(t.s.keys)}</b></span>
            </div>
          ))}
        </div>
      </section>

      <section className="stu-grid">
        {teams.length === 0 && <p className="small">아직 들어온 학생이 없어요. 학생 입장 QR을 띄워 주세요.</p>}
        {teams.map((t) => {
          const s = t.s;
          return (
            <div key={t.team_id} className={`stu ${s.status} ${s.stale ? 'stale' : ''}`}>
              <img className="stu-av" src={`art/av_${avatarFrom(t.klass).id}.webp`} alt={avatarFrom(t.klass).name} />
              <div className="stu-main">
                <div className="stu-name">{t.team}{nickCount[t.team] > 1 && <span className="warn"> 같은 닉네임</span>}</div>
                <div className="stu-status">{STATUS[s.status]}{s.stale ? ' · 연결 끊김?' : ''}{s.left != null ? ` · ${fmtTime(s.left)}` : ''}</div>
                <div className="stu-keys">{BOXES.map((b) => <img key={b.id} src={`art/${b.key}.webp`} className={s.g.boxes?.[b.id]?.keyAt ? '' : 'nokey'} title={`${b.year} ${b.keyWord}`} alt="" />)}</div>
                <div className="small">통행증 {s.g.lives ?? '-'}장 · 들킴 {s.g.caught || 0} · 퀴즈 오답 {s.wrong}{Object.keys(s.g.findHints || {}).length ? ` · 찾기 힌트 ${Object.values(s.g.findHints).reduce((a, b) => a + b, 0)}번` : ''}{s.open ? ` · ${s.open.year} 보관함 푸는 중` : ''}</div>
              </div>
              <div className="stu-btns">
                <button className="btn small ghost" onClick={() => act(() => giveTime(cls.code, cls.key, t.team_id, 5))}>+5분</button>
                <button className="btn small ghost" disabled={(s.g.lives ?? 3) >= SETTINGS.lives} onClick={() => act(() => giveLife(cls.code, cls.key, t.team_id))}>통행증 +1</button>
              </div>
            </div>
          );
        })}
      </section>

      {sentences.length > 0 && (
        <section className="t-box">
          <h2>새 기구에 전한 한 문장</h2>
          {sentences.map((t) => <blockquote key={t.team_id} className="my-sentence"><b>{t.team}</b> “{t.s.g.vault.sentence}”</blockquote>)}
        </section>
      )}
      <Hardest teams={teams} />
    </>
  );
}

function Hardest({ teams }) {
  if (!teams.length) return null;
  const rows = BOXES.flatMap((b) => b.quizzes.map((q) => {
    const st = teams.map((t) => t.s.g.boxes?.[b.id]?.quizzes?.[q.id]).filter(Boolean);
    return { b, q, tried: st.length, done: st.filter((s) => s.done).length, wrong: st.reduce((n, s) => n + (s.totalWrong || 0), 0) };
  })).filter((r) => r.tried);
  if (!rows.length) return null;
  rows.sort((a, b) => b.wrong / b.tried - a.wrong / a.tried);
  return (
    <section className="t-box">
      <h2>정리 시간에 짚어 볼 퀴즈</h2>
      <table className="t-table"><thead><tr><th>보관함</th><th>퀴즈</th><th>푼 학생</th><th>오답 수</th></tr></thead>
        <tbody>{rows.slice(0, 6).map((r) => <tr key={r.b.id + r.q.id}><td>{r.b.year}</td><td>{r.q.title}</td><td>{r.done}/{r.tried}</td><td>{r.wrong}</td></tr>)}</tbody>
      </table>
    </section>
  );
}
