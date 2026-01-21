"use client"

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { doc, onSnapshot, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { useAuth } from "./auth-provider"
import { DEFAULT_ROLES, RBAC_SCHEMA } from "@/lib/rbac-schema"
import { normalizeRole } from "@/lib/identity"

interface RBACContextType {
  can: (module: string, action: string) => boolean
  roleDefinitions: any
  userRole: string
  loading: boolean
  updateRolePermissions: (roleKey: string, permissions: any) => Promise<void>
  createRole: (roleKey: string, label: string, baseRole?: string) => Promise<void>
  deleteRole: (roleKey: string) => Promise<void>
}

const RBACContext = createContext<RBACContextType | null>(null)

function deepClone<T>(v: T): T {
  try {
    return JSON.parse(JSON.stringify(v))
  } catch {
    return v
  }
}

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const userRole = normalizeRole(profile?.role)

  const [roleDefinitions, setRoleDefinitions] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [configExists, setConfigExists] = useState<boolean | null>(null)

  const initAttemptedRef = useRef(false)

  // 1) Charger la config RBAC depuis Firestore (config/roles)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "roles"), (snapshot) => {
      if (snapshot.exists()) {
        setRoleDefinitions(snapshot.data())
        setConfigExists(true)
      } else {
        // On garde une config locale par défaut pour éviter de casser l'UI,
        // mais on n'écrit dans Firestore que si un rôle autorisé le permet.
        setRoleDefinitions(DEFAULT_ROLES)
        setConfigExists(false)
      }
      setLoading(false)
    })

    return () => unsub()
  }, [])

  // 2) Initialisation Firestore (1 seule fois) — uniquement pour Admin/Super Admin
  useEffect(() => {
    if (configExists !== false) return
    if (initAttemptedRef.current) return

    const canInit = userRole === "super_admin" || userRole === "admin"
    if (!canInit) return

    initAttemptedRef.current = true
    ;(async () => {
      try {
        await setDoc(doc(db, "config", "roles"), DEFAULT_ROLES)
      } catch (e) {
        // Si règles Firestore trop strictes, l'UI reste fonctionnelle en local.
        console.error("RBAC init failed", e)
      }
    })()
  }, [configExists, userRole])

  // 3) Fonction de vérification universelle
  const can = useMemo(() => {
    return (module: string, action: string) => {
      if (!profile) return false

      const roleKey = normalizeRole(profile.role)

      // Schéma inconnu → refuse tout (sécurité)
      if (!RBAC_SCHEMA[module]) {
        // Alias minimal: certains menus utilisent "sites" pour le module "sites_utiles"
        if (module === "sites" && RBAC_SCHEMA["sites_utiles"]) {
          module = "sites_utiles"
        } else {
          return false
        }
      }

      // Super admin / admin avec *
      const userRoleConfig = roleDefinitions?.[roleKey]
      if (!userRoleConfig) return false
      if (userRoleConfig.permissions?.["*"]) return true

      const moduleConfig = userRoleConfig.permissions?.[module]
      if (!moduleConfig) return false

      if (moduleConfig["*"] === true) return true
      return moduleConfig[action] === true
    }
  }, [profile, roleDefinitions])

  // 4) Actions d'administration
  const updateRolePermissions = async (roleKey: string, permissions: any) => {
    // côté UI, la page est déjà protégée, mais on ajoute une barrière ici aussi
    if (!can("equipes", "manage_permissions") && !(userRole === "admin" || userRole === "super_admin")) {
      throw new Error("FORBIDDEN")
    }

    const newRoles = { ...roleDefinitions }
    if (!newRoles[roleKey]) return

    newRoles[roleKey].permissions = deepClone(permissions)
    await setDoc(doc(db, "config", "roles"), newRoles)
  }

  const createRole = async (roleKey: string, label: string, baseRole = "employe") => {
    if (!can("equipes", "manage_permissions") && !(userRole === "admin" || userRole === "super_admin")) {
      throw new Error("FORBIDDEN")
    }

    const newRoles = { ...roleDefinitions }
    const basePerms = deepClone(roleDefinitions?.[baseRole]?.permissions || DEFAULT_ROLES.employe.permissions)

    newRoles[roleKey] = { label, permissions: basePerms }
    await setDoc(doc(db, "config", "roles"), newRoles)
  }

  const deleteRole = async (roleKey: string) => {
    if (!can("equipes", "manage_permissions") && !(userRole === "admin" || userRole === "super_admin")) {
      throw new Error("FORBIDDEN")
    }

    const newRoles = { ...roleDefinitions }
    delete newRoles[roleKey]
    await setDoc(doc(db, "config", "roles"), newRoles)
  }

  return (
    <RBACContext.Provider
      value={{
        can,
        roleDefinitions,
        userRole: userRole || "guest",
        loading,
        updateRolePermissions,
        createRole,
        deleteRole,
      }}
    >
      {children}
    </RBACContext.Provider>
  )
}

export const useRBAC = () => {
  const context = useContext(RBACContext)
  if (!context) throw new Error("useRBAC must be used within RBACProvider")
  return context
}
