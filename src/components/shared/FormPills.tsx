'use client';

interface Props { form: string[]; size?: number; }

export default function FormPills({ form, size = 12 }: Props) {
  const colors: Record<string, string> = { W: '#3da55c', D: '#6e7791', L: '#c93a4d' };
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {form.map((r, i) => (
        <span key={i} style={{
          width: size, height: size,
          background: colors[r] || '#6e7791',
          color: '#fff', fontSize: size * 0.6, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--f-mono)', lineHeight: 1
        }}>{r}</span>
      ))}
    </span>
  );
}
