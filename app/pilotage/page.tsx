"use client"

import { useState, useMemo, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { usePermissions } from "@/hooks/use-permissions"
import { useObjectives } from "@/hooks/use-objectives"
import {
  Target, TrendingUp, TrendingDown, Clock, Plus, Edit3, Trash2, X, Check, Euro, Users,
  Layers, AlertCircle, Save, Wallet, ChevronDown, ChevronUp, Calendar, Loader2,
  Percent, Hash, AlertTriangle, ThumbsUp
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

// Imports Firebase
import { doc, updateDoc, addDoc, collection, onSnapshot, query, getDoc, setDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/client"

// --- TYPES ---

type ObjectiveDirection = "ascending" | "descending" // Monter (CA) ou Descendre (Erreurs)
type TabValue = "objectifs" | "paliers" | "pilotage" | "equipe"

interface EditingPalier {
  objectiveId: string
  palierId: string
  name: string
  threshold: number
  reward: number
}

interface TeamMember {
  id: string
  name: string
  role: string
  contractHours: number
}

// Liste des modèles d'objectifs pour faciliter la création
const OBJECTIVE_PRESETS = [
  { id: "ca", label: "Chiffre d'Affaires", icon: Euro, unit: "€", direction: "ascending", desc: "Augmenter le revenu" },
  { id: "error", label: "Taux d'erreur", icon: AlertTriangle, unit: "%", direction: "descending", desc: "Réduire les erreurs (qualité)" },
  { id: "volume", label: "Volume Commandes", icon: Hash, unit: "cmd", direction: "ascending", desc: "Augmenter la production" },
  { id: "satisfaction", label: "Satisfaction Client", icon: ThumbsUp, unit: "/5", direction: "ascending", desc: "Améliorer la notation" },
  { id: "margin", label: "Marge Brute", icon: Percent, unit: "%", direction: "ascending", desc: "Optimiser la rentabilité" },
]

export default function PilotagePage() {
  const { canEdit } = usePermissions()
  const { objectives, loading: loadingObj } = useObjectives()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<TabValue>("pilotage")
  const [baseHours, setBaseHours] = useState(35)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  
  // États d'édition
  const [showEditHours, setShowEditHours] = useState(false)
  const [editingPalier, setEditingPalier] = useState<EditingPalier | null>(null)
  const [showAddPalier, setShowAddPalier] = useState<string | null>(null)
  const [showObjectiveDetail, setShowObjectiveDetail] = useState<string | null>(null)
  const [showAddObjective, setShowAddObjective] = useState(false)
  
  const [budgetMax, setBudgetMax] = useState(2000)
  const [simulatedPaliers, setSimulatedPaliers] = useState<Record<string, Record<string, number>>>({})
  const [expandedObjective, setExpandedObjective] = useState<string | null>(null)

  // 1. CHARGEMENT DES DONNÉES
  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      const members = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().displayName || doc.data().email || "Inconnu",
        role: doc.data().role || "Employé",
        contractHours: Number(doc.data().contractHours) || 35
      }))
      setTeamMembers(members)
    })

    const loadConfig = async () => {
        const docSnap = await getDoc(doc(db, "config", "pilotage"));
        if (docSnap.exists()) {
            setBaseHours(docSnap.data().baseHours || 35);
            setBudgetMax(docSnap.data().budgetMax || 2000);
        }
    }
    loadConfig();

    return () => unsubUsers();
  }, [])

  // 2. SYNCHRONISATION SIMULATION
  useEffect(() => {
    if (objectives.length > 0) {
        const initial: Record<string, Record<string, number>> = {}
        objectives.forEach((obj: any) => {
          initial[obj.id] = {}
          obj.paliers?.forEach((p: any) => {
            initial[obj.id][p.id] = p.reward
          })
        })
        setSimulatedPaliers(initial)
    }
  }, [objectives])

  // 3. CALCULS SIMULATION
  const simulationData = useMemo(() => {
    const objectiveCosts: any[] = []
    let totalCost = 0

    objectives.forEach((obj: any) => {
      if (!obj.isActive && activeTab !== 'pilotage') return;

      let objCost = 0
      const paliersList: any[] = []

      // Logique Paliers
      if (obj.paliers) {
          obj.paliers.forEach((p: any) => {
            const reward = simulatedPaliers[obj.id]?.[p.id] ?? p.reward
            objCost += reward
            paliersList.push({ id: p.id, name: p.name, reward })
          })
      } 
      // Logique Prime Fixe (Legacy fallback)
      else {
          objCost = obj.fixedReward || 0;
      }

      objectiveCosts.push({ id: obj.id, title: obj.title, cost: objCost, paliers: paliersList })
      totalCost += objCost
    })

    const teamTotalCost = teamMembers.reduce((sum, m) => {
      const ratio = m.contractHours / baseHours;
      return sum + (totalCost * ratio);
    }, 0)

    return {
      objectiveCosts,
      teamTotalCost: Math.round(teamTotalCost),
      budgetDiff: budgetMax - Math.round(teamTotalCost),
      isOverBudget: teamTotalCost > budgetMax,
    }
  }, [objectives, simulatedPaliers, baseHours, budgetMax, teamMembers, activeTab])

  // --- HELPER PROGRESSION ---
  const calculateProgress = (current: number, target: number, direction: ObjectiveDirection) => {
      if (direction === 'descending') {
          // Pour "Moins de 1%", si on est à 5%, c'est 0% de réussite. Si on est à 0.5%, c'est 100%.
          // On assume une base de départ (ex: 10% d'erreur) pour l'affichage, ou on simplifie.
          // Simplification : Si current <= target, c'est gagné.
          if (current <= target) return 100;
          // Sinon on affiche une jauge inverse simple : Target / Current (plus current est grand, plus ratio est petit)
          return Math.max(0, Math.min(100, (target / (current || 1)) * 100));
      }
      // Standard Ascending
      return Math.min(100, Math.max(0, (current / (target || 1)) * 100));
  }

  // --- ACTIONS FIREBASE ---

  const handleUpdateBaseHours = async () => {
      try {
          await setDoc(doc(db, "config", "pilotage"), { baseHours, budgetMax }, { merge: true });
          setShowEditHours(false);
          toast({ title: "Configuration sauvegardée" });
      } catch (e) {
          toast({ title: "Erreur sauvegarde", variant: "destructive" });
      }
  }

  const handleToggleActive = async (obj: any) => {
      await updateDoc(doc(db, "objectives", obj.id), { isActive: !obj.isActive });
  }

  const handleSaveSimulation = async () => {
      try {
          const promises = objectives.map(async (obj: any) => {
              if (!obj.paliers) return;
              const changes = simulatedPaliers[obj.id];
              if (!changes) return;

              const newPaliers = obj.paliers.map((p: any) => ({
                  ...p,
                  reward: changes[p.id] !== undefined ? changes[p.id] : p.reward
              }));

              const newTotalReward = newPaliers.reduce((acc: number, p: any) => acc + p.reward, 0);

              await updateDoc(doc(db, "objectives", obj.id), {
                  paliers: newPaliers,
                  reward: newTotalReward
              });
          });

          await Promise.all(promises);
          await setDoc(doc(db, "config", "pilotage"), { budgetMax }, { merge: true });

          toast({ title: "Simulation appliquée !", description: "Les montants des primes ont été mis à jour." });
      } catch (e) {
          toast({ title: "Erreur", description: "Impossible d'appliquer la simulation.", variant: "destructive" });
      }
  }

  // GESTION PALIERS
  const handleAddPalierConfirm = async (objectiveId: string, name: string, threshold: number, reward: number) => {
      const obj = objectives.find((o: any) => o.id === objectiveId);
      if(!obj) return;

      const newPalier = { id: `p-${Date.now()}`, name, threshold, reward };
      const newPaliers = [...(obj.paliers || []), newPalier];
      const newReward = newPaliers.reduce((acc:any, p:any) => acc + p.reward, 0);

      await updateDoc(doc(db, "objectives", objectiveId), { paliers: newPaliers, reward: newReward });
      setShowAddPalier(null);
      toast({ title: "Palier ajouté" });
  }

  const handleUpdatePalierConfirm = async () => {
      if(!editingPalier) return;
      const obj = objectives.find((o: any) => o.id === editingPalier.objectiveId);
      if(!obj) return;

      const newPaliers = obj.paliers.map((p: any) => p.id === editingPalier.palierId ? { ...p, name: editingPalier.name, threshold: editingPalier.threshold, reward: editingPalier.reward } : p);
      const newReward = newPaliers.reduce((acc: number, p: any) => acc + p.reward, 0);

      await updateDoc(doc(db, "objectives", editingPalier.objectiveId), { paliers: newPaliers, reward: newReward });
      setEditingPalier(null);
      toast({ title: "Palier modifié" });
  }

  const handleDeletePalier = async () => {
      if(!editingPalier) return;
      if(!confirm("Supprimer ce palier ?")) return;

      const obj = objectives.find((o: any) => o.id === editingPalier.objectiveId);
      if(!obj) return;

      const newPaliers = obj.paliers.filter((p: any) => p.id !== editingPalier.palierId);
      const newReward = newPaliers.reduce((acc: number, p: any) => acc + p.reward, 0);

      await updateDoc(doc(db, "objectives", editingPalier.objectiveId), { paliers: newPaliers, reward: newReward });
      setEditingPalier(null);
      toast({ title: "Palier supprimé" });
  }

  // CRÉATION OBJECTIF AVANCÉE
  const handleCreateObjective = async (data: any) => {
      try {
        await addDoc(collection(db, "objectives"), {
            title: data.title,
            description: data.description || "",
            isActive: true,
            type: "secondary", // Défaut, modifiable après
            target: Number(data.target),
            unit: data.unit,
            direction: data.direction, // "ascending" | "descending"
            reward: 0,
            progress: data.direction === "descending" ? Number(data.target) * 2 : 0, // Si descendant, on commence "haut" pour simuler
            paliers: [],
            createdAt: new Date()
        });
        setShowAddObjective(false);
        toast({ title: "Objectif créé avec succès" });
      } catch(e) {
        toast({ title: "Erreur création", variant: "destructive" });
      }
  }

  if (loadingObj) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  return (
    <PermissionGate moduleId="pilotage" redirect>
      <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pilotage</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gérez les objectifs et les primes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl gap-2 bg-transparent" onClick={() => setShowEditHours(true)}>
              <Clock className="w-4 h-4" /> {baseHours}h
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold">{objectives.filter((o:any) => o.isActive).length}</p>
            <p className="text-[11px] text-muted-foreground">Objectifs actifs</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent/10 flex items-center justify-center">
              <Euro className="w-5 h-5 text-accent" />
            </div>
            <p className="text-xl font-bold">{simulationData.teamTotalCost}€</p>
            <p className="text-[11px] text-muted-foreground">Budget Est.</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-chart-3/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-chart-3" />
            </div>
            <p className="text-xl font-bold">{teamMembers.length}</p>
            <p className="text-[11px] text-muted-foreground">Collaborateurs</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="grid w-full grid-cols-4 h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="objectifs" className="rounded-lg text-xs font-medium">Objectifs</TabsTrigger>
            <TabsTrigger value="paliers" className="rounded-lg text-xs font-medium">Paliers</TabsTrigger>
            <TabsTrigger value="pilotage" className="rounded-lg text-xs font-medium">Pilotage</TabsTrigger>
            <TabsTrigger value="equipe" className="rounded-lg text-xs font-medium">Équipe</TabsTrigger>
          </TabsList>

          {/* --- ONGLET 1 : OBJECTIFS --- */}
          <TabsContent value="objectifs" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Définition des objectifs</h2>
              <Button size="sm" variant="outline" className="rounded-xl gap-1 bg-transparent" onClick={() => setShowAddObjective(true)}>
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            </div>

            <div className="space-y-3">
              {objectives.map((obj: any) => {
                const isDescending = obj.direction === 'descending';
                const progressPercent = calculateProgress(obj.progress, obj.target, obj.direction);

                return (
                  <div key={obj.id} className="pulse-card p-4 cursor-pointer" onClick={() => setShowObjectiveDetail(obj.id)}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", obj.type === "principal" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                              {isDescending ? <TrendingDown className="w-5 h-5"/> : <TrendingUp className="w-5 h-5"/>}
                          </div>
                          <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm">{obj.title}</h3>
                                {isDescending && <Badge variant="destructive" className="text-[9px] px-1 h-4">Réduire</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground">{obj.paliers?.length || 0} paliers • {obj.reward}€ max</p>
                          </div>
                        </div>
                        <Switch checked={obj.isActive} onCheckedChange={() => handleToggleActive(obj)} onClick={(e) => e.stopPropagation()} />
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", isDescending ? "bg-red-500" : "bg-primary")} style={{ width: `${progressPercent}%` }} />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                          {obj.progress?.toLocaleString()} / {obj.target?.toLocaleString()} {obj.unit}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          {/* --- ONGLET 2 : PALIERS --- */}
          <TabsContent value="paliers" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Gestion des paliers</h2>
            </div>
            {objectives.filter((o:any) => o.isActive).map((obj: any) => {
               const isDescending = obj.direction === 'descending';
               return (
                <div key={obj.id} className="space-y-3">
                  <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg">
                    <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{obj.title}</span></div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddPalier(obj.id)}><Plus className="w-3 h-3 mr-1" /> Palier</Button>
                  </div>
                  <div className="space-y-2 pl-2 border-l-2 border-muted">
                    {obj.paliers?.sort((a:any, b:any) => isDescending ? b.threshold - a.threshold : a.threshold - b.threshold).map((palier: any, index: number) => (
                      <div key={palier.id} className="pulse-card p-3 flex items-center gap-3">
                        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2"><span className="text-sm font-medium">{palier.name}</span></div>
                          <p className="text-xs text-muted-foreground">
                             {isDescending ? "Si inférieur à" : "Si supérieur à"} : <strong>{palier.threshold} {obj.unit}</strong>
                          </p>
                        </div>
                        <div className="text-right"><p className="text-sm font-bold text-primary">+{palier.reward}€</p></div>
                        <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setEditingPalier({ objectiveId: obj.id, palierId: palier.id, name: palier.name, threshold: palier.threshold, reward: palier.reward })}><Edit3 className="w-4 h-4 text-muted-foreground" /></Button>
                      </div>
                    ))}
                    {(!obj.paliers || obj.paliers.length === 0) && <p className="text-xs text-muted-foreground italic pl-2">Aucun palier défini.</p>}
                  </div>
                </div>
               )
            })}
          </TabsContent>

          {/* --- ONGLET 3 : PILOTAGE --- */}
          <TabsContent value="pilotage" className="space-y-4 mt-4">
            <div className="pulse-card p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Wallet className="w-5 h-5 text-primary" /></div>
                <div className="flex-1"><h3 className="font-semibold text-sm">Simulation Budgétaire</h3><p className="text-xs text-muted-foreground">Ajustez pour voir l'impact global</p></div>
              </div>
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Budget Max (€)</Label>
                <Input type="number" value={budgetMax} onChange={(e) => setBudgetMax(Number(e.target.value))} className="rounded-xl text-lg font-bold" />
              </div>
              <div className={cn("p-4 rounded-xl mb-4", simulationData.isOverBudget ? "bg-red-500/10 border border-red-500/30" : "bg-green-500/10 border border-green-500/30")}>
                <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Coût projeté</span><span className={cn("text-lg font-bold", simulationData.isOverBudget ? "text-red-400" : "text-green-400")}>{simulationData.teamTotalCost}€</span></div>
                <div className="h-3 bg-muted rounded-full overflow-hidden mb-2"><div className={cn("h-full rounded-full transition-all", simulationData.isOverBudget ? "bg-red-500" : "bg-green-500")} style={{ width: `${Math.min((simulationData.teamTotalCost / budgetMax) * 100, 100)}%` }} /></div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Budget: {budgetMax}€</span>
                  <span className={cn("font-semibold", simulationData.isOverBudget ? "text-red-400" : "text-green-400")}>{simulationData.isOverBudget ? "Dépassement: " : "Reste: "}{Math.abs(simulationData.budgetDiff)}€</span>
                </div>
              </div>
            </div>

            <div className="pulse-card p-4">
              <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-accent" /></div><div><h3 className="font-semibold text-sm">Ajustement des paliers</h3><p className="text-xs text-muted-foreground">Glissez pour modifier les récompenses</p></div></div>
              <div className="space-y-3">
                {simulationData.objectiveCosts.map((obj) => (
                  <div key={obj.id} className="pulse-card p-3 bg-muted/30">
                    <button className="w-full flex items-center justify-between" onClick={() => setExpandedObjective(expandedObjective === obj.id ? null : obj.id)}>
                      <div className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" /><span className="text-sm font-medium">{obj.title}</span></div>
                      <div className="flex items-center gap-2"><span className="text-sm font-bold text-primary">{obj.cost}€</span>{expandedObjective === obj.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}</div>
                    </button>
                    {expandedObjective === obj.id && (
                      <div className="mt-4 space-y-6 pt-3 border-t border-border">
                        {obj.paliers.map((palier: any) => (
                          <div key={palier.id} className="space-y-4">
                            <div className="flex items-center justify-between"><span className="text-sm font-medium">{palier.name}</span><span className="text-lg font-bold text-primary">{palier.reward}€</span></div>
                            <div className="space-y-3 px-1">
                              <Slider value={[palier.reward]} min={0} max={500} step={5} onValueChange={([value]) => { setSimulatedPaliers(prev => ({ ...prev, [obj.id]: { ...prev[obj.id], [palier.id]: value } })) }} className="w-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <Button className="w-full rounded-xl" onClick={handleSaveSimulation}><Save className="w-4 h-4 mr-2" /> Appliquer la simulation</Button>
              </div>
            </div>
          </TabsContent>

          {/* --- ONGLET 4 : EQUIPE --- */}
          <TabsContent value="equipe" className="space-y-4 mt-4">
            <div className="flex items-center justify-between"><h2 className="font-semibold text-sm">Primes au prorata</h2><span className="text-xs text-muted-foreground">Base {baseHours}h</span></div>
            <div className="space-y-3">
              {teamMembers.map((member) => {
                const ratio = member.contractHours / baseHours;
                const potentialPrime = Math.round(simulationData.teamTotalCost * (ratio / teamMembers.length)); // Approximatif pour visuel
                return (
                  <div key={member.id} className="pulse-card p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center"><span className="text-xs font-bold text-white">{member.name.substring(0,2).toUpperCase()}</span></div>
                      <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{member.name}</p><p className="text-xs text-muted-foreground">{member.role}</p></div>
                      <div className="text-right"><p className="text-lg font-bold">{member.contractHours}h</p><p className="text-[10px] text-muted-foreground">contrat</p></div>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* --- MODALES --- */}

      {/* 1. EDIT HEURES */}
      {showEditHours && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setShowEditHours(false)}>
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-4 text-lg">Configuration Horaire</h2>
            <div className="space-y-4">
              <div><Label className="text-sm">Heures temps plein (référence)</Label><Input type="number" value={baseHours} onChange={(e) => setBaseHours(Number(e.target.value))} className="rounded-xl mt-2" /></div>
              <Button className="w-full rounded-xl" onClick={handleUpdateBaseHours}><Save className="w-4 h-4 mr-2" /> Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. EDIT PALIER */}
      {editingPalier && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setEditingPalier(null)}>
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-6 text-lg">Modifier le palier</h2>
            <div className="space-y-4">
              <div><Label>Nom</Label><Input value={editingPalier.name} onChange={(e) => setEditingPalier({ ...editingPalier, name: e.target.value })} className="rounded-xl mt-1" /></div>
              <div><Label>Seuil Cible</Label><Input type="number" value={editingPalier.threshold} onChange={(e) => setEditingPalier({ ...editingPalier, threshold: Number(e.target.value) })} className="rounded-xl mt-1" /></div>
              <div><Label>Prime (€)</Label><Input type="number" value={editingPalier.reward} onChange={(e) => setEditingPalier({ ...editingPalier, reward: Number(e.target.value) })} className="rounded-xl mt-1" /></div>
              <div className="flex gap-3 pt-2">
                <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleDeletePalier}><Trash2 className="w-4 h-4 mr-2" /> Supprimer</Button>
                <Button className="flex-1 rounded-xl" onClick={handleUpdatePalierConfirm}><Save className="w-4 h-4 mr-2" /> Enregistrer</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ADD PALIER */}
      {showAddPalier && (
        <AddPalierModal 
            onClose={() => setShowAddPalier(null)} 
            onConfirm={(n, t, r) => handleAddPalierConfirm(showAddPalier, n, t, r)}
            objective={objectives.find((o:any) => o.id === showAddPalier)} 
        />
      )}

      {/* 4. ADD OBJECTIVE (AVANCÉ) */}
      {showAddObjective && (
          <AddObjectiveAdvancedModal 
            onClose={() => setShowAddObjective(false)} 
            onConfirm={handleCreateObjective} 
          />
      )}

      {/* 5. DETAIL OBJECTIF */}
      {showObjectiveDetail && (
        <ObjectiveDetailModal 
            objectiveId={showObjectiveDetail} 
            onClose={() => setShowObjectiveDetail(null)} 
            objectivesList={objectives} 
        />
      )}

      <BottomNav />
      </div>
    </PermissionGate>
  )
}

// --- SOUS-COMPOSANTS ---

function AddObjectiveAdvancedModal({ onClose, onConfirm }: { onClose: () => void, onConfirm: (data: any) => void }) {
    const [selectedPreset, setSelectedPreset] = useState<string>("ca")
    const [title, setTitle] = useState("Chiffre d'Affaires")
    const [target, setTarget] = useState("")
    const [description, setDescription] = useState("")

    // Met à jour les champs quand on change de preset
    useEffect(() => {
        const p = OBJECTIVE_PRESETS.find(p => p.id === selectedPreset)
        if(p) {
            setTitle(p.label)
            setDescription(p.desc)
        }
    }, [selectedPreset])

    const handleSubmit = () => {
        const p = OBJECTIVE_PRESETS.find(p => p.id === selectedPreset)!
        onConfirm({
            title, description, target,
            unit: p.unit,
            direction: p.direction
        })
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-6 pb-10" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold">Nouvel Objectif</h2>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5"/></Button>
                </div>

                <div className="space-y-4">
                    {/* Selecteur de Type */}
                    <div>
                        <Label className="mb-2 block">Type d'objectif</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {OBJECTIVE_PRESETS.map(preset => (
                                <button 
                                    key={preset.id}
                                    onClick={() => setSelectedPreset(preset.id)}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all text-xs text-center h-20",
                                        selectedPreset === preset.id 
                                            ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/20" 
                                            : "border-border bg-muted/20 text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    <preset.icon className="w-5 h-5" />
                                    <span>{preset.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div><Label>Titre personnalisé</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1.5"/></div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Cible à atteindre</Label>
                            <Input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0" className="mt-1.5 font-bold" />
                        </div>
                        <div>
                            <Label>Unité</Label>
                            <div className="flex h-10 items-center justify-center rounded-md border bg-muted font-bold text-muted-foreground mt-1.5">
                                {OBJECTIVE_PRESETS.find(p => p.id === selectedPreset)?.unit}
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        {OBJECTIVE_PRESETS.find(p => p.id === selectedPreset)?.direction === 'descending' 
                            ? "Info : Pour cet objectif, la progression augmentera quand la valeur diminuera (ex: moins d'erreurs)." 
                            : "Info : La progression augmentera quand la valeur augmentera (ex: plus de CA)."}
                    </div>

                    <Button className="w-full py-6 text-base" onClick={handleSubmit} disabled={!target}>Créer l'objectif</Button>
                </div>
            </div>
        </div>
    )
}

function AddPalierModal({ onClose, onConfirm, objective }: { onClose: () => void, onConfirm: (n: string, t: number, r: number) => void, objective: any }) {
    const [name, setName] = useState("")
    const [threshold, setThreshold] = useState("")
    const [reward, setReward] = useState("")
    
    const isDescending = objective?.direction === 'descending'

    return (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose}>
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-6 text-lg">Ajouter un palier</h2>
            <div className="space-y-4">
              <div><Label>Nom</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Niveau 1" className="rounded-xl mt-1" /></div>
              
              <div>
                  <Label>
                      {isDescending ? `Seuil max autorisé (${objective.unit})` : `Seuil à atteindre (${objective.unit})`}
                  </Label>
                  <Input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="1000" className="rounded-xl mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">
                      {isDescending ? "La prime sera débloquée si la valeur est EN-DESSOUS de ce chiffre." : "La prime sera débloquée si la valeur est AU-DESSUS de ce chiffre."}
                  </p>
              </div>

              <div><Label>Récompense (€)</Label><Input type="number" value={reward} onChange={e => setReward(e.target.value)} placeholder="50" className="rounded-xl mt-1" /></div>
              
              <Button className="w-full rounded-xl" onClick={() => onConfirm(name, Number(threshold), Number(reward))} disabled={!name || !threshold}>
                <Plus className="w-4 h-4 mr-2" /> Ajouter
              </Button>
            </div>
          </div>
        </div>
    )
}

function ObjectiveDetailModal({ objectiveId, onClose, objectivesList }: { objectiveId: string, onClose: () => void, objectivesList: any[] }) {
  const objective = objectivesList.find((o) => o.id === objectiveId)
  const handleDelete = async () => {
      if(confirm("Supprimer cet objectif ?")) {
          await deleteDoc(doc(db, "objectives", objectiveId))
          onClose()
      }
  }
  
  if (!objective) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-sm rounded-2xl p-6 space-y-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start">
            <div>
                <h2 className="font-bold text-lg">{objective.title}</h2>
                <Badge variant="outline" className="mt-1">{objective.direction === 'descending' ? 'Objectif de réduction' : 'Objectif de croissance'}</Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="space-y-4">
            <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Cible actuelle</span>
                <span className="font-bold">{objective.target} {objective.unit}</span>
            </div>
            <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Progression</span>
                <span className="font-bold">{objective.progress} {objective.unit}</span>
            </div>
        </div>

        <div className="pt-4 flex gap-3">
            <Button variant="destructive" className="flex-1" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-2"/> Supprimer</Button>
            <Button variant="outline" className="flex-1" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  )
}
