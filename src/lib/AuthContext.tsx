'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, signOut, User
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export type UserRole = 'user' | 'admin';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  balance: number;
  role: UserRole;
  isPrivate: boolean;
  suspended: boolean;
  suspendedReason?: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [role, setRole] = useState<UserRole>('user');
  const [isPrivate, setIsPrivate] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [suspendedReason, setSuspendedReason] = useState<string | undefined>();

  useEffect(() => {
    let balanceUnsub: (() => void) | null = null;
    const authUnsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (balanceUnsub) { balanceUnsub(); balanceUnsub = null; }
      if (u) {
        ensureUserDoc(u).catch(() => {});
        balanceUnsub = onSnapshot(doc(db, 'users', u.uid), snap => {
          if (snap.exists()) {
            const d = snap.data();
            setBalance(d.balance ?? 1000);
            setRole(d.role === 'admin' ? 'admin' : 'user');
            setIsPrivate(d.isPrivate ?? false);
            setSuspended(d.suspended ?? false);
            setSuspendedReason(d.suspendedReason ?? undefined);
          } else {
            setBalance(1000);
            setRole('user');
            setIsPrivate(false);
            setSuspended(false);
            setSuspendedReason(undefined);
          }
        });
      }
      setLoading(false);
    });
    return () => { authUnsub(); if (balanceUnsub) balanceUnsub(); };
  }, []);

  const ensureUserDoc = async (u: User, name?: string) => {
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        displayName: name || u.displayName || u.email?.split('@')[0],
        email: u.email,
        balance: 1000,
        role: 'user',
        isPrivate: false,
        createdAt: serverTimestamp(),
      });
      setBalance(1000);
    } else {
      setBalance(snap.data().balance ?? 1000);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { user: u } = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDoc(u);
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { user: u } = await createUserWithEmailAndPassword(auth, email, password);
    await ensureUserDoc(u, name);
  };

  const signInGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const { user: u } = await signInWithPopup(auth, provider);
    await ensureUserDoc(u);
  };

  const logout = () => signOut(auth);

  return (
    <Ctx.Provider value={{ user, loading, balance, role, isPrivate, suspended, suspendedReason, signIn, signUp, signInGoogle, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
