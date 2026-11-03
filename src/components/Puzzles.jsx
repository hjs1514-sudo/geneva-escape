import { useMemo, useState, useEffect } from 'react';
import { T, plain } from './common.jsx';
import { shuffle } from '../lib/store.js';

// 모든 퍼즐은 onResult(correct:boolean, answerSummary:string) 을 부릅니다.

export function Choice({ step, onResult, locked }) {
  const [picked, setPicked] = useState(null);
  const [wrongs, setWrongs] = useState([]);
  useEffect(() => { setPicked(null); setWrongs([]); }, [step]);
  const choose = (i) => {
    if (locked) return;
    setPicked(i);
    const ok = i === step.answer;
    if (!ok) setWrongs((w) => [...w, i]);
    onResult(ok, plain(step.options[i]));
  };
  return (
    <div className="choices">
      {step.options.map((o, i) => (
        <button
          key={i}
          className={`choice ${picked === i && i === step.answer ? 'right' : ''} ${wrongs.includes(i) ? 'wrong' : ''}`}
          onClick={() => choose(i)}
          disabled={locked || wrongs.includes(i)}
        >
          <span className="choice-no">{'①②③④⑤⑥'[i]}</span>
          <span><T inert>{o}</T></span>
        </button>
      ))}
    </div>
  );
}

export function Match({ step, onResult, locked }) {
  const [sel, setSel] = useState(null);
  const [pairs, setPairs] = useState({}); // left -> right
  const [bad, setBad] = useState([]);
  const rightOrder = useMemo(() => shuffle(step.right, 11), [step]);
  const usedRight = Object.values(pairs);
  const pickRight = (ri) => {
    if (sel === null || locked) return;
    const next = { ...pairs };
    for (const k of Object.keys(next)) if (next[k] === ri) delete next[k];
    next[sel] = ri;
    setPairs(next); setSel(null); setBad([]);
  };
  const check = () => {
    const wrong = step.left.map((_, i) => i).filter((i) => pairs[i] !== step.answer[i]);
    setBad(wrong);
    onResult(wrong.length === 0, step.left.map((l, i) => `${l}→${plain(step.right[pairs[i]] ?? '?')}`).join(', '));
  };
  return (
    <div className="match">
      <div className="match-cols">
        <div className="match-col">
          {step.left.map((l, i) => (
            <button key={i} className={`match-item ${sel === i ? 'sel' : ''} ${pairs[i] !== undefined ? 'paired' : ''} ${bad.includes(i) ? 'wrong' : ''}`}
              onClick={() => !locked && setSel(i)}>
              <span><T inert>{l}</T></span>
              {pairs[i] !== undefined && <small>→ {plain(step.right[pairs[i]])}</small>}
            </button>
          ))}
        </div>
        <div className="match-col">
          {rightOrder.map(([r, ri]) => (
            <button key={ri} className={`match-item right-side ${usedRight.includes(ri) ? 'used' : ''}`} onClick={() => pickRight(ri)} disabled={sel === null}>
              <span><T inert>{r}</T></span>
            </button>
          ))}
        </div>
      </div>
      <p className="howto">왼쪽 카드를 누른 뒤, 짝이 되는 오른쪽 카드를 누르세요.</p>
      <button className="btn" disabled={locked || Object.keys(pairs).length < step.left.length} onClick={check}>연결 확인</button>
    </div>
  );
}

export function Order({ step, onResult, locked }) {
  const pool = useMemo(() => shuffle(step.items, 5), [step]);
  const [seq, setSeq] = useState([]);
  const [bad, setBad] = useState(false);
  const add = (i) => { if (!locked && !seq.includes(i)) { setSeq([...seq, i]); setBad(false); } };
  const check = () => {
    const ok = seq.every((v, k) => v === k);
    setBad(!ok);
    onResult(ok, seq.map((i) => i + 1).join('-'));
    if (!ok) setTimeout(() => setSeq([]), 900);
  };
  return (
    <div className="order">
      <div className="order-slots">
        {step.items.map((_, k) => (
          <div key={k} className={`order-slot ${bad ? 'wrong' : ''}`}>
            <span className="order-no">{k + 1}</span>
            {seq[k] !== undefined ? <span><T inert>{step.items[seq[k]]}</T></span> : <em>카드를 눌러 놓으세요</em>}
          </div>
        ))}
      </div>
      <div className="order-pool">
        {pool.map(([it, i]) => (
          <button key={i} className="card-btn" disabled={seq.includes(i) || locked} onClick={() => add(i)}><T inert>{it}</T></button>
        ))}
      </div>
      <div className="row">
        <button className="btn ghost" onClick={() => setSeq([])} disabled={locked}>처음부터</button>
        <button className="btn" disabled={locked || seq.length < step.items.length} onClick={check}>순서 확인</button>
      </div>
    </div>
  );
}

export function Classify({ step, onResult, locked }) {
  const items = useMemo(() => shuffle(step.items, 3), [step]);
  const [put, setPut] = useState({}); // idx -> bin
  const [bad, setBad] = useState([]);
  const check = () => {
    const wrong = step.items.map((_, i) => i).filter((i) => put[i] !== step.items[i].bin);
    setBad(wrong);
    onResult(wrong.length === 0, `틀린 카드 ${wrong.length}장`);
  };
  return (
    <div className="classify">
      {items.map(([it, i]) => (
        <div key={i} className={`classify-row ${bad.includes(i) ? 'wrong' : ''}`}>
          <span className="classify-text"><T inert>{it.text}</T></span>
          <div className="seg">
            {step.bins.map((b, bi) => (
              <button key={bi} className={put[i] === bi ? 'on' : ''} disabled={locked}
                onClick={() => { setPut({ ...put, [i]: bi }); setBad(bad.filter((x) => x !== i)); }}>{b}</button>
            ))}
          </div>
        </div>
      ))}
      <button className="btn" disabled={locked || Object.keys(put).length < step.items.length} onClick={check}>나누기 확인</button>
    </div>
  );
}

export function Step({ step, onResult, locked }) {
  const P = { choice: Choice, match: Match, order: Order, classify: Classify }[step.type];
  return <P step={step} onResult={onResult} locked={locked} />;
}
