import { type Firestore, initializeFirestore, getFirestore } from "firebase/firestore";
import { app } from "./app";

let _db: Firestore | null = null; // Singleton instance

const isClient = typeof window !== "undefined"; // Client-only guard

export const getFirebaseDb = (): Firestore => {
  if (!isClient) {
    throw new Error("Firestore initialization is not supported on the server side.");
  }

  if (_db) {
    return _db; // Return existing instance
  }

  const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)";
  const settings = {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false,
    experimentalLongPollingOptions: { timeoutSeconds: 30 },
  };

  try {
    // First attempt: Initialize with settings and databaseId
    _db = initializeFirestore(app, settings, databaseId);
  } catch (error: any) {
    if (error.message.includes("already been started")) {
      // Fallback: Use getFirestore() if initialization has already occurred
      _db = getFirestore(app);
    } else {
      throw error; // Re-throw other errors
    }
  }

  return _db;
};