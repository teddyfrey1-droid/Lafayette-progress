"use client"

import { useState, useEffect, useCallback } from "react"
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { useAuth } from "@/components/auth/auth-provider"
import { DEFAULT_PERMISSIONS, type ModulePermission, type PermissionMode, MODULES } from "@/lib/permissions-config"

type RawPermissionValue = string[] | Partial<ModulePermission>
type RawPermissionsDoc = Record<string, RawPermissionValue>

function normalizeRole(input?: string) {
  const r = (input || "").toLowerCase().trim()
  if (!r) return ""
  // Aliases EN -> FR / compat
  if (r === "employee") return "employe"
  if (r === "staff") return "employe"
  return r
}

function normalizePermissions(raw: RawPermissionsDoc): Record<string, ModulePermission> {
  const normalized: Record<string, ModulePermission> = {}
  for (const [moduleId, value] of Object.entries(raw || {})) {
    if (Array.isArray(value)) {
      normalized[moduleId] = { view: value, edit: value }
      continue
    }
    const view = Array.isArray((value as any)?.view) ? (value as any).view : []
    const edit = Array.isArray((value as any)?.edit) ? (value as any).edit : []
    normalized[moduleId] = { view, edit }
  }
  return normalized
}

export function usePermissions() {
  const { profile, loading: authLoading } = useAuth()
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>(DEFAULT_PERMISSIONS)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const permissionsRef = doc(db, "settings", "permissions")

    const unsubscribe = onSnapshot(
      permissionsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as any

          // Format courant: { permissions: { [moduleId]: {view:[], edit:[]} } }
          // Format legacy: { [moduleId]: string[] } ou { [moduleId]: {view/edit} }
          const candidate = (data?.permissions && typeof data.permissions === "object") ? data.permissions : data

          // On ne garde que les modules connus (evite d'injecter updatedAt, etc.)
          const allowed = new Set(MODULES.map((m) => m.id))
          const filteredRaw: RawPermissionsDoc = {}
          for (const [k, v] of Object.entries((candidate || {}) as Record<string, any>)) {
            if (allowed.has(k)) filteredRaw[k] = v as RawPermissionValue
          }

          const normalized = normalizePermissions(filteredRaw)

          // Merge avec DEFAULT_PERMISSIONS pour ajouter automatiquement les nouveaux modules
          const merged: Record<string, ModulePermission> = { ...DEFAULT_PERMISSIONS }
          for (const [k, v] of Object.entries(normalized)) merged[k] = v

          // Assurer que tous les modules declares existent
          for (const m of MODULES) {
            if (!merged[m.id]) merged[m.id] = DEFAULT_PERMISSIONS[m.id] || { view: [], edit: [] }
          }

          setPermissions(merged)
        } else {
          setPermissions(DEFAULT_PERMISSIONS)
        }
        setLoading(false)
        setInitialized(true)
      },
      (err) => {
        console.error("Erreur lecture permissions:", err)
        setPermissions(DEFAULT_PERMISSIONS)
        setLoading(false)
        setInitialized(true)
      },
    )

    return () => unsubscribe()
  }, [])

  const currentRole = normalizeRole(profile?.role)

  // ✅ FIX: Mémorise les fonctions pour éviter les re-renders
  const canView = useCallback((moduleId: string) => {
    // ✅ FIX: En cours de chargement auth, on autorise temporairement
    if (authLoading || !initialized) return true
    if (!currentRole) return true // Nouvel utilisateur sans rôle = autoriser par défaut
    if (currentRole === "super_admin") return true
    const modulePerm = permissions[moduleId]
    if (!modulePerm) return true
    return modulePerm.view.map(normalizeRole).includes(currentRole)
  }, [currentRole, permissions, authLoading, initialized])

  const canEdit = useCallback((moduleId: string) => {
    // ✅ FIX: En cours de chargement auth, on refuse les éditions par sécurité
    if (authLoading || !initialized) return false
    if (!currentRole) return false
    if (currentRole === "super_admin") return true
    const modulePerm = permissions[moduleId]
    if (!modulePerm) return false
    return modulePerm.edit.map(normalizeRole).includes(currentRole)
  }, [currentRole, permissions, authLoading, initialized])

  // Alias historique
  const canAccess = canView

  const updatePermission = async (moduleId: string, roleId: string, mode: PermissionMode = "view") => {
    const permissionsRef = doc(db, "settings", "permissions")
    const role = normalizeRole(roleId)

    // Copie
    const current = permissions[moduleId] || { view: [], edit: [] }
    const next: ModulePermission = {
      view: [...(current.view || [])],
      edit: [...(current.edit || [])],
    }

    const list = mode === "edit" ? next.edit : next.view
    const i = list.findIndex((x) => normalizeRole(x) === role)

    if (i >= 0) {
      list.splice(i, 1)
      // Si on retire le view, on retire aussi edit (coherence)
      if (mode === "view") {
        next.edit = next.edit.filter((x) => normalizeRole(x) !== role)
      }
    } else {
      list.push(roleId)
      // Si on ajoute l'edit, on force le view
      if (mode === "edit" && !next.view.map(normalizeRole).includes(role)) {
        next.view.push(roleId)
      }
    }

    const newPermissions = {
      ...permissions,
      [moduleId]: next,
    }

    await setDoc(
      permissionsRef,
      {
        permissions: newPermissions,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  const toggleAll = async (moduleId: string, enabled: boolean, mode: PermissionMode = "view") => {
    const permissionsRef = doc(db, "settings", "permissions")

    const roles = [
      "employe",
      "assistant_manager",
      "manager",
      "directeur",
      "gerant",
      "admin",
      "super_admin",
    ]

    const current = permissions[moduleId] || { view: [], edit: [] }
    const next: ModulePermission = { ...current, view: [...current.view], edit: [...current.edit] }

    if (enabled) {
      if (mode === "view") next.view = roles
      if (mode === "edit") {
        next.edit = roles
        next.view = Array.from(new Set([...(next.view || []), ...roles]))
      }
    } else {
      if (mode === "view") {
        next.view = []
        next.edit = []
      } else {
        next.edit = []
      }
    }

    const newPermissions = {
      ...permissions,
      [moduleId]: next,
    }

    await setDoc(
      permissionsRef,
      {
        permissions: newPermissions,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  const resetToDefault = async () => {
    const permissionsRef = doc(db, "settings", "permissions")
    await setDoc(
      permissionsRef,
      {
        permissions: DEFAULT_PERMISSIONS,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  return {
    permissions,
    loading,
    canView,
    canEdit,
    canAccess,
    updatePermission,
    toggleAll,
    resetToDefault,
  }
}
