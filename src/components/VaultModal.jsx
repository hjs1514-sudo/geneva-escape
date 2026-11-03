import { useMemo, useState } from 'react';
import { BOXES, VAULT } from '../data/game.js';
import { shuffle } from '../lib/store.js';
import { LockPad } from './BoxModal.jsx';

export default function VaultModal({ game, update, onClose }) {
  const v = game.vault || {};
  const words = BOXES.map((b) => b.keyWord);
  const pool = useMemo(() => shuffle(words, 19), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [fill, setFill] = useState(v.placed ? words : [null, null, null, null]);
  const [sel, setSel] = useState(fill.findIndex((x) => !x));
  const [bad, setBad] = useState([]);
  const [shake, setShake] = useState(false);
  const [msg, setMsg] = useState('');
  const [text, setText] = useState(v.sentence || '');

  const sentence = (line, i) => {
    const m = line.match(/^(.*)\{(\d)\}(.*)$/);
    const k = Number(m[2]);
    return (
      <p key={i} className="concl-line">
        {m[1]}
        <button className={`blank ${sel === k ? 'sel' : ''} ${bad.includes(k) ? 'wrong' : ''} ${fill[k] ? 'filled' : ''}`}
          disabled={v.placed} onClick={() => setSel(k)}>{fill[k] || '열쇠 자리'}</button>
        {m[3]}
      </p>
    );
  };

  const put = (w) => {
    if (sel < 0) return;
    const f = fill.map((x) => (x === w ? null : x));
    f[sel] = w;
    setFill(f); setBad([]);
    const next = f.findIndex((x) => !x);
    setSel(next);
  };
  const check = () => {
    const wrong = fill.map((w, i) => (w === words[i] ? -1 : i)).filter((i) => i >= 0);
    setBad(wrong);
    if (!wrong.length) update((x) => { x.vault.placed = true; return x; });
  };
  const tryCode = (c) => {
    if (c === VAULT.code) { update((x) => { x.vault.open = true; return x; }); return; }
    setShake(true); setTimeout(() => setShake(false), 500);
    update((x) => { x.vault.wrong = (x.vault.wrong || 0) + 1; return x; });
    setMsg('다이얼이 돌아가지 않는다. 결론 문장의 마지막 줄을 다시 읽어 보자.');
  };
  const submit = () => {
    update((x) => {
      x.vault.sentence = text.trim();
      x.vault.at = Date.now();
      x.outcome = 'escaped';
      x.escapedAt = Date.now();
      return x;
    });
  };

  return (
    <div className="modal-back">
      <div className="modal vault-modal">
        <button className="close-x" onClick={onClose} aria-label="닫기">×</button>
        {!v.placed && (
          <>
            <div className="vault-head"><img src="art/vault.webp" alt="" /><div>
              <h3>지하 금고</h3>
              <p>금고 문에 열쇠 구멍 네 개와 문장이 새겨져 있다. 빈칸을 누르고 알맞은 열쇠 낱말을 끼워 넣자.</p>
            </div></div>
            <div className="concl">{VAULT.conclusion.map(sentence)}</div>
            <div className="word-pool">
              {pool.map(([w]) => <button key={w} className={`chip big ${fill.includes(w) ? 'used' : ''}`} onClick={() => put(w)}>{w}</button>)}
            </div>
            {bad.length > 0 && <p className="err">맞지 않는 열쇠가 {bad.length}개 있다. 빨간 칸을 다시 생각해 보자.</p>}
            <button className="btn" disabled={fill.some((x) => !x)} onClick={check}>열쇠 돌리기</button>
          </>
        )}
        {v.placed && !v.open && (
          <>
            <h3>마지막 다이얼</h3>
            <div className="concl done">{VAULT.conclusion.map((l, i) => <p key={i} className="concl-line">{l.replace(/\{(\d)\}/, (_, k) => `【${words[k]}】`)}</p>)}</div>
            <p className="lock-note">{VAULT.codeNote}</p>
            <LockPad onSubmit={tryCode} shake={shake} label="금고 암호 4자리" />
            {msg && <p className="err">{msg}</p>}
          </>
        )}
        {v.open && (
          <>
            <img className="ending-img" src="art/ending.webp" alt="열린 금고" />
            <h3>평화의 열쇠</h3>
            <blockquote className="charter">{VAULT.charter}<cite>{VAULT.charterCite}</cite></blockquote>
            <label className="ask">{VAULT.ask}
              <textarea value={text} maxLength={140} rows={3} onChange={(e) => setText(e.target.value)} placeholder="예) 나라끼리 다툼이 생기면 무력 대신 대화로 풀어야 한다." />
            </label>
            <div className="small">{text.trim().length}/140자 · 10자 넘게 써 주세요</div>
            <button className="btn big" disabled={text.trim().length < 10} onClick={submit}>새 기구에 전하고 탈출하기</button>
          </>
        )}
      </div>
    </div>
  );
}
