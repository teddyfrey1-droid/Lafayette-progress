export const MODULES = [
  { id: "pilotage", label: "Pilotage (Vue globale)" },
  { id: "fournisseurs", label: "Gestion Fournisseurs" },
  { id: "equipes", label: "Gestion Équipes" },
  { id: "parametres", label: "Paramètres & Config" },
  { id: "diffusion", label: "Diffusion / Campagnes" },
  { id: "history_edit", label: "Modifier/Supprimer Historique" }, // Droit spécifique pour les logs
] as const;

export const ROLES = [
  { id: "gerant", label: "Gérant" },
  { id: "directeur", label: "Directeur" },
  { id: "admin", label: "Admin" },
  { id: "manager", label: "Manager" },
  { id: "assistant_manager", label: "Assistant Manager" },
  { id: "employe", label: "Employé" },
  { id: "employee", label: "Employee (Legacy)" },
] as const;

// Droits par défaut (si rien n'est configuré en base)
export const DEFAULT_PERMISSIONS = {
  pilotage: ["gerant", "directeur", "admin"],
  fournisseurs: ["gerant", "directeur", "admin", "manager"],
  equipes: ["gerant", "directeur", "admin", "manager"],
  parametres: ["gerant", "directeur", "admin"],
  history_edit: ["gerant", "admin"],
};
