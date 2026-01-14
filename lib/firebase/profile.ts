import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"
import { getDefaultCompanyId, getFirebaseDb } from "./client"

export type UserRole = "admin" | "manager" | "employee"

export interface UserProfile {
  uid: string
  email: string
  name: string
  role: UserRole
  companyId: string
  excludeFromPrimes: boolean
  createdAt?: unknown
  lastLogin?: unknown
  status?: "active" | "inactive" | "pending"
}

export function userProfileRef(companyId: string, uid: string) {
  return doc(getFirebaseDb(), "companyData", companyId, "users", uid)
}

export async function ensureUserProfile(params: { uid: string; email: string; name?: string; companyId?: string }) {
  const companyId = params.companyId ?? getDefaultCompanyId()
  const ref = userProfileRef(companyId, params.uid)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    const profile: UserProfile = {
      uid: params.uid,
      email: params.email,
      name: params.name?.trim() || params.email.split("@")[0] || "Utilisateur",
      role: "employee",
      companyId,
      excludeFromPrimes: false,
      status: "active",
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    }
    await setDoc(ref, profile, { merge: true })
    return profile
  }
  return snap.data() as UserProfile
}

export async function touchLastLogin(companyId: string, uid: string) {
  const ref = userProfileRef(companyId, uid)
  await updateDoc(ref, { lastLogin: serverTimestamp() })
}
