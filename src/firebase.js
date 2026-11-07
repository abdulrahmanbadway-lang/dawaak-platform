import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const e = import.meta.env;
const cfg = {
  apiKey: e.VITE_FIREBASE_API_KEY,
  authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: e.VITE_FIREBASE_PROJECT_ID,
  appId: e.VITE_FIREBASE_APP_ID,
  storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
};
export const configured = !!(cfg.apiKey && cfg.projectId);
const app = configured ? initializeApp(cfg) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app && cfg.storageBucket ? getStorage(app) : null;
