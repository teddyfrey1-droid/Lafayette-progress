"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { useObjectives } from "@/hooks/use-objectives"
import {
  Target, TrendingUp, TrendingDown, Minus, Wallet, 
  ChevronRight, Calendar, ArrowUpRight, Trophy, Crown, Lock, History, AlertCircle, EyeOff, CheckCircle2, Circle, ChevronLeft
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { ProgressRing } from "@/components/pulse/progress-ring"

export default function ObjectifsPage() {
  const { objectives, loading } = useObjectives()
  const [selectedObj, setSelectedObj] = useState<any | null>(null)

  // --- MOTEUR DE TENDANCE ---
  const getTrend = (obj: any) => {
    if (!obj.history || obj.history.length === 0) return null;
    const lastEntry = obj.history[obj.history.length - 1];
    
    if (lastEntry.change > 0) return { icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", text: `+${lastEntry.change} ${obj.unit}` };
    if (lastEntry.change < 0) return { icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20", text: `${lastEntry.change} ${obj.unit}` };
    
    return { icon: Minus, color: "text-muted-foreground", bg: "bg-muted", text: "Stable" };
  }

  // Trier : Principal en premier
  const sortedObjectives = [...objectives].sort((a, b) => {
      if (a.type === 'principal') return -1;
      if (b.type === 'principal') return 1;
      return 0;
  });

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  // Si on a sélectionné un objectif, on affiche la vue détail (comme sur votre screen mais corrigée)
  if (selectedObj) {
      return (
          <ObjectiveDetailView 
              objective={selectedObj} 
              onBack={() => setSelectedObj(null)} 
          />
      )
  }

  return (
    <PermissionGate moduleId="objectifs" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
          <div className="flex items-center justify-between">
             <div>
                <h1 className="text-2xl font-bold tracking-tight">Mes Objectifs</h1>
                <p className="text-sm text-muted-foreground">Suivez vos performances en direct</p>
             </div>
             <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                {objectives.filter((o:any) => o.isActive).length} Actifs
             </div>
          </div>

          <div className="space-y-4">
            {sortedObjectives.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Aucun objectif assigné pour le moment.</p>
                </div>
            )}

            {sortedObjectives.map((obj: any) => {
              const trend = getTrend(obj);
              
              return (
                <div 
                    key={obj.id} 
                    onClick={() => setSelectedObj(obj)}
                    className="pulse-card p-5 cursor-pointer hover:border-primary/50 transition-all relative group overflow-hidden"
                >
                  {/* Badge Tendance */}
                  {trend && (
                      <div className={cn("absolute top-4 right-4 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md shadow-sm z-10", trend.bg, trend.color)}>
                          <trend.icon className="w-3 h-3" />
                          {trend.text}
                      </div>
                  )}

                  <div className="flex items-center gap-4 mb-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", obj.type === 'principal' ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary")}>
                       {obj.type === 'principal' ? <Crown className="w-6 h-6" /> : <Target className="w-6 h-6" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                             <h3 className="font-bold text-lg">{obj.title}</h3>
                             {obj.type === 'principal' && <Badge className="bg-amber-500 text-[10px] px-1.5 h-4 hover:bg-amber-600 border-0 text-white">Principal</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{obj.description || "Objectif mensuel"}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">Progression</span>
                        <span className="font-bold">{(obj.current || 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ {obj.target} {obj.unit}</span></span>
                    </div>
                    
                    <div className="h-3 bg-muted rounded-full overflow-hidden p-[2px]">
                        <div 
                            className={cn("h-full rounded-full transition-all duration-1000 relative", obj.type === 'principal' ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-blue-500 to-purple-600")}
                            style={{ width: `${Math.min(((obj.current || 0) / (obj.target || 1)) * 100, 100)}%` }} 
                        >
                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                        </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </main>
        <BottomNav />
      </div>
    </PermissionGate>
  )
}

// --- VUE DÉTAIL CORRIGÉE ---
function ObjectiveDetailView({ objective, onBack }: { objective: any, onBack: () => void }) {
    // 1. CALCULS ROBUSTES (Pour afficher les vrais chiffres)
    const safeObj = {
        ...objective,
        current: Number(objective.current || 0),
        target: Number(objective.target || 1),
        unit: objective.unit || "",
        paliers: (objective.paliers || []).map((p:any) => ({
            ...p,
            threshold: Number(p.threshold || 0),
            reward: Number(p.reward || 0),
            name: p.name || "Palier"
        }))
    };

    const isPrimary = safeObj.type === "principal";
    const isConfidential = safeObj.isConfidential || safeObj.hideRevenue;
    
    // Calcul Progression
    let progress = 0;
    if (safeObj.direction === 'descending') {
        progress = safeObj.current <= safeObj.target ? 100 : Math.max(0, (safeObj.target / (safeObj.current || 1)) * 100);
    } else {
        progress = Math.min(100, (safeObj.current / safeObj.target) * 100);
    }

    // Calculs Primes
    const maxReward = safeObj.paliers.length > 0 
        ? safeObj.paliers.reduce((acc:number, p:any) => acc + p.reward, 0)
        : (Number(safeObj.reward) || 0);

    const unlockedAmount = safeObj.paliers.length > 0
        ? safeObj.paliers.reduce((sum: number, p: any) => {
            const isUnlocked = safeObj.direction === 'descending' 
                ? (safeObj.current <= p.threshold && safeObj.current !== 0)
                : (safeObj.current >= p.threshold);
            return isUnlocked ? sum + p.reward : sum;
        }, 0)
        : ((safeObj.current >= safeObj.target) ? maxReward : 0);

    const unlockedPaliersCount = safeObj.paliers.filter((p: any) => 
        safeObj.direction === 'descending' ? safeObj.current <= p.threshold : safeObj.current >= p.threshold
    ).length;

    // Historique Trié
    const history = [...(safeObj.history || [])].sort((a: any, b: any) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return (
        <div className="min-h-screen bg-background pb-32 animate-in slide-in-from-right duration-300">
            <Header />
            <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
                
                {/* Header Navigation */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={onBack} className="rounded-xl -ml-2 pl-0 gap-1 hover:bg-transparent hover:text-primary">
                        <ChevronLeft className="w-5 h-5" /> Retour
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground">
                       {/* Espace pour option future */}
                    </Button>
                </div>

                {/* En-tête Objectif */}
                <div className="text-center space-y-3">
                    <div className={cn("w-16 h-16 mx-auto rounded-full flex items-center justify-center shadow-lg border-4 border-background", isPrimary ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary")}>
                        {isPrimary ? <Crown className="w-8 h-8" /> : <Target className="w-8 h-8" />}
                    </div>
                    <div>
                        <Badge variant="outline" className={cn("mb-2 border-0", isPrimary ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary")}>
                            {isPrimary ? "Objectif Principal" : "Objectif Secondaire"}
                        </Badge>
                        <h1 className="text-2xl font-black tracking-tight">{safeObj.title}</h1>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">{safeObj.description}</p>
                    </div>
                </div>

                {/* Jauge Circulaire */}
                <div className="flex justify-center py-2">
                    <ProgressRing
                        progress={progress}
                        size={160}
                        strokeWidth={12}
                        showPercentage={true}
                        sublabel={isConfidential 
                            ? "Masqué" 
                            : `${safeObj.current.toLocaleString()} / ${safeObj.target.toLocaleString()} ${safeObj.unit}`}
                    />
                </div>

                {/* Grille de Stats (Les vrais chiffres !) */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-card border border-border p-3 rounded-2xl text-center shadow-sm">
                        <p className="text-lg font-bold text-foreground">{isConfidential ? "?" : maxReward}€</p>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Prime Max</p>
                    </div>
                    <div className="bg-card border border-border p-3 rounded-2xl text-center shadow-sm">
                        <p className="text-lg font-bold text-foreground">{safeObj.paliers.length}</p>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Paliers</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-center shadow-sm">
                        <p className="text-lg font-bold text-emerald-700">{unlockedAmount}€</p>
                        <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Acquis</p>
                    </div>
                </div>

                {/* Historique Graphique (Timeline) */}
                <div className="pt-2">
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" /> Historique
                    </h3>
                    
                    <div className="relative pl-3">
                        {/* Ligne verticale */}
                        <div className="absolute left-[19px] top-2 bottom-4 w-[2px] bg-gradient-to-b from-border to-transparent" />

                        {history.length > 0 ? (
                            <div className="space-y-6">
                                {history.map((h: any, i: number) => (
                                    <div key={i} className="relative flex gap-4 items-start group animate-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 50}ms` }}>
                                        {/* Point Timeline */}
                                        <div className="z-10 w-3.5 h-3.5 rounded-full bg-background border-[3px] border-primary mt-1.5 shrink-0 shadow-sm ring-4 ring-background" />
                                        
                                        <div className="flex-1 bg-card border border-border/60 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-semibold text-muted-foreground">{h.date}</span>
                                                <Badge variant="secondary" className={cn("text-[10px] font-bold border", h.change > 0 ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-red-600 bg-red-50 border-red-100")}>
                                                    {h.change > 0 ? "+" : ""}{h.change} {safeObj.unit}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-muted-foreground text-xs">Cumul :</span>
                                                <span className="font-bold text-foreground">{Number(h.value).toLocaleString()} {safeObj.unit}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                                <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                                <p className="text-sm">Aucune activité enregistrée.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Liste des Paliers (Pour info) */}
                {safeObj.paliers.length > 0 && (
                    <div className="pt-2">
                         <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                            <Target className="w-5 h-5 text-primary" /> Paliers
                        </h3>
                        <div className="space-y-3">
                            {safeObj.paliers.sort((a:any, b:any) => a.threshold - b.threshold).map((palier: any, idx: number) => {
                                 const isReached = safeObj.direction === 'descending' ? safeObj.current <= palier.threshold : safeObj.current >= palier.threshold;
                                 return (
                                     <div key={idx} className={cn("flex items-center justify-between p-3 rounded-xl border", isReached ? "bg-emerald-50/50 border-emerald-200" : "bg-card border-border")}>
                                         <div className="flex items-center gap-3">
                                             <div className={cn("w-6 h-6 rounded-full flex items-center justify-center border-2", isReached ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground text-muted-foreground")}>
                                                 {isReached && <CheckCircle2 className="w-4 h-4" />}
                                             </div>
                                             <span className={cn("text-sm font-medium", isReached ? "text-emerald-900" : "text-muted-foreground")}>{palier.name} ({palier.threshold} {safeObj.unit})</span>
                                         </div>
                                         <span className={cn("text-sm font-bold", isReached ? "text-emerald-600" : "text-muted-foreground")}>+{palier.reward}€</span>
                                     </div>
                                 )
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
