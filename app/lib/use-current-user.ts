"use client"

import { useMemo } from "react"
import { useAuth } from "@/components/auth/auth-provider"

export type AppUserRole = "admin" | "manager" | "employee"

export function useCurrentUser() {
  const { user, profile } = useAuth()

  return useMemo(() => {
    // 1. Récupération des infos (Priorité : Firestore > Auth > Vide)
    const email = (profile?.email || user?.email || "").trim()
    const rawName = (profile?.displayName || user?.displayName || "").trim()
    const firstNameFirestore = (profile?.firstName || "").trim()
    
    // 2. Logique intelligente pour le nom
    // Si on a explicitement 'firstName' dans Firestore, on l'utilise.
    // Sinon on essaie de couper le 'displayName'.
    // Sinon on prend le début de l'email.
    let displayName = rawName
    let firstName = firstNameFirestore

    if (!displayName) {
        displayName = email ? email.split("@")[0] : "Utilisateur"
    }
    
    if (!firstName) {
        firstName = displayName.split(" ")[0] || "Utilisateur"
    }

    // 3. Rôle et Heures
    const role = ((profile?.role as AppUserRole | undefined) || "employee") as AppUserRole
    
    // IMPORTANT : Récupération des heures de contrat (Défaut 35h)
    const contractHours = profile?.contractHours ? Number(profile.contractHours) : 35

    return {
      uid: profile?.uid || user?.uid || "",
      email,
      displayName,
      firstName, // Le prénom correct pour le "Bonjour"
      role,
      contractHours, // <--- C'est ça qui manquait pour le calcul !
      isAdmin: role === "admin",
      isManagerOrAdmin: role === "admin" || role === "manager",
    }
  }, [profile, user])
}
