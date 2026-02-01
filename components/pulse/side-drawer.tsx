"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useCurrentUser } from "@/lib/use-current-user"
import { signOut } from "@/lib/firebase/auth"
import { usePermissions } from "@/hooks/use-permissions"
import { useCompanyModules } from "@/hooks/use-company-modules"
import { PulseLogo } from "./pulse-logo"
import { Button } from "@/components/ui/button"
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
  Shield,
  Truck,
  Globe,
  Building2,
  Briefcase,
  ChevronDown,
  ShoppingCart,
  KeyRound,
} from "lucide-react"

interface SideDrawerProps {
  open: boolean
  onClose: () => void
}

type MenuSection = {
  id: string
  title: string
  icon?: any
  items: MenuItem[]
  collapsible?: boolean
  // Contrôle d'apparition de la catégorie (modules activés par entreprise)
  sectionModuleId?: string
}

type MenuItem = {
  href: string
  icon: any
  label: string
  moduleId?: string | string[]
  match?: "all" | "any"
  badge?: string
}

// ✅ NOUVELLE STRUCTURE DU MENU
const menuSections: MenuSection[] = [
  {
    id: "main",
    title: "Principal",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord", moduleId: "dashboard" },
      { href: "/objectifs", icon: Target, label: "Objectifs", moduleId: "objectifs" },
      { href: "/primes", icon: Coins, label: "Primes", moduleId: "primes" },
      { href: "/sites-contacts-utiles", icon: Globe, label: "Sites & Contacts", moduleId: "sites" },
    ],
  },
  {
    id: "gestion",
    title: "Gestion",
    icon: Briefcase,
    collapsible: true,
    sectionModuleId: "menu_gestion",
    items: [
      { href: "/commandes", icon: ShoppingCart, label: "Passer une commande", moduleId: "commandes" },
      { href: "/fournisseurs", icon: Truck, label: "Fournisseurs", moduleId: "fournisseurs" },
      { href: "/gestion/acces", icon: KeyRound, label: "Droits & Accès", moduleId: "acces" },
      { href: "/gestion-fournisseurs/admin-sites", icon: Globe, label: "Outils Admin", moduleId: "outils_admin" },
      { href: "/equipes", icon: Users, label: "Équipes", moduleId: "equipes" },
    ],
  },
  {
    id: "outils",
    title: "Outils avancés",
    icon: BarChart3,
    collapsible: true,
    sectionModuleId: "menu_outils",
    items: [
      { href: "/pilotage", icon: BarChart3, label: "Pilotage", moduleId: "pilotage" },
      { href: "/diffusion", icon: Send, label: "Diffusion", moduleId: "diffusion" },
    ],
  },
  {
    id: "admin",
    title: "Administration",
    icon: Shield,
    collapsible: true,
    sectionModuleId: "menu_admin",
    items: [
      { href: "/centre-controle", icon: Shield, label: "Centre de contrôle", moduleId: "centre_controle", badge: "Admin" },
      { href: "/parametres", icon: Settings, label: "Paramètres", moduleId: "parametres" },
    ],
  },
]

