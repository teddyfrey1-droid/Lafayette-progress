"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Target, Coins, Globe, Settings } from "lucide-react"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Accueil" },
  { href: "/objectifs", icon: Target, label: "Objectifs" },
  { href: "/primes", icon: Coins, label: "Primes" },
  { href: "/sites-contacts-utiles", icon: Globe, label: "Sites" },
  { href: "/parametres", icon: Settings, label: "Plus" },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
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
