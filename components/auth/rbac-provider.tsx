"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { doc, onSnapshot, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { useAuth } from "./auth-provider"
// On importe le schéma qu'on vient de créer pour ne pas surcharger ce fichier
import { DEFAULT_ROLES, RBAC_SCHEMA } from "@/lib/rbac-schema"

interface RBACContextType {
  // Vérifie si l'utilisateur a le droit (ex: "objectifs", "edit")
  can: (module: keyof typeof RBAC_SCHEMA, action: string) => boolean;
  
  // Données pour l'admin (liste des rôles et leurs droits)
  roleDefinitions: any; 
  userRole: string;
  loading: boolean;
  
  // Actions d'administration (Pour la future page "Gestion des accès")
  updateRolePermissions: (roleKey: string, permissions: any) => Promise<void>;
  createRole: (roleKey: string, label: string, baseRole?: string) => Promise<void>;
  deleteRole: (roleKey: string) => Promise<void>;
}

const RBACContext = createContext<RBACContextType | null>(null);

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [roleDefinitions, setRoleDefinitions] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // 1. Charger la configuration des rôles depuis Firestore (Collection: config / Doc: roles)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "roles"), async (snapshot) => {
      if (snapshot.exists()) {
        setRoleDefinitions(snapshot.data());
      } else {
        // Initialisation automatique si la config n'existe pas encore
        console.log("⚠️ Initialisation RBAC : Création des rôles par défaut...");
        await setDoc(doc(db, "config", "roles"), DEFAULT_ROLES);
        setRoleDefinitions(DEFAULT_ROLES);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 2. Fonction de vérification universelle (Le cœur de la sécurité)
  const can = (module: keyof typeof RBAC_SCHEMA, action: string) => {
    // Si pas de rôle (pas connecté ou bug), on refuse tout
    if (!profile?.role) return false;

    // Le Super Admin (ou vous) a toujours tous les droits (God Mode)
    if (profile.role === "super_admin" || profile.email === "teddy.frey1@gmail.com") return true;

    // On récupère la config du rôle de l'utilisateur actuel
    const userRoleConfig = roleDefinitions[profile.role];
    if (!userRoleConfig) return false; // Rôle inconnu ou supprimé

    // Vérifier si le rôle a un accès total "*" (Admin simple)
    if (userRoleConfig.permissions?.["*"]) return true;

    // Vérifier le module spécifique (ex: "objectifs")
    const moduleConfig = userRoleConfig.permissions?.[module];
    if (!moduleConfig) return false;

    // Vérifier l'action spécifique (ex: "edit") ou accès total au module ("*")
    if (moduleConfig["*"] === true) return true;
    return moduleConfig[action] === true;
  };

  // 3. Actions d'administration (Sera utilisé par la page "Gestion des accès")
  
  // Modifier les cases à cocher d'un rôle
  const updateRolePermissions = async (roleKey: string, permissions: any) => {
    const newRoles = { ...roleDefinitions };
    if (!newRoles[roleKey]) return;
    
    newRoles[roleKey].permissions = permissions;
    await setDoc(doc(db, "config", "roles"), newRoles);
  };

  // Créer un nouveau rôle (ex: "Stagiaire")
  const createRole = async (roleKey: string, label: string, baseRole = "employe") => {
    const newRoles = { ...roleDefinitions };
    // On copie les permissions d'un rôle existant pour ne pas partir de zéro
    const basePerms = roleDefinitions[baseRole]?.permissions || DEFAULT_ROLES.employe.permissions;
    
    newRoles[roleKey] = { label, permissions: basePerms };
    await setDoc(doc(db, "config", "roles"), newRoles);
  };

  // Supprimer un rôle
  const deleteRole = async (roleKey: string) => {
    const newRoles = { ...roleDefinitions };
    delete newRoles[roleKey];
    await setDoc(doc(db, "config", "roles"), newRoles);
  };

  return (
    <RBACContext.Provider value={{ 
      can, 
      roleDefinitions, 
      userRole: profile?.role || "guest", 
      loading,
      updateRolePermissions,
      createRole,
      deleteRole
    }}>
      {children}
    </RBACContext.Provider>
  );
}

export const useRBAC = () => {
  const context = useContext(RBACContext);
  if (!context) throw new Error("useRBAC must be used within RBACProvider");
  return context;
};
