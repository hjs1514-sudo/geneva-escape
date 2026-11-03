// 진행판(교실 TV)용 급박한 배경음악.
// 실제 악기 녹음(첼로·콘트라베이스·바이올린·피아노·호른·튜바, tonejs-instruments MIT 샘플)으로 만든
// 58초짜리 곡(public/media/bgm.mp3)을 이음매 없이 반복한다. 132 BPM, 32마디.
import { useEffect, useRef, useState } from 'react';

const LOOP = (60 / 132 / 2) * 8 * 32; // 곡 한 바퀴 길이(초)

export class TenseMusic {
  async start(volume = 0.6) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!this.ctx) {
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
    }
    await this.ctx.resume();
    this.setVolume(volume);
    if (!this.buf) {
      const ab = await (await fetch('media/bgm.mp3')).arrayBuffer();
      this.buf = await new Promise((ok, no) => this.ctx.decodeAudioData(ab, ok, no));
    }
    this.src?.stop();
    const src = (this.src = this.ctx.createBufferSource());
    src.buffer = this.buf;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = Math.min(LOOP, this.buf.duration);
    src.connect(this.gain);
    src.start();
    return true;
  }

  stop() {
    try { this.src?.stop(); } catch { /* 이미 멈춤 */ }
    this.src = null;
  }

  setVolume(v) {
    if (this.gain) this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05);
  }
}

const VOL_KEY = 'geneva-music-vol';

/** 배경음악 켜기/끄기 버튼 + 소리 크기. 브라우저 규칙상 처음 한 번은 눌러야 소리가 난다 */
export function MusicButton() {
  const m = useRef(null);
  const [on, setOn] = useState(false);
  const [vol, setVol] = useState(() => { try { return Number(localStorage.getItem(VOL_KEY)) || 0.6; } catch { return 0.6; } });
  useEffect(() => () => m.current?.stop(), []);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    m.current ||= new TenseMusic();
    if (on) { m.current.stop(); setOn(false); return; }
    setBusy(true);
    try { if (await m.current.start(vol)) setOn(true); } catch { alert('배경음악을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'); }
    setBusy(false);
  };
  const change = (v) => {
    setVol(v);
    m.current?.setVolume(v);
    try { localStorage.setItem(VOL_KEY, String(v)); } catch { /* 저장 안 돼도 괜찮음 */ }
  };
  return (
    <div className={`music ${on ? 'on' : ''}`}>
      <button className="btn small ghost" onClick={toggle} disabled={busy}>{busy ? '♪ 불러오는 중…' : on ? '♪ 배경음악 끄기' : '♪ 급박한 배경음악 켜기'}</button>
      {on && <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => change(Number(e.target.value))} aria-label="배경음악 소리 크기" />}
    </div>
  );
}
