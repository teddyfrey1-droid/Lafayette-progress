"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { useAuth } from "./auth-provider"

// 1. Définition de toutes les actions possibles dans l'app
// C'est ici que vous rajouterez des lignes quand l'app grandira
export const PERMISSIONS_SCHEMA = {
  dashboard: { label: "Tableau de bord", actions: { view: "Voir", stats: "Voir stats financières" } },
  objectives: { label: "Objectifs", actions: { view: "Voir", edit: "Modifier", create: "Créer", delete: "Supprimer" } },
  primes: { label: "Primes", actions: { view: "Voir historique", validate: "Valider", pay: "Marquer payé", delete: "Supprimer historique" } },
  suppliers: { label: "Fournisseurs", actions: { view: "Voir liste", create: "Ajouter", edit: "Modifier", delete: "Supprimer" } },
  users: { label: "Utilisateurs", actions: { view: "Voir liste", invite: "Inviter", edit: "Modifier rôles", delete: "Bannir" } },
  settings: { label: "Paramètres", actions: { view: "Accéder", manage_roles: "Gérer les droits (DANGER)" } }
}

type PermissionsMap = Record<string, Record<string, boolean>>;

interface RBACContextType {
  can: (resource: keyof typeof PERMISSIONS_SCHEMA, action: string) => boolean;
  rolePermissions: Record<string, PermissionsMap>; // { manager: { suppliers: { delete: true } } }
  updatePermission: (role: string, resource: string, action: string, value: boolean) => Promise<void>;
  loading: boolean;
}

const RBACContext = createContext<RBACContextType | null>(null);

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [rolePermissions, setRolePermissions] = useState<Record<string, PermissionsMap>>({});
  const [loading, setLoading] = useState(true);

  // Initialisation par défaut si la base est vide
  const defaultPermissions = {
    admin: { "*": { "*": true } }, // Admin a tout
    manager: { 
      dashboard: { view: true, stats: true },
      suppliers: { view: true, create: true, edit: true, delete: false }, // Manager ne peut pas supprimer par défaut
      objectives: { view: true, edit: true },
    },
    employee: {
      dashboard: { view: true },
      objectives: { view: true },
      primes: { view: true } // Employé ne voit que SES primes
    }
  };

  useEffect(() => {
    // Écoute en temps réel la configuration des rôles
    const unsub = onSnapshot(doc(db, "config", "roles_permissions"), async (snapshot) => {
      if (snapshot.exists()) {
        setRolePermissions(snapshot.data() as any);
      } else {
        // Si première installation, on écrit les défauts
        await setDoc(doc(db, "config", "roles_permissions"), defaultPermissions);
        setRolePermissions(defaultPermissions as any);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Fonction principale de vérification
  const can = (resource: keyof typeof PERMISSIONS_SCHEMA, action: string) => {
    if (!profile?.role) return false;
    
    const roleConfig = rolePermissions[profile.role];
    if (!roleConfig) return false;

    // 1. Super Admin Check
    if (rolePermissions[profile.role]?.["*"]?.["*"]) return true;

    // 2. Resource Check
    const resConfig = roleConfig[resource];
    if (!resConfig) return false;

    // 3. Action Check
    return resConfig[action] === true;
  };

  const updatePermission = async (role: string, resource: string, action: string, value: boolean) => {
    const newPermissions = { ...rolePermissions };
    if (!newPermissions[role]) newPermissions[role] = {};
    if (!newPermissions[role][resource]) newPermissions[role][resource] = {};
    
    newPermissions[role][resource][action] = value;
    
    await setDoc(doc(db, "config", "roles_permissions"), newPermissions);
  };

  return (
    <RBACContext.Provider value={{ can, rolePermissions, updatePermission, loading }}>
      {children}
    </RBACContext.Provider>
  );
}

export const useRBAC = () => {
  const context = useContext(RBACContext);
  if (!context) throw new Error("useRBAC must be used within RBACProvider");
  return context;
};
