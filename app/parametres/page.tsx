"use client"

import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { useAuth } from "@/components/auth/auth-provider"
import { signOut } from "@/lib/firebase/auth"
import { useRouter } from "next/navigation"
import {
  User,
  Settings,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  HelpCircle,
  Mail,
  Lock,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useState } from "react"

export default function SettingsPage() {
  const { profile, user, loading } = useAuth()
  // Note: useRouter n'est plus nécessaire pour la déconnexion, mais peut servir ailleurs
  const router = useRouter()
  const [notifications, setNotifications] = useState(true)

  // Récupération des données réelles ou valeurs par défaut
  const displayName = profile?.displayName || user?.displayName || "Utilisateur"
  const email = profile?.email || user?.email || ""
  
  // Récupération du rôle (avec fallback sur 'employe')
  const role = profile?.role || "employe"

  // DÉFINITION DE LA HIÉRARCHIE
  // Sont considérés comme Admin (accès aux paramètres avancés) : Manager, Directeur, Gérant
  const isAdmin = ["manager", "directeur", "gerant"].includes(role)

  // Fonction pour afficher le nom du rôle proprement
  const formatRole = (r: string) => {
    switch(r) {
      case "gerant": return "Gérant"
      case "directeur": return "Directeur"
      case "manager": return "Manager"
      case "assistant_manager": return "Assistant Manager"
      default: return "Employé"
    }
  }

  const handleLogout = async () => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>

        {/* Carte de Profil */}
        <div className="pulse-card p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {displayName.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg truncate">{displayName}</h2>
              <p className="text-sm text-muted-foreground truncate">{email}</p>
              <div className="flex items-center gap-2 mt-1">
                {/* Badge de Rôle */}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary capitalize">
                  {formatRole(role)}
                </span>
                
                {/* Badge Admin (si applicable) */}
                {isAdmin && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20 gap-1">
                    <Shield className="w-3 h-3" />
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Menu Général */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground ml-1">Compte</h3>
          
          <div className="pulse-card overflow-hidden">
            <Link href="/parametres/profil" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Informations personnelles</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>

            <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Notifications</p>
                </div>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>

            <Link href="/parametres/securite" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
              <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Sécurité & Mot de passe</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* Section Admin (Visible seulement si Admin : Manager, Directeur, Gérant) */}
        {isAdmin && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground ml-1">Administration</h3>
            <div className="pulse-card overflow-hidden">
              <Link href="/parametres/utilisateurs" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Gérer les utilisateurs</p>
                  <p className="text-xs text-muted-foreground">Ajouter, modifier, bloquer</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Link>

              <Link href="/parametres/objectifs" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0">
                <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                  <Settings className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Configuration Globale</p>
                  <p className="text-xs text-muted-foreground">Objectifs et Primes</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </div>
          </div>
        )}

        {/* Autres */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground ml-1">Support</h3>
          <div className="pulse-card overflow-hidden">
            <Link href="/aide" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Aide & FAQ</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
            
            <a href="mailto:support@pulseapp.com" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-500">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Contacter le support</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </a>
          </div>
        </div>

        {/* Déconnexion */}
        <Button 
          variant="ghost" 
          className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10 h-12 rounded-2xl gap-2 mt-8"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          Se déconnecter
        </Button>

        <div className="text-center text-xs text-muted-foreground pb-4">
          <p>Pulse App v1.0.2</p>
          <p>ID: {user?.uid?.substring(0, 8) || "..."}</p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
