"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { clampContractHours, normalizeRole } from "@/lib/identity"
import { getTenantKey } from "@/lib/tenant"

export type CurrentUser = {
  uid: string
  email: string
  displayName: string
  role: string
  contractHours: number
  companyId: string | null
  companyName: string | null
  tenantKey: string | null
  excludeFromPrimes: boolean
  isManagerOrAdmin: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
}

export function useCurrentUser(): CurrentUser {
  const { user, profile } = useAuth()

  const uid = user?.uid || ""
  const email = user?.email || ""
  const displayName = profile?.displayName || user?.displayName || email || ""
  const role = normalizeRole(profile?.role)
  const contractHours = clampContractHours(profile?.contractHours ?? 35)

  const companyId = (profile?.companyId || profile?.company || null) as string | null
  const companyName = (profile?.companyName || profile?.company || null) as string | null
  const tenantKey = getTenantKey(profile)

  const excludeFromPrimes = Boolean(profile?.excludeFromPrimes)

  const isSuperAdmin = role === "super_admin"
  const isAdmin = role === "admin" || isSuperAdmin
  const isManagerOrAdmin = isAdmin || ["gerant", "directeur", "manager"].includes(role)

  return {
    uid,
    email,
    displayName,
    role,
    contractHours,
    companyId,
    companyName,
    tenantKey,
    excludeFromPrimes,
    isManagerOrAdmin,
    isAdmin,
    isSuperAdmin,
  }
}
