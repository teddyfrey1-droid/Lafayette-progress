"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { User as FirebaseUser } from "firebase/auth"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp } from "firebase/firestore"

import { auth, db } from "@/lib/firebase/client"
import type { UserProfile, UserRole } from "@/lib/firebase/auth"

type AuthContextValue = {
  user: FirebaseUser | null
  profile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function fallbackDisplayName(email: string, authName?: string | null) {
  const trimmedAuthName = (authName || "").trim()
  if (trimmedAuthName) return trimmedAuthName
  const trimmedEmail = (email || "").trim()
  if (!trimmedEmail) return "Utilisateur"
  return trimmedEmail.split("@")[0] || "Utilisateur"
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // 1. Écoute de l'état d'authentification de base (Firebase Auth)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // 2. Création automatique du profil Firestore s'il n'existe pas
  useEffect(() => {
    if (!user) return

    ;(async () => {
      try {
        const email = (user.email || "").trim()
        const ref = doc(db, "users", user.uid)
        const snap = await getDoc(ref)

        if (!snap.exists()) {
          // Si c'est votre email, on le met admin d'office pour éviter de se bloquer soi-même
          const role: UserRole = email.toLowerCase() === "teddydu911@gmail.com" ? "admin" : "employee"
          const displayName = fallbackDisplayName(email, user.displayName)

          await setDoc(
            ref,
            {
              uid: user.uid,
              email,
              displayName,
              role,
              contractHours: 35,
              disabled: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          )
        } else {
          // Si le document existe mais que le nom est vide, on le remplit
          const data = snap.data() as Partial<UserProfile>
          const existingName = (data.displayName || "").trim()
          if (!existingName) {
            const displayName = fallbackDisplayName(email, user.displayName)
            await setDoc(
              ref,
              {
                displayName,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            )
          }
        }
      } catch {
        // En cas d'erreur (ex: hors ligne), on laisse l'app continuer
      }
    })()
  }, [user])

  // 3. Écoute en temps réel du profil utilisateur (Rôles & Bannissement)
  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }

    const ref = doc(db, "users", user.uid)
    const unsub = onSnapshot(
      ref,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile
          
          // --- SÉCURITÉ : Vérification immédiate du bannissement ---
          if (data.disabled === true) {
            console.warn("Compte désactivé. Déconnexion forcée.")
            await signOut(auth) // Déconnexion Firebase
            router.replace("/connexion?error=account_disabled") // Redirection
            return
          }
          // ---------------------------------------------------------

          setProfile(data)
        } else {
          // Profil minimal en attendant la création Firestore
          const email = (user.email || "").trim()
          setProfile({
            uid: user.uid,
            email,
            displayName: fallbackDisplayName(email, user.displayName),
            role: "employee",
            createdAt: null,
            updatedAt: null,
          })
        }
      },
      () => {
        // En cas d'erreur de lecture, on garde un profil par défaut
        const email = (user.email || "").trim()
        setProfile({
          uid: user.uid,
          email,
          displayName: fallbackDisplayName(email, user.displayName),
          role: "employee",
          createdAt: null,
          updatedAt: null,
        })
      },
    )

    return () => unsub()
  }, [user, router])

  const value = useMemo<AuthContextValue>(() => ({ user, profile, loading }), [user, profile, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />")
  return ctx
}
