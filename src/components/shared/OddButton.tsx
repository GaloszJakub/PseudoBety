'use client';

interface Props {
  label?: string;
  sub?: string;
  value: number;
  delta?: number | null;
  selected?: boolean;
  onClick: () => void;
  big?: boolean;
  hot?: boolean;
}

export default function OddButton({ label, sub, value, delta, selected, onClick, big, hot }: Props) {
  const arrow = delta == null ? null : delta > 0 ? '▲' : delta < 0 ? '▼' : null;
  const cls = ['odd-btn', selected && 'selected', big && 'big'].filter(Boolean).join(' ');
  return (
    <button className={cls} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {(label || sub) && (
        <span className="odd-label">
          <span>
            {label}
            {sub && label !== sub && <span style={{ marginLeft: 4, opacity: 0.55 }}>{sub}</span>}
          </span>
          {hot && <span className="odd-hot">★</span>}
        </span>
      )}
      <span className="odd-row">
        <span className="odd-val">{value.toFixed(2)}</span>
        {arrow && (
          <span className={`odd-delta ${delta! > 0 ? 'odd-up' : 'odd-down'}`}>{arrow}</span>
        )}
      </span>
    </button>
  );
}
