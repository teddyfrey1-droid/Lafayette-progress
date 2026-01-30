import { useAuth } from "@/components/auth/auth-provider"

export function useCurrentUser() {
  const { profile, user } = useAuth()

  // 1. On essaie de récupérer les infos précises de Firestore (le profil enregistré en base)
  const dbFirstName = profile?.firstName
  const dbLastName = profile?.lastName
  
  // 2. Si pas en base, on essaie le "Display Name" de l'authentification (ex: "Thomas Durand")
  const authName = user?.displayName || ""
  const splitName = authName.split(" ")
  
  // 3. Logique de repli (Fallback)
  const firstName = dbFirstName || splitName[0] || "Collaborateur"
  const lastName = dbLastName || splitName.slice(1).join(" ") || ""
  const fullName = dbFirstName && dbLastName ? `${dbFirstName} ${dbLastName}` : (authName || "Collaborateur")

  // 4. Helper pour vérifier si manager ou admin
  const role = profile?.role || "employe"
  const isManagerOrAdmin = ["admin", "super_admin", "gerant", "manager", "directeur"].includes(role)

  return {
    ...profile, // On renvoie tout le reste (rôle, heures, etc.)
    uid: user?.uid,
    email: user?.email,
    firstName, // Le prénom calculé
    lastName,  // Le nom calculé
    displayName: fullName, // Le nom complet propre
    role,
    contractHours: Number(profile?.contractHours) || 35,
    isManagerOrAdmin, // Helper pour les permissions
  }
}
