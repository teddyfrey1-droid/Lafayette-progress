"use client"

import React, { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "./auth-provider"

const PUBLIC_PATHS = new Set<string>(["/", "/connexion", "/inscription", "/aide"])

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (PUBLIC_PATHS.has(pathname)) return
    if (!firebaseUser) router.replace("/connexion")
  }, [firebaseUser, loading, pathname, router])

  if (PUBLIC_PATHS.has(pathname)) return <>{children}</>

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="pulse-card p-6 rounded-2xl">
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      </div>
    )
  }

  if (!firebaseUser) return null

  return <>{children}</>
}
