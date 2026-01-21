"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Target, Coins, Globe } from "lucide-react"
// 👇 On remplace l'ancien hook par le nouveau
import { useRBAC } from "@/components/auth/rbac-provider"

// On met à jour les moduleId pour qu'ils matchent RBAC_SCHEMA
const navItems: Array<{ href: string; icon: any; label: string; moduleId: string }> = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Accueil", moduleId: "dashboard" },
  { href: "/objectifs", icon: Target, label: "Objectifs", moduleId: "objectifs" },
  { href: "/primes", icon: Coins, label: "Primes", moduleId: "primes" },
  { href: "/sites-contacts-utiles", icon: Globe, label: "Sites", moduleId: "sites_utiles" }, // Attention: c'est "sites_utiles" dans le schéma
]

export function BottomNav() {
  const pathname = usePathname()
  const { can, loading } = useRBAC() // 👈 Nouveau système

  const visible = navItems.filter((item) => {
    // Pendant le chargement, on affiche tout pour éviter que le menu saute
    if (loading) return true
    
    // On vérifie si l'utilisateur a le droit de "view" (voir) ce module
    return can(item.moduleId, "view")
  })

  // Si l'utilisateur n'a accès à rien (bizarre mais possible), on cache la barre
  if (!loading && visible.length === 0) return null;

  return (
    // Keep the bottom nav below drawers/modals (many overlays use z-50).
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card/80 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {visible.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all",
                isActive ? "text-primary bg-muted" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <div className={cn("p-1.5 rounded-xl transition-all", isActive && "bg-primary/15")}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
