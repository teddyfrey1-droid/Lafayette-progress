"use client"

import { Header } from "@/components/pulse/header"
import { useRBAC, PERMISSIONS_SCHEMA } from "@/components/auth/rbac-provider"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Lock, ShieldAlert } from "lucide-react"

export default function RolesManagementPage() {
  const { rolePermissions, updatePermission, loading, can } = useRBAC();

  if (loading) return <div className="p-8">Chargement des droits...</div>;
  
  // Sécurité : Seul ceux qui ont le droit "manage_roles" peuvent voir cette page
  if (!can("settings", "manage_roles")) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold">Accès Interdit</h1>
        <p className="text-muted-foreground">Vous n'avez pas les droits pour modifier les rôles.</p>
      </div>
    )
  }

  const roles = ["manager", "employee"]; // On ne touche pas à l'admin principal ici pour éviter de se bloquer soi-même

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header title="Gestion des Rôles" showBack />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="w-6 h-6 text-primary" />
            Permissions & Accès
          </h1>
          <p className="text-muted-foreground">Définissez précisément ce que chaque rôle peut faire dans l'application.</p>
        </div>

        <Tabs defaultValue="manager" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="manager">Manager</TabsTrigger>
            <TabsTrigger value="employee">Employé</TabsTrigger>
          </TabsList>

          {roles.map(role => (
            <TabsContent key={role} value={role} className="space-y-6">
              {Object.entries(PERMISSIONS_SCHEMA).map(([resourceKey, schema]) => (
                <Card key={resourceKey}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium">{schema.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(schema.actions).map(([actionKey, label]) => {
                        const isChecked = rolePermissions[role]?.[resourceKey]?.[actionKey] === true;
                        
                        return (
                          <div key={actionKey} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                            <span className="text-sm font-medium">{label}</span>
                            <Switch 
                              checked={isChecked}
                              onCheckedChange={(val) => updatePermission(role, resourceKey, actionKey, val)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  )
}
