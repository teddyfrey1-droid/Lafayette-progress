"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"
import { getDefaultCompanyId, getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client"
import type { UserProfile } from "@/lib/firebase/profile"
import { ensureUserProfile } from "@/lib/firebase/profile"

type AuthContextValue = {
  firebaseUser: FirebaseUser | null
  profile: UserProfile | null
  companyId: string
  loading: boolean
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const companyId = getDefaultCompanyId()

  useEffect(() => {
    let unsubProfile: (() => void) | null = null

    const unsubAuth = onAuthStateChanged(getFirebaseAuth(), async (u) => {
      setFirebaseUser(u)
      setProfile(null)

      if (!u) {
        if (unsubProfile) unsubProfile()
        unsubProfile = null
        setLoading(false)
        return
      }

      try {
        // Ensure profile exists (first login)
        await ensureUserProfile({
          uid: u.uid,
          email: u.email ?? "",
          name: u.displayName ?? undefined,
          companyId,
        })

        const ref = doc(getFirebaseDb(), "companyData", companyId, "users", u.uid)
        unsubProfile = onSnapshot(ref, (snap) => {
          if (snap.exists()) setProfile(snap.data() as UserProfile)
          else setProfile(null)
          setLoading(false)
        })
      } catch (e) {
        console.error(e)
        setLoading(false)
      }
    })

    return () => {
      if (unsubProfile) unsubProfile()
      unsubAuth()
    }
  }, [companyId])

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      companyId,
      loading,
      signOutUser: async () => {
        await signOut(getFirebaseAuth())
      },
    }),
    [firebaseUser, profile, companyId, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider />")
  return ctx
}
