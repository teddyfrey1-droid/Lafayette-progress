"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { useRBAC } from "@/components/auth/rbac-provider"
import { RBAC_SCHEMA } from "@/lib/rbac-schema"
import { Shield, Search, UserCog, Users, ArrowLeft, Save, LayoutGrid, ListFilter, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// Firebase
import { collection, query, onSnapshot, doc, updateDoc, where } from "firebase/firestore"
import { db } from "@/lib/firebase/client"

export default function GestionDroitsEquipePage() {
  const { roleDefinitions, updateRolePermissions, loading: rbacLoading, createRole, deleteRole } = useRBAC()
  const { toast } = useToast()
  
  const [activeMainTab, setActiveMainTab] = useState("roles")
  const [users, setUsers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRoleToEdit, setSelectedRoleToEdit] = useState("")

  // 1. Filtrer les rôles modifiables par le Gérant
  // On exclut Super Admin et le Gérant lui-même (pour ne pas se bloquer)
  const modifiableRoles = Object.keys(roleDefinitions || {}).filter(r => 
    !['super_admin', 'admin', 'gerant'].includes(r)
  );

  // Initialiser le rôle sélectionné au chargement
  useEffect(() => {
    if (modifiableRoles.length > 0 && !selectedRoleToEdit) {
      setSelectedRoleToEdit(modifiableRoles[0])
    }
  }, [roleDefinitions])

  // 2. Charger la liste des utilisateurs (Pour l'onglet Utilisateurs)
  useEffect(() => {
    // On ne charge pas les super admins pour éviter les accidents
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        // Filtre de sécurité visuelle
        .filter(u => u.role !== 'super_admin'); 
      setUsers(usersData);
    });
    return () => unsub();
  }, []);

  // --- ACTIONS ---

  // Modifier les permissions d'un modèle de rôle
  const handleTogglePermission = async (role: string, module: string, action: string, currentValue: boolean) => {
    const currentPerms = { ...roleDefinitions[role].permissions };
    if (!currentPerms[module]) currentPerms[module] = {};
    currentPerms[module][action] = !currentValue;

    try {
      await updateRolePermissions(role, currentPerms);
      toast({ title: "Modèle mis à jour", description: "Les droits ont été appliqués à tous les utilisateurs de ce rôle." });
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  // Changer le rôle d'un utilisateur spécifique
  const handleChangeUserRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      toast({ title: "Rôle utilisateur modifié", className: "bg-green-50 border-green-200" });
    } catch (e) {
      toast({ title: "Erreur modification", variant: "destructive" });
    }
  }

  // Filtrage recherche utilisateur
  const filteredUsers = users.filter(u => 
    (u.displayName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (rbacLoading) return <div className="min-h-screen bg-background" />;

  return (
    <PermissionGate moduleId="equipes" action="manage_permissions" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-5xl mx-auto space-y-6">
          {/* En-tête */}
          <div className="flex items-center gap-2">
             <Link href="/gestion-fournisseurs" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
             </Link>
             <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Shield className="w-6 h-6 text-primary" />
                    Gestion des Accès
                </h1>
                <p className="text-sm text-muted-foreground">Pilotez les autorisations de vos équipes.</p>
             </div>
          </div>

          {/* Onglets Principaux */}
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 p-1 rounded-xl mb-6">
                <TabsTrigger value="roles" className="rounded-lg gap-2 text-sm">
                    <LayoutGrid className="w-4 h-4" /> Modèles de Rôles
                </TabsTrigger>
                <TabsTrigger value="users" className="rounded-lg gap-2 text-sm">
                    <UserCog className="w-4 h-4" /> Cas par Cas (Utilisateurs)
                </TabsTrigger>
            </TabsList>

            {/* --- ONGLET 1 : CONFIGURATION DES RÔLES (Général) --- */}
            <TabsContent value="roles" className="space-y-6 animate-in fade-in slide-in-from-left-2">
                
                {/* Sélecteur de Rôle (Barre horizontale) */}
                <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide">
                    {modifiableRoles.map(roleKey => (
                        <button
                            key={roleKey}
                            onClick={() => setSelectedRoleToEdit(roleKey)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap",
                                selectedRoleToEdit === roleKey 
                                    ? "bg-primary text-primary-foreground border-primary shadow-md" 
                                    : "bg-card hover:bg-muted border-border"
                            )}
                        >
                            <span className="capitalize font-semibold text-sm">{roleDefinitions[roleKey].label}</span>
                        </button>
                    ))}
                </div>

                {selectedRoleToEdit && (
                    <div className="space-y-4">
                        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-sm text-blue-800 flex gap-3">
                            <Users className="w-5 h-5 shrink-0" />
                            <div>
                                <span className="font-bold">Modification globale :</span> Tout changement ici impactera immédiatement tous les employés ayant le statut <strong>{roleDefinitions[selectedRoleToEdit].label}</strong>.
                            </div>
                        </div>

                        {/* Grille des permissions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(RBAC_SCHEMA).map(([moduleKey, moduleDef]: [string, any]) => {
                                // Masquer les modules techniques pour le gérant
                                if (moduleKey === 'parametres' || moduleKey === 'pilotage') return null;

                                const userPerms = roleDefinitions[selectedRoleToEdit].permissions[moduleKey] || {};
                                
                                return (
                                    <Card key={moduleKey} className="overflow-hidden border-muted-foreground/10 shadow-sm">
                                        <CardHeader className="bg-muted/30 py-3 px-4 flex flex-row items-center justify-between">
                                            <CardTitle className="text-sm font-bold text-foreground/80">
                                                {moduleDef.label}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="divide-y divide-border/40">
                                                {Object.entries(moduleDef.actions).map(([actionKey, actionLabel]: [string, any]) => {
                                                    const isChecked = userPerms["*"] || userPerms[actionKey] === true;
                                                    const isLocked = actionKey === 'manage_permissions'; // Protection

                                                    return (
                                                        <div key={actionKey} className="flex items-center justify-between p-3 px-4 hover:bg-muted/10">
                                                            <span className="text-sm text-foreground/70">{actionLabel}</span>
                                                            <Switch 
                                                                checked={isChecked} 
                                                                disabled={isLocked}
                                                                onCheckedChange={() => handleTogglePermission(selectedRoleToEdit, moduleKey, actionKey, isChecked)}
                                                            />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                )}
            </TabsContent>

            {/* --- ONGLET 2 : GESTION UTILISATEURS (Cas par Cas) --- */}
            <TabsContent value="users" className="space-y-6 animate-in fade-in slide-in-from-right-2">
                
                {/* Barre de recherche */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Rechercher un membre (nom, email)..." 
                        className="pl-10 h-12 rounded-xl bg-card"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Liste des utilisateurs */}
                <div className="space-y-3">
                    {filteredUsers.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground">Aucun utilisateur trouvé.</div>
                    )}

                    {filteredUsers.map((user) => (
                        <div key={user.id} className="pulse-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                    {user.displayName?.[0] || user.email?.[0] || "?"}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">{user.displayName || "Utilisateur sans nom"}</h3>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                            </div>

                            {/* Sélecteur de Rôle Rapide */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span className="text-xs text-muted-foreground whitespace-nowrap sm:hidden">Rôle actuel :</span>
                                <Select 
                                    value={user.role} 
                                    onValueChange={(val) => handleChangeUserRole(user.id, val)}
                                    disabled={user.role === 'admin' || user.role === 'gerant'} // Protection contre modification des supérieurs
                                >
                                    <SelectTrigger className="w-full sm:w-[180px] h-9 rounded-lg border-primary/20 bg-primary/5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* On affiche tous les rôles dispos SAUF super_admin et gerant pour ne pas élever les droits trop haut */}
                                        {modifiableRoles.map(roleKey => (
                                            <SelectItem key={roleKey} value={roleKey}>
                                                {roleDefinitions[roleKey].label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ))}
                </div>
            </TabsContent>
          </Tabs>
        </main>
        <BottomNav />
      </div>
    </PermissionGate>
  )
}
