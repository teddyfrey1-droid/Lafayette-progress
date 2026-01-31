"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePermissions } from "@/hooks/use-permissions"
import { MODULES, ROLES } from "@/lib/permissions-config"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, KeyRound, RotateCcw, ShieldAlert, Search } from "lucide-react"
import { cn } from "@/lib/utils"

function norm(s: string) {
  return (s || "").toLowerCase().trim()
}

type ModuleItem = {
  id: string
  name: string
  description?: string
}

export function PermissionsManager({
  backHref,
  title = "Gestion des droits",
  subtitle = "Activez / désactivez l'accès à chaque page (par rôle). Les changements sont instantanés.",
  showReset = true,
}: {
  backHref: string
  title?: string
  subtitle?: string
  showReset?: boolean
}) {
  const { toast } = useToast()
  const { permissions, updatePermission, resetToDefault } = usePermissions()

  const [role, setRole] = useState<string>(ROLES.find((r) => norm(r.id) === "gerant")?.id || ROLES[0]?.id || "gerant")
  const [q, setQ] = useState("")

  // Modules: liste connue + modules présents en base (évite d'oublier une nouvelle page)
  const modules: ModuleItem[] = useMemo(() => {
    const known = MODULES.map((m) => ({ id: m.id, name: m.name, description: m.description }))
    const knownIds = new Set(known.map((m) => m.id))

    const dynamic = Object.keys(permissions || {})
      .filter((id) => !knownIds.has(id))
      .map((id) => ({ id, name: id, description: "Module" }))

    return [...known, ...dynamic]
  }, [permissions])

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim()
    if (!needle) return modules
    return modules.filter((m) => (m.name || "").toLowerCase().includes(needle) || (m.id || "").toLowerCase().includes(needle))
  }, [modules, q])

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
    <main className="px-4 py-6 max-w-5xl mx-auto space-y-6">
      <Link href={backHref} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-primary" /> {title}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {showReset && (
          <Button onClick={handleReset} variant="outline" className="rounded-xl bg-transparent gap-2">
            <RotateCcw className="w-4 h-4" /> Réinitialiser
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="pulse-card p-4">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Rôle</div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Sélectionner un rôle" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.id} value={r.id} disabled={isRoleLocked(r.id)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            Astuce : le switch <span className="font-semibold">Accès</span> active/désactive la page. <span className="font-semibold">Modifier</span> donne les droits d'édition.
          </p>
        </div>

        <div className="pulse-card p-4">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Rechercher</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Objectifs, Equipes, Hub de Gestion…" className="pl-10 h-11 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((m) => {
          const viewAllowed = isAllowed(m.id, role, "view")
          const editAllowed = isAllowed(m.id, role, "edit")
          const locked = isRoleLocked(role)

          return (
            <div key={m.id} className="pulse-card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-foreground truncate">{m.name}</div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">{m.id}</span>
                </div>
                {m.description ? <div className="text-xs text-muted-foreground mt-1">{m.description}</div> : null}
              </div>

              <div className="flex items-center gap-4 justify-between sm:justify-end">
                <div className="flex flex-col items-center gap-1">
                  <div className="text-[10px] text-muted-foreground">Accès</div>
                  <Switch
                    checked={locked ? true : viewAllowed}
                    disabled={locked}
                    onCheckedChange={() => updatePermission(m.id, role, "view")}
                    className={cn("data-[state=checked]:bg-primary")}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="text-[10px] text-muted-foreground">Modifier</div>
                  <Switch
                    checked={locked ? true : editAllowed}
                    disabled={locked}
                    onCheckedChange={() => updatePermission(m.id, role, "edit")}
                    className={cn("data-[state=checked]:bg-primary")}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 p-4 bg-orange-50 dark:bg-orange-900/10 text-orange-800 dark:text-orange-200 rounded-xl text-sm items-start border border-orange-100 dark:border-orange-900/20">
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
        <p>
          <strong>Attention :</strong> si vous retirez l'accès <em>Paramètres</em> et <em>Centre de contrôle</em> à votre rôle,
          vous risquez de ne plus pouvoir modifier les droits (sans intervention directe en base).
        </p>
      </div>
    </main>
  )
}
