import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getApp(): FirebaseApp | undefined {
  // During build-time prerendering env vars may be empty — skip init
  if (!firebaseConfig.apiKey) return undefined;
  if (getApps().length > 0) return getApps()[0];
  return initializeApp(firebaseConfig);
}

let _app: FirebaseApp | undefined;
let _db: Firestore | undefined;
let _auth: Auth | undefined;

export function getFirebaseApp(): FirebaseApp | undefined {
  if (!_app) _app = getApp();
  return _app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: Firestore = new Proxy({} as any, {
  get(_, prop) {
    if (!_db) {
      const app = getFirebaseApp();
      if (!app) return undefined;
      _db = getFirestore(app);
    }
    return (_db as unknown as Record<string, unknown>)[prop as string];
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: Auth = new Proxy({} as any, {
  get(_, prop) {
    if (!_auth) {
      const app = getFirebaseApp();
      if (!app) return undefined;
      _auth = getAuth(app);
    }
    return (_auth as unknown as Record<string, unknown>)[prop as string];
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default new Proxy({} as any, {
  get(_, prop) {
    const app = getFirebaseApp();
    if (!app) return undefined;
    return (app as unknown as Record<string, unknown>)[prop as string];
  },
});
