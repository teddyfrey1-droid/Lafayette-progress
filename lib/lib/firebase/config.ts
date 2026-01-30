// Firebase web config (client-side)
// NOTE: Values can be overridden by environment variables (recommended for production).

export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyAGaitqmFwExvJ9ZUpkdUdCKAqqDOP2cdQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "objectif-restaurant.firebaseapp.com",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ??
    "https://objectif-restaurant-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "objectif-restaurant",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "objectif-restaurant.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "910113283000",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:910113283000:web:0951fd9dca01aa6e46cd4d",
} as const

export const FIREBASE_API_KEY = FIREBASE_CONFIG.apiKey
export const FIREBASE_RTDB_URL = FIREBASE_CONFIG.databaseURL

// Optional toggles for tricky networks / corporate proxies.
export const FIREBASE_FORCE_LONG_POLLING = process.env.NEXT_PUBLIC_FIREBASE_FORCE_LONG_POLLING === "true"
