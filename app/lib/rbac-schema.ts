// Copiez ceci dans app/lib/rbac-schema.ts

// 1. Définition des rôles (Enum)
// C'est la SEULE source de vérité pour les noms de rôles dans toute l'app.
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  EMPLOYEE = 'employée', // Ou 'user', vérifiez ce que vous utilisez actuellement
  SUPER_ADMIN = 'super_admin'
}

// 2. Type pour l'utilisateur (Optionnel mais pratique)
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  company: string;
  disabled: boolean;
  // ... autres champs
}

export const ROLES_LABEL = {
  [UserRole.ADMIN]: "Administrateur",
  [UserRole.MANAGER]: "Manager",
  [UserRole.EMPLOYEE]: "Collaborateur",
  [UserRole.SUPER_ADMIN]: "Super Admin"
};
