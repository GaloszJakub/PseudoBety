'use client';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth, UserRole } from '@/lib/AuthContext';

interface AdminUser {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  balance: number;
  suspended: boolean;
  suspendedReason?: string;
  createdAt?: any;
  isPrivate: boolean;
}

type Tab = 'users' | 'bets';

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'var(--gold)',
  user: 'var(--text-3)',
};

export default function AdminPage({ onViewProfile }: { onViewProfile: (uid: string) => void }) {
  const { user, role } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [editBalance, setEditBalance] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [suspendReason, setSuspendReason] = useState<Record<string, string>>({});

  useEffect(() => {
    if (role !== 'admin') return;
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({
        uid: d.id,
        displayName: d.data().displayName || d.data().email?.split('@')[0] || '?',
        email: d.data().email || '',
        role: d.data().role === 'admin' ? 'admin' : 'user',
        balance: d.data().balance ?? 0,
        suspended: d.data().suspended ?? false,
        suspendedReason: d.data().suspendedReason,
        isPrivate: d.data().isPrivate ?? false,
        createdAt: d.data().createdAt,
      })));
    });
  }, [role]);

  if (role !== 'admin') {
    return <div className="page" style={{ paddingTop: 40, textAlign: 'center', color: 'var(--text-3)' }}>Brak dostępu</div>;
  }

  const save = async (uid: string, data: object) => {
    setSaving(s => ({ ...s, [uid]: true }));
    try { await updateDoc(doc(db, 'users', uid), data); }
    finally { setSaving(s => ({ ...s, [uid]: false })); }
  };

  const setRole = (uid: string, newRole: UserRole) => save(uid, { role: newRole });

  const toggleSuspend = async (u: AdminUser) => {
    if (u.suspended) {
      await save(u.uid, { suspended: false, suspendedReason: null });
    } else {
      const reason = suspendReason[u.uid]?.trim() || 'Konto zawieszone przez admina';
      await save(u.uid, { suspended: true, suspendedReason: reason });
    }
  };

  const setBalance = async (u: AdminUser) => {
    const val = parseFloat(editBalance[u.uid] ?? '');
    if (isNaN(val) || val < 0) return;
    await save(u.uid, { balance: val });
    setEditBalance(e => ({ ...e, [u.uid]: '' }));
  };

  const filtered = users.filter(u =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    suspended: users.filter(u => u.suspended).length,
    totalBalance: users.reduce((s, u) => s + u.balance, 0),
  };

  return (
    <div className="page" style={{ paddingTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-ui)', fontSize: 22, fontWeight: 800, color: 'var(--cream)' }}>
          <span style={{ color: 'var(--gold)', marginRight: 10 }}>⚙</span>Panel admina
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#0d0f12', background: 'var(--gold)', padding: '3px 8px' }}>Admin</span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Użytkownicy', val: stats.total },
          { label: 'Adminowie', val: stats.admins },
          { label: 'Zawieszeni', val: stats.suspended, color: stats.suspended > 0 ? '#e05555' : undefined },
          { label: 'Łączne saldo', val: `${stats.totalBalance.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN`, highlight: true },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', padding: '14px 16px' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: (s as any).color || ((s as any).highlight ? 'var(--gold-bright)' : 'var(--cream)') }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line-cool)', background: 'var(--bg-2)', padding: '0 14px', height: 40, marginBottom: 14 }}>
        <span style={{ fontSize: 14, color: 'var(--text-3)' }}>⌕</span>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Szukaj po nazwie lub emailu..."
          style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--cream)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
        />
        {search && <button onClick={() => setSearch('')} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--text-3)', fontSize: 16, cursor: 'pointer' }}>×</button>}
      </div>

      {/* Users table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)' }}>Brak użytkowników</div>
        )}
        {filtered.map(u => (
          <div key={u.uid} style={{
            border: `1px solid ${u.suspended ? 'rgba(224,85,85,0.4)' : 'var(--line)'}`,
            background: u.suspended ? 'rgba(224,85,85,0.04)' : 'var(--bg-1)',
          }}>
            {/* User header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'center', padding: '12px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, background: 'var(--gold-soft)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-ui)', fontSize: 15, fontWeight: 800, color: 'var(--gold-bright)', flexShrink: 0 }}>
                  {u.displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--f-ui)', fontSize: 14, fontWeight: 700, color: 'var(--cream)' }}>{u.displayName}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ROLE_COLORS[u.role], border: `1px solid ${ROLE_COLORS[u.role]}`, padding: '2px 6px' }}>{u.role}</span>
                    {u.suspended && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#e05555', border: '1px solid #e05555', padding: '2px 6px' }}>Zawieszony</span>}
                    {u.isPrivate && <span style={{ fontSize: 10, color: 'var(--text-3)', border: '1px solid var(--line-cool)', padding: '2px 6px' }}>Prywatny</span>}
                    {u.uid === user?.uid && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>(Ty)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Saldo</div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-bright)' }}>{u.balance.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN</div>
              </div>

              <button onClick={() => onViewProfile(u.uid)} style={{
                appearance: 'none', border: '1px solid var(--line-cool)', background: 'transparent',
                color: 'var(--text-2)', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                padding: '6px 12px', cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap',
              }}>Profil →</button>
            </div>

            {/* Actions row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '12px 16px', alignItems: 'flex-end' }}>

              {/* Role */}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>Rola</div>
                <div style={{ display: 'flex', gap: 0 }}>
                  {(['user', 'admin'] as UserRole[]).map(r => (
                    <button key={r} onClick={() => u.uid !== user?.uid && setRole(u.uid, r)} disabled={saving[u.uid] || u.uid === user?.uid} style={{
                      appearance: 'none', border: '1px solid var(--line-cool)',
                      background: u.role === r ? (r === 'admin' ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.07)') : 'transparent',
                      color: u.role === r ? (r === 'admin' ? 'var(--gold-bright)' : 'var(--cream)') : 'var(--text-3)',
                      fontFamily: 'inherit', fontSize: 11, fontWeight: 700, padding: '6px 12px',
                      cursor: u.uid === user?.uid ? 'not-allowed' : 'pointer',
                      opacity: u.uid === user?.uid ? 0.5 : 1,
                      textTransform: 'capitalize',
                    }}>{r}</button>
                  ))}
                </div>
              </div>

              {/* Balance */}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>Ustaw saldo</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number" min={0} placeholder={u.balance.toFixed(2)}
                    value={editBalance[u.uid] ?? ''}
                    onChange={e => setEditBalance(b => ({ ...b, [u.uid]: e.target.value }))}
                    className="mono"
                    style={{ width: 100, border: '1px solid var(--line-cool)', background: 'var(--bg-2)', color: 'var(--cream)', fontSize: 13, fontWeight: 700, padding: '6px 10px', outline: 'none', fontFamily: 'var(--f-mono)' }}
                  />
                  <button onClick={() => setBalance(u)} disabled={saving[u.uid] || !editBalance[u.uid]} style={{
                    appearance: 'none', border: '1px solid var(--line-cool)', background: 'var(--bg-2)',
                    color: 'var(--cream)', fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                    padding: '6px 12px', cursor: 'pointer', opacity: (!editBalance[u.uid] || saving[u.uid]) ? 0.5 : 1,
                  }}>Zapisz</button>
                  {([100, 500, 1000] as const).map(v => (
                    <button key={v} onClick={() => save(u.uid, { balance: u.balance + v })} disabled={saving[u.uid]} style={{
                      appearance: 'none', border: '1px solid var(--line-cool)', background: 'transparent',
                      color: 'var(--text-2)', fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 600,
                      padding: '6px 10px', cursor: 'pointer',
                    }}>+{v}</button>
                  ))}
                </div>
              </div>

              {/* Suspend */}
              <div style={{ marginLeft: 'auto' }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>
                  {u.suspended ? `Powód: ${u.suspendedReason || '—'}` : 'Zawieszenie'}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!u.suspended && (
                    <input
                      type="text" placeholder="Powód (opcjonalny)"
                      value={suspendReason[u.uid] ?? ''}
                      onChange={e => setSuspendReason(r => ({ ...r, [u.uid]: e.target.value }))}
                      style={{ border: '1px solid var(--line-cool)', background: 'var(--bg-2)', color: 'var(--cream)', fontSize: 12, padding: '6px 10px', outline: 'none', fontFamily: 'inherit', width: 160 }}
                    />
                  )}
                  <button onClick={() => toggleSuspend(u)} disabled={saving[u.uid] || u.uid === user?.uid} style={{
                    appearance: 'none', border: `1px solid ${u.suspended ? '#4caf82' : '#e05555'}`,
                    background: 'transparent',
                    color: u.suspended ? '#4caf82' : '#e05555',
                    fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                    padding: '6px 14px', cursor: u.uid === user?.uid ? 'not-allowed' : 'pointer',
                    opacity: u.uid === user?.uid ? 0.4 : 1,
                  }}>
                    {u.suspended ? 'Odwieś' : 'Zawieś'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
