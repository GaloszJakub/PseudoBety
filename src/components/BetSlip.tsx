'use client';
import { useState } from 'react';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

export interface Bet {
  id: string;
  matchId: string;
  matchLabel: string;
  competition: string;
  market: string;
  marketType: string;
  pick: string;
  odds: number;
}

interface Props {
  bets: Bet[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function BetSlip({ bets, onRemove, onClear }: Props) {
  const { user, balance } = useAuth();
  const [stake, setStake] = useState(50);
  const [betMode, setBetMode] = useState<'single'|'ako'|'system'>('ako');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePlace = async () => {
    if (!user) { setError('Zaloguj się, aby postawić zakład'); return; }
    if (stake <= 0) { setError('Podaj stawkę'); return; }
    if (stake > balance) { setError('Niewystarczające saldo'); return; }
    setPlacing(true);
    setError(null);
    try {
      const usedOdds = betMode === 'single' ? bets[0].odds : totalOdds;
      const potentialWin = stake * usedOdds;
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await tx.get(userRef);
        const currentBalance = userSnap.exists() ? userSnap.data().balance ?? 0 : 0;
        if (currentBalance < stake) throw new Error('Niewystarczające saldo');
        const betRef = doc(collection(db, 'bets'));
        tx.set(betRef, {
          userId: user.uid,
          stake,
          totalOdds: usedOdds,
          potentialWin,
          status: 'pending',
          createdAt: serverTimestamp(),
          settledAt: null,
          actualWin: null,
          selections: bets.map(b => ({
            matchId: b.matchId,
            matchLabel: b.matchLabel,
            competition: b.competition,
            market: b.market,
            marketType: b.marketType,
            pick: b.pick,
            odds: b.odds,
          })),
        });
        tx.update(userRef, { balance: currentBalance - stake });
      });
      setSuccess(true);
      onClear();
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Błąd podczas stawiania zakładu');
    } finally {
      setPlacing(false);
    }
  };

  const totalOdds = bets.reduce((acc, b) => acc * b.odds, 1);
  const potential = bets.length > 0 ? stake * (betMode === 'single' ? bets[0].odds : totalOdds) : 0;
  const tax = potential * 0.12;
  const netWin = potential - tax;

