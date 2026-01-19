"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { useRBAC } from "@/components/auth/rbac-provider"
import { RBAC_SCHEMA } from "@/lib/rbac-schema"
import { Shield, Plus, Trash2, ArrowLeft, Lock, Users, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function GestionDroitsEquipePage() {
  const { roleDefinitions, updateRolePermissions, createRole, deleteRole, loading } = useRBAC()
  const { toast } = useToast()
  
  // État création de rôle
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleLabel, setNewRoleLabel] = useState("")

  // --- FILTRE DE SÉCURITÉ ---
  // Le Gérant voit TOUT (Gérant, Manager, Employé, Stagiaire...)
  // SAUF le Super Admin (pour ne pas toucher à vos droits)
  const roleKeys = Object.keys(roleDefinitions || {}).filter(r => r !== 'super_admin');
  
  const [activeRole, setActiveRole] = useState(roleKeys[0] || "manager");

  const handleTogglePermission = async (role: string, module: string, action: string, currentValue: boolean) => {
    // Copie de sécurité
    const currentPerms = { ...roleDefinitions[role].permissions };
    if (!currentPerms[module]) currentPerms[module] = {};
    
    // Application du changement
    currentPerms[module][action] = !currentValue;

    try {
      await updateRolePermissions(role, currentPerms);
      toast({ title: "Droit mis à jour", description: "Le changement est immédiat pour l'équipe." });
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName || !newRoleLabel) return;
    try {
      const safeKey = newRoleName.toLowerCase().replace(/\s+/g, '_');
      await createRole(safeKey, newRoleLabel);
      setIsCreateOpen(false);
      setNewRoleName("");
      setNewRoleLabel("");
      toast({ title: "Nouveau rôle créé" });
    } catch (e) {
      toast({ title: "Erreur création", variant: "destructive" });
    }
  };

  const handleDeleteRole = async (roleKey: string) => {
    if (roleKey === 'gerant') {
        alert("Vous ne pouvez pas supprimer votre propre rôle principal.");
        return;
    }
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le rôle "${roleDefinitions[roleKey].label}" ?`)) return;
    
    try {
      await deleteRole(roleKey);
      setActiveRole(roleKeys[0]); 
      toast({ title: "Rôle supprimé" });
    } catch (e) {
      toast({ title: "Erreur suppression", variant: "destructive" });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;

  return (
    // 🔒 Le Gérant doit avoir le droit de gérer les permissions pour voir cette page
    <PermissionGate moduleId="equipes" action="manage_permissions" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-5xl mx-auto space-y-6">
          {/* Header Page */}
          <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-2">
                <Link href="/fournisseurs" className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Shield className="w-6 h-6 text-primary" />
                        Droits & Rôles
                    </h1>
                    <p className="text-sm text-muted-foreground">Configuration avancée de vos équipes.</p>
                </div>
             </div>
          </div>

          <Tabs value={activeRole} onValueChange={setActiveRole} className="w-full">
            <div className="flex items-center justify-between mb-6 overflow-x-auto pb-2 gap-2">
                {/* Liste des onglets (Rôles) */}
                <TabsList className="bg-muted/50 h-auto p-1 flex-wrap justify-start">
                    {roleKeys.map(roleKey => (
                        <TabsTrigger key={roleKey} value={roleKey} className="capitalize px-4 py-2">
                            {roleDefinitions[roleKey].label}
                        </TabsTrigger>
                    ))}
                </TabsList>
                
                {/* BOUTON CRÉER (Activé pour le Gérant) */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-2 shrink-0 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10">
                            <Plus className="w-4 h-4" /> Créer un Rôle
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Nouveau rôle d'équipe</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nom du poste (ex: Chef de Cuisine)</label>
                                <Input value={newRoleLabel} onChange={e => setNewRoleLabel(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Identifiant système (ex: chef_cuisine)</label>
                                <Input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter><Button onClick={handleCreateRole}>Créer</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {roleKeys.map(roleKey => {
                const roleData = roleDefinitions[roleKey];
                // Sécurité : Si le rôle a un accès total "*" (ex: Admin), on l'affiche différemment
                const isFullAdmin = roleData.permissions["*"]; 

                return (
                    <TabsContent key={roleKey} value={roleKey} className="space-y-6 animate-in fade-in">
                        
                        {/* Carte d'information du rôle */}
                        <div className="flex justify-between items-center bg-card border p-4 rounded-xl shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isFullAdmin ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary")}>
                                    {isFullAdmin ? <Lock className="w-5 h-5"/> : <Users className="w-5 h-5"/>}
                                </div>
                                <div>
                                    <h3 className="font-bold text-base flex items-center gap-2">
                                        {roleData.label}
                                        {roleKey === 'gerant' && <Badge variant="secondary">Votre Rôle</Badge>}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">ID: {roleKey}</p>
                                </div>
                            </div>

                            {/* Bouton Supprimer (Sauf pour lui-même ou les admins système) */}
                            {roleKey !== 'gerant' && roleKey !== 'admin' && (
                                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => handleDeleteRole(roleKey)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                </Button>
                            )}
                        </div>

                        {/* Avertissement pour les rôles admin */}
                        {isFullAdmin && (
                            <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm flex gap-2 items-center">
                                <AlertTriangle className="w-4 h-4" />
                                Ce rôle dispose de tous les accès par défaut.
                            </div>
                        )}

                        {/* GRILLE COMPLÈTE DES PERMISSIONS (Identique Super Admin) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(RBAC_SCHEMA).map(([moduleKey, moduleDef]: [string, any]) => {
                                // On ne masque rien, c'est "hypercomplet" comme demandé
                                const userPerms = roleData.permissions[moduleKey] || {};
                                
                                return (
                                    <Card key={moduleKey} className="overflow-hidden border-muted-foreground/20">
                                        <CardHeader className="bg-muted/30 py-3 px-4 border-b">
                                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                                {moduleDef.label}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="divide-y divide-border/50">
                                                {Object.entries(moduleDef.actions).map(([actionKey, actionLabel]: [string, any]) => {
                                                    // Est-ce coché ? (Soit explicitement, soit accès total)
                                                    const isChecked = isFullAdmin || userPerms["*"] || userPerms[actionKey] === true;
                                                    
                                                    // Protection : Le gérant ne peut pas se retirer ses propres droits d'admin
                                                    const isLocked = isFullAdmin || (roleKey === 'gerant' && actionKey === 'manage_permissions');

                                                    return (
                                                        <div key={actionKey} className="flex items-center justify-between p-3 px-4 hover:bg-muted/20">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium text-foreground/80">{actionLabel}</span>
                                                                <span className="text-[10px] text-muted-foreground">{moduleKey}.{actionKey}</span>
                                                            </div>
                                                            <Switch 
                                                                checked={isChecked} 
                                                                disabled={isLocked}
                                                                onCheckedChange={() => handleTogglePermission(roleKey, moduleKey, actionKey, isChecked)}
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
                    </TabsContent>
                )
            })}
          </Tabs>
        </main>
        <BottomNav />
      </div>
    </PermissionGate>
  )
}
