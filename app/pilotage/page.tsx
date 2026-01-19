"use client"

import { useState, useMemo, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { usePermissions } from "@/hooks/use-permissions"
import { useObjectives } from "@/hooks/use-objectives"
import {
  Target, TrendingUp, Clock, Plus, Edit3, Trash2, X, Check, Euro, Users,
  Layers, AlertCircle, Save, Calculator, Wallet, ChevronDown, ChevronUp, Calendar, Loader2
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

// Imports Firebase
import { doc, updateDoc, addDoc, collection, onSnapshot, query, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/client"

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

export default function PilotagePage() {
  const { canEdit } = usePermissions()
  const { objectives, loading: loadingObj } = useObjectives()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<TabValue>("pilotage")
  const [baseHours, setBaseHours] = useState(35)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  
  // États d'édition & Modales
  const [showEditHours, setShowEditHours] = useState(false)
  const [editingPalier, setEditingPalier] = useState<EditingPalier | null>(null)
  const [showAddPalier, setShowAddPalier] = useState<string | null>(null)
  const [showObjectiveDetail, setShowObjectiveDetail] = useState<string | null>(null) // ID de l'objectif à afficher
  const [showAddObjective, setShowAddObjective] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false) // <--- PLANIFICATION
  
  const [budgetMax, setBudgetMax] = useState(2000)
  const [simulatedPaliers, setSimulatedPaliers] = useState<Record<string, Record<string, number>>>({})
  const [expandedObjective, setExpandedObjective] = useState<string | null>(null)

  // 1. CHARGEMENT DES DONNÉES
  useEffect(() => {
    // Équipe
    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      const members = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().displayName || doc.data().email || "Inconnu",
        role: doc.data().role || "Employé",
        contractHours: doc.data().contractHours || 35
      }))
      setTeamMembers(members)
    })

    // Config (Base horaires)
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

  // 3. CALCULS EN TEMPS RÉEL (Simulation)
  const simulationData = useMemo(() => {
    const objectiveCosts: any[] = []
    let totalCost = 0

    objectives.forEach((obj: any) => {
      if (!obj.isActive && activeTab !== 'pilotage') return;

      let objCost = 0
      const paliersList: any[] = []

      if (obj.rewardType === 'fixed') {
          objCost = obj.fixedReward || 0;
      } 
      else if (obj.paliers) {
          obj.paliers.forEach((p: any) => {
            const reward = simulatedPaliers[obj.id]?.[p.id] ?? p.reward
            objCost += reward
            paliersList.push({ id: p.id, name: p.name, reward })
          })
      }

      objectiveCosts.push({ id: obj.id, title: obj.title, cost: objCost, paliers: paliersList })
      totalCost += objCost
    })

    const teamTotalCost = teamMembers.reduce((sum, m) => {
      const ratio = m.contractHours / baseHours;
      return sum + (totalCost * ratio);
    }, 0)

    const prime35h = totalCost;

    return {
      objectiveCosts,
      totalCost,
      teamTotalCost: Math.round(teamTotalCost),
      prime35h,
      budgetDiff: budgetMax - Math.round(teamTotalCost),
      isOverBudget: teamTotalCost > budgetMax,
    }
  }, [objectives, simulatedPaliers, baseHours, budgetMax, teamMembers, activeTab])

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

  // Paliers CRUD
  const handleAddPalierConfirm = async (objectiveId: string, name: string, threshold: number, reward: number) => {
      const obj = objectives.find((o: any) => o.id === objectiveId);
      if(!obj) return;

      const newPalier = { id: `p-${Date.now()}`, name, threshold, reward };
      const newPaliers = [...(obj.paliers || []), newPalier];
      const newReward = newPaliers.reduce((acc, p) => acc + p.reward, 0);

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

  const handleCreateObjective = async (title: string) => {
      await addDoc(collection(db, "objectives"), {
          title, description: "Nouvel objectif", isActive: true, type: "secondary", target: 100, unit: "pts", reward: 0, progress: 0, paliers: [], createdAt: new Date()
      });
      setShowAddObjective(false);
      toast({ title: "Objectif créé" });
  }

  if (loadingObj) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin"/></div>;

  return (
    <PermissionGate moduleId="pilotage" redirect>
      <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pilotage</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gérez les objectifs et les primes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl gap-2 bg-transparent" onClick={() => setShowScheduleModal(true)}>
              <Calendar className="w-4 h-4" /> Planifier
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl gap-2 bg-transparent" onClick={() => setShowEditHours(true)}>
              <Clock className="w-4 h-4" /> {baseHours}h
            </Button>
          </div>
        </div>

        {/* KPI Summary */}
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

          {/* OBJECTIFS */}
          <TabsContent value="objectifs" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Liste des objectifs</h2>
              <Button size="sm" variant="outline" className="rounded-xl gap-1 bg-transparent" onClick={() => setShowAddObjective(true)}>
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            </div>
            <div className="space-y-3">
              {objectives.map((obj: any) => (
                <div key={obj.id} className="pulse-card p-4 cursor-pointer" onClick={() => setShowObjectiveDetail(obj.id)}>
                  <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", obj.type === "principal" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                            {obj.type === "principal" ? <Target className="w-5 h-5"/> : <TrendingUp className="w-5 h-5"/>}
                        </div>
                        <div>
                            <h3 className="font-medium text-sm">{obj.title}</h3>
                            <p className="text-xs text-muted-foreground">{obj.paliers?.length || 0} paliers • {obj.reward}€ max</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{obj.isActive ? "Actif" : "Inactif"}</span>
                          <Switch checked={obj.isActive} onCheckedChange={() => handleToggleActive(obj)} onClick={(e) => e.stopPropagation()} />
                      </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (obj.progress / obj.target) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                        {Math.round(Math.min(100, (obj.progress / obj.target) * 100))}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* PALIERS */}
          <TabsContent value="paliers" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Gestion des paliers</h2>
            </div>
            {objectives.filter((o:any) => o.isActive).map((obj: any) => (
              <div key={obj.id} className="space-y-3">
                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg">
                  <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{obj.title}</span></div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddPalier(obj.id)}><Plus className="w-3 h-3 mr-1" /> Palier</Button>
                </div>
                <div className="space-y-2 pl-2 border-l-2 border-muted">
                  {obj.paliers?.map((palier: any, index: number) => (
                    <div key={palier.id} className="pulse-card p-3 flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><span className="text-sm font-medium">{palier.name}</span></div>
                        <p className="text-xs text-muted-foreground">Seuil : {palier.threshold.toLocaleString()}</p>
                      </div>
                      <div className="text-right"><p className="text-sm font-bold text-primary">+{palier.reward}€</p></div>
                      <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setEditingPalier({ objectiveId: obj.id, palierId: palier.id, name: palier.name, threshold: palier.threshold, reward: palier.reward })}><Edit3 className="w-4 h-4 text-muted-foreground" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* PILOTAGE */}
          <TabsContent value="pilotage" className="space-y-4 mt-4">
            <div className="pulse-card p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Wallet className="w-5 h-5 text-primary" /></div>
                <div className="flex-1"><h3 className="font-semibold text-sm">Budget & Simulation</h3><p className="text-xs text-muted-foreground">Les modifications ici impactent les primes réelles</p></div>
              </div>
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Budget maximum alloué</Label>
                <div className="flex items-center gap-2"><Input type="number" value={budgetMax} onChange={(e) => setBudgetMax(Number(e.target.value))} className="rounded-xl text-lg font-bold" /><span className="text-lg font-bold text-muted-foreground">€</span></div>
              </div>
              <div className={cn("p-4 rounded-xl mb-4", simulationData.isOverBudget ? "bg-red-500/10 border border-red-500/30" : "bg-green-500/10 border border-green-500/30")}>
                <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">Coût total équipe</span><span className={cn("text-lg font-bold", simulationData.isOverBudget ? "text-red-400" : "text-green-400")}>{simulationData.teamTotalCost}€</span></div>
                <div className="h-3 bg-muted rounded-full overflow-hidden mb-2"><div className={cn("h-full rounded-full transition-all", simulationData.isOverBudget ? "bg-red-500" : "bg-green-500")} style={{ width: `${Math.min((simulationData.teamTotalCost / budgetMax) * 100, 100)}%` }} /></div>
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
                <Button className="w-full rounded-xl" onClick={handleSaveSimulation}><Save className="w-4 h-4 mr-2" /> Appliquer la simulation (Enregistrer)</Button>
              </div>
            </div>
          </TabsContent>

          {/* EQUIPE */}
          <TabsContent value="equipe" className="space-y-4 mt-4">
            <div className="flex items-center justify-between"><h2 className="font-semibold text-sm">Primes au prorata</h2><span className="text-xs text-muted-foreground">Base {baseHours}h</span></div>
            <div className="space-y-3">
              {teamMembers.map((member) => {
                const ratio = member.contractHours / baseHours;
                const potentialPrime = Math.round(simulationData.totalCost * ratio);
                return (
                  <div key={member.id} className="pulse-card p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center"><span className="text-xs font-bold text-white">{member.name.substring(0,2).toUpperCase()}</span></div>
                      <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{member.name}</p><p className="text-xs text-muted-foreground">{member.role}</p></div>
                      <div className="text-right"><p className="text-lg font-bold">{potentialPrime}€</p><p className="text-[10px] text-muted-foreground">potentiel</p></div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4"><div><span className="text-muted-foreground">Contrat:</span> <span className="font-medium">{member.contractHours}h</span></div><div><span className="text-muted-foreground">Ratio:</span> <span className="font-medium">{Math.round(ratio * 100)}%</span></div></div>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
                    </div>
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
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm">
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl p-4 pb-8">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            <h2 className="font-semibold mb-4">Base horaire de référence</h2>
            <div className="space-y-4">
              <div><Label className="text-sm">Heures temps plein</Label><Input type="number" value={baseHours} onChange={(e) => setBaseHours(Number(e.target.value))} className="rounded-xl mt-2" /></div>
              <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowEditHours(false)}>Annuler</Button>
                  <Button className="flex-1" onClick={handleUpdateBaseHours}><Save className="w-4 h-4 mr-2" /> Enregistrer</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. EDIT PALIER */}
      {editingPalier && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm">
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl p-4 pb-8">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            <h2 className="font-semibold mb-6">Modifier le palier</h2>
            <div className="space-y-4">
              <div><Label className="text-sm">Nom</Label><Input value={editingPalier.name} onChange={(e) => setEditingPalier({ ...editingPalier, name: e.target.value })} className="rounded-xl mt-1" /></div>
              <div><Label className="text-sm">Seuil</Label><Input type="number" value={editingPalier.threshold} onChange={(e) => setEditingPalier({ ...editingPalier, threshold: Number(e.target.value) })} className="rounded-xl mt-1" /></div>
              <div><Label className="text-sm">Récompense (€)</Label><Input type="number" value={editingPalier.reward} onChange={(e) => setEditingPalier({ ...editingPalier, reward: Number(e.target.value) })} className="rounded-xl mt-1" /></div>
              <div className="flex gap-3">
                <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleDeletePalier}><Trash2 className="w-4 h-4 mr-2" /> Supprimer</Button>
                <Button className="flex-1 rounded-xl" onClick={handleUpdatePalierConfirm}><Save className="w-4 h-4 mr-2" /> Enregistrer</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ADD PALIER */}
      {showAddPalier && (
        <AddPalierModal onClose={() => setShowAddPalier(null)} onConfirm={(name, threshold, reward) => handleAddPalierConfirm(showAddPalier, name, threshold, reward)} />
      )}

      {/* 4. ADD OBJECTIF (SIMPLE) */}
      {showAddObjective && (
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-end justify-center sm:items-center">
              <div className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 space-y-4">
                  <h3 className="font-bold text-lg">Nouvel Objectif</h3>
                  <form onSubmit={(e: any) => { e.preventDefault(); handleCreateObjective(e.target.title.value) }}>
                      <div className="space-y-2">
                          <Label>Titre de l'objectif</Label>
                          <Input name="title" placeholder="Ex: Vente Produits Frais" required />
                      </div>
                      <div className="pt-2 flex gap-3">
                          <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddObjective(false)}>Annuler</Button>
                          <Button type="submit" className="flex-1">Créer</Button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* 5. PLANIFICATION / CALENDRIER */}
      {showScheduleModal && (
        <ScheduleObjectivesModal onClose={() => setShowScheduleModal(false)} />
      )}

      {/* 6. DETAIL OBJECTIF */}
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

// --- SOUS-COMPOSANTS MODALES ---

function AddPalierModal({ onClose, onConfirm }: { onClose: () => void, onConfirm: (n: string, t: number, r: number) => void }) {
    const [name, setName] = useState("")
    const [threshold, setThreshold] = useState("")
    const [reward, setReward] = useState("")

    return (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm">
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl p-4 pb-8">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            <h2 className="font-semibold mb-6">Ajouter un palier</h2>
            <div className="space-y-4">
              <div><Label className="text-sm">Nom</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Niveau 1" className="rounded-xl mt-1" /></div>
              <div><Label className="text-sm">Seuil</Label><Input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="1000" className="rounded-xl mt-1" /></div>
              <div><Label className="text-sm">Récompense (€)</Label><Input type="number" value={reward} onChange={e => setReward(e.target.value)} placeholder="50" className="rounded-xl mt-1" /></div>
              <Button className="w-full rounded-xl" onClick={() => onConfirm(name, Number(threshold), Number(reward))} disabled={!name || !threshold}>
                <Plus className="w-4 h-4 mr-2" /> Ajouter
              </Button>
              <Button variant="ghost" className="w-full" onClick={onClose}>Annuler</Button>
            </div>
          </div>
        </div>
    )
}

function ObjectiveDetailModal({ objectiveId, onClose, objectivesList }: { objectiveId: string, onClose: () => void, objectivesList: any[] }) {
  const objective = objectivesList.find((o) => o.id === objectiveId)
  if (!objective) return null

  // Fonction pour mettre à jour directement depuis le détail
  const updateField = async (field: string, value: any) => {
      await updateDoc(doc(db, "objectives", objectiveId), { [field]: value });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Détails de l'objectif</h2>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          <div className="text-center">
            <div className={cn("w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3", objective.type === "principal" ? "bg-primary/15" : "bg-muted")}>
              <Target className={cn("w-7 h-7", objective.type === "principal" ? "text-primary" : "text-muted-foreground")} />
            </div>
            <h3 className="font-bold text-lg">{objective.title}</h3>
            <p className="text-sm text-muted-foreground">{objective.description}</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div><p className="text-sm font-medium">Objectif actif</p><p className="text-xs text-muted-foreground">Visible par l'équipe</p></div>
              <Switch checked={objective.isActive} onCheckedChange={(v) => updateField('isActive', v)} />
            </div>
            <div>
              <Label className="text-sm">Objectif cible</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" defaultValue={objective.target} onBlur={(e) => updateField('target', Number(e.target.value))} className="rounded-xl" />
                <span className="text-sm text-muted-foreground w-12">{objective.unit}</span>
              </div>
            </div>
          </div>
          <Button className="w-full rounded-xl" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  )
}

function ScheduleObjectivesModal({ onClose }: { onClose: () => void }) {
  const [selectedMonth, setSelectedMonth] = useState("02")
  const [selectedYear, setSelectedYear] = useState("2026")
  const [duration, setDuration] = useState("1")
  const { toast } = useToast()

  const months = [{ value: "01", label: "Janvier" }, { value: "02", label: "Février" }, { value: "03", label: "Mars" }, { value: "04", label: "Avril" }, { value: "05", label: "Mai" }, { value: "06", label: "Juin" }, { value: "07", label: "Juillet" }, { value: "08", label: "Août" }, { value: "09", label: "Septembre" }, { value: "10", label: "Octobre" }, { value: "11", label: "Novembre" }, { value: "12", label: "Décembre" }]

  const handleSaveSchedule = () => {
      // Pour l'instant, on simule la sauvegarde car la logique "future" demande un backend plus complexe
      // Mais on peut stocker ça dans une collection "planning" si besoin plus tard
      toast({ title: "Planification enregistrée", description: `Objectifs appliqués pour ${duration} mois.` });
      onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Programmer les objectifs</h2>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="p-4 space-y-6 pb-8">
          <div className="pulse-card p-4 bg-primary/5 border-primary/20">
            <div className="flex gap-3">
              <Calendar className="w-5 h-5 text-primary shrink-0" />
              <div><p className="text-sm font-medium">Anticipez vos objectifs</p><p className="text-xs text-muted-foreground mt-1">Programmez les objectifs pour les mois à venir.</p></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Mois de début</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{months.map((month) => (<SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Année</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm">Durée (mois)</Label>
            <div className="flex gap-2 mt-2">
              {["1", "3", "6", "12"].map((d) => (
                <button key={d} onClick={() => setDuration(d)} className={cn("flex-1 py-3 rounded-xl text-sm font-medium transition-all", duration === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>{d} mois</button>
              ))}
            </div>
          </div>

          <Button className="w-full rounded-xl" onClick={handleSaveSchedule}><Save className="w-4 h-4 mr-2" /> Enregistrer la programmation</Button>
        </div>
      </div>
    </div>
  )
}
