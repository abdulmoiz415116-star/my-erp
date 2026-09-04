import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig, isFirebaseConfigured } from './config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined' && !isFirebaseConfigured()) {
    return null;
  }
  if (!app) {
    if (getApps().length > 0) {
      app = getApp();
    } else if (firebaseConfig.apiKey) {
      try {
        app = initializeApp(firebaseConfig);
      } catch (err) {
        console.warn('Firebase client initialization warning:', err);
      }
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const currentApp = getFirebaseApp();
  if (!auth && currentApp) {
    try {
      auth = getAuth(currentApp);
    } catch (err) {
      console.warn('Firebase Auth initialization error:', err);
    }
  }
  return auth;
}

export function getFirebaseFirestore(): Firestore | null {
  const currentApp = getFirebaseApp();
  if (!db && currentApp) {
    try {
      db = getFirestore(currentApp);
    } catch (err) {
      console.warn('Firestore initialization error:', err);
    }
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  const currentApp = getFirebaseApp();
  if (!storage && currentApp) {
    try {
      storage = getStorage(currentApp);
    } catch (err) {
      console.warn('Firebase Storage initialization error:', err);
    }
  }
  return storage;
}
