"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useRBAC } from "@/components/auth/rbac-provider"

type Props = {
  moduleId: string | string[]
  action?: string
  requireEdit?: boolean
  match?: "any" | "all"
  redirect?: boolean
  children: React.ReactNode
}

const fallbackAction = (moduleId: string, action?: string) => {
  if (action) return action
  // Par défaut: lecture / accès
  return "view"
}

export function PermissionGate({ moduleId, action, requireEdit, match = "all", redirect, children }: Props) {
  const router = useRouter()
  const { can, loading } = useRBAC()

  const modules = Array.isArray(moduleId) ? moduleId : [moduleId]
  const requiredAction = requireEdit ? "edit" : undefined

  const checkOne = (m: string) => {
    const a = requiredAction || fallbackAction(m, action)
    // certains modules historiques utilisent "access" au lieu de "view"
    const ok = can(m, a) || (a === "view" ? can(m, "access") : false)
    return ok
  }

  const allowed = match === "any" ? modules.some(checkOne) : modules.every(checkOne)

  React.useEffect(() => {
    if (!redirect) return
    if (loading) return
    if (!allowed) router.replace("/connexion")
  }, [allowed, loading, redirect, router])

  if (loading) return null
  if (!allowed) return null

  return <>{children}</>
}
