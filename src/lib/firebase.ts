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

// During build-time prerendering, NEXT_PUBLIC_* env vars may be empty strings.
// In client runtime they are always inlined by Next.js bundler.
function init() {
  if (!firebaseConfig.apiKey) {
    return { app: undefined as unknown as FirebaseApp, db: undefined as unknown as Firestore, auth: undefined as unknown as Auth };
  }
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  return { app, db, auth };
}

const { app, db, auth } = init();

// Export with definite types — in client code these are always defined.
// Server prerender code should not use these directly.
export { db, auth };
export default app;

// Re-export types for convenience
export type { FirebaseApp, Firestore, Auth };
