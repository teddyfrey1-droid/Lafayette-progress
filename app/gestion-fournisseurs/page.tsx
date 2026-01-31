import { redirect } from "next/navigation"

/**
 * HubGestion supprimé.
 * Cette route est conservée uniquement pour compatibilité avec d'anciens liens.
 */
export default function GestionFournisseursRedirect() {
  redirect("/fournisseurs")
}
