'use client';
import { useState } from 'react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

const PRESETS = [100, 500, 1000, 5000];

interface Props {
  onClose: () => void;
}

export default function DepositModal({ onClose }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleDeposit = async (val: number) => {
    if (!user || val <= 0 || val > 100_000) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { balance: increment(val) });
      setDone(true);
      setTimeout(onClose, 1200);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--line)',
        width: 360, padding: '28px 24px',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--f-ui)', fontSize: 18, fontWeight: 800, color: 'var(--cream)' }}>
            <span style={{ color: 'var(--gold)', marginRight: 8 }}>⚜</span>Doładuj saldo
          </div>
          <button onClick={onClose} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--text-3)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#4caf82', fontWeight: 700, fontSize: 15 }}>
            Saldo zaktualizowane!
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {PRESETS.map(v => (
                <button key={v} onClick={() => handleDeposit(v)} disabled={loading}
                  style={{
                    appearance: 'none', border: '1px solid var(--line)',
                    background: 'var(--bg-1)', color: 'var(--gold-bright)',
                    fontFamily: 'var(--f-mono)', fontSize: 15, fontWeight: 700,
                    padding: '14px 0', borderRadius: 0, cursor: 'pointer',
                    opacity: loading ? 0.5 : 1,
                  }}>
                  +{v.toLocaleString('pl-PL')} PLN
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line-cool)', background: 'var(--bg-1)', padding: '0 12px', height: 44, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>Inna kwota</span>
              <input
                type="number" min={1} max={100000}
                value={amount}
                onChange={e => setAmount(e.target.value === '' ? '' : Math.min(100_000, Math.max(0, Number(e.target.value))))}
                placeholder="0"
                className="mono"
                style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--cream)', fontSize: 16, fontWeight: 700, outline: 'none', textAlign: 'right' }}
              />
              <span className="mono" style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600 }}>PLN</span>
            </div>

            <button
              onClick={() => typeof amount === 'number' && amount > 0 && handleDeposit(amount)}
              disabled={loading || !amount || (typeof amount === 'number' && amount <= 0)}
              style={{
                appearance: 'none', border: 0, background: 'var(--gold)', color: '#0d0f12',
                width: '100%', padding: '12px 0', fontFamily: 'inherit',
                fontWeight: 800, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase',
                cursor: 'pointer', opacity: loading ? 0.6 : 1,
              }}>
              {loading ? 'Przetwarzanie...' : 'Doładuj'}
            </button>

            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
              To są papierowe pieniądze — brak prawdziwych transakcji
            </div>
          </>
        )}
      </div>
    </div>
  );
}
