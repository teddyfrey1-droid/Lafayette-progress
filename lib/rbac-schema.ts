// lib/rbac-schema.ts

export type PermissionAction = "view" | "edit" | "delete" | "create" | "manage" | string

export interface PermissionModule {
  label: string
  actions: Record<string, string> // code_action: Label lisible
}

// Définition de toutes les permissions possibles dans l'application
export const RBAC_SCHEMA: Record<string, PermissionModule> = {
  // --- MODULES PRINCIPAUX ---
  dashboard: {
    label: "Tableau de Bord",
    actions: {
      view: "Accéder au dashboard",
      view_stats: "Voir les chiffres financiers (CA, Marges)",
    },
  },

  objectifs: {
    label: "Objectifs",
    actions: {
      view: "Voir les objectifs",
      create: "Créer des objectifs",
      edit: "Modifier (titres, dates)",
      delete: "Supprimer des objectifs",
      manage_paliers: "Modifier les paliers & montants (Sensible)",
      publish: "Activer / Désactiver un objectif",
    },
  },

  primes: {
    label: "Primes & Historique",
    actions: {
      view: "Voir son historique personnel",
      view_all: "Voir l'historique de toute l'équipe",
      validate: "Valider une prime",
      pay: "Marquer comme payée",
      edit_history: "Corriger une ligne d'historique",
      delete_history: "Supprimer une ligne d'historique",
    },
  },

  // --- GESTION D'ÉQUIPE ---
  equipes: {
    label: "Gestion d'Équipe",
    actions: {
      view: "Voir la liste des membres",
      view_all: "Voir toute l'équipe",
      invite: "Inviter de nouveaux membres",
      edit_profile: "Modifier les infos (Nom, Email)",
      edit_contract: "Modifier le contrat (Heures, Rôle)",
      delete_user: "Supprimer un utilisateur",
      manage_permissions: "Gérer les accès",
    },
  },

  // --- RESSOURCES ---
  fournisseurs: {
    label: "Fournisseurs",
    actions: {
      view: "Voir la liste",
      create: "Ajouter un fournisseur",
      edit: "Modifier les fiches",
      delete: "Supprimer un fournisseur",
    },
  },

  sites_utiles: {
    label: "Sites Utiles & Contacts",
    actions: {
      view: "Voir la liste",
      manage: "Ajouter / Modifier / Supprimer",
    },
  },

  // Alias utilisé dans le menu (conserve l'UI sans renommer tout)
  sites: {
    label: "Sites (alias)",
    actions: {
      view: "Voir",
      manage: "Gérer",
    },
  },

  // --- COMMUNICATION ---
  diffusion: {
    label: "Diffusion & Messages",
    actions: {
      view: "Voir les messages",
      send: "Envoyer des notifications",
    },
  },

  notifications: {
    label: "Notifications",
    actions: {
      view: "Accéder",
    },
  },

  // --- PILOTAGE ---
  pilotage: {
    label: "Pilotage & Simulation",
    actions: {
      view: "Accéder",
      access: "Accéder",
      save: "Enregistrer les modifications budgétaires",
    },
  },

  // --- ADMINISTRATION ---
  centre_controle: {
    label: "Centre de contrôle",
    actions: {
      view: "Accéder",
      impersonate: "Se connecter en tant que",
      reset_password: "Envoyer un lien de mot de passe",
      update_user: "Modifier un utilisateur",
    },
  },

  parametres: {
    label: "Paramètres Globaux",
    actions: {
      view: "Accéder",
      access: "Accéder",
      manage_sensitive: "Modifier les paramètres sensibles",
    },
  },

  // --- DIVERS ---
  admin: {
    label: "Administration",
    actions: {
      view: "Accéder",
    },
  },

  gestion: {
    label: "Gestion",
    actions: {
      view: "Accéder",
    },
  },
}

// Rôles par défaut (initialisation config/roles)
export const DEFAULT_ROLES: Record<string, { label: string; permissions: any }> = {
  super_admin: { label: "Super Admin", permissions: { "*": true } },
  admin: { label: "Admin", permissions: { "*": true } },

  gerant: {
    label: "Gérant",
    permissions: {
      dashboard: { view: true, view_stats: true },
      objectifs: { view: true, create: true, edit: true, delete: true, manage_paliers: true, publish: true },
      primes: { view: true, view_all: true, validate: true, pay: true },
      equipes: { view: true, view_all: true, invite: true, edit_profile: true, edit_contract: true, manage_permissions: true },
      fournisseurs: { view: true, create: true, edit: true, delete: true },
      sites_utiles: { view: true, manage: true },
      sites: { view: true, manage: true },
      parametres: { view: true, access: true, manage_sensitive: false },
      pilotage: { view: true, access: true, save: true },
      diffusion: { view: true, send: true },
      centre_controle: { view: true, reset_password: true, update_user: true, impersonate: false },
      notifications: { view: true },
      gestion: { view: true },
      admin: { view: true },
    },
  },

  directeur: {
    label: "Directeur",
    permissions: {
      dashboard: { view: true, view_stats: true },
      objectifs: { view: true, edit: true },
      primes: { view: true, view_all: true, validate: true },
      equipes: { view: true, view_all: true, invite: true, edit_profile: true, edit_contract: true },
      fournisseurs: { view: true, create: true, edit: true },
      sites_utiles: { view: true, manage: true },
      sites: { view: true, manage: true },
      pilotage: { view: true, access: true },
      diffusion: { view: true },
      notifications: { view: true },
      gestion: { view: true },
    },
  },

  manager: {
    label: "Manager",
    permissions: {
      dashboard: { view: true, view_stats: false },
      objectifs: { view: true, edit: true },
      primes: { view: true, view_all: true, validate: true },
      equipes: { view: true, view_all: true, invite: true },
      fournisseurs: { view: true, create: true, edit: true },
      sites_utiles: { view: true, manage: true },
      sites: { view: true, manage: true },
      diffusion: { view: true },
      notifications: { view: true },
      gestion: { view: true },
    },
  },

  assistant_manager: {
    label: "Assistant Manager",
    permissions: {
      dashboard: { view: true },
      objectifs: { view: true },
      primes: { view: true },
      equipes: { view: true },
      fournisseurs: { view: true },
      sites_utiles: { view: true },
      sites: { view: true },
      notifications: { view: true },
      gestion: { view: true },
    },
  },

  employe: {
    label: "Employé",
    permissions: {
      dashboard: { view: true },
      objectifs: { view: true },
      primes: { view: true },
      equipes: { view: true },
      fournisseurs: { view: true },
      sites_utiles: { view: true },
      sites: { view: true },
      notifications: { view: true },
      gestion: { view: true },
    },
  },
}
