import { useState } from 'react';
import { SETTINGS, BOXES, CLUES, VAULT, STANDARDS } from '../data/game.js';
import { useSettings, useGame } from '../lib/store.js';
import { PinModal, T, plain } from '../components/common.jsx';
import { Qr, appUrl } from '../components/Qr.jsx';

function answerText(s) {
  if (s.type === 'choice') return `정답: ${'①②③④'[s.answer]} ${plain(s.options[s.answer])}`;
  if (s.type === 'match') return `정답: ${s.left.map((l, i) => `${plain(l)}→${plain(s.right[s.answer[i]])}`).join(' / ')}`;
  if (s.type === 'order') return `정답 순서: ${s.items.map(plain).join(' → ')}`;
  if (s.type === 'classify') return `정답: ${s.bins.map((b, bi) => `[${b}] ${s.items.filter((x) => x.bin === bi).map((x) => x.text).join(', ')}`).join(' / ')}`;
  return '';
}

export default function Teacher() {
  const [settings, setSettings] = useSettings();
  const [, , resetGame] = useGame();
  const [ok, setOk] = useState(false);
  const [f, setF] = useState(settings);
  const [saved, setSaved] = useState(false);
  if (!ok) {
    return (
      <div className="teacher">
        <PinModal title="교사 화면" pin={settings.pin} onOk={() => setOk(true)} onCancel={() => { location.hash = '#/'; }}>
          <p>처음 PIN은 {SETTINGS.teacherPin}이에요. 들어가서 바꿀 수 있어요.</p>
        </PinModal>
      </div>
    );
  }
  const soloUrl = `${appUrl()}#/?m=${f.minutes}&g=${f.guards}&s=${f.speed}`;
  return (
    <div className="teacher">
      <header className="t-head">
        <h1>교사 화면 · {SETTINGS.title}</h1>
        <div className="row">
          <a className="btn" href="#/board">실시간 진행판 열기</a>
          <a className="btn ghost" href="#/">학생 화면</a>
        </div>
      </header>
      <section className="t-box">
        <h2>수업 설정 (이 기기)</h2>
        <p className="small">수업 코드로 진행할 때는 진행판에서 정한 설정이 QR에 담겨 학생 기기로 갑니다. 여기 설정은 수업 코드 없이 이 기기에서 할 때 쓰입니다.</p>
        <div className="t-form">
          <label>제한 시간(분)<input type="number" min={10} max={90} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} /></label>
          <label>경비원 수<select value={f.guards} onChange={(e) => setF({ ...f, guards: Number(e.target.value) })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}명</option>)}</select></label>
          <label>경비원 빠르기<select value={f.speed} onChange={(e) => setF({ ...f, speed: Number(e.target.value) })}><option value={0.7}>느림</option><option value={1}>보통</option><option value={1.3}>빠름</option></select></label>
          <label>교사 PIN<input value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} /></label>
          <button className="btn small" onClick={() => { setSettings({ ...f, pin: f.pin || SETTINGS.teacherPin }); setSaved(true); setTimeout(() => setSaved(false), 1500); }}>{saved ? '저장했어요' : '저장'}</button>
        </div>
        <div className="row">
          <Qr url={soloUrl} label="수업 코드 없이 입장 QR" />
          <button className="btn ghost" onClick={() => { if (confirm('이 기기의 학생 기록을 지울까요?')) { resetGame(); alert('지웠어요.'); } }}>이 기기 학생 기록 지우기</button>
        </div>
      </section>

      <section className="t-box">
        <h2>미리 보기와 정답</h2>
        <p className="small">{STANDARDS[0]}</p>
        <h3>지도 위 단서</h3>
        <ul>{CLUES.map((c) => <li key={c.id}><b>{c.title}</b>: {plain(c.body)}</li>)}</ul>
        {BOXES.map((b) => (
          <details key={b.id} className="t-detail">
            <summary>보관함 {b.no} · {b.name} — {b.room} · 암호 <b>{b.year}</b> · 열쇠 낱말 <b>{b.keyWord}</b></summary>
            <p className="small">{b.lockNote}</p>
            <h4>자료 카드</h4>
            <ul>{b.cards.map((c) => <li key={c.id}><b>{c.title}</b>: <T inert>{c.body}</T>{c.note && <em> ({c.note})</em>}</li>)}</ul>
            <h4>퀴즈</h4>
            {b.quizzes.map((q) => (
              <div key={q.id} className="t-quiz">
                <b>{q.title}</b> (조각 「{q.piece}」, 함께 볼 자료: {q.combine.map((id) => b.cards.find((c) => c.id === id)?.title).join(', ')})
                <ol>{q.steps.map((s, i) => <li key={i}><T inert>{s.q}</T><br /><span className="answer">{answerText(s)}</span></li>)}</ol>
              </div>
            ))}
            <h4>정리 글</h4>
            <p><T inert>{b.record}</T></p>
          </details>
        ))}
        <details className="t-detail">
          <summary>지하 금고 — 관리인 사무실 · 암호 <b>{VAULT.code}</b></summary>
          <ol>{VAULT.conclusion.map((l, i) => <li key={i}>{l.replace(/\{(\d)\}/, (_, k) => `【${BOXES[k].keyWord}】`)}</li>)}</ol>
          <p>{VAULT.charter} — {VAULT.charterCite}</p>
        </details>
      </section>
    </div>
  );
}
