'use client';
import { useState } from 'react';

interface Props { code: string; size?: number; accent?: string | null; logo?: string; }

export default function TeamCrest({ code, size = 28, accent = null, logo }: Props) {
  const [imgError, setImgError] = useState(false);

  if (logo && !imgError) {
    return (
      <img
        src={logo}
        alt={code}
        width={size}
        height={size}
        style={{ flexShrink: 0, display: 'block', objectFit: 'contain' }}
        onError={() => setImgError(true)}
      />
    );
  }

  const initials = (code || '?').slice(0, 3);
  const fontSize = initials.length <= 2 ? 38 : 28;
  const palette = ['#1a3a7e','#4a2078','#7a1a2e','#1a5e4e','#5e3a1a','#2a4a7a','#5a1a4e','#1e3e1a'];
  let hash = 0;
  for (const c of code) hash = (hash * 31 + c.charCodeAt(0)) & 0xfffff;
  const bg = accent || palette[hash % palette.length];

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0, display: 'block' }}>
      <circle cx="50" cy="50" r="48" fill={bg} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <text x="50" y="58" textAnchor="middle" fontFamily="Manrope, sans-serif"
            fontWeight="700" fontSize={fontSize} fill="#ffffff" letterSpacing="-1">
        {initials}
      </text>
    </svg>
  );
}
