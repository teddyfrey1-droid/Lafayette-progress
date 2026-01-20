"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { useAuth } from "@/components/auth/auth-provider" // Pour les vraies infos profil
import { useTheme } from "next-themes" // Pour le mode sombre
import { 
  User, Shield, Link, Sliders, Users, Moon, Bell, 
  Palette, HelpCircle, LogOut, ChevronRight, LayoutGrid
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const { profile, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  // Calcul des initiales pour l'avatar
  const initials = profile?.displayName 
    ? profile.displayName.split(" ").map((n:string) => n[0]).join("").substring(0, 2).toUpperCase()
    : (profile?.email?.substring(0, 2).toUpperCase() || "??")

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-8">
        
        {/* En-tête Page */}
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gérez votre compte et préférences</p>
        </div>

        {/* SECTION COMPTE (PROFIL) */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Compte</h2>
            
            {/* Carte Profil */}
            <div className="pulse-card p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push('/settings/profile')}>
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-primary/20">
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">{profile?.displayName || "Utilisateur"}</h3>
                    <p className="text-sm text-muted-foreground truncate">{profile?.email}</p>
                    <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase border border-primary/20">
                        {profile?.role || "Employé"}
                    </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
            </div>

            {/* Menu Sécurité */}
            <div className="pulse-card overflow-hidden">
                <MenuItem 
                    icon={Shield} 
                    label="Sécurité" 
                    subLabel="Mot de passe et authentification"
                    onClick={() => router.push('/settings/security')}
                />
            </div>
        </section>

        {/* SECTION ADMINISTRATION (Visible seulement si admin/super_admin idéalement, mais affiché ici selon maquette) */}
        {['admin', 'super_admin', 'gerant'].includes(profile?.role || '') && (
            <section className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Administration</h2>
                <div className="pulse-card overflow-hidden divide-y divide-border/50">
                    <MenuItem 
                        icon={Link} 
                        label="Intégrations API" 
                        subLabel="Combo, Zelty, Uber Eats, etc."
                        onClick={() => router.push('/settings/integrations')}
                    />
                    <MenuItem 
                        icon={Sliders} 
                        label="Configuration objectifs" 
                        subLabel="Paramètres avancés des objectifs"
                        onClick={() => router.push('/pilotage')} // Redirige vers le pilotage que nous avons fait
                    />
                    <MenuItem 
                        icon={Users} 
                        label="Utilisateurs" 
                        subLabel="Gérer les accès et rôles"
                        onClick={() => router.push('/team')}
                    />
                </div>
            </section>
        )}

        {/* SECTION PRÉFÉRENCES */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Préférences</h2>
            <div className="pulse-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Moon className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="font-medium text-sm">Mode sombre</p>
                        <p className="text-xs text-muted-foreground">Basculer entre clair et sombre</p>
                    </div>
                </div>
                <Switch 
                    checked={theme === 'dark'} 
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} 
                />
            </div>
        </section>

        {/* SECTION SUPPORT */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Support</h2>
            <div className="pulse-card overflow-hidden divide-y divide-border/50">
                <MenuItem 
                    icon={Bell} 
                    label="Notifications" 
                    subLabel="Gérer les alertes"
                    onClick={() => router.push('/settings/notifications')}
                />
                <MenuItem 
                    icon={Palette} 
                    label="Thème" 
                    subLabel="Personnaliser l'apparence"
                    onClick={() => router.push('/settings/theme')}
                />
                <MenuItem 
                    icon={HelpCircle} 
                    label="Aide" 
                    subLabel="FAQ et documentation"
                    onClick={() => router.push('/help')}
                />
            </div>
        </section>

        {/* FOOTER & DÉCONNEXION */}
        <div className="pt-4 space-y-6 text-center">
            <Button 
                variant="destructive" 
                className="w-full h-12 rounded-xl font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-600 border border-red-500/20"
                onClick={() => signOut()}
            >
                <LogOut className="w-4 h-4 mr-2" />
                Se déconnecter
            </Button>

            <p className="text-xs text-muted-foreground font-medium">
                Pulse v2.0.0 - Janvier 2026
            </p>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}

// Composant utilitaire pour les items de menu
function MenuItem({ 
    icon: Icon, 
    label, 
    subLabel, 
    onClick 
}: { 
    icon: any, 
    label: string, 
    subLabel?: string, 
    onClick?: () => void 
}) {
    return (
        <button 
            onClick={onClick}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
        >
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-foreground">
                    <Icon className="w-4 h-4" />
                </div>
                <div>
                    <p className="font-medium text-sm">{label}</p>
                    {subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}
                </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </button>
    )
}
