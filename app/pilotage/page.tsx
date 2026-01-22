"use client"

import { useState, useMemo, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { usePermissions } from "@/hooks/use-permissions"
import { useObjectives } from "@/hooks/use-objectives"
import { useAuth } from "@/components/auth/auth-provider"
import {
  Target, TrendingUp, TrendingDown, Clock, Plus, Edit3, Trash2, X, Check, Euro, Users,
  Layers, AlertCircle, Save, Wallet, ChevronDown, ChevronUp, Calendar, Loader2,
  Percent, Hash, AlertTriangle, ThumbsUp, CalendarDays, Crown, Lock, EyeOff, Trash
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer"

// Imports Firebase
import { doc, updateDoc, addDoc, collection, onSnapshot, query, getDoc, setDoc, deleteDoc, arrayUnion, increment, where } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

// --- TYPES ---

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
  initials: string
  color: string
}

// Liste des modèles d'objectifs
const OBJECTIVE_PRESETS = [
  { id: "ca", label: "Chiffre d'Affaires", icon: Euro, unit: "€", direction: "ascending", desc: "Augmenter le revenu" },
  { id: "error", label: "Taux d'erreur", icon: AlertTriangle, unit: "%", direction: "descending", desc: "Réduire les erreurs" },
  { id: "volume", label: "Volume Commandes", icon: Hash, unit: "cmd", direction: "ascending", desc: "Augmenter la production" },
  { id: "satisfaction", label: "Satisfaction Client", icon: ThumbsUp, unit: "/5", direction: "ascending", desc: "Améliorer la notation" },
  { id: "margin", label: "Marge Brute", icon: Percent, unit: "%", direction: "ascending", desc: "Optimiser la rentabilité" },
]

export default function PilotagePage() {
  const { profile } = useAuth()
  const { canEdit } = usePermissions()
  const { objectives, loading: loadingObj } = useObjectives()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<TabValue>("objectifs")
  const [baseHours, setBaseHours] = useState(35)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  
  // États d'édition
  const [showEditHours, setShowEditHours] = useState(false)
  const [editingPalier, setEditingPalier] = useState<EditingPalier | null>(null)
  const [showAddPalier, setShowAddPalier] = useState<string | null>(null)
  const [selectedObj, setSelectedObj] = useState<any | null>(null)
  const [showAddObjective, setShowAddObjective] = useState(false)
  const [showPlanning, setShowPlanning] = useState(false)
  
  // Simulation Budget
  const [budgetMax, setBudgetMax] = useState(2000)
  const [simulatedPaliers, setSimulatedPaliers] = useState<Record<string, Record<string, number>>>({})
  const [expandedSim, setExpandedSim] = useState<string | null>(null)

  // 1. CHARGEMENT
  useEffect(() => {
    if (!profile?.companyId) return;
    const q = query(collection(db, "users"), where("companyId", "==", profile.companyId));
    const unsubUsers = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(doc => {
            const data = doc.data();
            if (data.role === 'super_admin' || data.companyName === 'Non assigné') return null;
            
            const initials = (data.displayName || data.email || "??").substring(0, 2).toUpperCase();
            const colors = ["bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-indigo-500", "bg-emerald-500"];
            return {
                id: doc.id,
                name: data.displayName || data.email || "Inconnu",
                role: data.role || "Employé",
                contractHours: Number(data.contractHours) || 35,
                initials,
                color: colors[initials.charCodeAt(0) % colors.length]
            }
      })
      setTeamMembers(members.filter(Boolean) as TeamMember[])
    })
    const loadConfig = async () => {
        const docSnap = await getDoc(doc(db, "config", "pilotage"));
        if (docSnap.exists()) { setBaseHours(docSnap.data().baseHours || 35); setBudgetMax(docSnap.data().budgetMax || 2000); }
    }
    loadConfig();
    return () => unsubUsers();
  }, [profile?.companyId])

  // 2. INIT SIMULATION
  useEffect(() => {
    if (objectives.length > 0 && Object.keys(simulatedPaliers).length === 0) {
        const initial: Record<string, Record<string, number>> = {}
        objectives.forEach((obj: any) => {
          initial[obj.id] = {}
          obj.paliers?.forEach((p: any) => { initial[obj.id][p.id] = p.reward })
        })
        setSimulatedPaliers(initial)
    }
  }, [objectives])

  // 3. CALCULS INTELLIGENTS
  const simulationData = useMemo(() => {
    let totalCostPerPerson = 0

    const principalObj = objectives.find((o: any) => o.type === 'principal');
    const isPrincipalMet = !principalObj || (principalObj.direction === 'descending' 
        ? ((principalObj.current || 0) <= (principalObj.target || 1)) 
        : ((principalObj.current || 0) >= (principalObj.target || 1))
    );

    objectives.forEach((obj: any) => {
      if (!obj.isActive && activeTab !== 'pilotage') return;
      if (obj.type === 'secondaire' && !isPrincipalMet && activeTab !== 'pilotage') {
          return;
      }

      let objMaxReward = 0
      if (obj.paliers && obj.paliers.length > 0) {
          objMaxReward = obj.paliers.reduce((acc:number, p:any) => {
             const reward = simulatedPaliers[obj.id]?.[p.id] ?? p.reward;
             return acc + reward;
          }, 0);
      } else {
          objMaxReward = obj.fixedReward || 0;
      }
      totalCostPerPerson += objMaxReward
    })

    const totalTeamRatio = teamMembers.reduce((sum, m) => sum + (m.contractHours / baseHours), 0);
    const teamTotalCost = Math.round(totalCostPerPerson * totalTeamRatio);

    return {
      teamTotalCost, 
      budgetDiff: budgetMax - teamTotalCost, 
      isOverBudget: teamTotalCost > budgetMax,
      totalCostPerPerson, 
      activeObjectivesCount: objectives.filter(o => o.isActive).length, 
      isPrincipalMet
    }
  }, [objectives, simulatedPaliers, baseHours, budgetMax, teamMembers, activeTab])

  // ACTIONS
  const handleSimulateChange = (objId: string, palierId: string, value: number) => {
    setSimulatedPaliers(prev => ({ ...prev, [objId]: { ...prev[objId], [palierId]: value } }))
  }

  const handleSaveSimulation = async () => {
      try {
        const updates = Object.keys(simulatedPaliers).map(async (objId) => {
            const obj = objectives.find(o => o.id === objId);
            if (!obj) return;
            const newPaliers = obj.paliers.map((p: any) => ({ ...p, reward: simulatedPaliers[objId][p.id] ?? p.reward }));
            await updateDoc(doc(db, "objectives", objId), { paliers: newPaliers });
        });
        await Promise.all(updates);
        await setDoc(doc(db, "config", "pilotage"), { baseHours, budgetMax }, { merge: true });
        toast({ title: "Configuration sauvegardée" });
      } catch (e) { toast({ title: "Erreur sauvegarde", variant: "destructive" }); }
  }

  const handleUpdateBaseHours = async () => { try { await setDoc(doc(db, "config", "pilotage"), { baseHours, budgetMax }, { merge: true }); setShowEditHours(false); toast({ title: "Configuration sauvegardée" }); } catch (e) { toast({ title: "Erreur", variant: "destructive" }); } }
  const handleCreateObjective = async (data: any) => { if (!profile?.companyId) return; try { await addDoc(collection(db, "objectives"), { companyId: profile.companyId, title: data.title, description: data.description || "", isActive: true, type: data.type || "secondaire", target: Number(data.target), unit: data.unit, direction: data.direction, current: 0, paliers: [], history: [], isConfidential: data.isConfidential || false, createdAt: new Date().toISOString() }); setShowAddObjective(false); toast({ title: "Objectif créé" }); } catch(e) { toast({ title: "Erreur", variant: "destructive" }); } }
  const handleCreatePlanning = async (data: any) => { if (!profile?.companyId) return; try { await addDoc(collection(db, "plannings"), { companyId: profile.companyId, ...data, createdAt: new Date().toISOString(), status: "scheduled" }); setShowPlanning(false); toast({ title: "Planifié" }); } catch (e) { toast({ title: "Erreur", variant: "destructive" }); } }
  const updateProgress = async (amount: number, dateStr?: string) => { if (!selectedObj) return; const targetDate = dateStr ? new Date(dateStr) : new Date(); const formattedDate = format(targetDate, "d MMM", { locale: fr }); try { await updateDoc(doc(db, "objectives", selectedObj.id), { current: increment(amount), history: arrayUnion({ date: formattedDate, value: amount, change: amount, timestamp: targetDate.toISOString() }) }); toast({ title: "Mise à jour réussie" }); } catch (e) { toast({ title: "Erreur", variant: "destructive" }); } }
  const handleAddPalierConfirm = async (objectiveId: string, name: string, threshold: number, reward: number) => { const obj = objectives.find((o: any) => o.id === objectiveId); if(!obj) return; const newPalier = { id: `p-${Date.now()}`, name, threshold, reward }; const newPaliers = [...(obj.paliers || []), newPalier]; await updateDoc(doc(db, "objectives", objectiveId), { paliers: newPaliers }); setShowAddPalier(null); toast({ title: "Palier ajouté" }); }
  const handleUpdatePalierConfirm = async () => { if(!editingPalier) return; const obj = objectives.find((o: any) => o.id === editingPalier.objectiveId); if(!obj) return; const newPaliers = obj.paliers.map((p: any) => p.id === editingPalier.palierId ? { ...p, name: editingPalier.name, threshold: editingPalier.threshold, reward: editingPalier.reward } : p); await updateDoc(doc(db, "objectives", editingPalier.objectiveId), { paliers: newPaliers }); setEditingPalier(null); toast({ title: "Palier modifié" }); }
  const handleDeletePalier = async () => { if(!editingPalier) return; if(!confirm("Supprimer ?")) return; const obj = objectives.find((o: any) => o.id === editingPalier.objectiveId); if(!obj) return; const newPaliers = obj.paliers.filter((p: any) => p.id !== editingPalier.palierId); await updateDoc(doc(db, "objectives", editingPalier.objectiveId), { paliers: newPaliers }); setEditingPalier(null); toast({ title: "Supprimé" }); }

  // 🔴 NOUVELLE FONCTION DE SUPPRESSION
  const handleDeleteObjective = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet objectif ? Cette action est irréversible.")) return;
    try {
        await deleteDoc(doc(db, "objectives", id));
        toast({ title: "Objectif supprimé" });
        setSelectedObj(null);
    } catch (e) {
        toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  }

  if (loadingObj) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  return (
    <PermissionGate moduleId="pilotage" redirect>
      <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
            <div><h1 className="text-2xl font-bold tracking-tight">Pilotage</h1><p className="text-sm text-muted-foreground mt-0.5">Gérez les objectifs et les primes</p></div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl gap-2 bg-transparent border-muted-foreground/20" onClick={() => setShowPlanning(true)}><Calendar className="w-4 h-4" /> Planifier</Button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/50 border border-border text-xs font-medium cursor-pointer hover:bg-muted" onClick={() => setShowEditHours(true)}><Clock className="w-3.5 h-3.5" /> {baseHours}h</div>
            </div>
        </div>

        {!simulationData.isPrincipalMet && objectives.some(o => o.type === 'principal') && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <Lock className="w-5 h-5 text-amber-600" />
                <div className="flex-1">
                    <p className="text-sm font-bold text-amber-700">Objectif Principal non atteint</p>
                    <p className="text-xs text-amber-600/80">Les primes secondaires sont verrouillées.</p>
                </div>
            </div>
        )}

        <div className="bg-muted/50 p-1 rounded-2xl flex mb-6">
            <button onClick={() => setActiveTab("objectifs")} className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2", activeTab === "objectifs" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}><Target className="w-4 h-4" /> Objectifs</button>
            <button onClick={() => setActiveTab("paliers")} className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2", activeTab === "paliers" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}><Layers className="w-4 h-4" /> Paliers</button>
            <button onClick={() => setActiveTab("pilotage")} className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2", activeTab === "pilotage" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}><Wallet className="w-4 h-4" /> Budget</button>
            <button onClick={() => setActiveTab("equipe")} className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2", activeTab === "equipe" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}><Users className="w-4 h-4" /> Équipe</button>
        </div>

        {activeTab === "objectifs" && (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <div><h2 className="font-semibold text-sm">Vos objectifs en cours</h2><p className="text-xs text-muted-foreground">Progression en temps réel</p></div>
                    <Button size="sm" className="rounded-full bg-purple-500 hover:bg-purple-600 text-white px-4" onClick={() => setShowAddObjective(true)}><Plus className="w-4 h-4 mr-2" /> Créer</Button>
                </div>
                {objectives.map((obj: any) => {
                    const isLocked = obj.type === 'secondaire' && !simulationData.isPrincipalMet;
                    return (
                        <div key={obj.id} onClick={() => setSelectedObj(obj)} className={cn("pulse-card p-6 bg-gradient-to-b from-card to-muted/20 cursor-pointer hover:border-primary/50 transition-all group", isLocked && "opacity-60 grayscale-[0.5]")}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-purple-400">
                                    {obj.type === 'principal' && <Crown className="w-4 h-4 text-amber-400" />}
                                    <Target className="w-4 h-4" />
                                    <span className={cn("text-xs font-bold uppercase tracking-wider", obj.type === 'principal' ? "text-amber-400" : "")}>{obj.type === 'principal' ? 'Principal' : 'Secondaire'}</span>
                                </div>
                                <div className="flex gap-2">
                                    {obj.isConfidential && <Badge variant="secondary" className="gap-1 text-[10px]"><EyeOff className="w-3 h-3"/> Caché</Badge>}
                                    {isLocked && <Badge variant="secondary" className="bg-amber-100 text-amber-700 gap-1"><Lock className="w-3 h-3"/> En attente</Badge>}
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center mb-6">
                                <CircularProgress value={obj.current} max={obj.target} direction={obj.direction} />
                                <h2 className="text-xl font-bold mt-4">{obj.title}</h2>
                                <p className="text-center text-xs text-muted-foreground mt-1 max-w-[280px] leading-relaxed">{obj.description}</p>
                            </div>
                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-muted-foreground">Progression</span>
                                    <span>{(obj.current || 0).toLocaleString()} / {(obj.target || 0).toLocaleString()} {obj.unit}</span>
                                </div>
                                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(((obj.current || 0) / (obj.target || 1)) * 100, 100)}%` }} />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        )}

        {activeTab === "pilotage" && (
            <div className="space-y-6 animate-in fade-in">
                <div className="pulse-card p-5 bg-[#0f0f11] border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center"><Edit3 className="w-5 h-5 text-purple-500" /></div>
                        <div><h3 className="font-semibold text-sm text-white">Ajustement des primes</h3><p className="text-xs text-white/60">Modifiez les montants pour simuler</p></div>
                    </div>
                    <div className="space-y-3">
                        {objectives.map((obj: any) => {
                            const isExpanded = expandedSim === obj.id;
                            const currentSimReward = obj.paliers?.reduce((acc: number, p: any) => acc + (simulatedPaliers[obj.id]?.[p.id] ?? p.reward), 0) || 0;
                            return (
                                <div key={obj.id} className="bg-card/5 rounded-xl border border-white/5 overflow-hidden transition-all">
                                    <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5" onClick={() => setExpandedSim(isExpanded ? null : obj.id)}>
                                        <div className="flex items-center gap-3">
                                            {obj.type === 'principal' ? <Crown className="w-4 h-4 text-amber-500"/> : <Target className="w-4 h-4 text-purple-400"/>}
                                            <span className="text-sm font-medium text-white">{obj.title}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-purple-400">{currentSimReward}€</span>
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-white/40"/> : <ChevronDown className="w-4 h-4 text-white/40"/>}
                                        </div>
                                    </div>
                                    {isExpanded && obj.paliers && (
                                        <div className="p-4 space-y-5 bg-black/20 border-t border-white/5">
                                            {obj.paliers.map((p: any, idx: number) => {
                                                const val = simulatedPaliers[obj.id]?.[p.id] ?? p.reward;
                                                return (
                                                    <div key={p.id} className="space-y-3">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/70">{idx + 1}</span>
                                                                <span className="text-white/80">{p.name}</span>
                                                            </div>
                                                            <span className="font-bold text-purple-400">{val}€</span>
                                                        </div>
                                                        <Slider value={[val]} max={500} step={5} onValueChange={(vals) => handleSimulateChange(obj.id, p.id, vals[0])} className="py-1"/>
                                                        <div className="flex justify-between text-[10px] text-white/30 px-1"><span>0€</span><span>250€</span><span>500€</span></div>
                                                    </div>
                                                )
                                            })}
                                            {(!obj.paliers || obj.paliers.length === 0) && <p className="text-xs text-white/40 italic">Aucun palier configurable.</p>}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="fixed bottom-[88px] left-4 right-4 max-w-lg mx-auto bg-card border-t border-x border-border rounded-t-2xl p-4 shadow-2xl z-10">
                     <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Coût max par personne (35h)</span>
                            <span className="font-bold text-white">{simulationData.totalCostPerPerson}€</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Coût total équipe (Estimé)</span>
                            <span className={cn("font-bold text-lg", simulationData.isOverBudget ? "text-red-400" : "text-purple-400")}>{simulationData.teamTotalCost}€</span>
                        </div>
                        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold" onClick={handleSaveSimulation}>
                            <Save className="w-4 h-4 mr-2"/> Enregistrer la configuration
                        </Button>
                     </div>
                </div>
                <div className="h-32"/>
            </div>
        )}

        {activeTab === "equipe" && (
            <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-3 gap-3">
                    <div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none">
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center mb-2"><Target className="w-4 h-4 text-purple-500" /></div>
                        <span className="text-xl font-bold">{simulationData.activeObjectivesCount}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Objectifs actifs</span>
                    </div>
                    <div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-2"><Euro className="w-4 h-4 text-blue-500" /></div>
                        <span className="text-xl font-bold">{simulationData.totalCostPerPerson}€</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Prime potentielle</span>
                    </div>
                    <div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2"><Users className="w-4 h-4 text-emerald-500" /></div>
                        <span className="text-xl font-bold">{teamMembers.length}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Collaborateurs</span>
                    </div>
                </div>

                <div className="flex items-center justify-between"><h2 className="font-semibold text-sm">Primes au prorata</h2><span className="text-xs text-muted-foreground">Base {baseHours}h</span></div>
                <div className="space-y-3">
                    {teamMembers.map((member) => {
                        const ratio = member.contractHours / baseHours;
                        const potentialPrime = Math.round(simulationData.totalCostPerPerson * ratio);
                        return (
                            <div key={member.id} className="pulse-card p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm", member.color)}>{member.initials}</div>
                                    <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{member.name}</p><p className="text-xs text-muted-foreground">{member.role}</p></div>
                                    <div className="text-right"><p className="text-lg font-bold text-purple-400">{potentialPrime}€</p><p className="text-[10px] text-muted-foreground">potentiel</p></div>
                                </div>
                                <div className="flex justify-between items-center text-xs text-muted-foreground mt-2"><span>Contrat: {member.contractHours}h</span><span>Ratio: {Math.round(ratio * 100)}%</span></div>
                                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
                            </div>
                        )
                    })}
                    {teamMembers.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Aucun collaborateur trouvé.</p>}
                </div>

                <div className="mt-4 p-5 rounded-2xl bg-[#0f0f11] border border-white/5 text-white">
                    <div className="flex justify-between items-end mb-1">
                        <div><p className="text-xs text-white/60 mb-1">Budget total primes</p><p className="text-3xl font-bold">{simulationData.teamTotalCost}€</p></div>
                        <div className="text-right"><p className="text-[10px] text-white/40 mb-1">Potentiel Maximum (Cumulé)</p><p className="text-sm font-medium text-purple-400">{simulationData.totalCostPerPerson}€ / personne <span className="text-white/40 font-normal">(base 35h)</span></p></div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === "paliers" && (
            <div className="space-y-4 animate-in fade-in">
                {objectives.filter((o:any) => o.isActive).map((obj: any) => (
                    <div key={obj.id} className="space-y-3">
                        <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg">
                            <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{obj.title}</span></div>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddPalier(obj.id)}><Plus className="w-3 h-3 mr-1" /> Palier</Button>
                        </div>
                        <div className="space-y-2 pl-2 border-l-2 border-muted">
                            {obj.paliers?.sort((a:any, b:any) => (obj.direction === 'descending' ? b.threshold - a.threshold : a.threshold - b.threshold)).map((palier: any, index: number) => (
                                <div key={palier.id} className="pulse-card p-3 flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2"><span className="text-sm font-medium">{palier.name}</span></div>
                                        <p className="text-xs text-muted-foreground">{obj.direction === 'descending' ? "Si inférieur à" : "Si supérieur à"} : <strong>{palier.threshold} {obj.unit}</strong></p>
                                    </div>
                                    <div className="text-right"><p className="text-sm font-bold text-primary">+{palier.reward}€</p></div>
                                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setEditingPalier({ objectiveId: obj.id, palierId: palier.id, name: palier.name, threshold: palier.threshold, reward: palier.reward })}><Edit3 className="w-4 h-4 text-muted-foreground" /></Button>
                                </div>
                            ))}
                            {(!obj.paliers || obj.paliers.length === 0) && <p className="text-xs text-muted-foreground italic pl-2">Aucun palier défini.</p>}
                        </div>
                    </div>
                ))}
            </div>
        )}

      </main>

      {/* --- MODALES & DRAWERS --- */}
      {showAddObjective && <AddObjectiveAdvancedModal onClose={() => setShowAddObjective(false)} onConfirm={handleCreateObjective} />}
      {showPlanning && <AddPlanningAdvancedModal onClose={() => setShowPlanning(false)} onConfirm={handleCreatePlanning} />}
      {showAddPalier && (
        <AddPalierModal onClose={() => setShowAddPalier(null)} onConfirm={(n, t, r) => handleAddPalierConfirm(showAddPalier, n, t, r)} objective={objectives.find((o:any) => o.id === showAddPalier)} />
      )}
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
      {showEditHours && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setShowEditHours(false)}>
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-4 text-lg">Configuration Horaire</h2>
            <div className="space-y-4">
              <div><Label className="text-sm">Heures temps plein (référence)</Label><Input type="number" value={baseHours} onChange={(e) => setBaseHours(Number(e.target.value))} className="rounded-xl mt-2" /></div>
              <div><Label className="text-sm">Budget Max (€)</Label><Input type="number" value={budgetMax} onChange={(e) => setBudgetMax(Number(e.target.value))} className="rounded-xl mt-2" /></div>
              <Button className="w-full rounded-xl" onClick={handleUpdateBaseHours}><Save className="w-4 h-4 mr-2" /> Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 MODIFICATION : On passe la fonction de suppression */}
      <ObjectiveDetailDrawer 
        objective={selectedObj} 
        onClose={() => setSelectedObj(null)} 
        onUpdateProgress={updateProgress}
        onDelete={() => selectedObj && handleDeleteObjective(selectedObj.id)} 
      />

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
    const [isPrincipal, setIsPrincipal] = useState(false)
    const [isConfidential, setIsConfidential] = useState(false)

    useEffect(() => { const p = OBJECTIVE_PRESETS.find(p => p.id === selectedPreset); if(p) { setTitle(p.label); setDescription(p.desc); } }, [selectedPreset])

    const handleSubmit = () => {
        const p = OBJECTIVE_PRESETS.find(p => p.id === selectedPreset)!
        onConfirm({ title, description, target, unit: p.unit, direction: p.direction, type: isPrincipal ? 'principal' : 'secondaire', isConfidential })
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-6 pb-10" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center"><h2 className="text-lg font-bold">Nouvel Objectif</h2><Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5"/></Button></div>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className="bg-muted/30 p-3 rounded-xl flex-1 flex items-center justify-between border border-border">
                            <Label className="text-xs font-bold flex items-center gap-1"><Crown className="w-3 h-3 text-amber-500" /> Principal</Label>
                            <Switch checked={isPrincipal} onCheckedChange={setIsPrincipal} />
                        </div>
                        <div className="bg-muted/30 p-3 rounded-xl flex-1 flex items-center justify-between border border-border">
                            <Label className="text-xs font-bold flex items-center gap-1"><EyeOff className="w-3 h-3 text-muted-foreground" /> Masquer</Label>
                            <Switch checked={isConfidential} onCheckedChange={setIsConfidential} />
                        </div>
                    </div>
                    <div><Label className="mb-2 block">Type d'objectif</Label><div className="grid grid-cols-3 gap-2">{OBJECTIVE_PRESETS.map(preset => (<button key={preset.id} onClick={() => setSelectedPreset(preset.id)} className={cn("flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all text-xs text-center h-20", selectedPreset === preset.id ? "border-purple-500 bg-purple-500/10 text-purple-500 font-semibold ring-1 ring-purple-500/20" : "border-border bg-muted/20 text-muted-foreground hover:bg-muted")}><preset.icon className="w-5 h-5" /><span>{preset.label}</span></button>))}</div></div>
                    <div><Label>Titre</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1.5"/></div>
                    <div className="grid grid-cols-2 gap-4"><div><Label>Cible</Label><Input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0" className="mt-1.5 font-bold" /></div><div><Label>Unité</Label><div className="flex h-10 items-center justify-center rounded-md border bg-muted font-bold text-muted-foreground mt-1.5">{OBJECTIVE_PRESETS.find(p => p.id === selectedPreset)?.unit}</div></div></div>
                    <Button className="w-full py-6 text-base bg-purple-600 hover:bg-purple-700" onClick={handleSubmit} disabled={!target}>Créer l'objectif</Button>
                </div>
            </div>
        </div>
    )
}

function AddPlanningAdvancedModal({ onClose, onConfirm }: { onClose: () => void, onConfirm: (data: any) => void }) {
    const [selectedPreset, setSelectedPreset] = useState<string>("ca")
    const [startMonth, setStartMonth] = useState("Février")
    const [startYear, setStartYear] = useState("2026")
    const [duration, setDuration] = useState(1)
    const [title, setTitle] = useState("Chiffre d'Affaires")
    const [target, setTarget] = useState("")
    const [isPrincipal, setIsPrincipal] = useState(false)
    const [isConfidential, setIsConfidential] = useState(false)
    const [paliers, setPaliers] = useState<any[]>([]) 
    const [palierName, setPalierName] = useState("")
    const [palierThreshold, setPalierThreshold] = useState("")
    const [palierReward, setPalierReward] = useState("")

    useEffect(() => { const p = OBJECTIVE_PRESETS.find(p => p.id === selectedPreset); if(p) setTitle(p.label); }, [selectedPreset])

    const handleAddPalier = () => {
        if (!palierName || !palierThreshold || !palierReward) return;
        setPaliers([...paliers, { id: Date.now().toString(), name: palierName, threshold: Number(palierThreshold), reward: Number(palierReward) }]);
        setPalierName(""); setPalierThreshold(""); setPalierReward("");
    }
    const handleRemovePalier = (id: string) => { setPaliers(paliers.filter(p => p.id !== id)); }
    const handleSubmit = () => {
        const p = OBJECTIVE_PRESETS.find(p => p.id === selectedPreset)!
        onConfirm({ title, target, unit: p.unit, direction: p.direction, startMonth, startYear, duration, type: isPrincipal ? 'principal' : 'secondaire', isConfidential, paliers })
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-6 pb-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center"><h2 className="text-lg font-bold">Programmer un objectif</h2><Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5"/></Button></div>
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4"><div><Label className="mb-2 block">Mois de début</Label><Select value={startMonth} onValueChange={setStartMonth}><SelectTrigger className="h-10 bg-muted/30"><SelectValue /></SelectTrigger><SelectContent>{["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div><div><Label className="mb-2 block">Année</Label><Select value={startYear} onValueChange={setStartYear}><SelectTrigger className="h-10 bg-muted/30"><SelectValue /></SelectTrigger><SelectContent>{["2025", "2026", "2027"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div></div>
                    <div><Label className="mb-2 block">Durée</Label><div className="flex gap-2">{[1, 3, 6, 12].map(d => (<button key={d} onClick={() => setDuration(d)} className={cn("flex-1 py-2 rounded-lg text-sm border transition-all", duration === d ? "bg-purple-600 text-white border-purple-600" : "bg-muted/20 border-border text-muted-foreground")}>{d} mois</button>))}</div></div>
                    <div className="flex gap-2">
                        <div className="bg-muted/30 p-3 rounded-xl flex-1 flex items-center justify-between border border-border"><Label className="text-xs font-bold flex items-center gap-1"><Crown className="w-3 h-3 text-amber-500" /> Principal</Label><Switch checked={isPrincipal} onCheckedChange={setIsPrincipal} /></div>
                        <div className="bg-muted/30 p-3 rounded-xl flex-1 flex items-center justify-between border border-border"><Label className="text-xs font-bold flex items-center gap-1"><EyeOff className="w-3 h-3 text-muted-foreground" /> Masquer</Label><Switch checked={isConfidential} onCheckedChange={setIsConfidential} /></div>
                    </div>
                    <div><Label className="mb-2 block">Type d'objectif</Label><div className="grid grid-cols-3 gap-2">{OBJECTIVE_PRESETS.map(preset => (<button key={preset.id} onClick={() => setSelectedPreset(preset.id)} className={cn("flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all text-xs text-center h-20", selectedPreset === preset.id ? "border-purple-500 bg-purple-500/10 text-purple-500 font-semibold ring-1 ring-purple-500/20" : "border-border bg-muted/20 text-muted-foreground hover:bg-muted")}><preset.icon className="w-5 h-5" /><span>{preset.label}</span></button>))}</div></div>
                    <div><Label>Cible prévue</Label><Input type="number" value={target} onChange={e => setTarget(e.target.value)} className="mt-1.5 font-bold" placeholder="0" /></div>
                    <div className="border-t border-border pt-4">
                        <Label className="mb-3 block text-sm font-semibold">Configuration des paliers</Label>
                        <div className="space-y-3 mb-4">{paliers.map((p, idx) => (<div key={p.id} className="flex items-center justify-between bg-muted/20 p-2 rounded-lg text-sm"><span className="font-medium text-xs">{idx + 1}. {p.name} (Seuil: {p.threshold})</span><div className="flex items-center gap-2"><span className="font-bold text-green-600">+{p.reward}€</span><button onClick={() => handleRemovePalier(p.id)}><Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500" /></button></div></div>))}{paliers.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">Aucun palier configuré</p>}</div>
                        <div className="grid grid-cols-3 gap-2 items-end"><div><Label className="text-[10px] mb-1">Nom</Label><Input value={palierName} onChange={e => setPalierName(e.target.value)} placeholder="Niveau 1" className="h-8 text-xs" /></div><div><Label className="text-[10px] mb-1">Seuil</Label><Input type="number" value={palierThreshold} onChange={e => setPalierThreshold(e.target.value)} placeholder="1000" className="h-8 text-xs" /></div><div><Label className="text-[10px] mb-1">Prime</Label><Input type="number" value={palierReward} onChange={e => setPalierReward(e.target.value)} placeholder="50" className="h-8 text-xs" /></div></div>
                        <Button variant="outline" size="sm" className="w-full mt-2 h-8 text-xs" onClick={handleAddPalier} disabled={!palierName || !palierThreshold || !palierReward}><Plus className="w-3 h-3 mr-1" /> Ajouter ce palier</Button>
                    </div>
                    <Button className="w-full py-6 text-base bg-purple-600 hover:bg-purple-700" onClick={handleSubmit} disabled={!target}>Valider la planification</Button>
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
              <div><Label>{isDescending ? `Seuil max autorisé (${objective.unit})` : `Seuil à atteindre (${objective.unit})`}</Label><Input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="1000" className="rounded-xl mt-1" /></div>
              <div><Label>Récompense (€)</Label><Input type="number" value={reward} onChange={e => setReward(e.target.value)} placeholder="50" className="rounded-xl mt-1" /></div>
              <Button className="w-full rounded-xl" onClick={() => onConfirm(name, Number(threshold), Number(reward))} disabled={!name || !threshold}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
            </div>
          </div>
        </div>
    )
}

function ObjectiveDetailDrawer({ 
    objective, 
    onClose, 
    onUpdateProgress,
    onDelete // 🔴 NOUVELLE PROP
}: { 
    objective: any, 
    onClose: () => void, 
    onUpdateProgress: (amount: number, date?: string) => void,
    onDelete: () => void 
}) {
    const [updateVal, setUpdateVal] = useState("")
    const [updateDate, setUpdateDate] = useState("")

    if (!objective) return null

    return (
        <Drawer open={!!objective} onOpenChange={(open) => !open && onClose()}>
            <DrawerContent className="fixed bottom-0 left-0 right-0 h-[96vh] flex flex-col outline-none bg-card rounded-t-3xl">
                <div className="w-full max-w-lg mx-auto flex flex-col h-full overflow-hidden">
                    <DrawerHeader className="text-left border-b border-border/50 pb-4 shrink-0">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/10 mx-auto mb-3"><Target className="w-6 h-6 text-purple-500" /></div>
                        <div className="text-center space-y-1"><Badge variant="outline" className="mb-2 border-purple-500/30 text-purple-400 bg-purple-500/10">{objective.type === "principal" ? "Principal" : "Secondaire"}</Badge><DrawerTitle className="text-2xl font-bold">{objective.title}</DrawerTitle><p className="text-sm text-muted-foreground px-4">{objective.description}</p></div>
                    </DrawerHeader>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        <div className="flex flex-col items-center"><CircularProgress value={objective.current} max={objective.target} direction={objective.direction} size={160} strokeWidth={12} /></div>
                        <div className="bg-purple-500/5 border border-purple-500/20 p-4 rounded-2xl space-y-3"><h3 className="font-bold text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-purple-500" /> Mettre à jour la progression</h3><div className="flex gap-2"><Input type="number" placeholder="Montant..." value={updateVal} onChange={(e) => setUpdateVal(e.target.value)} className="bg-background flex-1" /><Input type="date" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)} className="bg-background w-32" /><Button onClick={() => { onUpdateProgress(Number(updateVal), updateDate); setUpdateVal(""); setUpdateDate(""); }} className="bg-purple-600 hover:bg-purple-700"><Plus className="w-4 h-4" /></Button></div></div>
                        <div><h3 className="font-bold text-base mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-500" /> Historique complet</h3><div className="space-y-1 pb-4">{objective.history && objective.history.length > 0 ? ([...objective.history].reverse().map((h: any, i: number) => (<div key={i} className="flex justify-between items-center p-3 rounded-xl hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0"><div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-purple-500" /><span className="text-sm font-medium">{h.date}</span></div><div className="flex items-center gap-4"><span className="font-bold text-sm">{(h.value||0).toLocaleString()} {objective.unit}</span><span className="text-xs font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">+{h.change}</span></div></div>))) : (<p className="text-sm text-muted-foreground italic">Aucun historique.</p>)}</div></div>
                    </div>
                    {/* 🔴 FOOTER MODIFIÉ AVEC BOUTON SUPPRIMER */}
                    <DrawerFooter className="pt-2 pb-6 px-4 shrink-0 bg-card border-t border-border/50 flex-col gap-2">
                        <Button variant="destructive" className="w-full rounded-xl gap-2" onClick={onDelete}>
                            <Trash2 className="w-4 h-4" /> Supprimer l'objectif
                        </Button>
                        <DrawerClose asChild><Button variant="outline" className="w-full rounded-xl">Fermer</Button></DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

function CircularProgress({ value, max, size = 180, strokeWidth = 12, direction = "ascending" }: { value: number, max: number, size?: number, strokeWidth?: number, direction?: string }) {
    const safeValue = value || 0; const safeMax = max || 1;
    const radius = (size - strokeWidth) / 2; const circumference = radius * 2 * Math.PI;
    let percentage = 0;
    if (direction === 'descending') { percentage = safeValue <= safeMax ? 100 : Math.max(0, (safeMax / (safeValue || 1)) * 100); } else { percentage = Math.min(100, Math.max(0, (safeValue / safeMax) * 100)); }
    const offset = circumference - (percentage / 100) * circumference;
    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90"><circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-muted/20" /><circle cx={size / 2} cy={size / 2} r={radius} stroke="url(#gradient)" strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" /><defs><linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#a855f7" /></linearGradient></defs></svg>
            <div className="absolute flex flex-col items-center"><span className="text-4xl font-bold tracking-tighter">{Math.round(percentage)}%</span><span className="text-[10px] text-muted-foreground mt-1 font-medium">{safeValue.toLocaleString()} / {safeMax.toLocaleString()}</span></div>
        </div>
    )
}
