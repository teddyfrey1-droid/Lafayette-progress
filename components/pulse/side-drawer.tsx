"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PulseLogo } from "./pulse-logo"
import { useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { signOut } from "@/lib/firebase/auth"

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

function initials(name: string | null | undefined) {
  if (!name || typeof name !== 'string') return "U"
  
  const parts = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    
  if (parts.length === 0) return "U"
  return parts.map((p) => p[0]).join("").toUpperCase()
}

export function SideDrawer({ open, onClose }: SideDrawerProps) {
  const pathname = usePathname()
  // Note : useRouter n'est plus nécessaire ici pour la déconnexion car on utilise window.location
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  
  // Récupération des données utilisateur réelles via le contexte Auth
  const { user, profile } = useAuth()

  // Détermination des valeurs d'affichage avec fallback
  const displayName = profile?.displayName || user?.displayName || "Utilisateur"
  const role = profile?.role || "employee"
  const firstName = displayName.split(" ")[0] || "Utilisateur"
  const isAdmin = role === "admin" || role === "super_admin" || role === "manager"
  
  // Récupération de la société du profil
  const companyName = profile?.company || "Heiko"

  const handleLogout = async () => {
    setShowLogoutConfirm(false)
    onClose()
    try {
      await signOut()
      // CORRECTION : On force le rechargement complet de la page vers /connexion
      // Cela nettoie tous les états en mémoire et le cache du navigateur
      window.location.href = "/connexion"
    } catch (error) {
      console.error("Erreur lors de la déconnexion", error)
      // Redirection forcée même en cas d'erreur pour ne pas bloquer l'utilisateur
      window.location.href = "/connexion"
    }
  }

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
          "fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-card z-50 transform transition-transform duration-300 ease-out shadow-2xl flex flex-col h-full",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <PulseLogo size="md" />
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* User Info Header (Qui je suis) */}
          <div className="p-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="relative p-2.5 rounded-xl bg-primary/10">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{firstName}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {role === "admin" || role === "super_admin" ? "Administrateur" : role === "manager" ? "Manager" : "Salarié"}
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

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative group w-full text-left text-red-400 hover:bg-red-500/10 mt-4"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm flex-1">Déconnexion</span>
              <ChevronRight
                className={cn(
                  "w-4 h-4 opacity-0 -translate-x-2 transition-all",
                  "group-hover:opacity-100 group-hover:translate-x-0",
                )}
              />
            </button>
          </nav>

          {/* Footer Société (Où je travaille) */}
          <div className="p-4 border-t border-border mt-auto">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-border/50">
              <div className="w-10 h-10 rounded-lg bg-white dark:bg-black flex items-center justify-center shrink-0 shadow-sm">
                <Building2 className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Société / Site</p>
                <p className="font-semibold text-sm truncate text-foreground">{companyName}</p>
              </div>
            </div>
          </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm" 
            onClick={() => setShowLogoutConfirm(false)} 
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card rounded-2xl z-[60] p-6 max-w-sm w-[calc(100%-2rem)] mx-auto shadow-xl">
            <h3 className="font-semibold text-center text-lg mb-2">Se déconnecter ?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Êtes-vous sûr de vouloir vous déconnecter de votre compte ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={handleLogout} 
                className="flex-1 py-3 rounded-xl bg-destructive text-white font-medium hover:bg-destructive/90 transition-colors"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
