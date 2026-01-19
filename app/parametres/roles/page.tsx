"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { useRBAC } from "@/components/auth/rbac-provider"
// 👇 CORRECTION ICI : On importe depuis le bon fichier lib
import { RBAC_SCHEMA } from "@/lib/rbac-schema" 
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Lock, ShieldAlert, Plus, Trash2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function RolesManagementPage() {
  const { roleDefinitions, updateRolePermissions, createRole, deleteRole, loading, can } = useRBAC();
  const { toast } = useToast()

  // État pour la création de rôle
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleLabel, setNewRoleLabel] = useState("")

  // On récupère les clés des rôles (ex: ['gerant', 'manager', 'employe'])
  // On exclut 'super_admin' car il n'est pas modifiable
  const roleKeys = Object.keys(roleDefinitions || {}).filter(r => r !== 'super_admin' && r !== 'admin');
  const [activeRole, setActiveRole] = useState(roleKeys[0] || "manager");

  if (loading) return <div className="p-8 text-center">Chargement des droits...</div>;
  
  // Sécurité : Seul ceux qui ont le droit "manage_roles" (ou paramètre/manage_sensitive) peuvent voir cette page
  // Si RBAC_SCHEMA n'est pas encore chargé, on attend
  if (!loading && !can("parametres", "manage_sensitive")) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold">Accès Interdit</h1>
        <p className="text-muted-foreground">Vous n'avez pas les droits pour modifier les rôles.</p>
      </div>
    )
  }

  const handleTogglePermission = async (role: string, module: string, action: string, currentValue: boolean) => {
    const currentPerms = { ...roleDefinitions[role].permissions };
    if (!currentPerms[module]) currentPerms[module] = {};
    currentPerms[module][action] = !currentValue;

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
      const safeKey = newRoleName.toLowerCase().replace(/\s+/g, '_');
      await createRole(safeKey, newRoleLabel);
      setIsCreateOpen(false);
      setNewRoleName("");
      setNewRoleLabel("");
      toast({ title: "Rôle créé" });
    } catch (e) {
      toast({ title: "Erreur création", variant: "destructive" });
    }
  };

  const handleDeleteRole = async (roleKey: string) => {
    if (!confirm("Supprimer ce rôle ?")) return;
    try {
      await deleteRole(roleKey);
      setActiveRole(roleKeys[0]); 
      toast({ title: "Rôle supprimé" });
    } catch (e) {
      toast({ title: "Erreur suppression", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />
      
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
             <Link href="/centre-controle" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
             </Link>
             <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Lock className="w-6 h-6 text-primary" />
                    Permissions & Accès
                </h1>
                <p className="text-sm text-muted-foreground">Définissez précisément ce que chaque rôle peut faire.</p>
             </div>
        </div>

        <Tabs value={activeRole} onValueChange={setActiveRole} className="w-full">
          <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
              <TabsList className="h-auto p-1 flex-wrap justify-start">
                {roleKeys.map(role => (
                    <TabsTrigger key={role} value={role} className="px-3 py-1.5 capitalize">
                    {roleDefinitions[role].label}
                    </TabsTrigger>
                ))}
              </TabsList>

              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                        <Plus className="w-4 h-4" /> Nouveau Rôle
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Créer un rôle</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1"><label className="text-sm">Nom (Label)</label><Input value={newRoleLabel} onChange={e => setNewRoleLabel(e.target.value)} placeholder="Ex: Stagiaire"/></div>
                        <div className="space-y-1"><label className="text-sm">ID (Technique)</label><Input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Ex: stagiaire"/></div>
                    </div>
                    <DialogFooter><Button onClick={handleCreateRole}>Créer</Button></DialogFooter>
                </DialogContent>
              </Dialog>
          </div>

          {roleKeys.map(role => {
            const roleData = roleDefinitions[role];
            return (
                <TabsContent key={role} value={role} className="space-y-6">
                    <div className="flex justify-between items-center bg-card p-4 rounded-xl border">
                        <div>
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                {roleData.label} <Badge variant="outline">{role}</Badge>
                            </h2>
                            <p className="text-sm text-muted-foreground">Droits d'accès pour ce groupe.</p>
                        </div>
                        {role !== 'gerant' && <Button variant="ghost" className="text-red-500" onClick={() => handleDeleteRole(role)}><Trash2 className="w-4 h-4 mr-2"/> Supprimer</Button>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(RBAC_SCHEMA).map(([moduleKey, schema]: [string, any]) => {
                            const userPerms = roleData.permissions[moduleKey] || {};
                            const isFullAccess = roleData.permissions["*"];

                            return (
                                <Card key={moduleKey}>
                                <CardHeader className="pb-3 bg-muted/40">
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        {schema.label}
                                        {isFullAccess && <Badge className="ml-auto bg-green-500">Total</Badge>}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="space-y-4">
                                    {Object.entries(schema.actions).map(([actionKey, label]: [string, any]) => {
                                        const isChecked = isFullAccess || userPerms["*"] || userPerms[actionKey] === true;
                                        const isDangerous = actionKey.includes("delete") || actionKey.includes("manage_");
                                        
                                        return (
                                        <div key={actionKey} className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className={cn("text-sm font-medium", isDangerous && "text-red-600")}>{label}</span>
                                                <span className="text-[10px] text-muted-foreground font-mono">{moduleKey}.{actionKey}</span>
                                            </div>
                                            <Switch 
                                            checked={isChecked}
                                            disabled={isFullAccess}
                                            onCheckedChange={(val) => handleTogglePermission(role, moduleKey, actionKey, isChecked)}
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
    </div>
  )
}
