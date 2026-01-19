import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getDatabase } from "firebase/database"
import { getStorage } from "firebase/storage"
import { getFirestore, initializeFirestore } from "firebase/firestore"

import { FIREBASE_CONFIG, FIREBASE_FORCE_LONG_POLLING } from "./config"

let app: FirebaseApp

if (getApps().length === 0) {
  app = initializeApp(FIREBASE_CONFIG)
} else {
  app = getApp()
}

export const firebaseApp = app

export const auth = getAuth(app)

// Firestore initialization with safe defaults.
// Long polling can help in some restrictive networks (toggle via NEXT_PUBLIC_FIREBASE_FORCE_LONG_POLLING=true).
export const db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: FIREBASE_FORCE_LONG_POLLING,
      ignoreUndefinedProperties: true,
    })
  } catch {
    return getFirestore(app)
  }
})()

export const rtdb = getDatabase(app)
export const storage = getStorage(app)
