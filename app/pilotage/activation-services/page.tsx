"use client"

import Link from "next/link"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { MODULES, ROLES } from "@/lib/permissions-config"
import { usePermissions } from "@/hooks/use-permissions"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, ShieldAlert, RotateCcw } from "lucide-react"

function norm(s: string) {
  return (s || "").toLowerCase().trim()
}

export default function ServiceActivationPage() {
  // Page de configuration: accessible uniquement si le module Pilotage est autorisé,
  // et réservée aux profils ayant des droits d'édition sur Paramètres (ou Centre de contrôle).
  return (
    <PermissionGate moduleId="pilotage" redirect>
      <PermissionGate moduleId={["parametres", "centre_controle"]} match="any" requireEdit redirect>
        <ServiceConfigContent />
      </PermissionGate>
    </PermissionGate>
  )
}

function ServiceConfigContent() {
  const { toast } = useToast()
  const { permissions, updatePermission, resetToDefault } = usePermissions()

  const isRoleLocked = (roleId: string) => norm(roleId) === "super_admin"

  const isAllowed = (moduleId: string, roleId: string, mode: "view" | "edit") => {
    const perm = permissions[moduleId]
    const list = mode === "edit" ? perm?.edit || [] : perm?.view || []
    return list.map(norm).includes(norm(roleId))
  }

  const handleReset = async () => {
    if (!confirm("Réinitialiser toutes les permissions aux valeurs par défaut ?")) return
    try {
      await resetToDefault()
      toast({
        title: "Permissions réinitialisées",
        description: "Les restrictions sont actives immédiatement.",
        variant: "success",
      })
    } catch {
      toast({ title: "Erreur", description: "Impossible de réinitialiser.", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Link href="/pilotage" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Activation des services</h1>
            <p className="text-muted-foreground text-sm">
              Contrôle d'accès par rôle (lecture / modification). Les changements sont appliqués immédiatement.
            </p>
          </div>

          <Button onClick={handleReset} variant="outline" className="rounded-xl bg-transparent gap-2">
            <RotateCcw className="w-4 h-4" /> Réinitialiser
          </Button>
        </div>

        <div className="pulse-card overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                <tr>
                  <th className="px-4 py-4 font-medium min-w-[220px]">Module / Service</th>
                  {ROLES.map((role) => (
                    <th key={role.id} className="px-4 py-4 text-center font-medium min-w-[120px]">
                      <div className="leading-tight">
                        <div>{role.name}</div>
                        <div className="text-[10px] normal-case opacity-80">V / M</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MODULES.map((module) => (
                  <tr key={module.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-foreground">{module.name}</div>
                      <div className="text-xs text-muted-foreground">{module.description}</div>
                    </td>

                    {ROLES.map((role) => {
                      const viewAllowed = isAllowed(module.id, role.id, "view")
                      const editAllowed = isAllowed(module.id, role.id, "edit")
                      const locked = isRoleLocked(role.id)

                      return (
                        <td key={role.id} className="px-4 py-4">
                          <div className="flex items-center justify-center gap-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">V</span>
                              <Switch
                                checked={locked ? true : viewAllowed}
                                disabled={locked}
                                onCheckedChange={() => updatePermission(module.id, role.id, "view")}
                                className="data-[state=checked]:bg-primary"
                              />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">M</span>
                              <Switch
                                checked={locked ? true : editAllowed}
                                disabled={locked}
                                onCheckedChange={() => updatePermission(module.id, role.id, "edit")}
                                className="data-[state=checked]:bg-primary"
                              />
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 p-4 bg-orange-50 dark:bg-orange-900/10 text-orange-800 dark:text-orange-200 rounded-xl text-sm items-start border border-orange-100 dark:border-orange-900/20">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            <strong>Attention :</strong> si vous retirez l'accès &quot;Paramètres&quot; / &quot;Centre de contrôle&quot; à votre rôle,
            vous ne pourrez plus modifier les permissions (sauf intervention directe dans la base).
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
