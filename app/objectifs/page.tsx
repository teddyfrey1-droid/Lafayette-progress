"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { ProgressRing } from "@/components/pulse/progress-ring"
import { CelebrationModal } from "@/components/pulse/celebration-modal"
import { Target, ChevronRight, Sparkles, Info, TrendingUp, Loader2, Lock, EyeOff, ChevronLeft, CheckCircle2, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { useObjectives } from "@/hooks/use-objectives"
import { Badge } from "@/components/ui/badge"

// --- COMPOSANT HISTORIQUE (SÉCURISÉ) ---
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

  // Filtrage
  const principalObjective = objectives.find((o: any) => o.type === "principal" && o.isActive)
  const secondaryObjectives = objectives.filter((o: any) => (o.type === "secondaire" || !o.type) && o.isActive)

  // Gatekeeper: Si le principal n'est pas atteint, on bloque les secondaires
  const pCurrent = Number(principalObjective?.current || 0);
  const pTarget = Number(principalObjective?.target || 1);
  
  const isPrincipalMet = !principalObjective || (
      principalObjective.direction === 'descending' 
      ? pCurrent <= pTarget 
      : pCurrent >= pTarget
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // --- VUE DÉTAIL (CLIC) ---
  if (selectedObjective) {
    return (
      <ObjectiveDetailView
        objective={selectedObjective}
        onBack={() => setSelectedObjective(null)}
      />
    )
  }

  // --- VUE DASHBOARD (LISTE) ---
  
  // Calcul progression principal
  let principalProgress = 0;
  if (principalObjective) {
      if (principalObjective.direction === 'descending') {
          principalProgress = pCurrent <= pTarget ? 100 : Math.max(0, (pTarget / (pCurrent || 1)) * 100);
      } else {
          principalProgress = Math.min(100, (pCurrent / pTarget) * 100);
      }
  }

  // Prochain palier principal
  const nextPalier = principalObjective?.paliers?.find((p: any) => 
     principalObjective.direction === 'descending' ? Number(p.threshold) < pCurrent : Number(p.threshold) > pCurrent
  );

  return (
    <PermissionGate moduleId="objectifs" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Objectifs</h1>
            <p className="text-sm text-muted-foreground mt-1">Suivez votre progression et débloquez vos primes</p>
          </div>

          {/* SECTION OBJECTIF PRINCIPAL */}
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
                            Max: {(principalObjective.paliers.reduce((acc:number, p:any) => acc + Number(p.reward || 0), 0)).toLocaleString()}€
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
                        : `${pCurrent.toLocaleString()} / ${pTarget.toLocaleString()} ${principalObjective.unit}`}
                    </span>
                  </div>
                  <Progress value={principalProgress} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-accent" />
                </div>

                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Tendance</p>
                  <MockHistory target={pTarget} />
                </div>

                {nextPalier && (
                  <div className="mt-4 p-3 rounded-xl bg-muted/50 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Prochain palier</p>
                      <p className="font-medium text-sm">{nextPalier.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Cible</p>
                      <p className="font-semibold text-primary">
                        {Number(nextPalier.threshold || 0).toLocaleString()} {principalObjective.unit}
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

          {/* SECTION OBJECTIFS SECONDAIRES */}
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
                const current = Number(obj.current || 0);
                const target = Number(obj.target || 1);
                const isConfidential = obj.isConfidential || obj.hideRevenue;
                
                let progress = 0;
                if (obj.direction === 'descending') {
                    progress = current <= target ? 100 : Math.max(0, (target / (current || 1)) * 100);
                } else {
                    progress = Math.min(100, (current / target) * 100);
                }

                const nextPalierS = obj.paliers?.find((p: any) => 
                    obj.direction === 'descending' ? Number(p.threshold) < current : Number(p.threshold) > current
                );
                
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
                          {isConfidential ? `${Math.round(progress)}%` : current.toLocaleString()}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {isConfidential ? "" : `/ ${target.toLocaleString()} ${obj.unit}`}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-2 flex-1" />
                        <span className="text-sm font-semibold text-accent w-12 text-right">{Math.round(progress)}%</span>
                      </div>
                    </div>

                    {nextPalierS && !isLocked && (
                      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Prochain: <span className="font-medium text-foreground">{nextPalierS.name}</span>
                        </span>
                        <span className="text-xs font-semibold text-accent">+{nextPalierS.reward}€</span>
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

// --- VUE DÉTAIL (CLIC) ---
function ObjectiveDetailView({ objective, onBack }: { objective: any, onBack: () => void }) {
  // CRÉATION OBJET "SAFE" (Nettoyage des données pour éviter les crashs)
  const safeObj = {
      ...objective,
      current: Number(objective.current || 0),
      target: Number(objective.target || 1),
      unit: objective.unit || "",
      // Nettoyage des paliers un par un
      paliers: (objective.paliers || []).map((p:any) => ({
          ...p,
          threshold: Number(p.threshold || 0),
          reward: Number(p.reward || 0),
          name: p.name || "Palier"
      }))
  };

  const isPrimary = safeObj.type === "principal";
  const isConfidential = safeObj.isConfidential || safeObj.hideRevenue;
  
  let progress = 0;
  if (safeObj.direction === 'descending') {
      progress = safeObj.current <= safeObj.target ? 100 : Math.max(0, (safeObj.target / (safeObj.current || 1)) * 100);
  } else {
      progress = Math.min(100, (safeObj.current / safeObj.target) * 100);
  }

  const maxReward = safeObj.paliers.reduce((acc:number, p:any) => acc + p.reward, 0);
  const unlockedPaliers = safeObj.paliers.filter((p: any) => 
      safeObj.direction === 'descending' ? safeObj.current <= p.threshold : safeObj.current >= p.threshold
  ).length;

  return (
    <div className="min-h-screen bg-background pb-32 animate-in slide-in-from-right duration-300">
      <Header />
      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Bouton Retour */}
        <Button variant="ghost" onClick={onBack} className="rounded-xl -ml-2">
          <ChevronLeft className="w-4 h-4 mr-1" /> Retour
        </Button>

        {/* En-tête Objectif */}
        <div className="text-center space-y-3">
          <div className={cn("w-14 h-14 mx-auto rounded-2xl flex items-center justify-center", isPrimary ? "bg-primary/15" : "bg-accent/15")}>
            <Target className={cn("w-7 h-7", isPrimary ? "text-primary" : "text-accent")} />
          </div>
          <div>
            <span className={cn("text-xs font-medium px-3 py-1 rounded-full", isPrimary ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent")}>
              {isPrimary ? "Objectif Principal" : "Objectif Secondaire"}
            </span>
            <h1 className="text-xl font-bold mt-3">{safeObj.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{safeObj.description}</p>
          </div>
        </div>

        {/* Grosse Jauge Circulaire */}
        <div className="flex justify-center py-4">
          <ProgressRing
            progress={progress}
            size={130}
            strokeWidth={10}
            showPercentage={true}
            // SÉCURITÉ : .toLocaleString() est appliqué sur des Nombres garantis
            sublabel={isConfidential 
                ? "Données masquées" 
                : `${safeObj.current.toLocaleString()} / ${safeObj.target.toLocaleString()} ${safeObj.unit}`}
          />
        </div>

        {/* Grille de Stats (Comme v0.pdf) */}
        <div className="grid grid-cols-3 gap-3">
          <div className="pulse-card p-3 text-center">
            <p className="text-lg font-bold">{isConfidential ? "?" : maxReward}€</p>
            <p className="text-xs text-muted-foreground">Prime max</p>
          </div>
          <div className="pulse-card p-3 text-center">
            <p className="text-lg font-bold">{safeObj.paliers.length}</p>
            <p className="text-xs text-muted-foreground">Paliers</p>
          </div>
          <div className="pulse-card p-3 text-center">
            <p className="text-lg font-bold">{unlockedPaliers}</p>
            <p className="text-xs text-muted-foreground">Débloqués</p>
          </div>
        </div>

        {/* Historique Graphique */}
        <div>
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Historique de progression
            </h3>
            <div className="h-32 flex items-end gap-2 px-2 border-b border-border/50 pb-2">
                {(safeObj.history && safeObj.history.length > 0 ? safeObj.history.slice(-7) : []).map((h:any, i:number) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full bg-muted rounded-t-sm relative h-full flex items-end overflow-hidden">
                            <div 
                                className="w-full bg-primary transition-all duration-500 group-hover:bg-primary/80"
                                style={{ height: `${Math.min(100, ( (Number(h.value) || 0) / safeObj.target ) * 100)}%` }}
                            />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{h.date?.split(' ')[0]}</span>
                    </div>
                ))}
                {(!safeObj.history || safeObj.history.length === 0) && (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground italic bg-muted/20 rounded-xl">
                        Pas d'historique disponible
                    </div>
                )}
            </div>
        </div>

        {/* Timeline Verticale (Implémentée en dur pour éviter les bugs externes) */}
        <section className="space-y-4 pt-2">
          <h2 className="font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Paliers à atteindre
          </h2>
          
          <div className="relative pl-2 space-y-0">
             {/* Ligne verticale */}
             <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-border -z-10" />

             {safeObj.paliers.sort((a:any, b:any) => a.threshold - b.threshold).map((palier: any, index: number) => {
                 const isReached = safeObj.direction === 'descending' ? safeObj.current <= palier.threshold : safeObj.current >= palier.threshold;
                 
                 return (
                     <div key={index} className="flex items-start gap-4 py-3 group">
                         {/* Cercle Indicateur */}
                         <div className={cn(
                             "w-10 h-10 rounded-full flex items-center justify-center border-4 shrink-0 transition-all z-10",
                             isReached 
                                 ? "bg-primary border-background text-white shadow-md shadow-primary/20 scale-110" 
                                 : "bg-background border-muted text-muted-foreground"
                         )}>
                             {isReached ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                         </div>

                         {/* Carte Palier */}
                         <div className={cn(
                             "flex-1 p-3 rounded-xl border transition-all",
                             isReached ? "bg-primary/5 border-primary/20" : "bg-card border-border"
                         )}>
                             <div className="flex justify-between items-start mb-1">
                                 <span className={cn("font-bold text-sm", isReached && "text-primary")}>{palier.name}</span>
                                 <Badge variant={isReached ? "default" : "outline"} className="text-[10px] h-5">
                                     {isReached ? "Débloqué" : "Verrouillé"}
                                 </Badge>
                             </div>
                             <div className="flex justify-between items-center text-xs mt-2">
                                 <span className="text-muted-foreground">Objectif: <strong className="text-foreground">{palier.threshold.toLocaleString()} {safeObj.unit}</strong></span>
                                 <span className="font-bold text-primary">+{palier.reward}€</span>
                             </div>
                         </div>
                     </div>
                 )
             })}

             {safeObj.paliers.length === 0 && (
                 <p className="text-sm text-muted-foreground italic pl-8">Aucun palier configuré.</p>
             )}
          </div>
        </section>

      </main>
      <BottomNav />
    </div>
  )
}
