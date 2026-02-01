// Configuration des modules activables par entreprise (Centre de contrôle)

export interface CompanyModuleDefinition {
  id: string
  name: string
  description: string
  // Par défaut, le module est activé lors de la création d'une entreprise.
  isDefault: boolean
  // Aliases historiques (compat anciennes versions)
  aliases?: string[]
}

// ⚠️ Les IDs doivent correspondre aux `moduleId` utilisés par PermissionGate / usePermissions
// et aux `moduleId` du menu (SideDrawer). Les `aliases` permettent de migrer des valeurs
// anciennes stockées dans `companies.features`.
export const COMPANY_MODULES: CompanyModuleDefinition[] = [
  // Pages principales
  {
    id: "dashboard",
    name: "Tableau de bord",
    description: "Vue d'ensemble",
    isDefault: true,
    aliases: ["tableau_de_bord", "tableau-de-bord"],
  },
  {
    id: "objectifs",
    name: "Objectifs",
    description: "Objectifs et suivi",
    isDefault: true,
  },
  {
    id: "primes",
    name: "Primes",
    description: "Primes & historique",
    isDefault: true,
  },
  {
    id: "sites",
    name: "Sites & Contacts",
    description: "Raccourcis et contacts utiles",
    isDefault: true,
    aliases: ["sites-contacts", "sites_contacts", "sites-contacts-utiles"],
  },

  // Commandes / fournisseurs
  {
    id: "commandes",
    name: "Passer une commande",
    description: "Création & réception des commandes",
    isDefault: true,
    aliases: ["orders", "commande", "passer-une-commande", "passer_une_commande"],
  },
  {
    id: "fournisseurs",
    name: "Fournisseurs",
    description: "Fournisseurs & produits",
    isDefault: true,
  },

  // Équipes / gestion
  {
    id: "equipes",
    name: "Équipes",
    description: "Gestion des membres",
    isDefault: true,
  },
  {
    id: "gestion",
    name: "Gestion",
    description: "Hub de gestion & opérations",
    isDefault: true,
    aliases: ["gestion-fournisseurs", "hub-gestion", "hub_gestion"],
  },

  // Droits / outils admin
  {
    id: "acces",
    name: "Droits & Accès",
    description: "Gestion des autorisations",
    isDefault: true,
    aliases: ["droits", "droits-acces", "permissions", "rbac"],
  },
  {
    id: "outils_admin",
    name: "Outils Admin",
    description: "Outils administratifs (sites, configs)",
    isDefault: true,
    aliases: ["admin_tools", "admin-sites", "outils-admin"],
  },

  // Outils avancés
  {
    id: "pilotage",
    name: "Pilotage",
    description: "Pilotage & simulateur",
    isDefault: false,
  },
  {
    id: "diffusion",
    name: "Diffusion",
    description: "Diffusion / relevés / emails",
    isDefault: false,
  },

  // Paramètres / notifications
  {
    id: "notifications",
    name: "Notifications",
    description: "Centre de notifications",
    isDefault: true,
  },
  {
    id: "parametres",
    name: "Paramètres",
    description: "Paramètres et utilisateurs",
    isDefault: false,
  },

  // Contrôle d'affichage des catégories du menu (dropdown)
  {
    id: "menu_gestion",
    name: "Catégorie menu : Gestion",
    description: "Afficher la catégorie Gestion dans le menu",
    isDefault: true,
    aliases: ["menu-gestion"],
  },
  {
    id: "menu_outils",
    name: "Catégorie menu : Outils avancés",
    description: "Afficher la catégorie Outils avancés dans le menu",
    isDefault: true,
    aliases: ["menu-outils", "menu-outils-avances"],
  },
  {
    id: "menu_admin",
    name: "Catégorie menu : Administration",
    description: "Afficher la catégorie Administration dans le menu",
    isDefault: true,
    aliases: ["menu-administration"],
  },
]

export function normalizeCompanyModuleId(input?: string) {
  const id = (input || "").toString().trim()
  if (!id) return ""
  const direct = COMPANY_MODULES.find((m) => m.id === id)
  if (direct) return direct.id
  const alias = COMPANY_MODULES.find((m) => (m.aliases || []).includes(id))
  return alias ? alias.id : id
}
