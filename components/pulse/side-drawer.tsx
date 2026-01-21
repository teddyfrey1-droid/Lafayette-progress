"use client"

import React, { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { X, LayoutDashboard, Target, Coins, Globe, Users, Settings, Shield, ClipboardList } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import { useRBAC } from "@/components/auth/rbac-provider"

type DrawerProps = {
  open: boolean
  onClose: () => void
}

type MenuItem = {
  href: string
  icon: any
  label: string
  moduleId?: string
}

const MENU: MenuItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Accueil", moduleId: "dashboard" },
  { href: "/objectifs", icon: Target, label: "Objectifs", moduleId: "objectifs" },
  { href: "/primes", icon: Coins, label: "Primes", moduleId: "primes" },
  { href: "/equipes", icon: Users, label: "Équipe", moduleId: "equipes" },
  { href: "/sites-contacts-utiles", icon: Globe, label: "Sites utiles", moduleId: "sites_utiles" },
  { href: "/gestion-fournisseurs", icon: ClipboardList, label: "Gestion & fournisseurs", moduleId: "gestion" },
  { href: "/centre-controle", icon: Shield, label: "Centre de contrôle", moduleId: "centre_controle" },
  { href: "/parametres", icon: Settings, label: "Paramètres", moduleId: "parametres" },
]

export function SideDrawer({ open, onClose }: DrawerProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useAuth()
  const { can, loading } = useRBAC()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const firstName = (profile?.displayName || "").split(" ")[0] || ""
  const role = profile?.role || ""

  const isItemVisible = (item: MenuItem) => {
    if (!item.moduleId) return true
    if (loading) return true
    // lecture / accès
    return can(item.moduleId, "view") || can(item.moduleId, "access")
  }

  const visibleMenu = MENU.filter(isItemVisible)

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute left-0 top-0 h-full w-[320px] bg-background shadow-xl border-r border-border">
        <div className="p-4 flex items-center justify-between border-b border-border">
          <div>
            <div className="text-sm text-muted-foreground">Connecté</div>
            <div className="font-semibold">{firstName || profile?.email}</div>
            <div className="text-xs text-muted-foreground capitalize">{String(role).replaceAll("_", " ")}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="py-2">
          {visibleMenu.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose()}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
