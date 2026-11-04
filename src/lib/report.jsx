// 진행판 → 수업 결과 PDF. 한글 글꼴을 PDF에 넣지 않아도 되도록, A4 쪽을 화면에 그린 뒤 그림으로 찍어 PDF에 붙인다.
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { BOXES, SETTINGS } from '../data/game.js';
import { fmtTime } from './store.js';

const W = 794, H = 1123; // A4, 96dpi
const STATUS = { escaped: '탈출', timeout: '시간 초과', out: '쉬는 중', playing: '탐색 중', waiting: '입장 전' };

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
const dateText = (ms) => { const d = new Date(ms); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function rowOf(t) {
  const g = t.s.g;
  const lockWrong = BOXES.reduce((n, b) => n + (g.boxes?.[b.id]?.lockWrong || 0), 0);
  const hints = Object.values(g.findHints || {}).reduce((a, b) => a + b, 0);
  const quizHints = BOXES.reduce((n, b) => n + Object.values(g.boxes?.[b.id]?.quizzes || {}).filter((q) => (q.totalWrong || 0) > 0).length, 0);
  const used = g.outcome === 'escaped' && g.escapedAt ? g.escapedAt - g.startedAt : null;
  return { name: t.team, status: STATUS[t.s.status] || '-', keys: t.s.keys, used, caught: g.caught || 0, wrong: t.s.wrong, lockWrong, hints, quizHints, sentence: g.vault?.sentence || '' };
}

const css = `
.rp{width:${W}px;height:${H}px;box-sizing:border-box;padding:46px 50px 40px;background:#fff;color:#222;font-family:'Noto Sans KR',system-ui,sans-serif;font-size:12.5px;line-height:1.5;position:relative;overflow:hidden}
.rp h1{font-family:'Noto Serif KR',serif;font-size:24px;margin:0 0 2px}
.rp h2{font-family:'Noto Serif KR',serif;font-size:15px;margin:18px 0 8px;padding-bottom:4px;border-bottom:2px solid #b08a3e}
.rp .kick{color:#9a6b1f;font-weight:700;letter-spacing:.1em;font-size:11px}
.rp .meta{color:#555;margin-bottom:6px}
.rp table{width:100%;border-collapse:collapse}
.rp th,.rp td{border:1px solid #d7cfbf;padding:4px 6px;text-align:center}
.rp th{background:#f3ecdd;font-weight:700}
.rp td.l{text-align:left}
.rp .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.rp .card{border:1px solid #d7cfbf;border-radius:8px;padding:8px 10px;background:#faf7f0}
.rp .card b{display:block;font-size:20px;color:#7a4f12}
.rp .ok{color:#2f6b3e;font-weight:700}
.rp .q{border-left:3px solid #b08a3e;background:#faf7f0;padding:6px 10px;margin:0 0 6px;font-family:'Noto Serif KR',serif}
.rp .foot{position:absolute;left:50px;right:50px;bottom:20px;display:flex;justify-content:space-between;color:#999;font-size:10.5px}
.rp .note{color:#777;font-size:11px;margin-top:6px}
`;

function Page({ no, total, title, children }) {
  return (
    <div className="rp">
      {children}
      <div className="foot"><span>{SETTINGS.title} · {title}</span><span>{no} / {total}</span></div>
    </div>
  );
}

function StudentTable({ rows, start }) {
  return (
    <table>
      <thead><tr><th>번호</th><th>닉네임</th><th>결과</th><th>열쇠</th><th>걸린 시간</th><th>들킴</th><th>자물쇠 오답</th><th>퀴즈 오답</th><th>찾기 힌트</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i}><td>{start + i + 1}</td><td className="l">{r.name}</td><td className={r.status === '탈출' ? 'ok' : ''}>{r.status}</td><td>{r.keys}/{BOXES.length}</td>
          <td>{r.used != null ? fmtTime(r.used) : '-'}</td><td>{r.caught}</td><td>{r.lockWrong}</td><td>{r.wrong}</td><td>{r.hints}</td></tr>
      ))}</tbody>
    </table>
  );
}

