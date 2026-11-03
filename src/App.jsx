import { useEffect, useRef, useState } from 'react';
import { SETTINGS, AVATARS, STORY, BOXES } from './data/game.js';
import { useGame, useSettings, useNow, fmtTime, newId, keysOf } from './lib/store.js';
import { useSync } from './lib/api.js';
import { GlossProvider, T } from './components/common.jsx';
import Explore from './screens/Explore.jsx';
import Teacher from './screens/Teacher.jsx';
import Board from './screens/Board.jsx';

function useRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  return { path: path || '/', q: new URLSearchParams(query) };
}

export default function App() {
  const { path, q } = useRoute();
  if (path.startsWith('/teacher')) return <GlossProvider><Teacher /></GlossProvider>;
  if (path.startsWith('/board')) return <Board q={q} />;
  return <GlossProvider><Student q={q} /></GlossProvider>;
}

function Student({ q }) {
  const [game, update, reset] = useGame();
  const [settings] = useSettings();
  const now = useNow(500);
  const sync = useSync(game, update);

  // QR 주소로 받은 수업 설정 (?c=수업코드&m=분&g=경비원수&s=빠르기)
  const fromQr = q.get('c') || q.get('m') || q.get('g');
  const cfg = game.cfg || {
    guards: q.has('g') ? Number(q.get('g')) : settings.guards,
    speed: q.has('s') ? Number(q.get('s')) : settings.speed,
    minutes: q.has('m') ? Number(q.get('m')) : settings.minutes,
    code: q.get('c') || '',
  };

  // 시간 초과
  useEffect(() => {
    if (game.startedAt && !game.outcome && game.endAt && now > game.endAt) {
      update((x) => { x.outcome = 'timeout'; return x; });
    }
  }, [now, game.startedAt, game.outcome, game.endAt, update]);

  if (!game.nick && !game.introSeen) return <OpeningVideo onDone={() => update((x) => { x.introSeen = true; return x; })} />;
  if (!game.nick) return <Join cfg={cfg} fromQr={!!fromQr} update={update} />;
  if (!game.startedAt) return <Intro game={game} update={update} reset={reset} />;
  if (game.outcome) return <End game={game} reset={reset} sync={sync} />;
  return <Explore game={game} update={update} cfg={game.cfg || cfg} now={now} />;
}

function Join({ cfg, fromQr, update }) {
  const [code, setCode] = useState(cfg.code || '');
  const [nick, setNick] = useState('');
  const [av, setAv] = useState('');
  const ok = nick.trim().length >= 1 && av && (!code || /^\d{4}$/.test(code));
  const go = (e) => {
    e.preventDefault();
    if (!ok) return;
    update((x) => {
      x.nick = nick.trim().slice(0, 8);
      x.avatar = av;
      x.classCode = code;
      x.teamId = code ? newId() : '';
      x.minutes = cfg.minutes || SETTINGS.minutes;
      x.cfg = { guards: cfg.guards, speed: cfg.speed, minutes: x.minutes };
      return x;
    });
  };
  return (
    <div className="join" style={{ backgroundImage: 'url(art/entry_bg.webp)' }}>
      <form className="join-card" onSubmit={go}>
        <div className="join-kicker">국제 연합 조사관 등록</div>
        <h1>{SETTINGS.title}</h1>
        <label>수업 코드 <small>(선생님이 알려 준 4자리 · 혼자 연습하면 비워 두기)</small>
          <input inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="예) 2917" readOnly={fromQr && !!cfg.code} />
        </label>
        <label>닉네임 <small>(8자까지)</small>
          <input value={nick} maxLength={8} onChange={(e) => setNick(e.target.value)} placeholder="조사관 이름" />
        </label>
        <div className="av-pick-label">조사관 고르기</div>
        <div className="av-pick">
          {AVATARS.map((a) => (
            <button type="button" key={a.id} className={`av ${av === a.id ? 'on' : ''}`} onClick={() => setAv(a.id)} title={a.name}>
              <img src={`art/av_${a.id}.webp`} alt={a.name} />
            </button>
          ))}
        </div>
        <button className="btn big" disabled={!ok}>조사관 등록</button>
        <a className="teacher-link" href="#/teacher">교사 화면</a>
      </form>
    </div>
  );
}

export function IdCard({ game, children }) {
  return (
    <div className="id-card" style={{ backgroundImage: 'url(art/id_card.webp)' }}>
      <div className="id-photo"><img src={`art/av_${game.avatar}.webp`} alt="" /></div>
      <div className="id-name">{game.nick}</div>
      <div className="id-role">국제 연합 조사관 · 1946</div>
      {children}
    </div>
  );
}

