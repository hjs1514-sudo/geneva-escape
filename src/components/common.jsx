import { useState, createContext, useContext } from 'react';
import { GLOSSARY } from '../data/game.js';

// ---------- 낱말 풀이 ----------
const GlossCtx = createContext(() => {});
export function GlossProvider({ children }) {
  const [word, setWord] = useState(null);
  return (
    <GlossCtx.Provider value={setWord}>
      {children}
      {word && (
        <div className="gloss-pop" role="dialog" onClick={() => setWord(null)}>
          <div className="gloss-card" onClick={(e) => e.stopPropagation()}>
            <div className="gloss-word">{word}</div>
            <p>{GLOSSARY[word.replace(/\s/g, '')] || '뜻을 준비 중이에요.'}</p>
            <button className="btn small" onClick={() => setWord(null)}>알겠어요</button>
          </div>
        </div>
      )}
    </GlossCtx.Provider>
  );
}

export function T({ children, inert = false }) {
  const open = useContext(GlossCtx);
  const text = String(children ?? '');
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{\{(.+)\}\}$/);
        if (m && inert) return <b key={i} className="gloss-inert">{m[1]}</b>;
        if (m) {
          return (
            <button key={i} className="gloss" onClick={(e) => { e.stopPropagation(); open(m[1]); }}>
              {m[1]}
            </button>
          );
        }
        return p.split('\n').map((line, j, arr) => (
          <span key={`${i}-${j}`}>{line}{j < arr.length - 1 && <br />}</span>
        ));
      })}
    </>
  );
}
export const plain = (s) => String(s).replace(/\{\{([^}]+)\}\}/g, '$1');

// ---------- 교사 PIN ----------
export function PinModal({ title, pin, onOk, onCancel, children }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (v === pin) onOk(); else { setErr(true); setV(''); }
  };
  return (
    <div className="modal-back">
      <form className="modal paper-dark" onSubmit={submit}>
        <h3>{title}</h3>
        {children}
        <label className="pin-label">교사 PIN
          <input type="password" inputMode="numeric" autoFocus value={v} onChange={(e) => { setV(e.target.value); setErr(false); }} />
        </label>
        {err && <div className="err">PIN이 맞지 않아요.</div>}
        <div className="row">
          <button type="button" className="btn ghost" onClick={onCancel}>닫기</button>
          <button className="btn">확인</button>
        </div>
      </form>
    </div>
  );
}

// 퍼즐 단계 안(선택지·카드)에 들어 있는 낱말을 모아 칩으로 보여 줌
export function StepWords({ step }) {
  const open = useContext(GlossCtx);
  const texts = [];
  const walk = (v) => {
    if (typeof v === 'string') texts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => k !== 'q' && k !== 'hints' && walk(x));
  };
  walk(step);
  const words = [...new Set(texts.join(' ').match(/\{\{([^}]+)\}\}/g)?.map((w) => w.slice(2, -2)) || [])];
  if (!words.length) return null;
  return (
    <div className="step-words">
      <span>이 문제의 낱말</span>
      {words.map((w) => <button key={w} className="word-chip" onClick={() => open(w)}>{w}</button>)}
    </div>
  );
}
