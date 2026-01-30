import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"

import { auth, db } from "./client"

// Roles supportes dans l'app (on conserve la compatibilite avec les anciens libelles)
export type UserRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "assistant_manager"
  | "employee"
  | "employe"
  | "directeur"
  | "gerant"

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  firstName?: string
  lastName?: string
  role: UserRole
  contractHours?: number
  company?: string
  companyName?: string
  companyId?: string
  lastLogin?: unknown
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

  // Attribution automatique du role Admin pour votre email specifique
  const role: UserRole = email?.toLowerCase() === "teddy.frey1@gmail.com" ? "admin" : "employee"

  const res = await createUserWithEmailAndPassword(auth, email, password)

  // Mise a jour du profil Auth
  await updateProfile(res.user, { displayName })

  // Creation du document profil dans Firestore
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
        company: "Heiko",
        disabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch (error) {
    console.error("Erreur lors de la creation du profil Firestore:", error)
  }

  return res.user
}

/**
 * Inviter un utilisateur
 * IMPORTANT: on n'utilise plus sendPasswordResetEmail cote client.
 * L'invitation et l'envoi d'email passent par l'API serveur pour garantir la deliverabilite.
 */
export const inviteUser = async (email: string, role: string, hours: number, company: string) => {
  const [firstNameRaw] = (email || "").split("@")
  const firstName = firstNameRaw || "Utilisateur"

  const res = await fetch("/api/admin/invite-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      firstName,
      lastName: "",
      role,
      contractHours: hours,
      company: company || "Heiko",
    }),
  })

  const data = await res.json().catch(() => ({} as any))
  if (!res.ok) {
    throw new Error((data as any)?.error || "Erreur API")
  }

  return (data as any)?.uid as string
}

/**
 * Deconnexion de l'utilisateur
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
      return "Aucun compte ne correspond a cet email."
    case "auth/email-already-in-use":
      return "Cet email est deja utilise par un autre compte."
    case "auth/weak-password":
      return "Le mot de passe doit contenir au moins 6 caracteres."
    case "auth/invalid-email":
      return "L'adresse email n'est pas valide."
    case "auth/too-many-requests":
      return "Trop de tentatives. Veuillez reessayer plus tard."
    case "auth/network-request-failed":
      return "Probleme de connexion internet."
    default:
      return "Une erreur est survenue lors de l'authentification."
  }
}
