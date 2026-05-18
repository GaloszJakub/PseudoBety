'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface Props {
  onClose: () => void;
}

export default function AuthModal({ onClose }: Props) {
  const { signIn, signUp, signInGoogle } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await signIn(email, password);
      } else {
        if (!name.trim()) { setError('Podaj imię'); setLoading(false); return; }
        await signUp(email, password, name);
      }
      onClose();
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/invalid-credential': 'Błędny email lub hasło',
        'auth/user-not-found': 'Nie znaleziono konta',
        'auth/wrong-password': 'Błędne hasło',
        'auth/email-already-in-use': 'Email już zajęty',
        'auth/weak-password': 'Hasło min. 6 znaków',
        'auth/invalid-email': 'Nieprawidłowy email',
      };
      setError(msg[err.code] || 'Błąd. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInGoogle();
      onClose();
    } catch (err: any) {
      setError('Błąd logowania przez Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(4,8,26,0.82)',
      backdropFilter: 'blur(8px)',
      zIndex: 90,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px'
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--bg-1)',
        border: '1px solid var(--line)',
        borderRadius: 0,
        overflow: 'hidden',
        position: 'relative'
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '24px 28px 0', borderBottom: '1px solid var(--line-cool)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d0f12', fontWeight: 800, fontSize: 15 }}>b</div>
            <span style={{ fontFamily: 'var(--f-ui)', fontSize: 17, fontWeight: 800, color: 'var(--cream)' }}>be<b style={{ color: 'var(--gold-bright)' }}>ty</b></span>
          </div>

          <div style={{ display: 'flex', gap: 0 }}>
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }} style={{
                appearance: 'none', border: 0, background: 'transparent',
                color: tab === t ? 'var(--gold-bright)' : 'var(--text-2)',
                fontFamily: 'var(--f-ui)', fontSize: 13, fontWeight: 700,
                padding: '0 0 12px', marginRight: 20,
                borderBottom: tab === t ? '2px solid var(--gold)' : '2px solid transparent',
                cursor: 'pointer', letterSpacing: '0.02em'
              }}>
                {t === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px' }}>
          {tab === 'register' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Imię</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Jak masz na imię?"
                style={inputStyle} />
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="twoj@email.com" required
                style={inputStyle} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Hasło</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={tab === 'register' ? 'Min. 6 znaków' : '••••••••'} required
                style={inputStyle} />
            </div>

            {error && (
              <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(255,90,110,0.08)', border: '1px solid rgba(255,90,110,0.25)', fontSize: 12, color: '#ff8a99', borderRadius: 0 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              appearance: 'none', border: 0,
              background: loading ? 'var(--gold-dim)' : 'var(--gold)',
              color: '#0d0f12',
              fontFamily: 'var(--f-ui)', fontWeight: 800, fontSize: 13,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              width: '100%', padding: '13px 0',
              borderRadius: 0, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.12s'
            }}>
              {loading ? '...' : tab === 'login' ? 'Zaloguj się' : 'Utwórz konto · +1000 PLN'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line-cool)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.06em' }}>LUB</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line-cool)' }} />
          </div>

          <button onClick={handleGoogle} disabled={loading} style={{
            appearance: 'none',
            border: '1px solid var(--line)',
            background: 'var(--bg-2)',
            color: 'var(--cream)',
            fontFamily: 'var(--f-ui)', fontWeight: 600, fontSize: 13,
            width: '100%', padding: '11px 0',
            borderRadius: 0, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'background 0.12s'
          }}>
            <GoogleIcon />
            Kontynuuj z Google
          </button>

          {tab === 'register' && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
              Rejestracja = start z <span style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>1000 PLN</span> paper money.<br />
              Gra na wirtualne pieniądze · 18+
            </p>
          )}
        </div>

        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          appearance: 'none', border: '1px solid var(--line-cool)',
          background: 'rgba(255,255,255,0.04)', color: 'var(--text-2)',
          width: 30, height: 30, borderRadius: 0, cursor: 'pointer',
          fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>✕</button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10, fontWeight: 700,
  letterSpacing: '0.10em', textTransform: 'uppercase',
  color: 'var(--text-3)', marginBottom: 6
};

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--line)',
  color: 'var(--cream)',
  fontFamily: 'var(--f-ui)', fontSize: 14,
  padding: '10px 12px', borderRadius: 0,
  outline: 'none',
  boxSizing: 'border-box'
};

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