  return (
    <aside style={{
      width: 320, flexShrink: 0,
      borderLeft: '1px solid var(--line-cool)',
      background: 'var(--bg-1)',
      height: '100%',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden'
    }}>
      {bets.length === 0 ? (
        <div style={{ padding: '60px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, flex: 1 }}>
          <div style={{ marginBottom: 8 }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="26" stroke="rgba(212,175,55,0.3)" strokeWidth="1" strokeDasharray="2 3" />
              <text x="28" y="35" textAnchor="middle" fontFamily='"Manrope", sans-serif' fontSize="22" fill="rgba(212,175,55,0.8)">⚜</text>
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--f-ui)', fontSize: 16, fontWeight: 800, color: 'var(--cream)' }}>Kupon jest pusty</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 240, lineHeight: 1.5 }}>
            Wybierz kursy z meczy żeby zbudować swój zakład.
          </div>
          <div style={{ marginTop: 28, padding: '12px 14px', border: '1px solid var(--line)', background: 'var(--bg-2)', display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, textAlign: 'left' }}>
            <span style={{ flexShrink: 0, width: 18, height: 18, background: 'var(--gold)', color: '#0d0f12', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic' }}>i</span>
            <span>Dodaj 2+ kursy żeby zbudować AKO i pomnożyć wygraną.</span>
          </div>
        </div>
      ) : (
        <>
          <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--line-cool)', flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: 'var(--f-ui)', fontSize: 16, fontWeight: 800, color: 'var(--cream)', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.01em' }}>
                <span style={{ color: 'var(--gold)' }}>⚜</span>
                <span>Twój kupon</span>
                <span className="mono" style={{ color: 'var(--gold-bright)' }}>· {bets.length}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', letterSpacing: '0.04em', marginTop: 4 }}>
                Łączny kurs <span className="mono" style={{ fontSize: 18, marginLeft: 6, color: 'var(--gold-bright)' }}>{totalOdds.toFixed(2)}</span>
              </div>
            </div>
            <button onClick={onClear} style={{ appearance: 'none', border: '1px solid var(--line-cool)', background: 'transparent', color: 'var(--text-3)', fontSize: 11, padding: '6px 10px', borderRadius: 0, letterSpacing: '0.02em', cursor: 'pointer' }}>Wyczyść</button>
          </div>

          <div style={{ display: 'flex', gap: 4, padding: '10px 18px 12px', borderBottom: '1px solid var(--line-cool)', flexShrink: 0 }}>
            {([
              { id: 'single', label: 'Pojedyncze', enabled: bets.length >= 1 },
              { id: 'ako', label: 'AKO', enabled: bets.length >= 2 },
              { id: 'system', label: 'System', enabled: bets.length >= 3 },
            ] as const).map(t => (
              <button key={t.id}
                onClick={() => t.enabled && setBetMode(t.id)}
                disabled={!t.enabled}
                style={{
                  appearance: 'none',
                  border: `1px solid ${betMode === t.id ? 'var(--gold)' : 'var(--line-cool)'}`,
                  background: betMode === t.id ? 'rgba(212,175,55,0.16)' : 'transparent',
                  color: betMode === t.id ? 'var(--gold-bright)' : 'var(--text-2)',
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '8px 12px', borderRadius: 0, flex: 1,
                  opacity: t.enabled ? 1 : 0.3, cursor: t.enabled ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit'
                }}>
                {t.label}
                {t.id === 'ako' && bets.length >= 2 && <span className="mono" style={{ fontSize: 10, marginLeft: 5, opacity: 0.7 }}>×{bets.length}</span>}
              </button>
            ))}
          </div>

          <div style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            {bets.map((bet) => (
              <div key={bet.id} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'stretch', padding: '10px 12px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>{bet.market}</div>
                  <div style={{ fontFamily: 'var(--f-ui)', fontSize: 13, fontWeight: 700, color: 'var(--cream)', lineHeight: 1.25 }}>{bet.pick}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>{bet.matchLabel}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.04em' }}>{bet.competition}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 }}>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold-bright)', letterSpacing: '-0.01em' }}>{bet.odds.toFixed(2)}</div>
                  <button onClick={() => onRemove(bet.id)} style={{ appearance: 'none', border: '1px solid var(--line-cool)', background: 'transparent', color: 'var(--text-3)', width: 22, height: 22, borderRadius: 0, fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line-cool)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line-cool)', borderRadius: 0, padding: '0 12px', marginBottom: 8, height: 40 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600 }}>Stawka</span>
              <input type="number" value={stake}
                onChange={e => setStake(Math.max(0, Number(e.target.value) || 0))}
                className="mono"
                style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--cream)', fontSize: 18, fontWeight: 700, textAlign: 'right', outline: 'none', padding: '0 8px', minWidth: 0 }} />
              <span className="mono" style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600 }}>PLN</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              {[20, 50, 100, 250].map(v => (
                <button key={v} onClick={() => setStake(v)} style={{
                  appearance: 'none',
                  border: `1px solid ${stake === v ? 'var(--gold)' : 'var(--line-cool)'}`,
                  background: stake === v ? 'rgba(212,175,55,0.12)' : 'transparent',
                  color: stake === v ? 'var(--gold-bright)' : 'var(--text-2)',
                  fontFamily: 'var(--f-mono)', fontSize: 12, fontWeight: 700,
                  padding: '7px 0', borderRadius: 0, cursor: 'pointer'
                }}>{v}</button>
              ))}
            </div>
          </div>

          <div style={{ padding: '0 18px 12px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            {[
              { label: 'Łączny kurs', val: totalOdds.toFixed(2), style: {} },
              { label: 'Możliwa wygrana', val: `${potential.toFixed(2)} PLN`, style: {} },
              { label: 'Podatek 12%', val: `−${tax.toFixed(2)} PLN`, style: { color: 'var(--text-3)' } },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', ...r.style }}>
                <span>{r.label}</span>
                <span className="mono">{r.val}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px dashed var(--line-cool)', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--f-ui)', fontSize: 14, fontWeight: 800, color: 'var(--gold-bright)' }}>
              <span>Wygrana netto</span>
              <span className="mono">{netWin.toFixed(2)} PLN</span>
            </div>
          </div>

          {error && (
            <div style={{ margin: '0 18px 8px', padding: '8px 12px', background: 'rgba(220,50,50,0.12)', border: '1px solid rgba(220,50,50,0.3)', fontSize: 12, color: '#ff6b6b' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ margin: '0 18px 8px', padding: '8px 12px', background: 'rgba(50,200,100,0.12)', border: '1px solid rgba(50,200,100,0.3)', fontSize: 12, color: '#4caf82' }}>
              Kupon postawiony!
            </div>
          )}
          <button onClick={handlePlace} disabled={placing || bets.length === 0} style={{
            appearance: 'none', border: 0,
            background: placing ? 'var(--text-3)' : 'var(--gold)',
            color: '#0d0f12',
            padding: '12px 18px', margin: '0 18px 18px', borderRadius: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            fontFamily: 'inherit', cursor: placing ? 'not-allowed' : 'pointer', flexShrink: 0,
            opacity: placing ? 0.7 : 1,
          }}>
            <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {placing ? 'Przetwarzanie...' : 'Postaw zakład'}
            </span>
            <span className="mono" style={{ fontSize: 13, color: 'rgba(7,13,36,0.7)' }}>
              {stake} PLN → {potential.toFixed(2)} PLN
            </span>
          </button>
        </>
      )}
    </aside>
  );
}
