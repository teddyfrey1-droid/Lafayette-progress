// Configuration des modules et des roles pour le systeme de permissions

export interface ModuleDefinition {
  id: string
  name: string
  description: string
  icon: string
}

// Roles affiches dans l'UI d'activation (les alias sont gerees dans use-permissions)
export const ROLES = [
  { id: "employe", name: "Employe", description: "Acces de base" },
  { id: "assistant_manager", name: "Assistant Manager", description: "Supervision" },
  { id: "manager", name: "Manager", description: "Gestion d'equipe" },
  { id: "directeur", name: "Directeur", description: "Direction site" },
  { id: "gerant", name: "Gerant", description: "Gestion complete" },
  { id: "admin", name: "Admin", description: "Administration" },
  { id: "super_admin", name: "Super Admin", description: "Acces total" },
] as const

export const MODULES: ModuleDefinition[] = [
  { id: "dashboard", name: "Dashboard", description: "Vue d'ensemble", icon: "LayoutDashboard" },
  { id: "objectifs", name: "Objectifs", description: "Objectifs et suivi", icon: "Target" },
  { id: "primes", name: "Primes", description: "Primes & historique", icon: "Trophy" },
  { id: "equipes", name: "Equipes", description: "Gestion des membres", icon: "Users" },
  { id: "gestion", name: "Gestion", description: "Gestion & operations", icon: "ClipboardList" },
  { id: "fournisseurs", name: "Fournisseurs", description: "Fournisseurs et commandes", icon: "Truck" },
  { id: "sites", name: "Sites / Contacts", description: "Sites & contacts utiles", icon: "MapPin" },
  { id: "diffusion", name: "Diffusion", description: "Emails / notifications", icon: "Mail" },
  { id: "notifications", name: "Notifications", description: "Centre de notifications", icon: "Bell" },
  { id: "pilotage", name: "Pilotage", description: "Pilotage & simulateur", icon: "Gauge" },
  { id: "centre_controle", name: "Centre de controle", description: "Console admin", icon: "Shield" },
  { id: "parametres", name: "Parametres", description: "Parametres et utilisateurs", icon: "Settings" },
  { id: "history_edit", name: "Historique", description: "Modifier/supprimer l'historique", icon: "History" },
]

export type PermissionMode = "view" | "edit" | "delete"

export type ModulePermission = {
  view: string[]
  edit: string[]
  delete: string[]
}

const DELETE_DEFAULT = ["admin", "super_admin"]

// Permissions par defaut (VIEW, EDIT, DELETE)
// - view: qui peut voir le module
// - edit: qui peut modifier / executer des actions sensibles
// - delete: qui peut supprimer (par defaut: admin/super_admin)
export const DEFAULT_PERMISSIONS: Record<string, ModulePermission> = {
  dashboard: {
    view: ["employe", "assistant_manager", "manager", "directeur", "gerant", "admin", "super_admin"],
    edit: ["assistant_manager", "manager", "directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
  objectifs: {
    view: ["employe", "assistant_manager", "manager", "directeur", "gerant", "admin", "super_admin"],
    edit: ["manager", "directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
  primes: {
    view: ["employe", "assistant_manager", "manager", "directeur", "gerant", "admin", "super_admin"],
    edit: ["manager", "directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
  equipes: {
    view: ["assistant_manager", "manager", "directeur", "gerant", "admin", "super_admin"],
    edit: ["directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
  gestion: {
    view: ["assistant_manager", "manager", "directeur", "gerant", "admin", "super_admin"],
    edit: ["manager", "directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
  fournisseurs: {
    view: ["assistant_manager", "manager", "directeur", "gerant", "admin", "super_admin"],
    edit: ["manager", "directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
  sites: {
    view: ["employe", "assistant_manager", "manager", "directeur", "gerant", "admin", "super_admin"],
    edit: ["manager", "directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
  diffusion: {
    view: ["directeur", "gerant", "admin", "super_admin"],
    edit: ["directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
  notifications: {
    view: ["employe", "assistant_manager", "manager", "directeur", "gerant", "admin", "super_admin"],
    edit: ["assistant_manager", "manager", "directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
  pilotage: {
    view: ["manager", "directeur", "gerant", "admin", "super_admin"],
    edit: ["directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
  centre_controle: {
    view: ["admin", "super_admin"],
    edit: ["admin", "super_admin"],
    delete: ["super_admin"],
  },
  parametres: {
    view: ["directeur", "gerant", "admin", "super_admin"],
    edit: ["directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
  history_edit: {
    view: ["directeur", "gerant", "admin", "super_admin"],
    edit: ["directeur", "gerant", "admin", "super_admin"],
    delete: [...DELETE_DEFAULT],
  },
}
