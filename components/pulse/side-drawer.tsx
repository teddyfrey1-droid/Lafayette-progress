"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  X,
  LayoutDashboard,
  Target,
  Coins,
  Users,
  BarChart3,
  Send,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  User,
  Shield,
  Truck,
  Globe,
} from "lucide-react"
import { useAuth } from "@/components/pulse/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { PulseLogo } from "./pulse-logo"

interface SideDrawerProps {
  open: boolean
  onClose: () => void
}

const menuItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord", adminOnly: false },
  { href: "/objectifs", icon: Target, label: "Objectifs", adminOnly: false },
  { href: "/primes", icon: Coins, label: "Primes & Historique", adminOnly: false },
  { href: "/equipes", icon: Users, label: "Equipes", adminOnly: false },
  { href: "/sites-contacts-utiles", icon: Globe, label: "Sites & Contacts utiles", adminOnly: false },
  { href: "/gestion-fournisseurs", icon: Truck, label: "Gestion & Fournisseurs", adminOnly: false },
  { href: "/pilotage", icon: BarChart3, label: "Pilotage", adminOnly: false },
  { href: "/diffusion", icon: Send, label: "Diffusion", adminOnly: false },
  { href: "/centre-controle", icon: Shield, label: "Centre de contrôle", adminOnly: true },
  { href: "/parametres", icon: Settings, label: "Parametres", adminOnly: false },
  { href: "/aide", icon: HelpCircle, label: "Aide", adminOnly: false },
]

export function SideDrawer({ open, onClose }: SideDrawerProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, signOutUser } = useAuth()

  const handleLogout = async () => {
    onClose()
    try {
      await signOutUser()
    } catch {
      // ignore
    }
    router.push("/connexion")
  }

  const displayName = profile?.name || profile?.email || "Utilisateur"
  const firstName = displayName.split(" ")[0]
  const isAdmin = profile?.role === "admin"

const firstName = displayName.split(" ")[0]
  const isAdmin = profile?.role === "admin"

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300 backdrop-blur-sm",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-card z-50 transform transition-transform duration-300 ease-out shadow-2xl",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <PulseLogo size="md" />
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="relative p-2.5 rounded-xl bg-primary/10">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{firstName}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {profile?.role === "admin" ? "Super Admin" : profile?.role}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => {
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative group",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium text-sm flex-1">{item.label}</span>
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 opacity-0 -translate-x-2 transition-all",
                        "group-hover:opacity-100 group-hover:translate-x-0",
                      )}
                    />
                  </Link>
                )
              })}
          </nav>

          {/* User */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {displayName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate capitalize">
                  {profile?.role === "admin" ? "Super Admin" : profile?.role}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl text-muted-foreground hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
