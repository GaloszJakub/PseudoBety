'use client';

interface Props { data: number[]; height?: number; }

export default function PressureWave({ data, height = 28 }: Props) {
  if (!data || data.length === 0) return null;
  const width = 200;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
  const areaPoints = `0,${height} ` + points + ` ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`}
         style={{ width: '100%', height, display: 'block' }}
         preserveAspectRatio="none">
      <defs>
        <linearGradient id="pressGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0cf5e" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f0cf5e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#pressGrad)" />
      <polyline points={points} fill="none" stroke="#f0cf5e" strokeWidth="1" />
    </svg>
  );
}
