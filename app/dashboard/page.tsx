"use client"

import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { MainGauge } from "@/components/pulse/main-gauge"
import { CountdownTimer } from "@/components/pulse/countdown-timer"
import { useCurrentUser } from "@/lib/use-current-user" 
import { useObjectives } from "@/hooks/use-objectives" 
import { Coins, Target, TrendingUp, Clock, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { PermissionGate } from "@/components/auth/permission-gate"
import { useAuth } from "@/components/auth/auth-provider"

export default function DashboardPage() {
  const { loading: authLoading } = useAuth()
  const user = useCurrentUser()
  const { objectives, loading: objLoading } = useObjectives()
  
  // 1. Récupération du prénom
  const firstName = user.firstName || "Collaborateur";

  // 2. Calcul du Pro-Rata (Heures contrat vs 35h)
  const userHours = user.contractHours || 35;
  const baseHours = 35;
  const ratio = userHours / baseHours;

  // 3. Calculs dynamiques (Moteur Financier)
  const stats = objectives.reduce((acc: any, obj: any) => {
    if (obj.isActive) {
       acc.totalObjectives++;
       
       // Le potentiel MAX de cet objectif
       const maxReward = obj.reward || 0;
       acc.totalPotential += maxReward;

       // ⚠️ CORRECTION 1 : Sécurisation de la variable (supporte 'progress' et 'current')
       const currentVal = obj.progress ?? obj.current ?? 0;
       const targetVal = obj.target || 1;

       // --- NOUVEAU : CALCUL DE LA PROGRESSION LISSÉE (VISUELLE) ---
       // On calcule un % d'avancement (0 à 1) pour faire bouger la jauge en continu
       let objRatio = 0;
       if (obj.direction === 'descending') {
           // Cas descendant (ex: moins d'erreurs = mieux)
           objRatio = currentVal <= targetVal 
              ? 1 
              : Math.max(0, targetVal / (currentVal || 1));
       } else {
           // Cas classique (plus de ventes = mieux)
           objRatio = Math.min(1, Math.max(0, currentVal / targetVal));
       }
       
       // On ajoute cette "progression virtuelle" au total pondéré
       acc.totalWeightedProgress += (objRatio * maxReward);

       // --- CALCUL DE L'ARGENT RÉEL (PALIERS) ---
       // (Reste identique pour l'affichage "Acquis" en euros)
       let unlockedForThisObj = 0;
       const isDescending = obj.direction === 'descending';

       if (obj.paliers && obj.paliers.length > 0) {
         obj.paliers.forEach((p: any) => {
             const thresholdReached = isDescending 
                ? (currentVal <= p.threshold && currentVal !== 0) 
                : currentVal >= p.threshold; 

             if (thresholdReached) {
                 unlockedForThisObj += p.reward;
             }
         });
       } else {
         const targetReached = isDescending
            ? (currentVal <= targetVal && currentVal !== 0)
            : currentVal >= targetVal;
            
         if (targetReached) {
             unlockedForThisObj += maxReward;
         }
       }

       acc.unlockedAmount += unlockedForThisObj;
    }
    return acc;
  }, { totalPotential: 0, unlockedAmount: 0, totalObjectives: 0, totalWeightedProgress: 0 });

  // 4. Calcul du pourcentage GLOBAL (Basé sur la progression pondérée)
  // ⚠️ CORRECTION 2 : On utilise le progrès pondéré au lieu de l'argent débloqué
  const mainProgress = stats.totalPotential > 0 
    ? (stats.totalWeightedProgress / stats.totalPotential) * 100 
    : 0;
  
  // 5. Application du Ratio heures
  const potentialProRata = stats.totalPotential * ratio;
  const unlockedProRata = stats.unlockedAmount * ratio;
  const pendingProRata = potentialProRata - unlockedProRata;

  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);
  const currentMonth = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  if (authLoading || objLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    )
  }

  return (
    <PermissionGate moduleId="dashboard" redirect>
      <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <p className="text-lg font-medium text-muted-foreground mb-1">
            Bonjour, {firstName} 👋
          </p>
          <h1 className="text-3xl font-bold tracking-tight capitalize">{currentMonth}</h1>
          
          {userHours !== 35 && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-xs text-accent font-medium">
                <AlertCircle className="w-3 h-3" />
                Base contrat : {userHours}h (Calcul ajusté)
            </div>
          )}
        </div>

        {/* Jauge Principale */}
        <div className="flex justify-center mb-6">
          <MainGauge
            progress={mainProgress} 
            unlockedAmount={unlockedProRata} 
            pendingAmount={pendingProRata}
            size={220}
            strokeWidth={14}
          />
        </div>

        <div className="mb-8">
          <CountdownTimer targetDate={endOfMonth} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Acquis</p>
            </div>
            <p className="text-xl font-bold text-foreground">{unlockedProRata.toFixed(0)}€</p>
            <p className="text-xs text-muted-foreground">Net estimé</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Objectifs</p>
            </div>
            <p className="text-xl font-bold text-foreground">{stats.totalObjectives}</p>
            <p className="text-xs text-muted-foreground">Actifs</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border">
             <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Potentiel</p>
            </div>
            <p className="text-xl font-bold text-foreground">{potentialProRata.toFixed(0)}€</p>
            <p className="text-xs text-muted-foreground">Max ({userHours}h)</p>
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

        <div className="space-y-2">
          <Link href="/objectifs" className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Voir les objectifs</p>
                <p className="text-xs text-muted-foreground">{stats.totalObjectives} actifs</p>
              </div>
            </div>
             <div className="flex items-center gap-3">
               <span className="text-xs font-bold">{Math.round(mainProgress)}%</span>
               <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                 <div className="h-full bg-primary" style={{ width: `${mainProgress}%` }} />
               </div>
            </div>
          </Link>

          <Link href="/primes" className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors">
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