function buildPages({ cls, data, teams }) {
  const rows = teams.map(rowOf).sort((a, b) => b.keys - a.keys || (a.used ?? 9e12) - (b.used ?? 9e12) || a.name.localeCompare(b.name));
  const escaped = rows.filter((r) => r.status === '탈출');
  const avgUsed = escaped.length ? escaped.reduce((n, r) => n + r.used, 0) / escaped.length : null;
  const avgKeys = rows.length ? (rows.reduce((n, r) => n + r.keys, 0) / rows.length).toFixed(1) : '0';
  const title = data?.title || cls.title || `수업 ${cls.code}`;
  const created = data?.created_at || cls.created_at || Date.now();

  const boxRows = BOXES.map((b) => {
    const gs = teams.map((t) => t.s.g);
    const found = gs.filter((g) => g.found?.includes(b.id)).length;
    const opened = gs.filter((g) => g.boxes?.[b.id]?.opened).length;
    const keyed = gs.filter((g) => g.boxes?.[b.id]?.keyAt).length;
    const lockWrong = gs.reduce((n, g) => n + (g.boxes?.[b.id]?.lockWrong || 0), 0);
    const hint = gs.filter((g) => g.findHints?.[b.id]).length;
    return { b, found, opened, keyed, lockWrong, hint };
  });
  const quizRows = BOXES.flatMap((b) => b.quizzes.map((q) => {
    const st = teams.map((t) => t.s.g.boxes?.[b.id]?.quizzes?.[q.id]).filter(Boolean);
    const wrong = st.reduce((n, s) => n + (s.totalWrong || 0), 0);
    return { b, q, tried: st.length, done: st.filter((s) => s.done).length, wrong, per: st.length ? wrong / st.length : 0 };
  }));
  const hardest = [...quizRows].filter((r) => r.tried).sort((a, b) => b.per - a.per).slice(0, 3);
  const sentences = rows.filter((r) => r.sentence);

  const FIRST = 26, NEXT = 38;
  const restRows = chunk(rows.slice(FIRST), NEXT);
  const sentPages = chunk(sentences, 16);
  const pages = [];
  pages.push((n, T) => (
    <Page key="p1" no={n} total={T} title={title}>
      <div className="kick">수업 결과 보고서</div>
      <h1>{SETTINGS.title}</h1>
      <div className="meta">{title} · 수업 코드 {cls.code} · {dateText(created)} · 제한 시간 {data?.minutes ?? cls.minutes ?? SETTINGS.minutes}분 · 저장 {dateText(Date.now())}</div>
      <div className="cards">
        <div className="card">참여 학생<b>{rows.length}명</b></div>
        <div className="card">탈출<b>{escaped.length}명</b></div>
        <div className="card">평균 열쇠<b>{avgKeys}개</b></div>
        <div className="card">평균 탈출 시간<b>{avgUsed != null ? fmtTime(avgUsed) : '-'}</b></div>
      </div>
      <h2>학생별 결과</h2>
      {rows.length ? <StudentTable rows={rows.slice(0, FIRST)} start={0} /> : <p>아직 들어온 학생이 없어요.</p>}
      <p className="note">찾기 힌트: 보관함·금고 위치 힌트를 받은 횟수 · 들킴: 경비원 손전등에 걸린 횟수 · 닉네임 외의 개인 정보는 모으지 않아요.</p>
    </Page>
  ));
  restRows.forEach((part, i) => pages.push((n, T) => (
    <Page key={`s${i}`} no={n} total={T} title={title}><h2>학생별 결과 (이어서)</h2><StudentTable rows={part} start={FIRST + i * NEXT} /></Page>
  )));
  pages.push((n, T) => (
    <Page key="boxes" no={n} total={T} title={title}>
      <h2>보관함별 진행</h2>
      <table>
        <thead><tr><th>보관함</th><th>암호</th><th>열쇠 낱말</th><th>발견</th><th>자물쇠 엶</th><th>열쇠 얻음</th><th>자물쇠 오답</th><th>찾기 힌트 쓴 학생</th></tr></thead>
        <tbody>{boxRows.map((r) => <tr key={r.b.id}><td className="l">{r.b.no}. {r.b.name}</td><td>{r.b.year}</td><td>{r.b.keyWord}</td><td>{r.found}</td><td>{r.opened}</td><td>{r.keyed}</td><td>{r.lockWrong}</td><td>{r.hint}</td></tr>)}</tbody>
      </table>
      <h2>퀴즈별 결과</h2>
      <table>
        <thead><tr><th>보관함</th><th>퀴즈</th><th>도전</th><th>해결</th><th>오답 합계</th><th>1인당 오답</th></tr></thead>
        <tbody>{quizRows.map((r) => <tr key={r.b.id + r.q.id}><td>{r.b.year}</td><td className="l">{r.q.title}</td><td>{r.tried}</td><td>{r.done}</td><td>{r.wrong}</td><td>{r.tried ? r.per.toFixed(1) : '-'}</td></tr>)}</tbody>
      </table>
      {hardest.length > 0 && <><h2>정리 시간에 짚어 볼 퀴즈</h2>{hardest.map((r) => <p key={r.b.id + r.q.id} className="q">{r.b.year} 「{r.q.title}」 — 도전한 학생 1명당 오답 {r.per.toFixed(1)}번</p>)}</>}
    </Page>
  ));
  (sentPages.length ? sentPages : [[]]).forEach((part, i) => pages.push((n, T) => (
    <Page key={`t${i}`} no={n} total={T} title={title}>
      <h2>새 기구(국제 연합)에 전한 한 문장{i ? ' (이어서)' : ''}</h2>
      {part.length ? part.map((r, k) => <p key={k} className="q"><b>{r.name}</b> “{r.sentence}”</p>) : <p>아직 한 문장을 남긴 학생이 없어요.</p>}
    </Page>
  )));
  const T = pages.length;
  return { title, pages: pages.map((f, i) => f(i + 1, T)) };
}

export async function downloadReport(args) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${W}px;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    const { title, pages } = buildPages(args);
    flushSync(() => root.render(<><style>{css}</style>{pages}</>));
    await document.fonts?.ready;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const els = host.querySelectorAll('.rp');
    for (let i = 0; i < els.length; i++) {
      const canvas = await html2canvas(els[i], { scale: 2, backgroundColor: '#ffffff', logging: false, width: W, height: H });
      if (i) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
    }
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const url = URL.createObjectURL(pdf.output('blob'));
    const a = document.createElement('a');
    a.href = url;
    a.download = `geneva1946_result_${args.cls.code}_${stamp}.pdf`; // 한글 파일 이름은 일부 브라우저에서 깨져 영문으로
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return title;
  } finally {
    root.unmount();
    host.remove();
  }
}
