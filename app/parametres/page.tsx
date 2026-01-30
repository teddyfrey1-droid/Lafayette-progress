"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { 
  User, Shield, Link as LinkIcon, Sliders, Users, Moon, Bell, 
  Palette, HelpCircle, LogOut, ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"

export default function SettingsPage() {
  const { profile, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  // Calcul des initiales
  const initials = profile?.displayName 
    ? profile.displayName.split(" ").map((n:string) => n[0]).join("").substring(0, 2).toUpperCase()
    : (profile?.email?.substring(0, 2).toUpperCase() || "??")

  // Vérification rôle admin/gérant
  const isAdmin = ['admin', 'super_admin', 'gerant'].includes(profile?.role || '');

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-8">
        
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gérez votre compte et préférences</p>
        </div>

        {/* SECTION COMPTE */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Compte</h2>
            
            {/* Carte Profil */}
            <div className="pulse-card p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors">
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
            </div>

            {/* Menu Sécurité (Correction du lien) */}
            <div className="pulse-card overflow-hidden">
                <MenuItem 
                    icon={Shield} 
                    label="Sécurité" 
                    subLabel="Mot de passe et authentification"
                    onClick={() => router.push('/parametres/securite')}
                />
            </div>
        </section>

        {/* SECTION ADMINISTRATION */}
        {isAdmin && (
            <section className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Administration</h2>
                <div className="pulse-card overflow-hidden divide-y divide-border/50">
                    <MenuItem 
                        icon={LinkIcon} 
                        label="Intégrations API" 
                        subLabel="Combo, Zelty, Uber Eats..."
                        onClick={() => router.push('/parametres/integrations-api')}
                    />
                    <MenuItem 
                        icon={Sliders} 
                        label="Configuration objectifs" 
                        subLabel="Paramètres avancés des objectifs"
                        onClick={() => router.push('/parametres/objectifs')}
                    />
                    <MenuItem 
                        icon={Users} 
                        label="Utilisateurs & Rôles" 
                        subLabel="Gérer les accès et permissions"
                        onClick={() => router.push('/parametres/utilisateurs')}
                    />
                </div>
            </section>
        )}

        {/* PRÉFÉRENCES */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Préférences</h2>
            <div className="pulse-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500"><Moon className="w-4 h-4" /></div>
                    <div><p className="font-medium text-sm">Mode sombre</p><p className="text-xs text-muted-foreground">Apparence de l'application</p></div>
                </div>
                <Switch checked={theme === 'dark'} onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} />
            </div>
        </section>

        {/* SECTION SUPPORT */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Support</h2>
            <div className="pulse-card overflow-hidden divide-y divide-border/50">
                <MenuItem icon={Bell} label="Notifications" subLabel="Gérer les alertes" />
                <MenuItem icon={Palette} label="Thème" subLabel="Personnaliser l'apparence" />
                <MenuItem icon={HelpCircle} label="Aide" subLabel="FAQ et documentation" />
            </div>
        </section>

        {/* DÉCONNEXION */}
        <div className="pt-4 text-center pb-6">
            <Button variant="destructive" className="w-full h-12 rounded-xl" onClick={() => signOut()}>
                <LogOut className="w-4 h-4 mr-2" /> Se déconnecter
            </Button>
            <p className="text-xs text-muted-foreground font-medium mt-4">Pulse v2.0.0 - Janvier 2026</p>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}

function MenuItem({ icon: Icon, label, subLabel, onClick }: any) {
    return (
        <button onClick={onClick} className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-foreground"><Icon className="w-4 h-4" /></div>
                <div><p className="font-medium text-sm">{label}</p>{subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </button>
    )
}
