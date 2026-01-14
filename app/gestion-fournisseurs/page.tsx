"use client"

import { Header } from "@/components/pulse/header"
import { useAuth } from "@/components/pulse/auth/auth-provider"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { Truck, ChevronRight, Globe, Settings, Lock } from "lucide-react"
import Link from "next/link"
import { profile } from "@/lib/demo-data"

export default function GestionFournisseursPage() {
  const { profile } = useAuth()
  const isAdmin = (profile?.role || "") === "admin" || (profile?.role || "") === "manager"

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion & Fournisseurs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gérez vos fournisseurs et outils internes</p>
        </div>

        {/* Main Links */}
        <section className="space-y-3">
          <Link href="/fournisseurs" className="block">
            <div className="pulse-card p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/10 flex items-center justify-center">
                  <Truck className="w-7 h-7 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1">Fournisseurs</h3>
                  <p className="text-xs text-muted-foreground">
                    Livraisons, délais, commerciaux et conditions de commande
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </Link>

          <Link href="/sites-contacts-utiles" className="block">
            <div className="pulse-card p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/15 to-blue-600/10 flex items-center justify-center">
                  <Globe className="w-7 h-7 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1">Sites & Contacts utiles</h3>
                  <p className="text-xs text-muted-foreground">CAF, impôts, santé et autres ressources utiles</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </Link>

          {isAdmin && (
            <Link href="/gestion-fournisseurs/admin-sites" className="block">
              <div className="pulse-card p-5 hover:shadow-lg transition-shadow border-primary/20">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center">
                    <Settings className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base">Sites Admin</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        ADMIN
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Dood, Mal, outils internes et plateformes de livraison
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </Link>
          )}
        </section>

        {/* Info */}
        <div className="pulse-card p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Cette section regroupe tous les outils de gestion et les contacts de vos fournisseurs pour faciliter vos
            commandes et suivis de livraisons.
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
