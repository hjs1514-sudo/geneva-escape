// 진행판(교실 TV)용 급박한 배경음악. 음악 파일 없이 브라우저(Web Audio)에서 바로 만든다.
// 낮은 심장 박동 + 시계 초침 + 단조 베이스 반복 + 긴장감 있는 현악 같은 울림, 8마디마다 조금씩 차오른다.
import { useEffect, useRef, useState } from 'react';

const BPM = 132;
const BEAT = 60 / BPM;
const STEP = BEAT / 2; // 8분음표
// A단조 반복(8분음표 16개 = 2마디). 숫자는 A1(55Hz) 기준 반음
const BASS = [0, 0, 12, 0, 1, 0, 12, 0, 0, 0, 12, 0, 3, 1, 0, -2];
const hz = (semi, base = 55) => base * 2 ** (semi / 12);

function makeNoise(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export class TenseMusic {
  constructor() {
    this.ctx = null;
    this.timer = null;
    this.step = 0;
    this.next = 0;
  }

  start(volume = 0.6) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!this.ctx) {
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.comp = ctx.createDynamicsCompressor();
      this.comp.connect(this.master);
      this.noise = makeNoise(ctx);
      // 계속 울리는 낮은 현악 울림 (A2 + E3, 살짝 어긋나게)
      this.padGain = ctx.createGain();
      this.padGain.gain.value = 0.05;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 700;
      this.padGain.connect(lp); lp.connect(this.comp);
      this.padLp = lp;
      [[110, -6], [110, 7], [164.8, -4], [164.8, 5]].forEach(([f, det]) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        o.connect(this.padGain); o.start();
      });
      // 천천히 숨 쉬듯 밝아졌다 어두워지기
      const lfo = ctx.createOscillator();
      const lfoAmt = ctx.createGain();
      lfo.frequency.value = 0.12; lfoAmt.gain.value = 350;
      lfo.connect(lfoAmt); lfoAmt.connect(lp.frequency); lfo.start();
    }
    this.ctx.resume();
    this.setVolume(volume);
    this.step = 0;
    this.next = this.ctx.currentTime + 0.1;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 25);
    return true;
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.ctx) this.ctx.suspend();
  }

  setVolume(v) {
    if (this.master) this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.9, this.ctx.currentTime, 0.05);
  }

  schedule() {
    const ctx = this.ctx;
    while (this.next < ctx.currentTime + 0.15) {
      this.play(this.step, this.next);
      this.next += STEP;
      this.step++;
    }
  }

  play(i, t) {
    const bar = Math.floor(i / 8);
    const inBar = i % 8;
    const phrase = bar % 8; // 8마디마다 긴장이 쌓였다가 풀린다
    // 심장 박동: 1·2박(쿵-쿵)
    if (inBar === 0 || inBar === 1) this.thump(t, inBar === 0 ? 1 : 0.6);
    if (phrase >= 4 && (inBar === 4 || inBar === 5)) this.thump(t, inBar === 4 ? 0.8 : 0.5);
    // 시계 초침: 8분음표마다, 정박은 조금 더 크게
    this.tick(t, inBar % 2 === 0 ? 0.32 : 0.16);
    // 베이스 반복
    this.bass(t, hz(BASS[i % 16]), phrase >= 6 ? 0.2 : 0.15);
    // 후반 4마디: 높은 현악 떨림(트레몰로)으로 긴장 올리기
    if (phrase >= 4) this.tremolo(t, hz(phrase >= 6 ? 15 : 12, 440 / 2), 0.02 + (phrase - 4) * 0.012);
    // 8마디 끝: 솟아오르는 소리
    if (phrase === 7 && inBar === 0) this.riser(t, BEAT * 4);
    if (this.padLp && inBar === 0) this.padGain.gain.setTargetAtTime(0.04 + phrase * 0.006, t, 0.5);
  }

  thump(t, amp) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g); g.connect(this.comp);
    o.start(t); o.stop(t + 0.35);
  }

  tick(t, amp) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass'; hp.frequency.value = 5200; hp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    s.connect(hp); hp.connect(g); g.connect(this.comp);
    s.start(t); s.stop(t + 0.05);
  }

  bass(t, f, amp) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(160, t + STEP * 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 0.95);
    o.connect(lp); lp.connect(g); g.connect(this.comp);
    o.start(t); o.stop(t + STEP);
  }

  tremolo(t, f, amp) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    // 16분음표 두 번 떨기
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.02);
    g.gain.linearRampToValueAtTime(amp * 0.2, t + STEP / 2);
    g.gain.linearRampToValueAtTime(amp, t + STEP / 2 + 0.02);
    g.gain.linearRampToValueAtTime(0.0001, t + STEP);
    o.connect(lp); lp.connect(g); g.connect(this.comp);
    o.start(t); o.stop(t + STEP + 0.02);
  }

  riser(t, dur) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(this.comp);
    s.start(t); s.stop(t + dur);
  }
}

const VOL_KEY = 'geneva-music-vol';

/** 배경음악 켜기/끄기 버튼 + 소리 크기. 브라우저 규칙상 처음 한 번은 눌러야 소리가 난다 */
export function MusicButton() {
  const m = useRef(null);
  const [on, setOn] = useState(false);
  const [vol, setVol] = useState(() => { try { return Number(localStorage.getItem(VOL_KEY)) || 0.6; } catch { return 0.6; } });
  useEffect(() => () => m.current?.stop(), []);
  const toggle = () => {
    m.current ||= new TenseMusic();
    if (on) { m.current.stop(); setOn(false); } else if (m.current.start(vol)) setOn(true);
  };
  const change = (v) => {
    setVol(v);
    m.current?.setVolume(v);
    try { localStorage.setItem(VOL_KEY, String(v)); } catch { /* 저장 안 돼도 괜찮음 */ }
  };
  return (
    <div className={`music ${on ? 'on' : ''}`}>
      <button className="btn small ghost" onClick={toggle}>{on ? '♪ 배경음악 끄기' : '♪ 급박한 배경음악 켜기'}</button>
      {on && <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => change(Number(e.target.value))} aria-label="배경음악 소리 크기" />}
    </div>
  );
}
