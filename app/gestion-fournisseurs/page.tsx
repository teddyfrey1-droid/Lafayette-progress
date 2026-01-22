"use client"

import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { useRBAC } from "@/components/auth/rbac-provider"
import { 
  Truck, Laptop2, Shield, ChevronRight, Lock, KeyRound, 
  Settings2, Boxes
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function GestionHubPage() {
  const { can, userRole, loading } = useRBAC()

  // Lien dynamique pour la gestion des droits
  const accessManagementLink = userRole === 'super_admin' ? '/centre-controle/acces' : '/gestion/acces';

  if (loading) return <div className="min-h-screen bg-background" />

  return (
    <PermissionGate moduleId="dashboard" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-lg mx-auto space-y-8">
          
          {/* En-tête avec un style plus "Dashboard" */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white shadow-xl">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/5 blur-2xl" />
            <div className="relative z-10">
                <h1 className="text-2xl font-bold tracking-tight mb-1">Hub de Gestion</h1>
                <p className="text-sm text-gray-300">
                  Pilotage des opérations et de l'administration.
                </p>
            </div>
          </div>

          {/* --- ZONE OPÉRATIONNELLE --- */}
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                <Boxes className="w-4 h-4" /> Opérations & Logistique
            </h2>

            {/* 1. Fournisseurs (Grande Carte) */}
            {can("fournisseurs", "view") && (
                <Link href="/fournisseurs" className="block group">
                    <div className="pulse-card relative overflow-hidden p-5 transition-all hover:shadow-lg hover:border-blue-500/30 group-active:scale-[0.99]">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Truck className="w-24 h-24 text-blue-600" />
                        </div>
                        
                        <div className="relative z-10 flex items-start gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-600 shadow-sm border border-blue-500/10">
                                <Truck className="w-7 h-7" />
                            </div>
                            <div className="flex-1 pt-1">
                                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                                    Fournisseurs
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                    Annuaire, jours de livraison et conditions de commande.
                                </p>
                            </div>
                            <div className="self-center">
                                <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-blue-500 transition-colors" />
                            </div>
                        </div>
                    </div>
                </Link>
            )}

            {/* 2. Sites Admin (Carte Secondaire) */}
            {(can("parametres", "access") || userRole === 'manager' || userRole === 'gerant') && (
                <Link href="/gestion-fournisseurs/admin-sites" className="block group">
                    <div className="pulse-card p-4 flex items-center gap-4 hover:bg-amber-500/5 transition-all hover:border-amber-500/30 active:scale-[0.98]">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-600 border border-amber-500/10">
                            <Laptop2 className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base text-foreground">Sites Admin & Outils</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Dood, Mal, Plateformes...</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-amber-500 transition-colors" />
                    </div>
                </Link>
            )}
          </div>

          {/* --- ZONE ADMINISTRATION RH (Gérant / Super Admin) --- */}
          {can("equipes", "manage_permissions") && (
            <div className="space-y-4 pt-2">
                <h2 className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                    <Shield className="w-4 h-4" /> Administration RH
                </h2>

                <Link 
                    href={accessManagementLink}
                    className="block group"
                >
                    <div className="pulse-card p-1 bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-transparent border-purple-500/20 hover:border-purple-500/40 transition-all">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-card/80 backdrop-blur-sm">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shrink-0 text-white shadow-md">
                                <KeyRound className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="font-bold text-base text-foreground">Gestion des Droits</h3>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
                                        ADMIN
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-snug">
                                    Configurer les accès et permissions de l'équipe par rôle.
                                </p>
                            </div>
                            <Settings2 className="w-5 h-5 text-muted-foreground/50 group-hover:text-purple-500 transition-colors" />
                        </div>
                    </div>
                </Link>
            </div>
          )}

        </main>
        <BottomNav />
      </div>
    </PermissionGate>
  )
}
