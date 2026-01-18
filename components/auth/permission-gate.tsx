"use client"

import { ReactNode, useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePermissions } from "@/hooks/use-permissions"

interface PermissionGateProps {
  moduleId: string | string[]
  children: ReactNode
  fallback?: ReactNode
  redirect?: boolean
  requireEdit?: boolean
  match?: "all" | "any"
}

export function PermissionGate({
  moduleId,
  children,
  fallback,
  redirect = false,
  requireEdit = false,
  match = "all",
}: PermissionGateProps) {
  const router = useRouter()
  const { canView, canEdit, loading } = usePermissions()

  const ids = Array.isArray(moduleId) ? moduleId : [moduleId]
  const check = (id: string) => (requireEdit ? canEdit(id) : canView(id))
  const hasAccess = match === "any" ? ids.some(check) : ids.every(check)

  useEffect(() => {
    if (!loading && redirect && !hasAccess) {
      router.replace("/dashboard")
    }
  }, [loading, redirect, hasAccess, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>

    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m0-8v2m0 7a9 9 0 110-18 9 9 0 010 18z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Acces refuse</h2>
          <p className="text-muted-foreground mb-6">
            Vous n'avez pas les droits necessaires pour acceder a cette section.
          </p>
          <button onClick={() => router.back()} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
            Retour
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
