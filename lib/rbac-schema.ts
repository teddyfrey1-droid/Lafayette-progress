// --- 1. DÉFINITION DES RÔLES (ENUM) ---
// C'est la base de votre système.
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  GERANT = 'gerant',    // Ajouté car présent dans vos DEFAULT_ROLES
  MANAGER = 'manager',
  EMPLOYEE = 'employee' // Standardisé (était 'employe' ou 'employée')
}

// Labels pour l'affichage dans l'interface (Menu déroulant, Profil...)
export const ROLES_LABEL = {
  [UserRole.SUPER_ADMIN]: "Super Admin",
  [UserRole.ADMIN]: "Administrateur",
  [UserRole.GERANT]: "Gérant",
  [UserRole.MANAGER]: "Manager",
  [UserRole.EMPLOYEE]: "Collaborateur"
};

// --- 2. TYPES UTILISATEUR ---
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  company: string;
  disabled: boolean;
  contractHours?: number;
  // ... autres champs
}

// --- 3. SYSTÈME DE PERMISSIONS (RBAC) ---

export type PermissionAction = "view" | "edit" | "delete" | "create" | "manage" | string;

export interface PermissionModule {
  label: string;
  actions: Record<string, string>; // code_action: Label lisible
}

// Définition de toutes les permissions possibles dans l'application
export const RBAC_SCHEMA: Record<string, PermissionModule> = {
  // --- MODULES PRINCIPAUX ---
  dashboard: {
    label: "Tableau de Bord",
    actions: {
      view: "Accéder au dashboard",
      view_stats: "Voir les chiffres financiers (CA, Marges)",
    }
  },
  objectifs: {
    label: "Objectifs",
    actions: {
      view: "Voir les objectifs",
      create: "Créer des objectifs",
      edit: "Modifier (titres, dates)",
      delete: "Supprimer des objectifs",
      manage_paliers: "Modifier les paliers & montants (Sensible)",
      publish: "Activer / Désactiver un objectif"
    }
  },
  primes: {
    label: "Primes & Historique",
    actions: {
      view: "Voir son historique personnel",
      view_all: "Voir l'historique de toute l'équipe",
      validate: "Valider une prime (Manager)",
      pay: "Marquer comme payée (Gérant)",
      delete_history: "Supprimer une ligne d'historique (Danger)"
    }
  },
  
  // --- GESTION D'ÉQUIPE ---
  equipes: {
    label: "Gestion d'Équipe",
    actions: {
      view: "Voir la liste des membres",
      invite: "Inviter de nouveaux membres",
      edit_profile: "Modifier les infos (Nom, Email)",
      edit_contract: "Modifier le contrat (Heures, Rôle)",
      delete_user: "Bannir / Supprimer un utilisateur",
      manage_permissions: "Gérer les accès (Cette page)"
    }
  },

  // --- RESSOURCES ---
  fournisseurs: {
    label: "Fournisseurs",
    actions: {
      view: "Voir la liste",
      create: "Ajouter un fournisseur",
      edit: "Modifier les fiches",
      delete: "Supprimer un fournisseur"
    }
  },
  sites_utiles: {
    label: "Sites Utiles & Contacts",
    actions: {
      view: "Voir la liste",
      manage: "Ajouter / Modifier / Supprimer"
    }
  },

  // --- ADMINISTRATION ---
  parametres: {
    label: "Paramètres Globaux",
    actions: {
      access: "Accéder aux réglages",
      manage_sensitive: "Modifier les paramètres sensibles (Emails, Règles)"
    }
  },
  
  // --- FEATURES SPÉCIALES ---
  diffusion: {
    label: "Diffusion & Messages",
    actions: {
      view: "Voir les messages",
      send: "Envoyer des notifications",
    }
  },
  pilotage: {
    label: "Pilotage & Simulation",
    actions: {
      access: "Accéder au simulateur",
      save: "Enregistrer les modifications budgétaires"
    }
  },
  notifications: {
      label: "Notifications",
      actions: {
          view: "Voir ses notifications"
      }
  }
};

// --- 4. RÔLES PAR DÉFAUT ---
// Configuration initiale des permissions pour chaque rôle
export const DEFAULT_ROLES = {
  [UserRole.SUPER_ADMIN]: { label: "Super Admin", permissions: { "*": true } }, // Tout permis
  [UserRole.ADMIN]: { label: "Admin", permissions: { "*": true } },
  
  [UserRole.GERANT]: { 
    label: "Gérant", 
    permissions: { 
      dashboard: { view: true, view_stats: true },
      objectifs: { view: true, create: true, edit: true, delete: true, manage_paliers: true, publish: true },
      primes: { view: true, view_all: true, validate: true, pay: true },
      equipes: { view: true, invite: true, edit_profile: true, edit_contract: true, delete_user: false, manage_permissions: true },
      fournisseurs: { view: true, create: true, edit: true, delete: true },
      sites_utiles: { view: true, manage: true },
      parametres: { access: true, manage_sensitive: false },
      pilotage: { access: true, save: true },
      diffusion: { view: true, send: true }
    } 
  },
  
  [UserRole.MANAGER]: {
    label: "Manager",
    permissions: {
      dashboard: { view: true, view_stats: false },
      objectifs: { view: true, create: false, edit: true, delete: false, manage_paliers: false },
      primes: { view: true, view_all: true, validate: true, pay: false },
      equipes: { view: true, invite: true, edit_profile: false, edit_contract: false },
      fournisseurs: { view: true, create: true, edit: true, delete: false },
      sites_utiles: { view: true, manage: true },
      diffusion: { view: true, send: false }
    }
  },
  
  [UserRole.EMPLOYEE]: {
    label: "Employé",
    permissions: {
      dashboard: { view: true },
      objectifs: { view: true },
      primes: { view: true },
      equipes: { view: true }, // Voir ses collègues uniquement
      fournisseurs: { view: true },
      sites_utiles: { view: true },
      notifications: { view: true }
    }
  }
};
