"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { ProgressRing } from "@/components/pulse/progress-ring"
import { PalierTimeline } from "@/components/pulse/palier-timeline"
import { CelebrationModal } from "@/components/pulse/celebration-modal"
import { Target, ChevronRight, Sparkles, Info, TrendingUp, Loader2, Lock, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { useObjectives } from "@/hooks/use-objectives"
import { Badge } from "@/components/ui/badge"

const MockHistory = ({ target }: { target: number }) => (
  <div className="flex items-end gap-1 h-12 mt-4 opacity-70">
     {[40, 50, 65, 70, 55, 80, 75].map((h, i) => (
         <div key={i} className="flex-1 bg-primary/20 rounded-t-sm" style={{ height: `${h}%` }}></div>
     ))}
  </div>
)

export default function ObjectivesPage() {
  const { objectives, loading } = useObjectives()
  const [selectedObjective, setSelectedObjective] = useState<any | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)

  const principalObjective = objectives.find((o: any) => o.type === "principal" && o.isActive)
  const secondaryObjectives = objectives.filter((o: any) => (o.type === "secondaire" || !o.type) && o.isActive)

  const isPrincipalMet = !principalObjective || (
      principalObjective.direction === 'descending' 
      ? (principalObjective.current || 0) <= (principalObjective.target || 1) 
      : (principalObjective.current || 0) >= (principalObjective.target || 1)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (selectedObjective) {
    return (
      <ObjectiveDetail
        objective={selectedObjective}
        onBack={() => setSelectedObjective(null)}
      />
    )
  }

  // SÉCURITÉ : On utilise des valeurs par défaut pour éviter le crash
  const currentP = principalObjective?.current || 0;
  const targetP = principalObjective?.target || 1;
  const nextPalier = principalObjective?.paliers?.find((p: any) => 
     principalObjective.direction === 'descending' ? p.threshold < currentP : p.threshold > currentP
  );
  
  let principalProgress = 0;
  if (principalObjective) {
      if (principalObjective.direction === 'descending') {
          principalProgress = currentP <= targetP ? 100 : Math.max(0, (targetP / (currentP || 1)) * 100);
      } else {
          principalProgress = Math.min(100, (currentP / targetP) * 100);
      }
  }

  return (
    <PermissionGate moduleId="objectifs" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Objectifs</h1>
            <p className="text-sm text-muted-foreground mt-1">Suivez votre progression et débloquez vos primes</p>
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Objectif Principal</h2>
            </div>

            {principalObjective ? (
              <div
                className="pulse-card p-5 cursor-pointer border-primary/30 hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedObjective(principalObjective)}
              >
                <div className="flex flex-col items-center text-center mb-4">
                  <ProgressRing 
                    progress={principalProgress} 
                    size={100} 
                    strokeWidth={8} 
                    showPercentage={!principalObjective.isConfidential} 
                  />
                  <h3 className="font-semibold mt-3">{principalObjective.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{principalObjective.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">Principal</span>
                    {!principalObjective.isConfidential && principalObjective.paliers && (
                        <span className="text-xs text-muted-foreground">
                            Max: {(principalObjective.paliers.reduce((acc:number, p:any) => acc + (p.reward || 0), 0) || 0)}€
                        </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="font-semibold">
                      {principalObjective.isConfidential 
                        ? <span className="flex items-center gap-1 italic opacity-70"><EyeOff className="w-3 h-3"/> Masqué</span> 
                        : `${(currentP || 0).toLocaleString()} / ${(targetP || 0).toLocaleString()} ${principalObjective.unit}`}
                    </span>
                  </div>
                  <Progress value={principalProgress} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-accent" />
                </div>

                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Tendance</p>
                  <MockHistory target={targetP} />
                </div>

                {/* SÉCURITÉ : Protection de l'affichage du palier */}
                {nextPalier && (
                  <div className="mt-4 p-3 rounded-xl bg-muted/50 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Prochain palier</p>
                      <p className="font-medium text-sm">{nextPalier.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Cible</p>
                      <p className="font-semibold text-primary">
                        {/* 🛑 C'est ici que ça plantait : on sécurise avec ( || 0) */}
                        {(nextPalier.threshold || 0).toLocaleString()} {principalObjective.unit}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ) : (
                <div className="pulse-card p-8 text-center text-muted-foreground">
                    <Target className="w-10 h-10 mx-auto mb-2 opacity-50"/>
                    <p>Aucun objectif principal configuré.</p>
                </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-accent" />
                <h2 className="font-semibold">Objectifs Secondaires</h2>
              </div>
              <span className="text-xs text-muted-foreground">{secondaryObjectives.length} actifs</span>
            </div>

            <div className="grid gap-3">
              {secondaryObjectives.map((obj: any) => {
                // SÉCURITÉ
                const current = obj.current || 0;
                const target = obj.target || 1;
                
                let progress = 0;
                if (obj.direction === 'descending') {
                    progress = current <= target ? 100 : Math.max(0, (target / (current || 1)) * 100);
                } else {
                    progress = Math.min(100, (current / target) * 100);
                }

                const nextPalier = obj.paliers?.find((p: any) => p.threshold > current)
                const isLocked = !isPrincipalMet; 

                return (
                  <div 
                    key={obj.id} 
                    className={cn("pulse-card p-4 cursor-pointer transition-all", isLocked ? "opacity-60 grayscale-[0.5]" : "hover:shadow-md")}
                    onClick={() => !isLocked && setSelectedObjective(obj)}
                  >
                    <div className="text-center mb-3">
                      <div className="flex justify-center mb-2">
                        <div className="p-2 rounded-xl bg-accent/15 relative">
                          <TrendingUp className="w-4 h-4 text-accent" />
                          {isLocked && <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5"><Lock className="w-2.5 h-2.5 text-white"/></div>}
                        </div>
                      </div>
                      <h3 className="font-semibold text-sm">{obj.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">{obj.description}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-bold">
                          {obj.isConfidential ? `${Math.round(progress)}%` : (current || 0).toLocaleString()}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {obj.isConfidential ? "" : `/ ${(target || 0).toLocaleString()} ${obj.unit}`}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-2 flex-1" />
                        <span className="text-sm font-semibold text-accent w-12 text-right">{Math.round(progress)}%</span>
                      </div>
                    </div>

                    {nextPalier && !isLocked && (
                      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Prochain: <span className="font-medium text-foreground">{nextPalier.name}</span>
                        </span>
                        <span className="text-xs font-semibold text-accent">+{nextPalier.reward}€</span>
                      </div>
                    )}
                    {isLocked && (
                        <div className="mt-3 pt-3 border-t border-border/50 text-center">
                            <span className="text-xs font-bold text-amber-600 flex items-center justify-center gap-1">
                                <Lock className="w-3 h-3"/> En attente du principal
                            </span>
                        </div>
                    )}
                  </div>
                )
              })}

              {secondaryObjectives.length === 0 && (
                  <p className="text-sm text-center text-muted-foreground py-4">Aucun objectif secondaire pour le moment.</p>
              )}
            </div>
          </section>

          <div className="pulse-card p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Les paliers se débloquent automatiquement. Les primes secondaires ne sont validées que si l'objectif principal est atteint.
              </p>
            </div>
          </div>
        </main>
        <BottomNav />
        <CelebrationModal open={showCelebration} onClose={() => setShowCelebration(false)} title="Succès !" subtitle="Palier débloqué" type="achievement" />
      </div>
    </PermissionGate>
  )
}

function ObjectiveDetail({ objective, onBack }: { objective: any, onBack: () => void }) {
  const isPrimary = objective.type === "principal"
  // SÉCURITÉ : Valeurs par défaut
  const current = objective.current || 0;
  const target = objective.target || 1;
  const isConfidential = objective.isConfidential || objective.hideRevenue;
  
  let progress = 0;
  if (objective.direction === 'descending') {
      progress = current <= target ? 100 : Math.max(0, (target / (current || 1)) * 100);
  } else {
      progress = Math.min(100, (current / target) * 100);
  }

  const maxReward = objective.paliers?.reduce((acc:number, p:any) => acc + (p.reward || 0), 0) || 0;
  const unlockedPaliers = objective.paliers?.filter((p: any) => 
      objective.direction === 'descending' ? current <= p.threshold : current >= p.threshold
  ).length || 0;

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />
      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <Button variant="ghost" onClick={onBack} className="rounded-xl -ml-2">
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Retour
        </Button>

        <div className="text-center space-y-3">
          <div className={cn("w-14 h-14 mx-auto rounded-2xl flex items-center justify-center", isPrimary ? "bg-primary/15" : "bg-accent/15")}>
            <Target className={cn("w-7 h-7", isPrimary ? "text-primary" : "text-accent")} />
          </div>
          <div>
            <span className={cn("text-xs font-medium px-3 py-1 rounded-full", isPrimary ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent")}>
              {isPrimary ? "Objectif Principal" : "Objectif Secondaire"}
            </span>
            <h1 className="text-xl font-bold mt-3">{objective.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{objective.description}</p>
          </div>
        </div>

        <div className="flex justify-center py-4">
          <ProgressRing
            progress={progress}
            size={130}
            strokeWidth={10}
            showPercentage={true}
            // SÉCURITÉ : .toLocaleString() protégé
            sublabel={isConfidential 
                ? "Données masquées" 
                : `${(current || 0).toLocaleString()} / ${(target || 0).toLocaleString()} ${objective.unit}`}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="pulse-card p-3 text-center">
            <p className="text-lg font-bold">{isConfidential ? "?" : maxReward}€</p>
            <p className="text-xs text-muted-foreground">Prime max</p>
          </div>
          <div className="pulse-card p-3 text-center">
            <p className="text-lg font-bold">{objective.paliers?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Paliers</p>
          </div>
          <div className="pulse-card p-3 text-center">
            <p className="text-lg font-bold">{unlockedPaliers}</p>
            <p className="text-xs text-muted-foreground">Débloqués</p>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Paliers de récompense
          </h2>
          {/* On passe l'objectif sécurisé */}
          <PalierTimeline objective={{...objective, current}} />
        </section>

        <div className="pulse-card p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Continuez vos efforts ! Les mises à jour sont effectuées quotidiennement par votre manager.
            </p>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
