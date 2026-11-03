import { useState } from 'react';
import { SETTINGS } from '../data/game.js';
import { boxState, quizState, useImageOk } from '../lib/store.js';
import { T, StepWords } from './common.jsx';
import { Step } from './Puzzles.jsx';

export function LockPad({ onSubmit, shake, label = '암호 4자리' }) {
  const [v, setV] = useState('');
  const press = (d) => setV((x) => (x.length < 4 ? x + d : x));
  const submit = () => { if (v.length === 4) { onSubmit(v); setV(''); } };
  return (
    <div className={`lockpad ${shake ? 'shake' : ''}`}>
      <div className="lock-face">
        <img src="art/lock.webp" alt="" />
        <div className="lock-digits" aria-label={label}>
          {[0, 1, 2, 3].map((i) => <span key={i}>{v[i] ?? ''}</span>)}
        </div>
      </div>
      <input className="sr-only" inputMode="numeric" value={v} aria-label={label}
        onChange={(e) => setV(e.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <div className="keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <button key={d} className="key" onClick={() => press(String(d))}>{d}</button>)}
        <button className="key ghost" onClick={() => setV('')}>지우기</button>
        <button className="key" onClick={() => press('0')}>0</button>
        <button className="key go" disabled={v.length < 4} onClick={submit}>열기</button>
      </div>
    </div>
  );
}

export function PaperCard({ card, onClick, small }) {
  const ok = useImageOk(card.kind === 'photo' && card.src ? `${card.src}.jpg` : null);
  const frame = { doc: 'card_doc', photo: 'card_photo', telegram: 'card_telegram', letter: 'letter' }[card.kind];
  return (
    <button className={`paper-card ${card.kind} ${small ? 'small' : ''}`} onClick={onClick} style={{ backgroundImage: `url(art/${frame}.webp)` }}>
      {card.kind === 'photo' && ok ? <img className="pc-photo" src={`sources/${card.src}.jpg`} alt="" /> : null}
      <span className="pc-title">{card.title}</span>
      {!small && <span className="pc-body"><T inert>{card.body}</T></span>}
    </button>
  );
}

function CardView({ card, onClose }) {
  const ok = useImageOk(card.kind === 'photo' && card.src ? `${card.src}.jpg` : null);
  return (
    <div className="modal-back top" onClick={onClose}>
      <div className={`card-view ${card.kind}`} onClick={(e) => e.stopPropagation()}>
        {card.kind === 'photo' && ok && <img className="cv-photo" src={`sources/${card.src}.jpg`} alt={card.title} />}
        <h3>{card.title}</h3>
        <p className="paper-body"><T>{card.body}</T></p>
        {card.cite && <div className="paper-cite">— {card.cite}</div>}
        {card.note && <div className="paper-note">{card.note}</div>}
        <button className="btn" onClick={onClose}>내려놓기</button>
      </div>
    </div>
  );
}

export default function BoxModal({ box, game, update, onClose, onAlarm }) {
  const bs = game.boxes[box.id] || { opened: false, lockWrong: 0, quizzes: {} };
  const [shake, setShake] = useState(false);
  const [msg, setMsg] = useState('');
  const [spill, setSpill] = useState(false);
  const [view, setView] = useState(null);
  const [qi, setQi] = useState(() => Math.max(0, box.quizzes.findIndex((q) => !bs.quizzes[q.id]?.done)));
  const done = box.quizzes.every((q) => bs.quizzes[q.id]?.done);

  const tryCode = (v) => {
    if (Number(v) === box.year) {
      update((x) => { boxState(x, box.id).opened = true; boxState(x, box.id).openedAt = Date.now(); return x; });
      setSpill(true);
      setTimeout(() => setSpill(false), 1800);
      return;
    }
    setShake(true); setTimeout(() => setShake(false), 500);
    const n = (bs.lockWrong || 0) + 1;
    update((x) => { boxState(x, box.id).lockWrong = n; return x; });
    if (SETTINGS.lockWrongLimit && n % SETTINGS.lockWrongLimit === 0) { onAlarm(); return; }
    setMsg(`철컥… 열리지 않는다. (${n % SETTINGS.lockWrongLimit}/${SETTINGS.lockWrongLimit}번 틀림 · 3번 틀리면 경비원이 소리를 듣는다)`);
  };

  // 자물쇠
  if (!bs.opened) {
    return (
      <div className="modal-back">
        <div className="modal box-lock">
          <button className="close-x" onClick={onClose} aria-label="닫기">×</button>
          <div className="box-head">
            <img src={`art/${box.img}.webp`} alt="" />
            <div>
              <div className="box-no">보관함 {box.no} · {box.room}</div>
              <h3>{box.name}</h3>
              <p className="lock-note">{box.lockNote}</p>
              <p className="small">중요한 역사적 사건이 일어난 해를 4자리로 넣어요. 모르겠으면 지도 곳곳의 단서(게시판·달력·신문·전보)를 찾아보세요.</p>
            </div>
          </div>
          <LockPad onSubmit={tryCode} shake={shake} />
          {msg && <p className="err">{msg}</p>}
        </div>
      </div>
    );
  }

  // 열쇠를 얻은 뒤
  if (done) {
    return (
      <div className="modal-back">
        <div className="modal key-got">
          <img className="key-img" src={`art/${box.key}.webp`} alt="" />
          <div className="key-label">열쇠를 얻었다!</div>
          <div className="key-word">{box.quizzes.map((q) => <span key={q.id}>{q.piece}</span>)}<b> → {box.keyWord}</b></div>
          <div className="record"><h4>관리인의 기록</h4><p><T>{box.record}</T></p></div>
          <button className="btn" onClick={() => {
            update((x) => { const b = boxState(x, box.id); b.keyAt ||= Date.now(); return x; });
            onClose();
          }}>열쇠를 챙겨 지도로 돌아가기</button>
        </div>
      </div>
    );
  }

  const quiz = box.quizzes[qi];
  const qs = bs.quizzes[quiz.id] || { step: 0, wrong: 0, hints: 0, done: false };
  const step = quiz.steps[Math.min(qs.step, quiz.steps.length - 1)];
  const hint = qs.wrong > 0 ? step.hints?.[Math.min(qs.wrong, step.hints.length) - 1] : null;

  const onResult = (ok) => {
    update((x) => {
      const s = quizState(x, box.id, quiz.id);
      if (ok) {
        s.step += 1; s.wrong = 0;
        if (s.step >= quiz.steps.length) { s.done = true; s.doneAt = Date.now(); }
      } else { s.wrong += 1; s.totalWrong = (s.totalWrong || 0) + 1; }
      return x;
    });
    if (ok && qs.step + 1 >= quiz.steps.length) {
      const next = box.quizzes.findIndex((q, i) => i !== qi && !bs.quizzes[q.id]?.done);
      if (next >= 0) setTimeout(() => setQi(next), 900);
    }
  };

  return (
    <div className="modal-back">
      <div className="desk">
        <button className="close-x" onClick={onClose} aria-label="닫기">×</button>
        <div className="desk-head">
          <h3>보관함 {box.no} · {box.name}</h3>
          <span className="small">쏟아진 자료를 눌러 읽고, 두세 장을 함께 견주어 퀴즈를 풀어요.</span>
        </div>
        <div className={`spill ${spill ? 'go' : ''}`}>
          {box.cards.map((c, i) => (
            <div key={c.id} className="spill-slot" style={{ '--i': i, '--r': `${((i * 37) % 15) - 7}deg` }}>
              <PaperCard card={c} small onClick={() => setView(c)} />
            </div>
          ))}
        </div>
        <div className="quiz-tabs">
          {box.quizzes.map((q, i) => {
            const st = bs.quizzes[q.id];
            return (
              <button key={q.id} className={`quiz-tab ${i === qi ? 'on' : ''} ${st?.done ? 'done' : ''}`} onClick={() => setQi(i)}>
                <span>{st?.done ? q.piece : '?'}</span>{q.title}
              </button>
            );
          })}
        </div>
        <div className="quiz">
          <div className="combine">
            <span>함께 볼 자료</span>
            {quiz.combine.map((id) => {
              const c = box.cards.find((x) => x.id === id);
              return <button key={id} className="chip" onClick={() => setView(c)}>{c.title}</button>;
            })}
          </div>
          {qs.done ? (
            <p className="good">풀었다! 글자 조각 「{quiz.piece}」을 얻었다.</p>
          ) : (
            <>
              {quiz.steps.length > 1 && <div className="step-count">{qs.step + 1} / {quiz.steps.length}</div>}
              <p className="q"><T>{step.q}</T></p>
              <StepWords step={step} />
              <Step key={`${quiz.id}-${qs.step}`} step={step} onResult={onResult} locked={false} />
              {hint && <p className="hint">힌트: <T>{hint}</T></p>}
            </>
          )}
        </div>
      </div>
      {view && <CardView card={view} onClose={() => setView(null)} />}
    </div>
  );
}
