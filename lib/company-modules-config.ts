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

// ⚠️ Les IDs doivent correspondre aux moduleId utilisés par PermissionGate / usePermissions.
// On utilise des aliases pour accepter les anciennes valeurs stockées dans companies.features.
export const COMPANY_MODULES: CompanyModuleDefinition[] = [
  {
    id: "sites",
    name: "Sites & Contacts",
    description: "Raccourcis et contacts utiles",
    isDefault: true,
    aliases: ["sites-contacts", "sites_contacts", "sites-contacts-utiles"],
  },
  {
    id: "fournisseurs",
    name: "Fournisseurs",
    description: "Gestion des contacts fournisseurs",
    isDefault: true,
  },
  {
    id: "objectifs",
    name: "Objectifs",
    description: "Suivi des objectifs et paliers",
    isDefault: true,
  },
  {
    id: "primes",
    name: "Primes",
    description: "Historique et calcul des primes",
    isDefault: true,
  },
  {
    id: "equipes",
    name: "Équipes",
    description: "Gestion des collaborateurs",
    isDefault: true,
  },
  {
    id: "diffusion",
    name: "Relevés température",
    description: "Suivi des températures frigos",
    isDefault: false,
  },
  {
    id: "gestion",
    name: "Hub de Gestion",
    description: "Hub de gestion & opérations",
    isDefault: true,
    aliases: ["gestion-fournisseurs", "hub-gestion", "hub_gestion"],
  },
  {
    id: "pilotage",
    name: "Pilotage",
    description: "Pilotage & simulateur",
    isDefault: false,
  },
  {
    id: "parametres",
    name: "Paramètres",
    description: "Paramètres et utilisateurs",
    isDefault: false,
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "Centre de notifications",
    isDefault: true,
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
