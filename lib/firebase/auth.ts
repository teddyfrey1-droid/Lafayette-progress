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
  company?: string // Champ pour la société/site
  disabled?: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

/**
 * Connexion classique
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const res = await signInWithEmailAndPassword(auth, email, password)
  return res.user
}

/**
 * Inscription publique (via la page /inscription)
 */
export async function signUpWithEmail(params: {
  email: string
  password: string
  displayName: string
  role?: UserRole
}): Promise<User> {
  const { email, password, displayName } = params

  // Attribution automatique du rôle Admin pour votre email spécifique
  const role: UserRole = email?.toLowerCase() === "teddy.frey1@gmail.com" ? "admin" : "employee"

  const res = await createUserWithEmailAndPassword(auth, email, password)

  // Mise à jour du profil Auth
  await updateProfile(res.user, { displayName })

  // Création du document profil dans Firestore
  const ref = doc(db, "users", res.user.uid)
  try {
    await setDoc(
      ref,
      {
        uid: res.user.uid,
        email,
        displayName,
        role,
        contractHours: 35,
        company: "Heiko", // Valeur par défaut
        disabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch (error) {
    console.error("Erreur lors de la création du profil Firestore:", error)
  }

  return res.user
}

/**
 * Inviter un utilisateur (création sans déconnecter l'admin actuel)
 * Utilisé dans app/equipes/page.tsx
 */
export const inviteUser = async (email: string, role: string, hours: number, company: string) => {
  const SECONDARY_APP_NAME = "SecondaryApp"
  let secondaryApp: FirebaseApp

  // 1. Initialiser une instance secondaire pour ne pas écraser la session admin
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

    // 3. Envoyer l'email de réinitialisation pour que l'invité choisisse son mot de passe
    await sendPasswordResetEmail(secondaryAuth, email)

    // 4. Créer sa fiche dans Firestore (avec les paramètres fournis)
    await setDoc(doc(db, "users", uid), {
      uid,
      email,
      displayName: email.split("@")[0],
      role, 
      contractHours: hours,
      company: company || "Heiko", // Enregistrement de la société/site
      disabled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // 5. Déconnecter l'instance secondaire
    await firebaseSignOut(secondaryAuth)

    return uid
  } catch (error) {
    console.error("Erreur lors de l'invitation de l'utilisateur:", error)
    throw error
  } finally {
    // Nettoyage : supprimer l'instance secondaire de la mémoire
    if (secondaryApp!) {
      await deleteApp(secondaryApp)
    }
  }
}

/**
 * Déconnexion de l'utilisateur
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

/**
 * Traduction des erreurs Firebase pour l'utilisateur
 */
export function friendlyAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Email ou mot de passe incorrect."
    case "auth/user-not-found":
      return "Aucun compte ne correspond à cet email."
    case "auth/email-already-in-use":
      return "Cet email est déjà utilisé par un autre compte."
    case "auth/weak-password":
      return "Le mot de passe doit contenir au moins 6 caractères."
    case "auth/invalid-email":
      return "L'adresse email n'est pas valide."
    case "auth/too-many-requests":
      return "Trop de tentatives. Veuillez réessayer plus tard."
    case "auth/network-request-failed":
      return "Problème de connexion internet."
    default:
      return "Une erreur est survenue lors de l'authentification."
  }
}
