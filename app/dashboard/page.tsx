"use client"

import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { MainGauge } from "@/components/pulse/main-gauge"
import { CountdownTimer } from "@/components/pulse/countdown-timer"
import { useCurrentUser } from "@/lib/use-current-user" 
import { useObjectives } from "@/hooks/use-objectives" // On utilise le vrai hook
import { Coins, Target, TrendingUp, Clock, Loader2 } from "lucide-react"
import Link from "next/link"
import { PermissionGate } from "@/components/auth/permission-gate"
import { useAuth } from "@/components/auth/auth-provider" // Pour l'état de chargement

export default function DashboardPage() {
  const { user: authUser, loading: authLoading } = useAuth()
  const user = useCurrentUser()
  const { objectives, loading: objLoading } = useObjectives()
  
  // 1. Gestion du Prénom (fallback intelligent)
  // Si useCurrentUser n'a pas encore le nom, on regarde l'objet Auth direct
  const displayName = user?.displayName || authUser?.displayName || "";
  const firstName = displayName.split(" ")[0] || "L'équipe";

  // 2. Calculs Temps Réel
  // Heures contractuelles (Défaut 35h si non défini)
  const userHours = user?.contractHours ? Number(user.contractHours) : 35;
  const baseHours = 35;
  const ratio = userHours / baseHours;

  // Calcul dynamique basé sur les objectifs Firebase
  const stats = objectives.reduce((acc, obj) => {
    // Si l'objectif est actif
    if (obj.isActive) {
       acc.totalObjectives++;
       acc.totalPotential += obj.reward; // Récompense totale possible
       
       // Calcul progression pondérée
       const progressPercent = Math.min(100, Math.max(0, (obj.currentValue / obj.targetValue) * 100));
       acc.globalProgress += progressPercent;

       // Si débloqué (logique à adapter selon vos règles, ex: si progress 100%)
       if (progressPercent >= 100) {
         acc.unlockedAmount += obj.reward;
       }
    }
    return acc;
  }, { totalPotential: 0, unlockedAmount: 0, globalProgress: 0, totalObjectives: 0 });

  // Moyenne de progression pour la jauge
  const mainProgress = stats.totalObjectives > 0 ? stats.globalProgress / stats.totalObjectives : 0;

  // Application du Pro-Rata (Heures contrat)
  const potentialProRata = stats.totalPotential * ratio;
  const unlockedProRata = stats.unlockedAmount * ratio;
  const pendingProRata = potentialProRata - unlockedProRata;

  // Configuration dates
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);

  if (authLoading || objLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>
  }

  return (
    <PermissionGate moduleId="dashboard" redirect>
      <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto">
        {/* Header Bonjour */}
        <div className="text-center mb-6">
          <p className="text-lg font-medium text-muted-foreground mb-1">
            Bonjour, {firstName} 👋
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Objectif du mois</h1>
           {/* Affichage des heures contrat pour info user */}
          <p className="text-xs text-muted-foreground mt-2 border border-border bg-secondary/50 rounded-full px-3 py-1 inline-block">
            Base contrat : {userHours}h {userHours !== 35 && "(Ajusté)"}
          </p>
        </div>

        {/* Jauge Principale */}
        <div className="flex justify-center mb-6">
          <MainGauge
            progress={mainProgress}
            unlockedAmount={unlockedProRata} // Montant ajusté aux heures
            pendingAmount={pendingProRata}
            size={220}
            strokeWidth={14}
          />
        </div>

        {/* Compte à rebours */}
        <div className="mb-8">
          <CountdownTimer targetDate={endOfMonth} />
        </div>

        {/* Grille de Statistiques */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Acquis</p>
            </div>
            {/* Affichage dynamique */}
            <p className="text-xl font-bold text-foreground">{unlockedProRata.toFixed(2)}€</p>
            <p className="text-xs text-muted-foreground">Sur votre paie</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Objectifs</p>
            </div>
            <p className="text-xl font-bold text-foreground">{stats.totalObjectives}</p>
            <p className="text-xs text-muted-foreground">Actifs ce mois</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Potentiel</p>
            </div>
            <p className="text-xl font-bold text-foreground">{potentialProRata.toFixed(2)}€</p>
            <p className="text-xs text-muted-foreground">Max possible ({userHours}h)</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Mise à jour</p>
            </div>
            <p className="text-xl font-bold text-foreground">Live</p>
            <p className="text-xs text-muted-foreground">Temps réel</p>
          </div>
        </div>

        {/* ... Liens de navigation (inchangés) ... */}
         <div className="space-y-2">
          <Link
            href="/objectifs"
            className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Voir les objectifs</p>
                <p className="text-xs text-muted-foreground">{stats.totalObjectives} actifs ce mois</p>
              </div>
            </div>
            {/* Petite jauge mini */}
             <div className="flex items-center gap-3">
               <span className="text-xs font-bold">{Math.round(mainProgress)}%</span>
               <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                 <div className="h-full bg-primary" style={{ width: `${mainProgress}%` }} />
               </div>
            </div>
          </Link>

          <Link
            href="/primes"
            className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Coins className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Historique des primes</p>
                <p className="text-xs text-muted-foreground">Consultez vos primes passées</p>
              </div>
            </div>
             <Coins className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
    </PermissionGate>
  )
}
