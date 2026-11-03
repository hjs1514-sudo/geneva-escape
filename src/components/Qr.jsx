import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { SETTINGS } from '../data/game.js';

export function appUrl() {
  if (SETTINGS.appUrl) return SETTINGS.appUrl;
  return `${location.origin}${location.pathname}`;
}
export const shortUrl = (u) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');

export function useQr(url, size) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: size, errorCorrectionLevel: 'M', color: { dark: '#2a2118', light: '#f4ecd6' } })
      .then((d) => alive && setSrc(d)).catch(() => alive && setSrc(null));
    return () => { alive = false; };
  }, [url, size]);
  return src;
}

/** 작은 QR을 누르면 크게 뜹니다 */
export function Qr({ url, label = '입장 QR', big: bigTitle = '각자 기기의 카메라로 찍으세요', sub }) {
  const src = useQr(url, 200);
  const [big, setBig] = useState(false);
  return (
    <>
      <button className="qr-mini" onClick={() => setBig(true)} title="눌러서 크게 보기">
        {src ? <img src={src} alt={`입장 QR: ${url}`} /> : <span className="qr-mini-wait" />}
        <span>{label}</span>
      </button>
      {big && <QrBig url={url} title={bigTitle} sub={sub} onClose={() => setBig(false)} />}
    </>
  );
}

function QrBig({ url, title, sub, onClose }) {
  const src = useQr(url, 900);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 복사 불가 */ }
  };
  return (
    <div className="qr-big" onClick={onClose}>
      <div className="qr-big-card" onClick={(e) => e.stopPropagation()}>
        <div className="qr-big-title">{title}</div>
        {sub && <div className="qr-big-sub">{sub}</div>}
        {src && <img src={src} alt={`QR: ${url}`} />}
        <div className="qr-big-url">{shortUrl(url)}</div>
        <div className="row center">
          <button className="btn ghost" onClick={copy}>{copied ? '복사했어요' : '주소 복사'}</button>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
