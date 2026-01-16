import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  getAuth,
  type User,
} from "firebase/auth"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { initializeApp, getApps, getApp, deleteApp, type FirebaseApp } from "firebase/app"

import { auth, db } from "./client"
import { FIREBASE_CONFIG } from "./config"

export type UserRole = "admin" | "manager" | "employee"

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  contractHours?: number
  disabled?: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const res = await signInWithEmailAndPassword(auth, email, password)
  return res.user
}

// Inscription publique (via la page /inscription)
export async function signUpWithEmail(params: {
  email: string
  password: string
  displayName: string
  role?: UserRole
}): Promise<User> {
  const { email, password, displayName } = params

  // CORRECTION ICI : C'est teddy.frey1@gmail.com qui devient Admin auto
  const role: UserRole = email?.toLowerCase() === "teddy.frey1@gmail.com" ? "admin" : "employee"

  const res = await createUserWithEmailAndPassword(auth, email, password)

  // Mise à jour du profil Auth
  await updateProfile(res.user, { displayName })

  // Création du profil Firestore
  const ref = doc(db, "users", res.user.uid)
  try {
    await setDoc(
      ref,
      {
        uid: res.user.uid,
        email,
        displayName,
        role,
        contractHours: 35, // Valeur par défaut
        disabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch {
    // Si les règles Firestore bloquent, on continue (le compte Auth est créé)
  }

  return res.user
}

// --- FONCTION MANQUANTE QUI PROVOQUAIT L'ERREUR ---
// Permet d'inviter un utilisateur sans déconnecter l'admin actuel
export const inviteUser = async (email: string, role: string, hours: number) => {
  const SECONDARY_APP_NAME = "SecondaryApp"
  let secondaryApp: FirebaseApp

  // 1. Initialiser une instance secondaire de l'app Firebase
  if (getApps().some((app) => app.name === SECONDARY_APP_NAME)) {
    secondaryApp = getApp(SECONDARY_APP_NAME)
  } else {
    secondaryApp = initializeApp(FIREBASE_CONFIG, SECONDARY_APP_NAME)
  }

  try {
    const secondaryAuth = getAuth(secondaryApp)

    // 2. Créer l'utilisateur avec un mot de passe temporaire complexe
    const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!" + Date.now()
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword)
    const uid = userCredential.user.uid

    // 3. Envoyer l'email de "mot de passe oublié" pour qu'il définisse le sien
    await sendPasswordResetEmail(secondaryAuth, email)

    // 4. Créer sa fiche dans Firestore (avec l'instance principale 'db')
    await setDoc(doc(db, "users", uid), {
      uid,
      email,
      displayName: email.split("@")[0],
      role, 
      contractHours: hours,
      disabled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // 5. Déconnecter l'instance secondaire pour ne pas interférer
    await firebaseSignOut(secondaryAuth)

    return uid
  } catch (error) {
    console.error("Erreur invitation:", error)
    throw error
  } finally {
    // Nettoyage de la mémoire
    if (secondaryApp!) {
      await deleteApp(secondaryApp)
    }
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export function friendlyAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Email ou mot de passe incorrect."
    case "auth/user-not-found":
      return "Aucun compte ne correspond à cet email."
    case "auth/email-already-in-use":
      return "Cet email est déjà utilisé."
    case "auth/weak-password":
      return "Mot de passe trop faible."
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessayez plus tard."
    case "auth/network-request-failed":
      return "Problème réseau. Vérifiez votre connexion."
    default:
      return "Une erreur est survenue."
  }
}
