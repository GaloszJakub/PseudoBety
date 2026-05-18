import { initializeApp, getApps, App } from 'firebase-admin/app';
import { cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App | null = null;
let db: Firestore | null = null;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not set');
  app = initializeApp({
    credential: cert(JSON.parse(serviceAccount)),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
  return app;
}

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (!db) {
      getAdminApp();
      db = getFirestore();
      try { db.settings({ ignoreUndefinedProperties: true }); } catch { /* already set */ }
    }
    return (db as any)[prop];
  },
});
