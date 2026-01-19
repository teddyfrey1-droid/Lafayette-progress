"use client"

import { useMemo } from "react"
import { useAuth } from "@/components/auth/auth-provider"

export type AppUserRole = "admin" | "manager" | "employee"

export function useCurrentUser() {
  const { user, profile } = useAuth()

  return useMemo(() => {
    const email = (profile?.email || user?.email || "").trim()
    const rawName = (profile?.displayName || user?.displayName || "").trim()
    const fallbackName = email ? email.split("@")[0] : "Utilisateur"
    const displayName = rawName || fallbackName
    const role = ((profile?.role as AppUserRole | undefined) || "employee") as AppUserRole

    return {
      uid: profile?.uid || user?.uid || "",
      email,
      displayName,
      role,
      isAdmin: role === "admin",
      isManagerOrAdmin: role === "admin" || role === "manager",
      firstName: displayName.split(" ")[0] || "Utilisateur",
    }
  }, [profile?.uid, profile?.email, profile?.displayName, profile?.role, user?.uid, user?.email, user?.displayName])
}
