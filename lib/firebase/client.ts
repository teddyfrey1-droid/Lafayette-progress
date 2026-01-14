// Firebase client initialization (browser-safe).
// Values must be provided via NEXT_PUBLIC_* env vars.
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app"
import { Auth, getAuth } from "firebase/auth"
import { Firestore, getFirestore } from "firebase/firestore"

// Default Firebase config (from Lafayette-progress).
// You can still override with NEXT_PUBLIC_FIREBASE_* env vars on Render.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAGaitqmFwExvJ9ZUpkdUdCKAqqDOP2cdQ",
  authDomain: "objectif-restaurant.firebaseapp.com",
  projectId: "objectif-restaurant",
  storageBucket: "objectif-restaurant.firebasestorage.app",
  messagingSenderId: "910113283000",
  appId: "1:910113283000:web:0951fd9dca01aa6e46cd4d",
  databaseURL: "https://objectif-restaurant-default-rtdb.europe-west1.firebasedatabase.app",
} as const


function getEnv(name: string): string {
  // In Next.js, NEXT_PUBLIC_* vars are replaced at build time.
  // If a value is missing, keep it empty and let runtime checks handle it.
  return (process.env as Record<string, string | undefined>)[name] ?? ""
}

function getFirebaseConfig() {
  return {
    apiKey: getEnv("NEXT_PUBLIC_FIREBASE_API_KEY") || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID") || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId:
      getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: getEnv("NEXT_PUBLIC_FIREBASE_APP_ID") || DEFAULT_FIREBASE_CONFIG.appId,
    // Optional:
    measurementId: getEnv("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"),
    databaseURL: getEnv("NEXT_PUBLIC_FIREBASE_DATABASE_URL") || DEFAULT_FIREBASE_CONFIG.databaseURL,
  }
}

let _app: FirebaseApp | null = null
let _auth: Auth | null = null
let _db: Firestore | null = null

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app
  const cfg = getFirebaseConfig()
  // Minimal validation to avoid cryptic runtime errors.
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
    throw new Error(
      "Firebase n'est pas configuré. Renseigne les variables NEXT_PUBLIC_FIREBASE_* (voir .env.example).",
    )
  }
  _app = getApps().length ? getApp() : initializeApp(cfg)
  return _app
}

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth
  _auth = getAuth(getFirebaseApp())
  return _auth
}

export function getFirebaseDb(): Firestore {
  if (_db) return _db
  _db = getFirestore(getFirebaseApp())
  return _db
}

export function getDefaultCompanyId(): string {
  return getEnv("NEXT_PUBLIC_DEFAULT_COMPANY_ID") || "A"
}