"use client"

import { usePermissions } from "@/hooks/use-permissions"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PermissionGateProps {
  moduleId: string
  children: React.ReactNode
  fallback?: React.ReactNode // Affiché si refusé (sinon redirection ou message par défaut)
  redirect?: boolean // Rediriger automatiquement vers /dashboard ?
}

export function PermissionGate({ moduleId, children, fallback, redirect = false }: PermissionGateProps) {
  const { canAccess, loading } = usePermissions()
  const router = useRouter()
  const hasAccess = canAccess(moduleId)

  useEffect(() => {
    if (!loading && !hasAccess && redirect) {
      router.push("/dashboard")
    }
  }, [loading, hasAccess, redirect, router])

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>
    
    // Message d'accès refusé par défaut
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center p-4 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
          <Lock className="w-10 h-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">Accès Restreint</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Votre niveau d'habilitation actuel ne vous permet pas d'accéder au module <strong>{moduleId}</strong>.
        </p>
        <Button onClick={() => router.push("/dashboard")} variant="outline" className="mt-4 rounded-xl">
          Retour au tableau de bord
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
