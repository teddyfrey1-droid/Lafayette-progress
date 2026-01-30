"use client"

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { User as FirebaseUser } from "firebase/auth"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp } from "firebase/firestore"

import { auth, db } from "@/lib/firebase/client"
import type { UserProfile, UserRole } from "@/lib/firebase/auth"
import { clearDemoState, ensureDemoSeed } from "@/lib/demo/local-demo-store"

export type CompanyProfile = {
  id: string
  name: string
  plan?: string
  status?: string
  [k: string]: any
}

type AuthContextValue = {
  user: FirebaseUser | null
  profile: UserProfile | null
  company: CompanyProfile | null
  companyLoading: boolean
  isDemo: boolean
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
  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [companyLoading, setCompanyLoading] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const prevCompanyIdRef = useRef<string | null>(null)
  const prevIsDemoRef = useRef<boolean>(false)

  // --- ACTIVITY SESSION TRACKING (suivi connexions + durée) ---
  const tabIdRef = useRef<string | null>(null)
  const startedSessionForUid = useRef<string | null>(null)
  const endingSessionRef = useRef(false)

  const getTabId = () => {
    if (tabIdRef.current) return tabIdRef.current
    if (typeof window === "undefined") return "server"
    const existing = window.sessionStorage.getItem("pulse_tab_id")
    if (existing) {
      tabIdRef.current = existing
      return existing
    }
    const id =
      window.crypto && "randomUUID" in window.crypto
        ? (window.crypto as any).randomUUID()
        : `${Date.now()}-${Math.random()}`
    window.sessionStorage.setItem("pulse_tab_id", id)
    tabIdRef.current = id
    return id
  }

  const sessionKeys = () => {
    const tabId = getTabId()
    return {
      sessionId: `pulse_session_id:${tabId}`,
      endToken: `pulse_session_end_token:${tabId}`,
      uid: `pulse_session_uid:${tabId}`,
    }
  }

  async function startActivitySession(currentUser: FirebaseUser) {
    try {
      if (typeof window === "undefined") return
      const keys = sessionKeys()

      const existingSessionId = window.sessionStorage.getItem(keys.sessionId)
      const existingUid = window.sessionStorage.getItem(keys.uid)
      if (existingSessionId && existingUid === currentUser.uid) return

      const token = await currentUser.getIdToken()
      const res = await fetch("/api/activity/start-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })

      const data = await res.json().catch(() => ({} as any))
      if (res.ok && data?.sessionId && data?.endToken) {
        window.sessionStorage.setItem(keys.sessionId, String(data.sessionId))
        window.sessionStorage.setItem(keys.endToken, String(data.endToken))
        window.sessionStorage.setItem(keys.uid, currentUser.uid)
      }
    } catch {
      // best-effort (offline / adblock / etc.)
    }
  }

  async function endActivitySession(reason: string) {
    if (endingSessionRef.current) return
    try {
      if (typeof window === "undefined") return

      const keys = sessionKeys()
      const sessionId = window.sessionStorage.getItem(keys.sessionId)
      const endToken = window.sessionStorage.getItem(keys.endToken)
      if (!sessionId || !endToken) return

      endingSessionRef.current = true
      await fetch("/api/activity/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, endToken, reason }),
        // @ts-expect-error keepalive is supported in browsers
        keepalive: true,
      }).catch(() => {})
    } finally {
      try {
        if (typeof window !== "undefined") {
          const keys = sessionKeys()
          window.sessionStorage.removeItem(keys.sessionId)
          window.sessionStorage.removeItem(keys.endToken)
          window.sessionStorage.removeItem(keys.uid)
        }
      } catch {
        // ignore
      }
      endingSessionRef.current = false
    }
  }

  // 1. Écoute de l'état d'authentification de base (Firebase Auth)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // 1bis. Si l'utilisateur se déconnecte, on clôture la session (best-effort)
  useEffect(() => {
    if (user) return
    // user === null
    endActivitySession("logout")
    startedSessionForUid.current = null
  }, [user])

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

        // ✅ Mise à jour de la dernière connexion (sert à sortir du statut "en attente")
        await setDoc(
          ref,
          {
            lastLogin: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
      } catch {
        // En cas d'erreur (ex: hors ligne), on laisse l'app continuer
      }
    })()
  }, [user])

  // 2bis. Démarre une session d'activité (1 par login)
  useEffect(() => {
    if (!user) return
    if (!profile) return
    // Démarrer une session une seule fois par uid
    if (startedSessionForUid.current === user.uid) return
    startedSessionForUid.current = user.uid
    startActivitySession(user)

    const handleBeforeUnload = () => {
      // best-effort (keepalive)
      endActivitySession("beforeunload")
    }
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        endActivitySession("hidden")
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [user, profile])

  // 3. Écoute en temps réel du profil utilisateur (Rôles & Bannissement)
  useEffect(() => {
    if (!user) {
      setProfile(null)
      setCompany(null)
      setCompanyLoading(false)
      setIsDemo(false)
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

  // 4. Écoute en temps réel de l'entreprise (plan / statut) + gestion du mode démo
  useEffect(() => {
    const companyId = (profile as any)?.companyId as string | undefined
    if (!companyId) {
      setCompany(null)
      setCompanyLoading(false)
      setIsDemo(false)
      return
    }

    setCompanyLoading(true)
    const ref = doc(db, "companies", companyId)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? (snap.data() as any) : null
        const companyDoc: CompanyProfile | null = data
          ? { id: snap.id, ...(data as any) }
          : null

        setCompany(companyDoc)
        setCompanyLoading(false)

        const plan = (companyDoc?.plan || "").toString().toLowerCase()
        const status = (companyDoc?.status || "").toString().toLowerCase()
        const nextIsDemo = plan === "starter" && status === "trial"

        // Seed demo data only in demo mode
        if (nextIsDemo) {
          const name = (companyDoc?.name || companyDoc?.companyName || "Entreprise Démo").toString()
          ensureDemoSeed(companyId, name)
        }

        // If we were in demo before and we just exited demo, clear local demo state
        if (prevIsDemoRef.current && !nextIsDemo) {
          clearDemoState(companyId)
        }

        prevIsDemoRef.current = nextIsDemo
        prevCompanyIdRef.current = companyId
        setIsDemo(nextIsDemo)
      },
      () => {
        setCompany(null)
        setCompanyLoading(false)
        setIsDemo(false)
      },
    )

    return () => unsub()
  }, [profile])

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, company, companyLoading, isDemo, loading }),
    [user, profile, company, companyLoading, isDemo, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />")
  return ctx
}
