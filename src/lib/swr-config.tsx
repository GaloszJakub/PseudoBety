'use client';
import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

function localStorageProvider() {
  if (typeof window === 'undefined') return new Map();
  const stored = localStorage.getItem('bety-swr-v1');
  const cache = new Map<string, any>(stored ? JSON.parse(stored) : []);
  window.addEventListener('beforeunload', () => {
    const data = Array.from(cache.entries()).filter(([, v]) => v?.data !== undefined);
    try { localStorage.setItem('bety-swr-v1', JSON.stringify(data)); } catch { /* quota */ }
  });
  return cache;
}

export default function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: localStorageProvider }}>
      {children}
    </SWRConfig>
  );
}