export function SideDrawer({ open, onClose }: SideDrawerProps) {
  const pathname = usePathname()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  
  // ✅ Sections fermées par défaut : On initialise avec les IDs des sections repliables
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(["gestion", "outils", "admin"])
  )
  
  const user = useCurrentUser()
  const { canView, loading: permissionsLoading } = usePermissions()
  const { isModuleEnabled } = useCompanyModules()

  const getRoleLabel = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin': 
      case 'super_admin': return 'Administrateur';
      case 'gerant': return 'Gérant';
      case 'manager': return 'Manager';
      case 'directeur': return 'Directeur';
      case 'assistant_manager': return 'Assistant Manager';
      default: return 'Salarié';
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin': 
      case 'super_admin': return 'bg-red-500/10 text-red-600 border-red-200';
      case 'gerant': return 'bg-purple-500/10 text-purple-600 border-purple-200';
      case 'manager':
      case 'directeur': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  }

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  const checkItemVisible = (item: MenuItem) => {
    if (!item.moduleId) return true
    if (permissionsLoading) return true
    
    const ids = Array.isArray(item.moduleId) ? item.moduleId : [item.moduleId]
    const checkWithCompany = (id: string) => canView(id) && isModuleEnabled(id)
    
    return item.match === "any" ? ids.some(checkWithCompany) : ids.every(checkWithCompany)
  }

  const getVisibleSections = () => {
    return menuSections
      .map((section) => {
        const items = section.items.filter(checkItemVisible)
        return { ...section, items }
      })
      .filter((section) => {
        if (section.items.length === 0) return false
        if (!section.sectionModuleId) return true
        return isModuleEnabled(section.sectionModuleId)
      })
  }

  const handleLogout = async () => {
    setShowLogoutConfirm(false)
    onClose()
    try {
      await signOut()
      window.location.href = "/connexion"
    } catch (error) {
      console.error("Erreur lors de la déconnexion", error)
      window.location.href = "/connexion"
    }
  }

  const visibleSections = getVisibleSections()

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300 backdrop-blur-sm",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-card z-50 transform transition-transform duration-300 ease-out shadow-2xl flex flex-col h-full",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <PulseLogo size="md" />
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl hover:bg-muted">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 border-b border-border bg-gradient-to-br from-muted/30 to-muted/10">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/80 to-accent/80 text-white font-bold text-lg uppercase shadow-lg shadow-primary/20">
              {(user.firstName?.[0] || "") + (user.lastName?.[0] || "")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {user.displayName || "Utilisateur"}
              </p>
              <div className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border mt-1",
                getRoleBadgeColor(user.role)
              )}>
                {getRoleLabel(user.role)}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {visibleSections.map((section, sectionIndex) => {
            const isCollapsed = collapsedSections.has(section.id)
            const isCollapsible = section.collapsible && section.items.length > 0
            
            const hasActiveItem = section.items.some(item => 
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
            )

            return (
              <div key={section.id} className={cn(
                "mb-2",
                sectionIndex > 0 && "mt-3"
              )}>
                {section.title && (
                  <div 
                    className={cn(
                      "flex items-center justify-between px-3 py-2 mb-1",
                      isCollapsible && "cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
                    )}
                    onClick={() => isCollapsible && toggleSection(section.id)}
                  >
                    <div className="flex items-center gap-2">
                      {section.icon && (
                        <section.icon className={cn(
                          "w-4 h-4",
                          hasActiveItem ? "text-primary" : "text-muted-foreground"
                        )} />
                      )}
                      <span className={cn(
                        "text-xs font-semibold uppercase tracking-wider",
                        hasActiveItem ? "text-primary" : "text-muted-foreground"
                      )}>
                        {section.title}
                      </span>
                    </div>
                    {isCollapsible && (
                      <ChevronDown className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform duration-200",
                        isCollapsed && "-rotate-90"
                      )} />
                    )}
                  </div>
                )}

                <div className={cn(
                  "space-y-1 overflow-hidden transition-all duration-200",
                  isCollapsible && isCollapsed && "max-h-0 opacity-0",
                  (!isCollapsible || !isCollapsed) && "max-h-[500px] opacity-100"
                )}>
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all relative group",
                          isActive
                            ? "bg-primary/10 text-primary shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                        )}
                        
                        <item.icon className={cn(
                          "w-5 h-5 transition-transform group-hover:scale-110",
                          isActive && "text-primary"
                        )} />
                        <span className="font-medium text-sm flex-1">{item.label}</span>
                        
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-red-500/10 text-red-600 rounded-full">
                            {item.badge}
                          </span>
                        )}
                        
                        <ChevronRight
                          className={cn(
                            "w-4 h-4 opacity-0 -translate-x-2 transition-all",
                            "group-hover:opacity-100 group-hover:translate-x-0",
                          )}
                        />
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className="my-4 border-t border-border/50" />

          <Link
            href="/aide"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group",
              pathname === "/aide"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="font-medium text-sm flex-1">Aide</span>
          </Link>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all relative group w-full text-left text-red-500 hover:bg-red-500/10 mt-2"
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

        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 border border-border/50">
            <div className="w-10 h-10 rounded-lg bg-white dark:bg-black flex items-center justify-center shrink-0 shadow-sm border border-border/30">
              <Building2 className="w-5 h-5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Entreprise</p>
              <p className="font-semibold text-sm truncate text-foreground">{user.company || "Mon entreprise"}</p>
            </div>
          </div>
        </div>
      </div>

      {showLogoutConfirm && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={() => setShowLogoutConfirm(false)} 
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card rounded-2xl z-[60] p-6 max-w-sm w-[calc(100%-2rem)] mx-auto shadow-xl border border-border animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <LogOut className="w-7 h-7 text-red-500" />
            </div>
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
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
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
