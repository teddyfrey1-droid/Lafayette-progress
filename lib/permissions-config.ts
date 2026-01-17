export const MODULES = [
  { id: "pilotage", label: "Pilotage (Vue globale)" },
  { id: "gestion_fournisseurs", label: "Gestion Fournisseurs" },
  { id: "diffusion", label: "Diffusion / Campagnes" },
  { id: "equipes", label: "Gestion des Équipes" },
  { id: "parametres", label: "Paramètres Généraux" },
  { id: "history_edit", label: "Modification Historique/Logs" },
] as const;

export const ROLES = [
  { id: "admin", label: "Administrateur" },
  { id: "manager", label: "Manager" },
  { id: "assistant_manager", label: "Assistant Manager" },
  { id: "employe", label: "Employé" },
] as const;

// Structure par défaut si rien n'est en base
export const DEFAULT_PERMISSIONS = {
  pilotage: ["admin", "manager"],
  gestion_fournisseurs: ["admin", "manager"],
  diffusion: ["admin", "manager"],
  equipes: ["admin", "manager"],
  parametres: ["admin"],
  history_edit: ["admin"],
};
