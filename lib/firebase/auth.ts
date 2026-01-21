import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "./client"
import { clampContractHours, normalizeRole } from "@/lib/identity"
import { getAuthHeader } from "@/lib/firebase/get-id-token"

export type UserRole = "super_admin" | "admin" | "gerant" | "directeur" | "manager" | "assistant_manager" | "employe" | string

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
  params: { role?: UserRole; contractHours?: number; companyId?: string; companyName?: string } = {}
) {
  const role = normalizeRole(params.role || "employe")
  const companyId = params.companyId ?? "default"
  const companyName = params.companyName ?? (companyId === "default" ? "Non assigné" : companyId)
  const contractHours = clampContractHours(params.contractHours ?? 35)

  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    displayName,
    role,
    contractHours,
    companyId,
    companyName,
    company: companyName,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function signUp(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await createUserProfile(cred.user.uid, email, displayName)
  return cred
}

// Invite (admin route) — requires Authorization Bearer token
export async function inviteUser(email: string, displayName: string, role: UserRole = "employe", contractHours = 35, companyId?: string) {
  const headers = { "Content-Type": "application/json", ...(await getAuthHeader()) }

  const res = await fetch("/api/admin/invite-user", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, displayName, role, contractHours, companyId }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || "Invite failed")
  return data
}

export async function sendResetLink(email: string) {
  return sendPasswordResetEmail(auth, email)
}

// Compatibility: InscriptionClient expects signUpWithEmail
export async function signUpWithEmail(
  input:
    | { email: string; password: string; displayName: string }
    | string,
  password?: string,
  displayName?: string,
) {
  if (typeof input === "string") {
    return signUp(input, password || "", displayName || "")
  }
  return signUp(input.email, input.password, input.displayName)
}

// Friendly Firebase auth error messages (FR)
export function friendlyAuthError(err: any): string {
  const code = String(err?.code || "")
  switch (code) {
    case "auth/invalid-email":
      return "Email invalide."
    case "auth/user-disabled":
      return "Compte désactivé."
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Email ou mot de passe incorrect."
    case "auth/email-already-in-use":
      return "Cet email est déjà utilisé."
    case "auth/weak-password":
      return "Mot de passe trop faible."
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessayez plus tard."
    default:
      return err?.message ? String(err.message) : "Erreur d’authentification."
  }
}