function Intro({ game, update, reset }) {
  const [page, setPage] = useState(0);
  const start = () => update((x) => {
    x.startedAt = Date.now();
    x.endAt = Date.now() + (x.minutes || SETTINGS.minutes) * 60000;
    return x;
  });
  return (
    <div className="intro">
      {page === 0 && (
        <div className="intro-card">
          <IdCard game={game} />
          <p>조사관 등록이 끝났어요. 이 통행증 3장이 있어야 문서고를 돌아다닐 수 있어요.</p>
          <div className="row center">
            <button className="btn ghost" onClick={() => { reset(); update((x) => { x.introSeen = true; return x; }); }}>다시 등록</button>
            <button className="btn" onClick={() => setPage(2)}>관리인의 편지 읽기</button>
          </div>
        </div>
      )}
      {page === 2 && (
        <div className="letter" style={{ backgroundImage: 'url(art/letter.webp)' }}>
          <div className="letter-date">1946년 4월, 제네바</div>
          <p>{STORY.letter}</p>
          <p className="sig">{STORY.signature}</p>
          <p className="paper-note">{STORY.note}</p>
          <button className="btn big" onClick={start}>문서고로 들어가기</button>
        </div>
      )}
    </div>
  );
}

// 주소에 들어오자마자 도입 영상 → 끝나면 로그인(조사관 등록) 화면
function OpeningVideo({ onDone }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const has = useVideo();
  useEffect(() => {
    if (has === false) { onDone(); return; }
    const v = ref.current;
    if (!has || !v) return;
    v.muted = false;
    v.play().catch(() => {
      // 소리 있는 자동 재생이 막히면 소리 없이 시작하고 '소리 켜기'를 보여 준다
      v.muted = true; setMuted(true);
      v.play().catch(() => setNeedTap(true));
    });
  }, [has]); // eslint-disable-line react-hooks/exhaustive-deps
  const unmute = () => { const v = ref.current; v.muted = false; setMuted(false); v.play(); };
  const start = () => { const v = ref.current; v.muted = false; setMuted(false); setNeedTap(false); v.currentTime = 0; v.play(); };
  return (
    <div className="opening">
      {has && <video ref={ref} src="media/intro.mp4" playsInline preload="auto" onEnded={onDone} />}
      {needTap && <button className="opening-play" onClick={start} aria-label="도입 영상 재생">▶<span>도입 영상 보기</span></button>}
      <div className="opening-bar">
        {muted && !needTap && <button className="btn" onClick={unmute}>🔊 소리 켜기</button>}
        <button className="btn small ghost" onClick={onDone}>건너뛰기</button>
      </div>
    </div>
  );
}

function useVideo() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    fetch('media/intro.mp4', { method: 'HEAD' }).then((r) => setOk(r.ok && (r.headers.get('content-type') || '').includes('video'))).catch(() => setOk(false));
  }, []);
  return ok;
}

function End({ game, reset, sync }) {
  const won = game.outcome === 'escaped';
  const used = (won ? game.escapedAt : game.endAt) - game.startedAt;
  return (
    <div className="end" style={{ backgroundImage: `url(art/${won ? 'ending' : 'vault'}.webp)` }}>
      <div className="end-card">
        <h1>{won ? '평화의 열쇠를 전했다!' : '문서고가 봉인되었다'}</h1>
        <IdCard game={game}>
          <div className={`stamp ${won ? 'ok' : 'no'}`}>{won ? '임무 완수' : '시간 초과'}</div>
        </IdCard>
        <table className="end-stats"><tbody>
          <tr><th>걸린 시간</th><td>{fmtTime(used)}</td></tr>
          <tr><th>모은 열쇠</th><td>{keysOf(game)} / {BOXES.length}</td></tr>
          <tr><th>경비원에게 들킨 횟수</th><td>{game.caught || 0}번</td></tr>
        </tbody></table>
        {won && <blockquote className="my-sentence">“{game.vault.sentence}”</blockquote>}
        {!won && <p>선생님께 시간을 더 받으면 이어서 할 수 있어요.</p>}
        <details className="records">
          <summary>관리인의 기록 다시 읽기</summary>
          {BOXES.filter((b) => game.boxes[b.id]?.keyAt).map((b) => <p key={b.id}><b>{b.year} {b.keyWord}</b> — <T>{b.record}</T></p>)}
        </details>
        {game.classCode && <p className="small">진행판 연결: {sync === 'ok' ? '선생님 화면에 전달됨' : sync === 'error' ? '연결 안 됨(다시 시도 중)' : '-'}</p>}
        <button className="btn ghost" onClick={() => { if (confirm('이 기기의 기록을 지우고 처음부터 할까요?')) reset(); }}>처음부터 다시</button>
      </div>
    </div>
  );
}
