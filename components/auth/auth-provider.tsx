"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { onAuthStateChanged, User } from "firebase/auth"
import { auth, db } from "@/lib/firebase/client"
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"
import { normalizeRole, clampContractHours } from "@/lib/identity"

type AuthContextType = {
  user: User | null
  profile: any | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const DEFAULT_COMPANY_ID = "default"
const DEFAULT_COMPANY_NAME = "Non assigné"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile: null | (() => void) = null

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      // reset previous profile listener
      if (unsubProfile) {
        unsubProfile()
        unsubProfile = null
      }

      if (!firebaseUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)

      const userRef = doc(db, "users", firebaseUser.uid)

      try {
        const snap = await getDoc(userRef)

        if (!snap.exists()) {
          // Création d'un profil minimal (compatible règles + UI)
          const initial = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "",
            role: "employe",
            contractHours: 35,
            companyId: DEFAULT_COMPANY_ID,
            companyName: DEFAULT_COMPANY_NAME,
            company: DEFAULT_COMPANY_NAME,
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
          await setDoc(userRef, initial)
        }
      } catch (e) {
        console.error("AuthProvider profile init error", e)
        setProfile(null)
        setLoading(false)
        return
      }

      let didTryMigration = false

      unsubProfile = onSnapshot(
        userRef,
        async (docSnap) => {
          if (!docSnap.exists()) {
            setProfile(null)
            setLoading(false)
            return
          }

          const data = docSnap.data() as any
          const derivedCompanyId = data.companyId || data.company || DEFAULT_COMPANY_ID
          const derivedCompanyName =
            data.companyName || data.company || (derivedCompanyId === DEFAULT_COMPANY_ID ? DEFAULT_COMPANY_NAME : derivedCompanyId)

          const normalized = {
            ...data,
            role: normalizeRole(data.role),
            contractHours: clampContractHours(data.contractHours),
            companyId: derivedCompanyId,
            companyName: derivedCompanyName,
            company: derivedCompanyName,
          }

          // Migration légère: injecter companyId si manquant (pilotage en dépend)
          if (!data.companyId && !didTryMigration) {
            didTryMigration = true
            try {
              await updateDoc(userRef, {
                companyId: normalized.companyId,
                companyName: normalized.companyName,
                company: normalized.companyName,
                updatedAt: serverTimestamp(),
              })
            } catch {
              // si règles trop strictes, on garde la valeur côté UI
            }
          }

          setProfile(normalized)
          setLoading(false)
        },
        (err) => {
          console.error("AuthProvider profile onSnapshot error", err)
          setProfile(null)
          setLoading(false)
        },
      )
    })

    return () => {
      if (unsubProfile) unsubProfile()
      unsubAuth()
    }
  }, [])

  return <AuthContext.Provider value={{ user, profile, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
