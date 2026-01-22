"use client"

import React, { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { Spinner } from "@/components/ui/spinner"

// Liste des pages accessibles à tous (sans connexion)
const PUBLIC_PATHS = ["/", "/connexion", "/inscription", "/mot-de-passe-oublie"]

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname() || "/"
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  // Vérifie si l'URL actuelle commence par l'une des routes publiques
  // Cela gère /connexion, /connexion/, /connexion?etc...
  const isPublic = PUBLIC_PATHS.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  )

  useEffect(() => {
    // Si on est sur une page publique, on arrête de vérifier
    if (isPublic) {
      setIsChecking(false)
      return
    }

    // Si le chargement auth est fini et qu'on a pas d'utilisateur
    if (!loading && !user) {
      // On redirige vers la connexion en sauvegardant la page demandée
      const next = encodeURIComponent(pathname)
      router.replace(`/connexion?next=${next}`)
    } else if (!loading && user) {
      // Si on est connecté, on laisse passer
      setIsChecking(false)
    }
  }, [loading, user, pathname, isPublic, router])

  // 1. Si c'est une page publique, on affiche direct (c'est ça qui bloquait !)
  if (isPublic) {
    return <>{children}</>
  }

  // 2. Pendant le chargement de Firebase, on affiche le spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // 3. Si on n'est pas connecté (et pas sur une page publique), on affiche rien ou le spinner en attendant la redirection
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // 4. Si tout est bon (Utilisateur connecté sur page privée)
  return <>{children}</>
}
