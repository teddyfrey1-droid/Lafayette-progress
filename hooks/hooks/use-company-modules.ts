"use client"

import { useMemo } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { COMPANY_MODULES, normalizeCompanyModuleId } from "@/lib/company-modules-config"

type CompanyFeature = { id: string; enabled: boolean }

/**
 * Modules activés par entreprise (Centre de contrôle).
 * - Compatible avec les anciennes valeurs stockées via `aliases`.
 * - Merge avec les défauts pour que les nouvelles pages apparaissent sans casser les anciennes entreprises.
 * - ✅ FIX: Gestion robuste des cas où company/profile n'est pas encore chargé
 */
export function useCompanyModules() {
  const { company, profile, loading, companyLoading } = useAuth()

  const role = (profile as any)?.role ? String((profile as any).role).toLowerCase() : ""
  const isSuperAdmin = role === "super_admin"

  const enabledSet = useMemo(() => {
    // ✅ FIX: En cours de chargement, on autorise tout pour éviter l'écran noir
    if (loading || companyLoading) return null as Set<string> | null
    
    // Pas d'entreprise (super_admin global, nouveau user, etc.) => pas de limitation par modules.
    if (!company) return null as Set<string> | null

    const raw: CompanyFeature[] = Array.isArray((company as any)?.features)
      ? ((company as any).features as any[]).map((f) => ({
          id: String((f as any)?.id || ""),
          enabled: Boolean((f as any)?.enabled),
        }))
      : []

    const byId = new Map<string, boolean>()
    for (const f of raw) {
      const nid = normalizeCompanyModuleId(f.id)
      if (!nid) continue
      byId.set(nid, f.enabled)
    }

    // Merge avec defaults : si un module n'existe pas encore en base, on prend isDefault
    const set = new Set<string>()
    for (const def of COMPANY_MODULES) {
      const enabled = byId.has(def.id) ? Boolean(byId.get(def.id)) : Boolean(def.isDefault)
      if (enabled) set.add(def.id)
    }

    // Modules toujours visibles
    set.add("dashboard")
    // Ne jamais bloquer le centre de contrôle à cause d'une config entreprise
    set.add("centre_controle")
    // ✅ FIX: Toujours autoriser les paramètres et notifications de base
    set.add("parametres")
    set.add("notifications")

    return set
  }, [company, loading, companyLoading])

  const isModuleEnabled = (moduleId: string) => {
    const id = (moduleId || "").toString()
    if (!id) return true
    if (isSuperAdmin) return true
    // ✅ FIX: En cours de chargement, autoriser pour éviter l'écran noir
    if (loading || companyLoading) return true
    if (!enabledSet) return true
    if (id === "dashboard" || id === "centre_controle" || id === "parametres" || id === "notifications") return true
    return enabledSet.has(id)
  }

  return {
    isModuleEnabled,
    enabledSet,
    isSuperAdmin,
    loading: loading || companyLoading,
  }
}
