"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase/client"
import { doc, onSnapshot } from "firebase/firestore"
import { useAuth } from "@/components/auth/auth-provider"
import { DEFAULT_PERMISSIONS } from "@/lib/permissions-config"

export function usePermissions() {
  const { profile } = useAuth()
  const [permissions, setPermissions] = useState<Record<string, string[]>>(DEFAULT_PERMISSIONS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Écoute en temps réel du document 'permissions' dans la collection 'settings'
    const unsub = onSnapshot(doc(db, "settings", "permissions"), (docSnap) => {
      if (docSnap.exists()) {
        setPermissions(docSnap.data() as Record<string, string[]>)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Fonction principale pour vérifier un accès
  const canAccess = (moduleId: string): boolean => {
    // Si pas de profil chargé, pas d'accès
    if (!profile || !profile.role) return false
    
    // Le super_admin a toujours tous les droits (sécurité ultime)
    if (profile.role === "super_admin") return true
    
    const allowedRoles = permissions[moduleId] || []
    return allowedRoles.includes(profile.role)
  }

  return { permissions, loading, canAccess, userRole: profile?.role }
}
