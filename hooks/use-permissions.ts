"use client"

import { useState, useEffect } from "react"
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
    // Legacy: { [moduleId]: string[] }
    if (Array.isArray(value)) {
      normalized[moduleId] = { view: value, edit: value, delete: value }
      continue
    }

    const view = Array.isArray((value as any)?.view) ? (value as any).view : []
    const edit = Array.isArray((value as any)?.edit) ? (value as any).edit : []
    // delete peut etre absent dans les anciens documents -> fallback sur edit
    const del = Array.isArray((value as any)?.delete) ? (value as any).delete : edit

    normalized[moduleId] = { view, edit, delete: del }
  }
  return normalized
}

export function usePermissions() {
  const { profile } = useAuth()
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>(DEFAULT_PERMISSIONS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const permissionsRef = doc(db, "settings", "permissions")

    const unsubscribe = onSnapshot(
      permissionsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as any

          // Format courant: { permissions: { [moduleId]: {view:[], edit:[], delete:[]} } }
          // Format legacy: { [moduleId]: string[] } ou { [moduleId]: {view/edit} }
          const candidate = data?.permissions && typeof data.permissions === "object" ? data.permissions : data

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
            if (!merged[m.id]) merged[m.id] = DEFAULT_PERMISSIONS[m.id] || { view: [], edit: [], delete: [] }
            // Compat : si delete manque (ancien doc), on met delete = edit
            if (!Array.isArray((merged[m.id] as any).delete)) {
              ;(merged[m.id] as any).delete = Array.isArray((merged[m.id] as any).edit) ? (merged[m.id] as any).edit : []
            }
          }

          setPermissions(merged)
        } else {
          setPermissions(DEFAULT_PERMISSIONS)
        }
        setLoading(false)
      },
      (err) => {
        console.error("Erreur lecture permissions:", err)
        setPermissions(DEFAULT_PERMISSIONS)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  const currentRole = normalizeRole(profile?.role)

  const canView = (moduleId: string) => {
    if (!currentRole) return false
    if (currentRole === "super_admin") return true
    const modulePerm = permissions[moduleId]
    if (!modulePerm) return true
    return modulePerm.view.map(normalizeRole).includes(currentRole)
  }

  const canEdit = (moduleId: string) => {
    if (!currentRole) return false
    if (currentRole === "super_admin") return true
    const modulePerm = permissions[moduleId]
    if (!modulePerm) return false
    return modulePerm.edit.map(normalizeRole).includes(currentRole)
  }

  const canDelete = (moduleId: string) => {
    if (!currentRole) return false
    if (currentRole === "super_admin") return true
    const modulePerm = permissions[moduleId]
    if (!modulePerm) return false
    const list = Array.isArray((modulePerm as any).delete) ? (modulePerm as any).delete : modulePerm.edit
    return (list || []).map(normalizeRole).includes(currentRole)
  }

  // Alias historique
  const canAccess = canView

  const updatePermission = async (moduleId: string, roleId: string, mode: PermissionMode = "view") => {
    const permissionsRef = doc(db, "settings", "permissions")
    const role = normalizeRole(roleId)

    // Copie
    const current = permissions[moduleId] || { view: [], edit: [], delete: [] }
    const next: ModulePermission = {
      view: [...(current.view || [])],
      edit: [...(current.edit || [])],
      delete: [...((current as any).delete || [])],
    }

    const list = mode === "edit" ? next.edit : mode === "delete" ? next.delete : next.view
    const i = list.findIndex((x) => normalizeRole(x) === role)

    if (i >= 0) {
      list.splice(i, 1)
      // Coherence:
      // - si on retire view -> retirer edit + delete
      // - si on retire edit -> retirer delete
      if (mode === "view") {
        next.edit = next.edit.filter((x) => normalizeRole(x) !== role)
        next.delete = next.delete.filter((x) => normalizeRole(x) !== role)
      }
      if (mode === "edit") {
        next.delete = next.delete.filter((x) => normalizeRole(x) !== role)
      }
    } else {
      list.push(roleId)
      // Coherence:
      // - si on ajoute edit -> forcer view
      // - si on ajoute delete -> forcer edit + view
      if (mode === "edit" && !next.view.map(normalizeRole).includes(role)) {
        next.view.push(roleId)
      }
      if (mode === "delete") {
        if (!next.edit.map(normalizeRole).includes(role)) next.edit.push(roleId)
        if (!next.view.map(normalizeRole).includes(role)) next.view.push(roleId)
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

    const roles = ["employe", "assistant_manager", "manager", "directeur", "gerant", "admin", "super_admin"]

    const current = permissions[moduleId] || { view: [], edit: [], delete: [] }
    const next: ModulePermission = {
      view: [...(current.view || [])],
      edit: [...(current.edit || [])],
      delete: [...((current as any).delete || [])],
    }

    if (enabled) {
      if (mode === "view") {
        next.view = roles
      }
      if (mode === "edit") {
        next.edit = roles
        next.view = Array.from(new Set([...(next.view || []), ...roles]))
      }
      if (mode === "delete") {
        next.delete = roles
        next.edit = Array.from(new Set([...(next.edit || []), ...roles]))
        next.view = Array.from(new Set([...(next.view || []), ...roles]))
      }
    } else {
      if (mode === "view") {
        next.view = []
        next.edit = []
        next.delete = []
      } else if (mode === "edit") {
        next.edit = []
        next.delete = []
      } else {
        next.delete = []
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
    canDelete,
    canAccess,
    updatePermission,
    toggleAll,
    resetToDefault,
  }
}
