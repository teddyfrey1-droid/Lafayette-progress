"use client"

import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { useRBAC } from "@/components/auth/rbac-provider" // ✅ Nouveau système
import { 
  Truck, Globe, Laptop2, Shield, ChevronRight, Lock, Users, KeyRound 
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function GestionHubPage() {
  const { can, userRole, loading } = useRBAC()

  // Détermination du lien de gestion des droits selon le rôle
  // Super Admin -> Centre de Contrôle (Tout)
  // Gérant -> Gestion (Ses équipes)
  const accessManagementLink = userRole === 'super_admin' ? '/centre-controle/acces' : '/gestion/acces';

  if (loading) return <div className="min-h-screen bg-background" />

  return (
    // On laisse l'accès large (dashboard) car le filtrage se fait à l'intérieur
    <PermissionGate moduleId="dashboard" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-lg mx-auto space-y-8">
          
          {/* Header de la page */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestion & Ressources</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Plateforme centrale des outils et de l'administration.
            </p>
          </div>

          {/* --- SECTION 1 : OPÉRATIONNEL (Tout le monde selon droits) --- */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1 mb-2">
                Outils du quotidien
            </h2>

            {/* 1. Fournisseurs */}
            {can("fournisseurs", "view") && (
                <Link href="/fournisseurs" className="block">
                    <div className="pulse-card p-4 flex items-center gap-4 hover:bg-muted/40 transition-all active:scale-[0.98]">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-600">
                            <Truck className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base text-foreground">Fournisseurs</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Commandes, livraisons et contacts</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                </Link>
            )}

            {/* 2. Sites Utiles */}
            {can("sites_utiles", "view") && (
                <Link href="/sites-contacts-utiles" className="block">
                    <div className="pulse-card p-4 flex items-center gap-4 hover:bg-muted/40 transition-all active:scale-[0.98]">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-600">
                            <Globe className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base text-foreground">Sites & Contacts</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Ressources externes, CAF, Santé...</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                </Link>
            )}

            {/* 3. Sites Admin (Réservé) */}
            {/* On affiche si on a accès aux params OU si on est manager */}
            {(can("parametres", "access") || userRole === 'manager' || userRole === 'gerant') && (
                <Link href="/gestion-fournisseurs/admin-sites" className="block">
                    <div className="pulse-card p-4 flex items-center gap-4 hover:bg-muted/40 transition-all active:scale-[0.98]">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-600">
                            <Laptop2 className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-base text-foreground">Sites Admin</h3>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold border border-amber-200">RESTREINT</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Plateformes de livraison & Outils internes</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                </Link>
            )}
          </section>

          {/* --- SECTION 2 : ADMINISTRATION RH (Gérant / Super Admin) --- */}
          {/* C'est ici que se trouve le bouton "Puissant" que vous vouliez */}
          {can("equipes", "manage_permissions") && (
            <section className="space-y-3 pt-2">
                <div className="flex items-center gap-2 mb-2 ml-1">
                    <Shield className="w-4 h-4 text-primary" />
                    <h2 className="text-xs font-bold text-primary uppercase tracking-wider">
                        Administration RH
                    </h2>
                </div>

                <Link 
                    href={accessManagementLink}
                    className="pulse-card p-5 flex items-center gap-4 hover:bg-muted/40 transition-all active:scale-[0.98] border-primary/30 bg-primary/5 shadow-sm"
                >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-primary text-white shadow-md shadow-primary/20">
                        <KeyRound className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                            Gestion des Droits
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                            Contrôle total des permissions par rôle.<br/>
                            <span className="opacity-80">Définissez qui peut voir, modifier ou supprimer.</span>
                        </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-primary" />
                </Link>

                {/* Optionnel : Raccourci vers l'équipe si pas déjà dans la nav */}
                <Link 
                    href="/equipe"
                    className="pulse-card p-4 flex items-center gap-4 hover:bg-muted/40 transition-all active:scale-[0.98]"
                >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 text-purple-600">
                        <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-foreground">Annuaire de l'équipe</h3>
                        <p className="text-xs text-muted-foreground">Liste des membres et contrats</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </Link>
            </section>
          )}

        </main>
        <BottomNav />
      </div>
    </PermissionGate>
  )
}
