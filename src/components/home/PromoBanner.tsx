'use client';
import { useState, useEffect } from 'react';

const promos = [
  { eyebrow: 'Mecz dnia · Liga Mistrzów', title: 'Real Madryt vs Bayern', sub: 'Postaw 50 PLN — odbierz bonus 25 PLN do następnego zakładu', cta: 'Obstaw teraz' },
  { eyebrow: 'Bonus powitalny', title: '+1000 PLN dla nowych', sub: 'Cashback do 100% na pierwsze 7 dni · 18+', cta: 'Załóż konto' },
  { eyebrow: 'Roland Garros · Live', title: 'Świątek dzisiaj 17:30', sub: 'Transmisja w aplikacji + boost kursu +15%', cta: 'Zobacz' },
];

export default function PromoBanner() {
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % promos.length), 5000);
    return () => clearInterval(t);
  }, []);
  const p = promos[slide];

  return (
    <section style={{ position: 'relative', padding: '18px 22px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 0, marginBottom: 16, minHeight: 96, display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, width: '100%' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700, marginBottom: 6 }}>{p.eyebrow}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--cream)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 4 }}>{p.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>{p.sub}</div>
        </div>
        <button style={{ appearance: 'none', border: 0, background: 'var(--gold)', color: '#0d0f12', padding: '10px 18px', borderRadius: 0, font: '800 12.5px/1 var(--f-ui)', letterSpacing: '0.02em', cursor: 'pointer', flexShrink: 0 }}>
          {p.cta} →
        </button>
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 12, display: 'flex', gap: 4 }}>
        {promos.map((_, i) => (
          <button key={i} onClick={() => setSlide(i)} style={{ appearance: 'none', border: 0, width: 14, height: 2, borderRadius: 1, background: i === slide ? 'var(--gold)' : 'var(--line-strong)', cursor: 'pointer', padding: 0 }} />
        ))}
      </div>
    </section>
  );
}
