import { useEffect, useRef, useState, useCallback } from 'react';
import { WORLD, SPAWN, BOXES, CLUES, VAULT, SETTINGS, ROOMS } from '../data/game.js';
import { moveFrom, guardAt, spotted, wedge, dist, roomOf, inShadow, GUARD_COUNT } from '../lib/world.js';
import { keysOf, fmtTime } from '../lib/store.js';
import BoxModal from '../components/BoxModal.jsx';
import VaultModal from '../components/VaultModal.jsx';
import { T } from '../components/common.jsx';

const SPEED = 150;      // 아바타 걸음(px/초)
const FIND = 78;        // 이만큼 가까이 가면 보관함 발견
const NEAR = 70;        // 단서·보관함을 열 수 있는 거리
const SPARKLE = 175;    // 근처에 무언가 있다는 신호
const AV_H = 92, GUARD_H = 96;

export default function Explore({ game, update, cfg, now }) {
  const viewRef = useRef(null);
  const [view, setView] = useState({ w: 800, h: 500 });
  const pos = useRef({ ...(game.pos || SPAWN) });
  const keys = useRef({});
  const stick = useRef(null);     // 화면 조이스틱 {dx, dy}
  const target = useRef(null);    // 눌러서 가기
  const face = useRef(1);
  const walking = useRef(false);
  const safeUntil = useRef(0);
  const chaser = useRef(null);    // 자물쇠를 틀려 출동한 경비원 {x, y, until}
  const [, setTick] = useState(0);
  const [modal, setModal] = useState(null); // {type:'box', id} | {type:'clue', id} | {type:'vault'} | {type:'found', id}
  const [flash, setFlash] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const g = useRef(game);
  g.current = game;
  const paused = !!modal || showMap || (game.outUntil && game.outUntil > now) || game.outcome;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const nGuards = Math.min(GUARD_COUNT, cfg.guards ?? SETTINGS.guards);
  const gSpeed = cfg.speed ?? SETTINGS.guardSpeed;

  // 화면 크기
  useEffect(() => {
    const el = viewRef.current;
    const ro = new ResizeObserver(() => setView({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 키보드
  useEffect(() => {
    const MAP = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', a: 'l', d: 'r', w: 'u', s: 'd', A: 'l', D: 'r', W: 'u', S: 'd' };
    const kd = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      const k = MAP[e.key];
      if (k) { keys.current[k] = true; target.current = null; e.preventDefault(); }
    };
    const ku = (e) => { const k = MAP[e.key]; if (k) keys.current[k] = false; };
    const blur = () => { keys.current = {}; };
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur); };
  }, []);

  const caught = useCallback((how) => {
    safeUntil.current = Date.now() + 3000;
    pos.current = { ...SPAWN };
    target.current = null;
    keys.current = {};
    stick.current = null;
    setFlash(how === 'bump' ? '경비원과 부딪혔다!' : '손전등에 비쳤다! 경비원에게 들켰다!');
    setTimeout(() => setFlash(null), 2200);
    update((x) => {
      x.caught = (x.caught || 0) + 1;
      x.lives = Math.max(0, (x.lives ?? SETTINGS.lives) - 1);
      x.pos = { ...SPAWN };
      if (x.lives === 0) x.outUntil = Date.now() + SETTINGS.outMinutes * 60000;
      return x;
    });
  }, [update]);

  // 게임 고리
  useEffect(() => {
    let raf, last = performance.now(), lastSave = 0;
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!pausedRef.current) {
        let dx = 0, dy = 0;
        const k = keys.current;
        if (k.l) dx -= 1; if (k.r) dx += 1; if (k.u) dy -= 1; if (k.d) dy += 1;
        if (stick.current) { dx = stick.current.dx; dy = stick.current.dy; }
        if (!dx && !dy && target.current) {
          const tx = target.current.x - pos.current.x, ty = target.current.y - pos.current.y;
          const d = Math.hypot(tx, ty);
          if (d < 6) target.current = null; else { dx = tx / d; dy = ty / d; }
        }
        const len = Math.hypot(dx, dy);
        walking.current = len > 0.05;
        if (len > 0.05) {
          const s = Math.min(1, len);
          const before = pos.current;
          pos.current = moveFrom(before, (dx / len) * s * SPEED * dt, (dy / len) * s * SPEED * dt);
          if (pos.current === before && target.current) target.current = null; // 막혔으면 멈춤
          if (dx) face.current = dx > 0 ? 1 : -1;
        }
        // 경비원
        if (Date.now() > safeUntil.current) {
          const tt = Date.now() / 1000;
          for (let i = 0; i < nGuards; i++) {
            const hit = spotted(guardAt(i, tt, gSpeed), pos.current);
            if (hit) { caught(hit); break; }
          }
          const c = chaser.current;
          if (c && Date.now() < c.until) {
            const vx = pos.current.x - c.x, vy = pos.current.y - c.y, d = Math.hypot(vx, vy);
            if (d > 1) { c.x += (vx / d) * 96 * gSpeed * dt; c.y += (vy / d) * 96 * gSpeed * dt; c.dir = Math.atan2(vy, vx); }
            if (Date.now() > safeUntil.current && spotted(c, pos.current)) { caught('light'); chaser.current = null; }
          } else if (c) chaser.current = null;
        }
        if (t - lastSave > 1000) {
          lastSave = t;
          const p = { x: Math.round(pos.current.x), y: Math.round(pos.current.y) };
          const old = g.current.pos;
          if (!old || old.x !== p.x || old.y !== p.y) update((x) => { x.pos = p; return x; });
        }
      }
      setTick((n) => (n + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [nGuards, gSpeed, caught, update]);

  // 통행증 쉬는 시간이 끝나면 1장으로 다시 시작
  useEffect(() => {
    if (game.outUntil && game.outUntil <= now) {
      update((x) => { x.outUntil = null; x.lives = Math.max(1, x.lives); x.pos = { ...SPAWN }; return x; });
      pos.current = { ...SPAWN };
    }
  }, [game.outUntil, now, update]);

  // 보관함 발견
  const p = pos.current;
  useEffect(() => {
    if (paused) return;
    const b = BOXES.find((b) => !game.found.includes(b.id) && dist(b.at, p) < FIND);
    if (b) {
      update((x) => { if (!x.found.includes(b.id)) x.found.push(b.id); return x; });
      keys.current = {}; stick.current = null; target.current = null;
      setModal({ type: 'found', id: b.id });
    }
  });

  // 카메라
  const fit = Math.min(view.w / WORLD.w, view.h / WORLD.h);
  const scale = Math.max(fit, Math.min(1.5, Math.max(view.w / 760, view.h / 700)));
  const camX = WORLD.w * scale <= view.w ? (view.w - WORLD.w * scale) / 2 : -Math.max(0, Math.min(WORLD.w * scale - view.w, p.x * scale - view.w / 2));
  const camY = WORLD.h * scale <= view.h ? (view.h - WORLD.h * scale) / 2 : -Math.max(0, Math.min(WORLD.h * scale - view.h, p.y * scale - view.h / 2));

  const tapWorld = (e) => {
    if (paused) return;
    const r = viewRef.current.getBoundingClientRect();
    target.current = { x: (e.clientX - r.left - camX) / scale, y: (e.clientY - r.top - camY) / scale };
  };

  const tt = Date.now() / 1000;
  const guards = Array.from({ length: nGuards }, (_, i) => guardAt(i, tt, gSpeed));
  if (chaser.current) guards.push({ ...chaser.current, chase: true });
  const keyCount = keysOf(game);
  const vaultOn = keyCount >= BOXES.length;

  // 지금 할 수 있는 일
  const nearBox = BOXES.find((b) => game.found.includes(b.id) && !game.boxes[b.id]?.keyAt && dist(b.at, p) < NEAR);
  const nearClue = CLUES.find((c) => dist(c.at, p) < NEAR);
  const nearVault = vaultOn && dist(VAULT.at, p) < NEAR + 10;
  const sparkle = BOXES.some((b) => !game.found.includes(b.id) && dist(b.at, p) < SPARKLE);
  const hidden = inShadow(p);
  const here = roomOf(p);

  const left = game.endAt ? game.endAt - now : 0;
  const out = game.outUntil && game.outUntil > now;

  const alarm = (at) => {
    // 가장 가까운 문에서 경비원이 달려온다
    const doors = [{ x: 240, y: 445 }, { x: 772, y: 445 }, { x: 1286, y: 445 }, { x: 484, y: 520 }, { x: 1062, y: 520 }, { x: 770, y: 520 }];
    const d = doors.reduce((a, b) => (dist(b, at) < dist(a, at) ? b : a));
    chaser.current = { x: d.x, y: d.y, dir: 0, until: Date.now() + 9000, name: '출동한 경비원' };
    setFlash('덜컹! 소리를 들은 경비원이 달려온다! 몸을 숨겨!');
    setTimeout(() => setFlash(null), 2600);
  };

  return (
    <div className="explore">
      <header className="hud">
        <div className="hud-left">
          <img className="hud-av" src={`art/av_${game.avatar}.webp`} alt="" />
          <div>
            <div className="hud-nick">{game.nick}</div>
            <div className="hud-room">{here.name || '문서고'}{hidden ? ' · 그림자 속에 숨었다' : ''}</div>
          </div>
        </div>
        <div className="hud-mid">
          <div className={`hud-time ${left < 5 * 60000 ? 'urgent' : ''}`} title="봉인까지 남은 시간">봉인까지 {fmtTime(left)}</div>
        </div>
        <div className="hud-right">
          <div className="hud-lives" aria-label={`통행증 ${game.lives}장`}>
            {Array.from({ length: SETTINGS.lives }, (_, i) => <span key={i} className={`pass ${i < game.lives ? '' : 'lost'}`} title="통행증" />)}
          </div>
          <div className="hud-keys" aria-label={`열쇠 ${keyCount}개`}>
            {BOXES.map((b) => <img key={b.id} src={`art/${b.key}.webp`} className={game.boxes[b.id]?.keyAt ? '' : 'nokey'} alt="" />)}
          </div>
          <button className="btn small ghost" onClick={() => setShowMap(true)}>지도</button>
        </div>
      </header>

      <div className="world-view" ref={viewRef} onPointerDown={tapWorld}>
        <div className="world" style={{ width: WORLD.w, height: WORLD.h, transform: `translate(${camX}px, ${camY}px) scale(${scale})` }}>
          <img className="world-map" src="art/map.webp" alt="" draggable={false} />
          {CLUES.map((c) => (
            <div key={c.id} className={`clue ${game.cluesRead.includes(c.id) ? 'read' : ''}`} style={{ left: c.at.x, top: c.at.y }}>
              <img src={`art/${c.img}.webp`} alt="" draggable={false} />
            </div>
          ))}
          {BOXES.filter((b) => game.found.includes(b.id)).map((b) => (
            <div key={b.id} className={`map-box ${game.boxes[b.id]?.keyAt ? 'done' : ''}`} style={{ left: b.at.x, top: b.at.y }}>
              <img src={`art/${b.img}.webp`} alt="" draggable={false} />
            </div>
          ))}
          {vaultOn && <div className="map-vault" style={{ left: VAULT.at.x, top: VAULT.at.y }}><span>지하 금고</span></div>}
          <svg className="lights" width={WORLD.w} height={WORLD.h}>
            {guards.map((gd, i) => <path key={i} d={wedge(gd)} className={gd.chase ? 'light chase' : 'light'} />)}
          </svg>
          {guards.map((gd, i) => (
            <img key={i} className={`guard ${gd.moving ? 'walk' : ''}`} src="art/guard.webp" alt=""
              style={{ left: gd.x, top: gd.y, height: GUARD_H, transform: `translate(-50%, -100%) scaleX(${Math.cos(gd.dir) < 0 ? -1 : 1})` }} />
          ))}
          <div className={`me ${walking.current ? 'walk' : ''} ${Date.now() < safeUntil.current ? 'blink' : ''} ${hidden ? 'hidden' : ''}`} style={{ left: p.x, top: p.y }}>
            <img src={`art/av_${game.avatar}.webp`} alt="나" style={{ height: AV_H, transform: `scaleX(${face.current})` }} draggable={false} />
            <span className="me-name">{game.nick}</span>
          </div>
        </div>

        {sparkle && !paused && <div className="sparkle-hint">이 근처에서 무언가 반짝인다…</div>}
        {flash && <div className="flash">{flash}</div>}
        {game.toast && <Toast text={game.toast} onDone={() => update((x) => { x.toast = null; return x; })} />}

        <div className="actions" onPointerDown={(e) => e.stopPropagation()}>
          {nearVault && <button className="btn big" onClick={() => setModal({ type: 'vault' })}>지하 금고로 내려가기</button>}
          {nearBox && <button className="btn big" onClick={() => setModal({ type: 'box', id: nearBox.id })}>{game.boxes[nearBox.id]?.opened ? '보관함 자료 보기' : '보관함 열기'}</button>}
          {nearClue && <button className="btn big ghost" onClick={() => setModal({ type: 'clue', id: nearClue.id })}>{nearClue.title} 읽기</button>}
        </div>
        <Joystick stick={stick} target={target} />
        {!game.found.length && !paused && !flash && <div className="first-tip">방향키(또는 화면 왼쪽 아래 조이스틱, 바닥 누르기)로 움직여요. 노란 손전등 빛을 피하고, 책장·서가 옆 그림자에 숨을 수 있어요.</div>}
      </div>

      {modal?.type === 'found' && (
        <div className="modal-back">
          <div className="modal found-pop">
            <div className="found-title">보관함을 발견했다!</div>
            <img src={`art/${BOXES.find((b) => b.id === modal.id).img}.webp`} alt="" />
            <p>잠긴 보관함이다. 자물쇠를 열려면 4자리 암호가 필요하다.</p>
            <div className="row center">
              <button className="btn ghost" onClick={() => setModal(null)}>나중에</button>
              <button className="btn" onClick={() => setModal({ type: 'box', id: modal.id })}>자물쇠 살펴보기</button>
            </div>
          </div>
        </div>
      )}
      {modal?.type === 'box' && (
        <BoxModal box={BOXES.find((b) => b.id === modal.id)} game={game} update={update} onClose={() => setModal(null)}
          onAlarm={() => { const b = BOXES.find((x) => x.id === modal.id); setModal(null); alarm(b.at); }} />
      )}
      {modal?.type === 'clue' && (() => {
        const c = CLUES.find((x) => x.id === modal.id);
        return (
          <div className="modal-back" onClick={() => setModal(null)}>
            <div className="modal clue-pop" onClick={(e) => e.stopPropagation()}>
              <img src={`art/${c.img}.webp`} alt="" />
              <h3>{c.title}</h3>
              <p className="paper-body"><T>{c.body}</T></p>
              <button className="btn" onClick={() => { update((x) => { if (!x.cluesRead.includes(c.id)) x.cluesRead.push(c.id); return x; }); setModal(null); }}>수첩에 적어 두기</button>
            </div>
          </div>
        );
      })()}
      {modal?.type === 'vault' && <VaultModal game={game} update={update} onClose={() => setModal(null)} />}
      {showMap && <MiniMap game={game} p={p} onClose={() => setShowMap(false)} />}
      {out && (
        <div className="modal-back">
          <div className="modal out-pop">
            <img src="art/guard.webp" alt="" />
            <h3>통행증을 모두 잃었다</h3>
            <p>경비원에게 문서고 밖으로 쫓겨났다. 잠시 숨을 고르고 다시 들어가자.</p>
            <div className="out-time">{fmtTime(game.outUntil - now)} 뒤 통행증 1장으로 다시 들어가요</div>
            <p className="small">모아 둔 열쇠와 수첩은 그대로 남아 있어요.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Toast({ text, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [text, onDone]);
  return <div className="flash good">{text}</div>;
}

function Joystick({ stick, target }) {
  const [knob, setKnob] = useState(null);
  const base = useRef(null);
  const onDown = (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    target.current = null;
    onMove(e);
  };
  const onMove = (e) => {
    if (!base.current || (e.type === 'pointermove' && e.buttons === 0 && e.pointerType === 'mouse')) return;
    const r = base.current.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > 1) { dx /= d; dy /= d; }
    stick.current = { dx, dy };
    setKnob({ dx, dy });
  };
  const onUp = () => { stick.current = null; setKnob(null); };
  return (
    <div className="joystick" ref={base} onPointerDown={onDown} onPointerMove={(e) => knob && onMove(e)} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="knob" style={knob ? { transform: `translate(${knob.dx * 34}px, ${knob.dy * 34}px)` } : null} />
    </div>
  );
}

function MiniMap({ game, p, onClose }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal minimap" onClick={(e) => e.stopPropagation()}>
        <h3>문서고 지도</h3>
        <div className="mini-wrap">
          <img src="art/map.webp" alt="문서고 1층 지도" />
          {ROOMS.map((r) => <span key={r.id} className="mini-room" style={{ left: `${((r.x + r.w / 2) / WORLD.w) * 100}%`, top: `${((r.y + r.h / 2) / WORLD.h) * 100}%` }}>{r.name}</span>)}
          {BOXES.filter((b) => game.found.includes(b.id)).map((b) => (
            <span key={b.id} className={`mini-box ${game.boxes[b.id]?.keyAt ? 'done' : ''}`} style={{ left: `${(b.at.x / WORLD.w) * 100}%`, top: `${(b.at.y / WORLD.h) * 100}%` }}>{b.year}</span>
          ))}
          <span className="mini-me" style={{ left: `${(p.x / WORLD.w) * 100}%`, top: `${(p.y / WORLD.h) * 100}%` }} />
        </div>
        <div className="notebook">
          <h4>조사 수첩</h4>
          {game.cluesRead.length === 0 && <p className="small">아직 읽은 단서가 없어요. 지도 곳곳의 게시판·달력·신문·전보를 찾아보세요.</p>}
          {game.cluesRead.map((id) => {
            const c = CLUES.find((x) => x.id === id);
            return c ? <p key={id}><b>{c.title}</b> — <T inert>{c.body}</T></p> : null;
          })}
        </div>
        <button className="btn" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
