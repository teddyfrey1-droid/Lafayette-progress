"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { useRBAC } from "@/components/auth/rbac-provider"
import { RBAC_SCHEMA, PermissionModule } from "@/lib/rbac-schema"
import { Shield, Save, Plus, Trash2, Info, Check, AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

export default function GestionAccesPage() {
  const { roleDefinitions, updateRolePermissions, createRole, deleteRole, loading } = useRBAC()
  const { toast } = useToast()
  
  // État pour la création de rôle
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleLabel, setNewRoleLabel] = useState("")

  // Gestion des onglets (Rôles)
  // On récupère les clés des rôles (ex: ['gerant', 'manager', 'employe'])
  // On exclut 'super_admin' car il n'est pas modifiable
  const roleKeys = Object.keys(roleDefinitions).filter(r => r !== 'super_admin' && r !== 'admin');
  const [activeRole, setActiveRole] = useState(roleKeys[0] || "manager");

  const handleTogglePermission = async (role: string, module: string, action: string, currentValue: boolean) => {
    // 1. Copie profonde des permissions actuelles du rôle
    const currentPerms = { ...roleDefinitions[role].permissions };
    
    // 2. Initialiser l'objet module s'il n'existe pas
    if (!currentPerms[module]) currentPerms[module] = {};

    // 3. Appliquer la modification
    currentPerms[module][action] = !currentValue;

    // 4. Sauvegarder
    try {
      await updateRolePermissions(role, currentPerms);
      toast({ title: "Permission mise à jour" });
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName || !newRoleLabel) return;
    try {
      // Nettoyage de la clé (pas d'espace, minuscule)
      const safeKey = newRoleName.toLowerCase().replace(/\s+/g, '_');
      await createRole(safeKey, newRoleLabel);
      setIsCreateOpen(false);
      setNewRoleName("");
      setNewRoleLabel("");
      toast({ title: "Rôle créé avec succès" });
    } catch (e) {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    }
  };

  const handleDeleteRole = async (roleKey: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce rôle ? Les utilisateurs assignés perdront leurs droits.")) return;
    try {
      await deleteRole(roleKey);
      setActiveRole(roleKeys[0]); // Revenir au premier rôle
      toast({ title: "Rôle supprimé" });
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement des accès...</div>;

  return (
    <PermissionGate moduleId="centre_controle" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-2 mb-4">
             <Link href="/centre-controle" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
             </Link>
             <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Shield className="w-6 h-6 text-primary" />
                    Gestion des Accès
                </h1>
                <p className="text-sm text-muted-foreground">Définissez précisément qui peut faire quoi.</p>
             </div>
          </div>

          <div className="flex justify-between items-center">
             <Tabs value={activeRole} onValueChange={setActiveRole} className="w-full">
                <div className="flex items-center justify-between mb-4 overflow-x-auto pb-2 gap-2">
                    <TabsList className="bg-muted/50 h-auto p-1 flex-wrap justify-start">
                        {roleKeys.map(roleKey => (
                            <TabsTrigger key={roleKey} value={roleKey} className="px-4 py-2 capitalize">
                                {roleDefinitions[roleKey].label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-2 shrink-0">
                                <Plus className="w-4 h-4" /> Nouveau Rôle
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Créer un nouveau rôle</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Nom affiché (Label)</label>
                                    <Input placeholder="Ex: Stagiaire RH" value={newRoleLabel} onChange={e => setNewRoleLabel(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Identifiant technique (ID)</label>
                                    <Input placeholder="Ex: stagiaire_rh" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateRole} disabled={!newRoleName || !newRoleLabel}>Créer</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {roleKeys.map(roleKey => {
                    const roleData = roleDefinitions[roleKey];
                    return (
                        <TabsContent key={roleKey} value={roleKey} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            
                            {/* En-tête du rôle */}
                            <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
                                <div>
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        {roleData.label} 
                                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">{roleKey}</Badge>
                                    </h2>
                                    <p className="text-sm text-muted-foreground">Configurez les permissions pour ce groupe d'utilisateurs.</p>
                                </div>
                                {roleKey !== 'gerant' && (
                                    <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteRole(roleKey)}>
                                        <Trash2 className="w-4 h-4 mr-2" /> Supprimer ce rôle
                                    </Button>
                                )}
                            </div>

                            {/* Grille des permissions */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(RBAC_SCHEMA).map(([moduleKey, moduleDef]: [string, any]) => {
                                    const userPerms = roleData.permissions[moduleKey] || {};
                                    const isFullAccess = roleData.permissions["*"];

                                    return (
                                        <Card key={moduleKey} className="overflow-hidden border-muted-foreground/20">
                                            <CardHeader className="bg-muted/30 py-3 px-4 border-b">
                                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                                    {moduleDef.label}
                                                    {isFullAccess && <Badge className="ml-auto bg-green-500">Accès Total (Admin)</Badge>}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <div className="divide-y divide-border/50">
                                                    {Object.entries(moduleDef.actions).map(([actionKey, actionLabel]: [string, any]) => {
                                                        const isChecked = isFullAccess || userPerms["*"] || userPerms[actionKey] === true;
                                                        const isDangerous = actionKey.includes("delete") || actionKey.includes("manage_");

                                                        return (
                                                            <div key={actionKey} className="flex items-center justify-between p-3 hover:bg-muted/20 transition-colors">
                                                                <div className="flex flex-col">
                                                                    <span className={cn("text-sm font-medium", isDangerous && "text-red-600")}>
                                                                        {actionLabel}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground font-mono">{moduleKey}.{actionKey}</span>
                                                                </div>
                                                                <Switch 
                                                                    checked={isChecked} 
                                                                    onCheckedChange={() => handleTogglePermission(roleKey, moduleKey, actionKey, isChecked)}
                                                                    disabled={isFullAccess} // On ne peut pas décocher si Super Admin
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
          </div>
        </main>
        <BottomNav />
      </div>
    </PermissionGate>
  )
}
