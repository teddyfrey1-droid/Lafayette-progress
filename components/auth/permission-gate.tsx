"use client"

import { usePermissions } from "@/hooks/use-permissions"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PermissionGateProps {
  moduleId: string
  children: React.ReactNode
  fallback?: React.ReactNode // Contenu à afficher si refusé (par défaut: redirection ou message)
  redirect?: boolean // Rediriger automatiquement ?
}

export function PermissionGate({ moduleId, children, fallback, redirect = false }: PermissionGateProps) {
  const { canAccess, loading } = usePermissions()
  const router = useRouter()
  const hasAccess = canAccess(moduleId)

  useEffect(() => {
    if (!loading && !hasAccess && redirect) {
      router.push("/dashboard") // Ou une page 403
    }
  }, [loading, hasAccess, redirect, router])

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>
    
    // Fallback par défaut
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center p-4">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">Accès Restreint</h2>
        <p className="text-muted-foreground max-w-sm">
          Votre rôle ne vous permet pas d'accéder à ce module ({moduleId}).
        </p>
        <Button onClick={() => router.push("/dashboard")} variant="outline">
          Retour au tableau de bord
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
