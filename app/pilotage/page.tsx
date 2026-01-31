"use client"

import { useState, useMemo, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { usePermissions } from "@/hooks/use-permissions"
import { useObjectives } from "@/hooks/use-objectives"
import { useAuth } from "@/components/auth/auth-provider"
import {
  Target, TrendingUp, TrendingDown, Minus, Clock, Plus, Edit3, Trash2, X, Euro, Users,
  Layers, Save, Wallet, ChevronDown, ChevronUp, Calendar, Loader2,
  Percent, Hash, AlertTriangle, ThumbsUp, Crown, Lock, EyeOff, CheckCircle2
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer"

import {
  demoAddObjective,
  demoDeleteObjective,
  demoGetMembers,
  demoGetPilotage,
  demoSetPilotage,
  demoUpdateObjective,
  subscribeDemo,
} from "@/lib/demo/local-demo-store"

import { doc, updateDoc, addDoc, collection, onSnapshot, query, getDoc, setDoc, deleteDoc, arrayUnion, where } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { format } from "date-fns"
import { addMonthsSafe } from "@/lib/objective-period"
import { fr } from "date-fns/locale"

// --- TYPES & CONSTANTES ---

type TabValue = "objectifs" | "budget" | "equipe"

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

const OBJECTIVE_PRESETS = [
  { id: "ca", label: "Chiffre d'Affaires", icon: Euro, unit: "€", direction: "ascending", desc: "Augmenter le revenu" },
  { id: "error", label: "Taux d'erreur", icon: AlertTriangle, unit: "%", direction: "descending", desc: "Réduire les erreurs" },
  { id: "volume", label: "Volume Commandes", icon: Hash, unit: "cmd", direction: "ascending", desc: "Augmenter la production" },
  { id: "satisfaction", label: "Satisfaction Client", icon: ThumbsUp, unit: "/5", direction: "ascending", desc: "Améliorer la notation" },
  { id: "margin", label: "Marge Brute", icon: Percent, unit: "%", direction: "ascending", desc: "Optimiser la rentabilité" },
]

export default function PilotagePage() {
  const { profile, isDemo } = useAuth()
  const { canEdit } = usePermissions()
  // NOTE: useObjectives() est la source Firestore (temps réel). On garde une copie locale
  // pour permettre des mises à jour optimistes instantanées dans Pilotage.
  const { objectives: liveObjectives, loading: loadingObj } = useObjectives()
  const { toast } = useToast()

  const [objectives, setObjectives] = useState<any[]>([])

  const [activeTab, setActiveTab] = useState<TabValue>("objectifs")
  const [baseHours, setBaseHours] = useState(35)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  
  const [showEditHours, setShowEditHours] = useState(false)
  const [editingPalier, setEditingPalier] = useState<EditingPalier | null>(null)
  const [showAddPalier, setShowAddPalier] = useState<string | null>(null)
  const [selectedObj, setSelectedObj] = useState<any | null>(null)
  const [showAddObjective, setShowAddObjective] = useState(false)
  const [showPlanning, setShowPlanning] = useState(false)
  
  const [budgetMax, setBudgetMax] = useState(2000)
  const [simulatedPaliers, setSimulatedPaliers] = useState<Record<string, Record<string, number>>>({})
  const [expandedSim, setExpandedSim] = useState<string | null>(null)

  // Sync live (Firestore) -> local
  useEffect(() => {
    setObjectives(liveObjectives as any)
  }, [liveObjectives])

  // 1. TRIER LES OBJECTIFS
  const sortedObjectives = useMemo(() => {
    return [...objectives].sort((a, b) => {
      if (a.type === 'principal') return -1;
      if (b.type === 'principal') return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [objectives]);

  // CHARGEMENT DATA
  useEffect(() => {
    if (!profile?.companyId) return;
    const companyId = profile.companyId

    // --- MODE DÉMO : users + config depuis localStorage ---
    if (isDemo) {
      const colors = ["bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-indigo-500", "bg-emerald-500"]
      const load = () => {
        const demoMembers = demoGetMembers(companyId)
        const members: TeamMember[] = demoMembers.map((m) => {
          const initials = (m.displayName || m.email || "??").substring(0, 2).toUpperCase()
          return {
            id: m.id,
            name: m.displayName || m.email || "Inconnu",
            role: m.role || "Employé",
            contractHours: Number(m.contractHours) || 35,
            initials,
            color: colors[initials.charCodeAt(0) % colors.length],
          }
        })
        setTeamMembers(members)

        const cfg = demoGetPilotage(companyId)
        if (cfg) {
          setBaseHours(cfg.baseHours || 35)
          setBudgetMax(cfg.budgetMax || 2000)
        }
      }

      load()
      const unsub = subscribeDemo(companyId, load)
      return () => unsub()
    }

    // --- MODE RÉEL : Firestore ---
    const q = query(collection(db, "users"), where("companyId", "==", companyId))
    const unsubUsers = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        if (data.role === "super_admin" || data.companyName === "Non assigné") return null

        const initials = (data.displayName || data.email || "??").substring(0, 2).toUpperCase()
        const colors = ["bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-indigo-500", "bg-emerald-500"]
        return {
          id: docSnap.id,
          name: data.displayName || data.email || "Inconnu",
          role: data.role || "Employé",
          contractHours: Number(data.contractHours) || 35,
          initials,
          color: colors[initials.charCodeAt(0) % colors.length],
        }
      })
      setTeamMembers(members.filter(Boolean) as TeamMember[])
    })
    const loadConfig = async () => {
      const companyCfgRef = doc(db, "pilotage_config", companyId)
      const docSnap = await getDoc(companyCfgRef)
      if (docSnap.exists()) {
        setBaseHours(docSnap.data().baseHours || 35)
        setBudgetMax(docSnap.data().budgetMax || 2000)
      } else {
        // Fallback rétro-compat: ancien doc global
        const fallbackCfg = await getDoc(doc(db, "config", "pilotage"))
        if (fallbackCfg.exists()) {
          setBaseHours(fallbackCfg.data().baseHours || 35)
          setBudgetMax(fallbackCfg.data().budgetMax || 2000)
        }
      }
    }
    loadConfig()
    return () => unsubUsers()
  }, [profile?.companyId, isDemo])

  // INIT SIMULATION
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

  // CALCULS BUDGET
  const simulationData = useMemo(() => {
    let totalCostPerPerson = 0
    const principalObj = objectives.find((o: any) => o.type === 'principal');
    const isPrincipalMet = !principalObj || (principalObj.direction === 'descending' 
        ? ((principalObj.current || 0) <= (principalObj.target || 1)) 
        : ((principalObj.current || 0) >= (principalObj.target || 1))
    );

    objectives.forEach((obj: any) => {
      if (!obj.isActive && activeTab !== 'budget') return;
      if (obj.type === 'secondaire' && !isPrincipalMet && activeTab !== 'budget') return;

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
    const budgetUsage = Math.min(100, (teamTotalCost / (budgetMax || 1)) * 100);

    return {
      teamTotalCost, budgetDiff: budgetMax - teamTotalCost, isOverBudget: teamTotalCost > budgetMax, budgetUsage,
      totalCostPerPerson, activeObjectivesCount: objectives.filter(o => o.isActive).length, isPrincipalMet
    }
  }, [objectives, simulatedPaliers, baseHours, budgetMax, teamMembers, activeTab])

  // --- ACTIONS ---
  const handleSimulateChange = (objId: string, palierId: string, value: number) => {
    setSimulatedPaliers(prev => ({ ...prev, [objId]: { ...prev[objId], [palierId]: value } }))
  }

  const handleSaveSimulation = async () => {
      try {
        if (!profile?.companyId) return
        const companyId = profile.companyId

        // --- MODE DÉMO : écriture locale uniquement ---
        if (isDemo) {
          Object.keys(simulatedPaliers).forEach((objId) => {
            const obj: any = objectives.find((o: any) => o.id === objId)
            if (!obj) return
            const newPaliers = (obj.paliers || []).map((p: any) => ({
              ...p,
              reward: simulatedPaliers[objId]?.[p.id] ?? p.reward,
            }))
            demoUpdateObjective(companyId, objId, { paliers: newPaliers } as any)
          })
          demoSetPilotage(companyId, { baseHours, budgetMax })
          toast({ title: "Configuration sauvegardée ✅" })
          return
        }

        // --- MODE RÉEL : Firestore ---
        const updates = Object.keys(simulatedPaliers).map(async (objId) => {
          const obj: any = objectives.find((o: any) => o.id === objId)
          if (!obj) return
          const newPaliers = (obj.paliers || []).map((p: any) => ({
            ...p,
            reward: simulatedPaliers[objId]?.[p.id] ?? p.reward,
          }))
          await updateDoc(doc(db, "objectives", objId), { paliers: newPaliers })
        })
        await Promise.all(updates)
        await setDoc(
          doc(db, "pilotage_config", companyId),
          { baseHours, budgetMax, companyId },
          { merge: true },
        )
        toast({ title: "Configuration sauvegardée ✅" })
      } catch (e) {
        toast({ title: "Erreur sauvegarde", variant: "destructive" })
      }
  }

  const handleUpdateBaseHours = async () => {
    try {
      if (!profile?.companyId) return
      const companyId = profile.companyId
      if (isDemo) {
        demoSetPilotage(companyId, { baseHours, budgetMax })
        setShowEditHours(false)
        toast({ title: "Config sauvegardée" })
        return
      }
      await setDoc(doc(db, "pilotage_config", companyId), { baseHours, budgetMax, companyId }, { merge: true })
      setShowEditHours(false)
      toast({ title: "Config sauvegardée" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleCreateObjective = async (data: any) => {
    if (!profile?.companyId) return
    const companyId = profile.companyId
    try {
      const createdAt = new Date().toISOString()
      const durationMonths = (data?.durationMonths ?? null) as (number | null)
      // Date de commencement (par défaut : aujourd'hui)
      const start = data?.startDate ? new Date(String(data.startDate)) : new Date()
      const safeStart = Number.isNaN(start.getTime()) ? new Date() : start
      const periodStart = safeStart.toISOString()
      const periodEnd = durationMonths ? addMonthsSafe(safeStart, durationMonths).toISOString() : null
      const payload = {
        companyId,
        title: data.title,
        description: data.description || "",
        isActive: true,
        type: data.type || "secondaire",
        target: Number(data.target),
        unit: data.unit,
        direction: data.direction,
        current: 0,
        paliers: [],
        history: [],
        isConfidential: data.isConfidential || false,
        periodStart,
        periodEnd,
        periodMonths: durationMonths,
        deadline: periodEnd,
        createdAt,
      }

      if (isDemo) {
        demoAddObjective(companyId, { id: `demo-obj-${Date.now()}`, ...(payload as any) } as any)
        setShowAddObjective(false)
        toast({ title: "Objectif créé (démo)" })
        return
      }

      await addDoc(collection(db, "objectives"), payload)
      setShowAddObjective(false)
      toast({ title: "Objectif créé" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleCreatePlanning = async (data: any) => {
    if (!profile?.companyId) return
    const companyId = profile.companyId
    try {
      if (isDemo) {
        setShowPlanning(false)
        toast({ title: "Planification enregistrée (démo)" })
        return
      }
      await addDoc(collection(db, "plannings"), {
        companyId,
        ...data,
        createdAt: new Date().toISOString(),
        status: "scheduled",
      })
      setShowPlanning(false)
      toast({ title: "Planifié" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }
  
  const updateProgress = async (nextTotal: number, dateStr?: string) => {
    if (!selectedObj) return

    const targetDate = dateStr ? new Date(dateStr) : new Date()
    const formattedDate = format(targetDate, "d MMM", { locale: fr })

    const newTotal = Number(nextTotal)
    if (!Number.isFinite(newTotal)) {
      toast({ title: "Valeur invalide", variant: "destructive" })
      return
    }

    if (!profile?.companyId) return
    const companyId = profile.companyId

    // --- Optimistic UI: on met à jour instantanément sans reload ---
    const prevLocal = Number(selectedObj?.current || 0)
    const changeLocal = newTotal - prevLocal
    const optimisticHistory = [
      ...(Array.isArray(selectedObj?.history) ? selectedObj.history : []),
      {
        date: formattedDate,
        value: newTotal,
        change: changeLocal,
        timestamp: targetDate.toISOString(),
      },
    ]
    const optimisticObj = {
      ...selectedObj,
      current: newTotal,
      history: optimisticHistory,
    }

    setSelectedObj(optimisticObj as any)
    setObjectives((prev) => prev.map((o: any) => (o.id === selectedObj.id ? { ...o, current: newTotal, history: optimisticHistory } : o)))

    try {
      // En démo : stockage local (valeur TOTALE, pas un ajout)
      if (isDemo) {
        demoUpdateObjective(companyId, selectedObj.id, { current: newTotal, history: optimisticHistory } as any)
        toast({ title: "Mise à jour enregistrée (démo)" })
        return
      }

      // En pro : on écrit sans recharger : l'onSnapshot confirmera / mettra à jour ensuite.
      const ref = doc(db, "objectives", selectedObj.id)
      await updateDoc(ref, {
        current: newTotal,
        history: arrayUnion({
          date: formattedDate,
          value: newTotal,
          change: changeLocal,
          timestamp: targetDate.toISOString(),
        }),
      })

      toast({ title: "Mise à jour enregistrée" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const updateObjectivePeriod = async (objectiveId: string, periodStartISO: string, periodMonths: number | null) => {
    if (!profile?.companyId) return
    const companyId = profile.companyId

    const start = new Date(periodStartISO)
    const end = periodMonths == null ? null : addMonthsSafe(start, periodMonths)
    const periodEnd = end ? end.toISOString() : null

    // Optimistic UI
    setObjectives((prev) =>
      prev.map((o: any) =>
        o.id === objectiveId
          ? { ...o, periodStart: start.toISOString(), periodEnd, periodMonths, deadline: periodEnd }
          : o
      )
    )
    setSelectedObj((prev: any) =>
      prev && prev.id === objectiveId
        ? { ...prev, periodStart: start.toISOString(), periodEnd, periodMonths, deadline: periodEnd }
        : prev
    )

    try {
      if (isDemo) {
        demoUpdateObjective(companyId, objectiveId, {
          periodStart: start.toISOString(),
          periodEnd,
          periodMonths,
          deadline: periodEnd,
        } as any)
        toast({ title: "Période mise à jour (démo)" })
        return
      }
      await updateDoc(doc(db, "objectives", objectiveId), {
        periodStart: start.toISOString(),
        periodEnd,
        periodMonths,
        deadline: periodEnd,
      })
      toast({ title: "Période mise à jour" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }
  const handleAddPalierConfirm = async (objectiveId: string, name: string, threshold: number, reward: number) => {
    const obj: any = objectives.find((o: any) => o.id === objectiveId)
    if (!obj) return
    const newPalier = { id: `p-${Date.now()}`, name, threshold, reward }
    const newPaliers = [...(obj.paliers || []), newPalier]
    // Optimistic UI
    setObjectives((prev) => prev.map((o: any) => (o.id === objectiveId ? { ...o, paliers: newPaliers } : o)))
    setSelectedObj((prev: any) => (prev && prev.id === objectiveId ? { ...prev, paliers: newPaliers } : prev))

    try {
      if (isDemo && profile?.companyId) {
        demoUpdateObjective(profile.companyId, objectiveId, { paliers: newPaliers } as any)
      } else {
        await updateDoc(doc(db, "objectives", objectiveId), { paliers: newPaliers })
      }
      setShowAddPalier(null)
      toast({ title: "Palier ajouté" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleUpdatePalierConfirm = async () => {
    if (!editingPalier) return
    const obj: any = objectives.find((o: any) => o.id === editingPalier.objectiveId)
    if (!obj) return
    const newPaliers = (obj.paliers || []).map((p: any) =>
      p.id === editingPalier.palierId
        ? { ...p, name: editingPalier.name, threshold: editingPalier.threshold, reward: editingPalier.reward }
        : p,
    )
    // Optimistic UI
    setObjectives((prev) => prev.map((o: any) => (o.id === editingPalier.objectiveId ? { ...o, paliers: newPaliers } : o)))
    setSelectedObj((prev: any) => (prev && prev.id === editingPalier.objectiveId ? { ...prev, paliers: newPaliers } : prev))

    try {
      if (isDemo && profile?.companyId) {
        demoUpdateObjective(profile.companyId, editingPalier.objectiveId, { paliers: newPaliers } as any)
      } else {
        await updateDoc(doc(db, "objectives", editingPalier.objectiveId), { paliers: newPaliers })
      }
      setEditingPalier(null)
      toast({ title: "Palier modifié" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleDeletePalier = async () => {
    if (!editingPalier) return
    if (!confirm("Supprimer ?")) return
    const obj: any = objectives.find((o: any) => o.id === editingPalier.objectiveId)
    if (!obj) return
    const newPaliers = (obj.paliers || []).filter((p: any) => p.id !== editingPalier.palierId)
    // Optimistic UI
    setObjectives((prev) => prev.map((o: any) => (o.id === editingPalier.objectiveId ? { ...o, paliers: newPaliers } : o)))
    setSelectedObj((prev: any) => (prev && prev.id === editingPalier.objectiveId ? { ...prev, paliers: newPaliers } : prev))

    try {
      if (isDemo && profile?.companyId) {
        demoUpdateObjective(profile.companyId, editingPalier.objectiveId, { paliers: newPaliers } as any)
      } else {
        await updateDoc(doc(db, "objectives", editingPalier.objectiveId), { paliers: newPaliers })
      }
      setEditingPalier(null)
      toast({ title: "Supprimé" })
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleDeleteObjective = async (id: string) => {
    if (!confirm("Supprimer cet objectif ?")) return
    try {
      if (isDemo && profile?.companyId) {
        demoDeleteObjective(profile.companyId, id)
      } else {
        await deleteDoc(doc(db, "objectives", id))
      }
      toast({ title: "Supprimé" })
      setSelectedObj(null)
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  // --- HELPERS TENDANCE ---
  const getTrend = (obj: any) => {
    if (!obj.history || obj.history.length === 0) return { icon: Minus, color: "text-muted-foreground", bg: "bg-muted", text: "Stable" };
    const lastEntry = obj.history[obj.history.length - 1];
    
    if (lastEntry.change > 0) return { icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-200", text: `+${lastEntry.change}` };
    if (lastEntry.change < 0) return { icon: TrendingDown, color: "text-red-600", bg: "bg-red-500/10 border-red-200", text: `${lastEntry.change}` };
    
    return { icon: Minus, color: "text-muted-foreground", bg: "bg-muted", text: "Stable" };
  }

  if (loadingObj) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  return (
    <PermissionGate moduleId="pilotage" redirect>
      <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Pilotage</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Objectifs, budget et primes</p>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/50 border border-border text-xs font-medium cursor-pointer hover:bg-muted" onClick={() => setShowEditHours(true)}>
                  <Clock className="w-3.5 h-3.5" /> {baseHours}h
                </div>
            </div>
        </div>

        {!simulationData.isPrincipalMet && objectives.some(o => o.type === 'principal') && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3">
                <Lock className="w-5 h-5 text-amber-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-700">Primes verrouillées</p>
                  <p className="text-xs text-amber-600/80">Atteignez l'objectif principal pour débloquer</p>
                </div>
            </div>
        )}

        {/* Onglets simplifiés */}
        <div className="bg-muted/50 p-1 rounded-2xl flex">
            <button onClick={() => setActiveTab("objectifs")} className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2", activeTab === "objectifs" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
              <Target className="w-4 h-4" /> Objectifs
            </button>
            <button onClick={() => setActiveTab("budget")} className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2", activeTab === "budget" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
              <Wallet className="w-4 h-4" /> Budget
            </button>
            <button onClick={() => setActiveTab("equipe")} className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2", activeTab === "equipe" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
              <Users className="w-4 h-4" /> Équipe
            </button>
        </div>

        {activeTab === "objectifs" && (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <div><h2 className="font-semibold text-sm">Objectifs actifs</h2><p className="text-xs text-muted-foreground">Progression en temps réel</p></div>
                    <Button size="sm" className="rounded-full bg-purple-500 hover:bg-purple-600 text-white px-4" onClick={() => setShowAddObjective(true)}><Plus className="w-4 h-4 mr-2" /> Créer</Button>
                </div>
                {sortedObjectives.map((obj: any) => {
                    const isLocked = obj.type === 'secondaire' && !simulationData.isPrincipalMet;
                    const trend = getTrend(obj);
                    
                    return (
                        <div key={obj.id} onClick={() => setSelectedObj(obj)} className={cn("pulse-card p-6 bg-gradient-to-b from-card to-muted/20 cursor-pointer hover:border-primary/50 transition-all group relative overflow-hidden", isLocked && "opacity-60 grayscale-[0.5]")}>
                            {/* Tendance Badge Flottant */}
                            <div className={cn("absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm shadow-sm", trend.bg, trend.color)}>
                                <trend.icon className="w-3 h-3" />
                                {trend.text}
                            </div>

                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-purple-400">
                                    {obj.type === 'principal' && <Crown className="w-4 h-4 text-amber-400" />}
                                    <Target className="w-4 h-4" />
                                    <span className={cn("text-xs font-bold uppercase tracking-wider", obj.type === 'principal' ? "text-amber-400" : "")}>{obj.type === 'principal' ? 'Principal' : 'Secondaire'}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center mb-6">
                                <CircularProgress value={obj.current} max={obj.target} direction={obj.direction} />
                                <h2 className="text-xl font-bold mt-4">{obj.title}</h2>
                                <p className="text-center text-xs text-muted-foreground mt-1 max-w-[280px] leading-relaxed">{obj.description}</p>
                            </div>
                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between text-sm font-medium"><span className="text-muted-foreground">Progression</span><span>{(obj.current || 0).toLocaleString()} / {(obj.target || 0).toLocaleString()} {obj.unit}</span></div>
                                <div className="h-2.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(((obj.current || 0) / (obj.target || 1)) * 100, 100)}%` }} /></div>
                            </div>
                        </div>
                    )
                })}
            </div>
        )}

        {activeTab === "budget" && (
           <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-3 gap-3">
                    <div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none"><div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center mb-2"><Target className="w-4 h-4 text-purple-500" /></div><span className="text-xl font-bold">{simulationData.activeObjectivesCount}</span><span className="text-[10px] text-muted-foreground uppercase font-bold">Objectifs</span></div>
                    <div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none"><div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-2"><Euro className="w-4 h-4 text-blue-500" /></div><span className="text-xl font-bold">{simulationData.totalCostPerPerson}€</span><span className="text-[10px] text-muted-foreground uppercase font-bold">Max / Pers</span></div>
                    <div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none"><div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2"><Users className="w-4 h-4 text-emerald-500" /></div><span className="text-xl font-bold">{teamMembers.length}</span><span className="text-[10px] text-muted-foreground uppercase font-bold">Équipe</span></div>
                </div>
                <div className={cn("p-5 rounded-2xl border transition-all duration-500", simulationData.isOverBudget ? "bg-red-500/10 border-red-500/30" : "bg-emerald-500/10 border-emerald-500/30")}><div className="flex justify-between items-center mb-3"><div className="flex items-center gap-2"><div className={cn("p-2 rounded-lg", simulationData.isOverBudget ? "bg-red-500 text-white" : "bg-emerald-500 text-white")}><Wallet className="w-5 h-5" /></div><div><h3 className="font-bold text-sm">{simulationData.isOverBudget ? "Attention Budget !" : "Budget Maîtrisé"}</h3><p className="text-xs text-muted-foreground">Coût total estimé</p></div></div><div className="text-right"><span className={cn("text-2xl font-black", simulationData.isOverBudget ? "text-red-500" : "text-emerald-500")}>{simulationData.teamTotalCost}€</span><p className="text-[10px] text-muted-foreground">sur {budgetMax}€ max</p></div></div><div className="relative h-4 bg-background/50 rounded-full overflow-hidden border border-black/5 dark:border-white/5"><div className={cn("absolute left-0 top-0 bottom-0 transition-all duration-500", simulationData.isOverBudget ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, simulationData.budgetUsage)}%` }} /><div className="absolute top-0 bottom-0 w-0.5 bg-foreground/30 z-10" style={{ left: '100%' }} /></div></div>
                <div className="pulse-card p-5 bg-card border-border"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center"><Edit3 className="w-5 h-5 text-purple-500" /></div><div><h3 className="font-semibold text-sm">Ajuster les primes</h3><p className="text-xs text-muted-foreground">Simulez l'impact financier</p></div></div><div className="space-y-3">{sortedObjectives.map((obj: any) => { const isExpanded = expandedSim === obj.id; const currentSimReward = obj.paliers?.reduce((acc: number, p: any) => acc + (simulatedPaliers[obj.id]?.[p.id] ?? p.reward), 0) || 0; return (<div key={obj.id} className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden transition-all"><div className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50" onClick={() => setExpandedSim(isExpanded ? null : obj.id)}><div className="flex items-center gap-3">{obj.type === 'principal' ? <Crown className="w-4 h-4 text-amber-500"/> : <Target className="w-4 h-4 text-purple-400"/>}<span className="text-sm font-medium">{obj.title}</span></div><div className="flex items-center gap-3"><Badge variant="outline" className="bg-background text-purple-500 border-purple-200">{currentSimReward}€</Badge>{isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground"/> : <ChevronDown className="w-4 h-4 text-muted-foreground"/>}</div></div>{isExpanded && obj.paliers && (<div className="p-4 space-y-6 bg-background/50 border-t border-border/50 animate-in slide-in-from-top-2">{(!obj.paliers || obj.paliers.length === 0) && (<div className="text-center py-2"><p className="text-xs text-muted-foreground mb-2">Aucun palier configuré.</p><Button size="sm" variant="outline" onClick={() => setShowAddPalier(obj.id)}>Ajouter un palier</Button></div>)}{obj.paliers.map((p: any, idx: number) => { const val = simulatedPaliers[obj.id]?.[p.id] ?? p.reward; return (<div key={p.id} className="space-y-3"><div className="flex justify-between items-center text-xs"><div className="flex items-center gap-2"><span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{idx + 1}</span><span className="font-medium">{p.name} <span className="text-muted-foreground">({p.threshold} {obj.unit})</span></span></div><div className="flex gap-2"><span className="font-bold text-lg text-primary">{val}€</span><Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => setEditingPalier({ objectiveId: obj.id, palierId: p.id, name: p.name, threshold: p.threshold, reward: p.reward })}><Edit3 className="w-3 h-3"/></Button></div></div><Slider value={[val]} max={500} step={5} onValueChange={(vals) => handleSimulateChange(obj.id, p.id, vals[0])} className="py-1" /></div>)})} {obj.paliers && obj.paliers.length > 0 && (<Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground h-8 mt-2" onClick={() => setShowAddPalier(obj.id)}><Plus className="w-3 h-3 mr-1"/> Ajouter un autre palier</Button>)}</div>)}</div>)})}</div></div>
                <div className="fixed bottom-[88px] left-4 right-4 max-w-lg mx-auto bg-card border border-border rounded-2xl p-4 shadow-2xl z-10 animate-in slide-in-from-bottom-4"><div className="space-y-3"><div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Coût max par personne (35h)</span><span className="font-bold">{simulationData.totalCostPerPerson}€</span></div><Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-lg shadow-purple-500/20" onClick={handleSaveSimulation}><Save className="w-4 h-4 mr-2"/> Valider cette configuration</Button></div></div><div className="h-32"/>
           </div>
        )}

        {activeTab === "equipe" && (
             <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-3 gap-3"><div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none"><div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center mb-2"><Target className="w-4 h-4 text-purple-500" /></div><span className="text-xl font-bold">{simulationData.activeObjectivesCount}</span><span className="text-[10px] text-muted-foreground uppercase font-bold">Objectifs</span></div><div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none"><div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-2"><Euro className="w-4 h-4 text-blue-500" /></div><span className="text-xl font-bold">{simulationData.totalCostPerPerson}€</span><span className="text-[10px] text-muted-foreground uppercase font-bold">Max / Pers</span></div><div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none"><div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2"><Users className="w-4 h-4 text-emerald-500" /></div><span className="text-xl font-bold">{teamMembers.length}</span><span className="text-[10px] text-muted-foreground uppercase font-bold">Équipe</span></div></div>
                <div className="flex items-center justify-between"><h2 className="font-semibold text-sm">Détail par collaborateur</h2><span className="text-xs text-muted-foreground">Base {baseHours}h</span></div>
                <div className="space-y-3">{teamMembers.map((member) => { const ratio = member.contractHours / baseHours; const potentialPrime = Math.round(simulationData.totalCostPerPerson * ratio); return (<div key={member.id} className="pulse-card p-4"><div className="flex items-center gap-3 mb-3"><div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm", member.color)}>{member.initials}</div><div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{member.name}</p><p className="text-xs text-muted-foreground">{member.role}</p></div><div className="text-right"><p className="text-lg font-bold text-purple-400">{potentialPrime}€</p><p className="text-[10px] text-muted-foreground">potentiel</p></div></div><div className="flex justify-between items-center text-xs text-muted-foreground mt-2"><span>Contrat: {member.contractHours}h</span><span>Ratio: {Math.round(ratio * 100)}%</span></div><div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div></div>)})}</div>
             </div>
        )}

      </main>

      {/* --- MODALES & DRAWERS --- */}
      {showAddObjective && <AddObjectiveAdvancedModal onClose={() => setShowAddObjective(false)} onConfirm={handleCreateObjective} />}
      {showPlanning && <AddPlanningAdvancedModal onClose={() => setShowPlanning(false)} onConfirm={handleCreatePlanning} />}
      {showAddPalier && <AddPalierModal onClose={() => setShowAddPalier(null)} onConfirm={(n, t, r) => handleAddPalierConfirm(showAddPalier, n, t, r)} objective={objectives.find((o:any) => o.id === showAddPalier)} />}
      
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
            <h2 className="font-semibold mb-4 text-lg">Configuration Générale</h2>
            <div className="space-y-4">
              <div><Label className="text-sm">Heures temps plein (référence)</Label><Input type="number" value={baseHours} onChange={(e) => setBaseHours(Number(e.target.value))} className="rounded-xl mt-2" /></div>
              <div><Label className="text-sm">Budget Max Global (€)</Label><Input type="number" value={budgetMax} onChange={(e) => setBudgetMax(Number(e.target.value))} className="rounded-xl mt-2" /></div>
              <Button className="w-full rounded-xl" onClick={handleUpdateBaseHours}><Save className="w-4 h-4 mr-2" /> Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Détail avec Timeline */}
      <ObjectiveDetailDrawer 
        objective={selectedObj} 
        onClose={() => setSelectedObj(null)} 
        onUpdateProgress={updateProgress}
        onUpdatePeriod={updateObjectivePeriod}
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
    const [durationMonths, setDurationMonths] = useState<number | null>(null)
    const [startDate, setStartDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"))
    useEffect(() => { const p = OBJECTIVE_PRESETS.find(p => p.id === selectedPreset); if(p) { setTitle(p.label); setDescription(p.desc); } }, [selectedPreset])
    const handleSubmit = () => {
      const p = OBJECTIVE_PRESETS.find(p => p.id === selectedPreset)!
      onConfirm({
        title,
        description,
        target,
        unit: p.unit,
        direction: p.direction,
        type: isPrincipal ? 'principal' : 'secondaire',
        isConfidential,
        durationMonths,
        startDate,
      })
    }
    return (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-6 pb-10" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center"><h2 className="text-lg font-bold">Nouvel Objectif</h2><Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5"/></Button></div>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className="bg-muted/30 p-3 rounded-xl flex-1 flex items-center justify-between border border-border"><Label className="text-xs font-bold flex items-center gap-1"><Crown className="w-3 h-3 text-amber-500" /> Principal</Label><Switch checked={isPrincipal} onCheckedChange={setIsPrincipal} /></div>
                        <div className="bg-muted/30 p-3 rounded-xl flex-1 flex items-center justify-between border border-border"><Label className="text-xs font-bold flex items-center gap-1"><EyeOff className="w-3 h-3 text-muted-foreground" /> Masquer</Label><Switch checked={isConfidential} onCheckedChange={setIsConfidential} /></div>
                    </div>
                    <div><Label className="mb-2 block">Type d'objectif</Label><div className="grid grid-cols-3 gap-2">{OBJECTIVE_PRESETS.map(preset => (<button key={preset.id} onClick={() => setSelectedPreset(preset.id)} className={cn("flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all text-xs text-center h-20", selectedPreset === preset.id ? "border-purple-500 bg-purple-500/10 text-purple-500 font-semibold ring-1 ring-purple-500/20" : "border-border bg-muted/20 text-muted-foreground hover:bg-muted")}><preset.icon className="w-5 h-5" /><span>{preset.label}</span></button>))}</div></div>
                    <div><Label>Titre</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1.5"/></div>
                    <div className="grid grid-cols-2 gap-4"><div><Label>Cible</Label><Input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0" className="mt-1.5 font-bold" /></div><div><Label>Unité</Label><div className="flex h-10 items-center justify-center rounded-md border bg-muted font-bold text-muted-foreground mt-1.5">{OBJECTIVE_PRESETS.find(p => p.id === selectedPreset)?.unit}</div></div></div>

                    {/* Date de début (clé pour un usage gérant/manager) */}
                    <div className="space-y-2">
                      <Label className="mb-1 block">Commence le</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-xl"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Exemple : objectif mensuel qui démarre le 1er, ou sprint qui démarre aujourd'hui.
                      </p>
                    </div>

<div className="space-y-2">
  <Label className="mb-1 block">Durée de l'objectif</Label>

  {/* Chips ultra-rapides (commercial-friendly) */}
  <div className="grid grid-cols-5 gap-2">
    {[1, 2, 3, 6].map((m) => {
      const active = durationMonths === m
      return (
        <button
          key={m}
          type="button"
          onClick={() => setDurationMonths(m)}
          className={cn(
            "py-2 rounded-full text-xs border transition-all",
            active
              ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white border-transparent shadow"
              : "bg-muted/20 border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {m}M
        </button>
      )
    })}
    <button
      type="button"
      onClick={() => setDurationMonths(null)}
      className={cn(
        "py-2 rounded-full text-xs border transition-all",
        durationMonths == null
          ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white border-transparent shadow"
          : "bg-muted/20 border-border text-muted-foreground hover:bg-muted"
      )}
      title="Durée indéfinie"
    >
      ∞
    </button>
  </div>

  {/* Aperçu période (super clair pour gérant/manager) */}
  <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs flex items-center justify-between">
    <span className="text-muted-foreground">
      Début : {(() => {
        try {
          const d = startDate ? new Date(startDate) : new Date()
          return format(d, "d MMM yyyy", { locale: fr })
        } catch {
          return "—"
        }
      })()}
    </span>
    <span className="font-semibold">
      {durationMonths == null
        ? "Sans fin"
        : (() => {
            try {
              const s = startDate ? new Date(startDate) : new Date()
              return `Fin : ${format(addMonthsSafe(s, durationMonths), "d MMM yyyy", { locale: fr })}`
            } catch {
              return "—"
            }
          })()}
    </span>
  </div>

  <p className="text-[11px] text-muted-foreground">
    {durationMonths == null
      ? "Objectif sans fin : l'historique s'affiche en continu."
      : "Conseil : 1–2 mois = sprint hyper motivant, parfait pour tester le potentiel."}
  </p>
</div>
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
    const handleAddPalier = () => { if (!palierName || !palierThreshold || !palierReward) return; setPaliers([...paliers, { id: Date.now().toString(), name: palierName, threshold: Number(palierThreshold), reward: Number(palierReward) }]); setPalierName(""); setPalierThreshold(""); setPalierReward(""); }
    const handleRemovePalier = (id: string) => { setPaliers(paliers.filter(p => p.id !== id)); }
    const handleSubmit = () => { const p = OBJECTIVE_PRESETS.find(p => p.id === selectedPreset)!; onConfirm({ title, target, unit: p.unit, direction: p.direction, startMonth, startYear, duration, type: isPrincipal ? 'principal' : 'secondaire', isConfidential, paliers }) }
    return (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-6 pb-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center"><h2 className="text-lg font-bold">Programmer un objectif</h2><Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5"/></Button></div>
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4"><div><Label className="mb-2 block">Mois de début</Label><Select value={startMonth} onValueChange={setStartMonth}><SelectTrigger className="h-10 bg-muted/30"><SelectValue /></SelectTrigger><SelectContent>{["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div><div><Label className="mb-2 block">Année</Label><Select value={startYear} onValueChange={setStartYear}><SelectTrigger className="h-10 bg-muted/30"><SelectValue /></SelectTrigger><SelectContent>{["2025", "2026", "2027"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div></div>
                    <div><Label className="mb-2 block">Durée</Label><div className="flex gap-2">{[1, 3, 6, 12].map(d => (<button key={d} onClick={() => setDuration(d)} className={cn("flex-1 py-2 rounded-lg text-sm border transition-all", duration === d ? "bg-purple-600 text-white border-purple-600" : "bg-muted/20 border-border text-muted-foreground")}>{d} mois</button>))}</div></div>
                     <Button className="w-full py-6 text-base bg-purple-600 hover:bg-purple-700" onClick={handleSubmit} disabled={!target}>Valider la planification</Button>
                </div>
            </div>
        </div>
    )
}

function AddPalierModal({ onClose, onConfirm, objective }: { onClose: () => void, onConfirm: (n: string, t: number, r: number) => void, objective: any }) {
    const [name, setName] = useState("")
    const [threshold, setThreshold] = useState("")
    const [thresholdMode, setThresholdMode] = useState<"value" | "percent">("value")
    const [thresholdPct, setThresholdPct] = useState("")
    const [reward, setReward] = useState("")
    const isDescending = objective?.direction === 'descending'

    const target = Number(objective?.target || 0)
    const pct = Number(thresholdPct)
    const rawThreshold = Number(threshold)

    const computedThreshold = useMemo(() => {
      if (thresholdMode === "percent") {
        if (!Number.isFinite(target) || target <= 0) return NaN
        if (!Number.isFinite(pct) || pct <= 0) return NaN
        const ratio = pct / 100
        if (ratio === 0) return NaN
        return isDescending ? target / ratio : target * ratio
      }
      return rawThreshold
    }, [thresholdMode, target, pct, rawThreshold, isDescending])

    const prettyThreshold = useMemo(() => {
      if (!Number.isFinite(computedThreshold)) return ""
      // € -> arrondi entier ; % -> 1 décimale ; sinon -> entier
      if ((objective?.unit || "").includes("%")) return `${Math.round(computedThreshold * 10) / 10}`
      if ((objective?.unit || "").includes("€")) return `${Math.round(computedThreshold).toLocaleString()}`
      return `${Math.round(computedThreshold).toLocaleString()}`
    }, [computedThreshold, objective?.unit])

    const canSubmit =
      Boolean(name) &&
      reward !== "" &&
      Number.isFinite(computedThreshold) &&
      (thresholdMode === "percent" ? target > 0 && pct > 0 : Boolean(threshold))
    return (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose}>
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-6 text-lg">Ajouter un palier</h2>
            <div className="space-y-4">
              <div><Label>Nom</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Niveau 1" className="rounded-xl mt-1" /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{isDescending ? `Seuil max (${objective.unit})` : `Seuil (${objective.unit})`}</Label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setThresholdMode("value")}
                      className={cn("px-2 py-1 rounded-lg text-[11px] border", thresholdMode === "value" ? "bg-purple-600 text-white border-purple-600" : "bg-muted/20 border-border text-muted-foreground")}
                    >Valeur</button>
                    <button
                      type="button"
                      onClick={() => setThresholdMode("percent")}
                      className={cn("px-2 py-1 rounded-lg text-[11px] border", thresholdMode === "percent" ? "bg-purple-600 text-white border-purple-600" : "bg-muted/20 border-border text-muted-foreground")}
                      disabled={!target}
                      title={!target ? "Définissez une cible pour utiliser le mode %" : undefined}
                    >%</button>
                  </div>
                </div>

                {thresholdMode === "value" ? (
                  <Input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="1000" className="rounded-xl mt-1" />
                ) : (
                  <div className="space-y-1">
                    <Input type="number" value={thresholdPct} onChange={e => setThresholdPct(e.target.value)} placeholder="Ex: 110" className="rounded-xl mt-1" />
                    <p className="text-[11px] text-muted-foreground">
                      {Number.isFinite(target) && target > 0 && prettyThreshold ? (
                        <>≈ <span className="font-semibold text-foreground">{prettyThreshold} {objective?.unit}</span></>
                      ) : (
                        <>Mode % indisponible sans cible</>
                      )}
                    </p>
                  </div>
                )}
              </div>
              <div><Label>Récompense (€)</Label><Input type="number" value={reward} onChange={e => setReward(e.target.value)} placeholder="50" className="rounded-xl mt-1" /></div>
              <Button
                className="w-full rounded-xl"
                onClick={() => onConfirm(name, Number(computedThreshold), Number(reward))}
                disabled={!canSubmit}
              >
                <Plus className="w-4 h-4 mr-2" /> Ajouter
              </Button>
            </div>
          </div>
        </div>
    )
}

function ObjectiveDetailDrawer({
  objective,
  onClose,
  onUpdateProgress,
  onUpdatePeriod,
  onDelete,
}: {
  objective: any
  onClose: () => void
  onUpdateProgress: (amount: number, date?: string) => void
  onUpdatePeriod: (objectiveId: string, periodStartISO: string, periodMonths: number | null) => void
  onDelete: () => void
}) {
    const [updateVal, setUpdateVal] = useState("")
    const [updateDate, setUpdateDate] = useState("")
    const [periodStart, setPeriodStart] = useState<string>("")
    const [periodMonths, setPeriodMonths] = useState<number | null>(null)

    // Init période (une seule fois par changement d'objectif)
    useEffect(() => {
      if (!objective) return
      const d = objective?.periodStart ? new Date(objective.periodStart) : new Date()
      const iso = Number.isNaN(d.getTime()) ? new Date() : d
      setPeriodStart(format(iso, "yyyy-MM-dd"))
      setPeriodMonths(typeof objective?.periodMonths === "number" ? objective.periodMonths : null)
    }, [objective?.id])

    if (!objective) return null

    // Trier l'historique (le plus récent en haut)
    const sortedHistory = [...(objective.history || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <Drawer open={!!objective} onOpenChange={(open) => !open && onClose()}>
            <DrawerContent className="fixed bottom-0 left-0 right-0 h-[96vh] flex flex-col outline-none bg-card rounded-t-3xl">
                <div className="w-full max-w-lg mx-auto flex flex-col h-full overflow-hidden">
                    <DrawerHeader className="text-left border-b border-border/50 pb-4 shrink-0 bg-background/50 backdrop-blur-md sticky top-0 z-10">
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 mx-auto mb-3 shadow-sm border border-purple-100">
                            <Target className="w-7 h-7 text-purple-600" />
                        </div>
                        <div className="text-center space-y-1">
                            <Badge variant="secondary" className="mb-2 bg-purple-50 text-purple-700 border-purple-100">{objective.type === "principal" ? "Principal" : "Secondaire"}</Badge>
                            <DrawerTitle className="text-2xl font-bold tracking-tight">{objective.title}</DrawerTitle>
                            <p className="text-sm text-muted-foreground px-4 max-w-xs mx-auto">{objective.description}</p>
                        </div>
                    </DrawerHeader>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-32">
                        {/* Jauge Circulaire */}
                        <div className="flex flex-col items-center py-4">
                            <CircularProgress value={objective.current} max={objective.target} direction={objective.direction} size={180} strokeWidth={16} />
                        </div>

                        {/* Période / Durée */}
                        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-purple-500" /> Période de l'objectif
                            </h3>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {periodMonths == null ? "∞" : `${periodMonths} mois`}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Début</Label>
                              <Input
                                type="date"
                                value={periodStart}
                                onChange={(e) => setPeriodStart(e.target.value)}
                                className="bg-background h-11"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Durée</Label>
                              <div className="grid grid-cols-5 gap-1">
                                {[1, 2, 3, 6].map((m) => (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => setPeriodMonths(m)}
                                    className={cn(
                                      "h-11 rounded-xl text-xs border transition-all",
                                      periodMonths === m
                                        ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white border-transparent shadow"
                                        : "bg-muted/20 border-border text-muted-foreground hover:bg-muted"
                                    )}
                                  >
                                    {m}M
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setPeriodMonths(null)}
                                  className={cn(
                                    "h-11 rounded-xl text-xs border transition-all",
                                    periodMonths == null
                                      ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white border-transparent shadow"
                                      : "bg-muted/20 border-border text-muted-foreground hover:bg-muted"
                                  )}
                                  title="Durée indéfinie"
                                >
                                  ∞
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs flex items-center justify-between">
                            <span className="text-muted-foreground">Fin</span>
                            <span className="font-semibold">
                              {(() => {
                                try {
                                  const start = periodStart ? new Date(periodStart) : new Date()
                                  if (periodMonths == null) return "Sans fin"
                                  const end = addMonthsSafe(start, periodMonths)
                                  return format(end, "d MMM yyyy", { locale: fr })
                                } catch {
                                  return periodMonths == null ? "Sans fin" : "—"
                                }
                              })()}
                            </span>
                          </div>

                          <Button
                            variant="secondary"
                            className="w-full rounded-xl"
                            onClick={() => {
                              const iso = periodStart ? new Date(periodStart).toISOString() : new Date().toISOString()
                              onUpdatePeriod(objective.id, iso, periodMonths)
                            }}
                          >
                            <Save className="w-4 h-4 mr-2" /> Enregistrer la période
                          </Button>
                        </div>
{/* Mise à jour rapide */}
<div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
    <div className="flex items-start justify-between gap-3">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <Wallet className="w-4 h-4 text-purple-500" /> Mise à jour rapide
      </h3>
      <Badge variant="outline" className="text-[10px] h-5">
        Valeur totale
      </Badge>
    </div>
    <p className="text-xs text-muted-foreground">
      Renseigne la valeur <span className="font-semibold">totale</span> du jour (ex : 17k lundi, 19k mardi).
    </p>
    <div className="flex gap-2">
        <Input type="number" placeholder="Valeur totale..." value={updateVal} onChange={(e) => setUpdateVal(e.target.value)} className="bg-background flex-1 h-12 text-lg font-medium" />
        <Input type="date" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)} className="bg-background w-36 h-12" />
        <Button
          onClick={() => { onUpdateProgress(Number(updateVal), updateDate); setUpdateVal(""); setUpdateDate(""); }}
          className="bg-purple-600 hover:bg-purple-700 h-12 w-12 rounded-xl shadow-lg shadow-purple-500/20"
          aria-label="Enregistrer"
        >
          <Save className="w-5 h-5" />
        </Button>
    </div>
</div>

{/* Historique visuel (score 0-140%) */}
<div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
  <h3 className="font-bold text-sm flex items-center gap-2">
    <TrendingUp className="w-4 h-4 text-purple-500" /> Tendance (10 derniers points)
  </h3>
  <PillTrendBars objective={objective} />
  </div>


                        {/* 🔴 TIMELINE VERTICALE */}
                        <div className="relative pl-2">
                            <h3 className="font-bold text-base mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-500" /> Historique</h3>
                            
                            {/* Ligne verticale */}
                            <div className="absolute left-[23px] top-10 bottom-0 w-0.5 bg-gradient-to-b from-purple-200 to-transparent dark:from-purple-900" />

                            <div className="space-y-6">
                                {sortedHistory.length > 0 ? (
                                    sortedHistory.map((h: any, i: number) => (
                                        <div key={i} className="relative flex gap-4 items-start group animate-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 50}ms` }}>
                                            {/* Point */}
                                            <div className="z-10 w-3.5 h-3.5 rounded-full bg-background border-[3px] border-purple-500 mt-1.5 shrink-0 shadow-sm ring-4 ring-background" />
                                            
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-sm font-semibold text-foreground">{h.date}</span>
                                                    <Badge variant="outline" className={cn("text-xs font-bold", h.change > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200")}>
                                                        {h.change > 0 ? "+" : ""}{h.change} {objective.unit}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg inline-block">
                                                    Nouvelle valeur : <span className="font-medium text-foreground">{h.value} {objective.unit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground text-sm italic bg-muted/20 rounded-xl">Aucune activité enregistrée.</div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <DrawerFooter className="pt-4 pb-8 px-4 shrink-0 bg-background/80 backdrop-blur-md border-t border-border/50 flex-col gap-2 z-20">
                        <Button variant="outline" className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onDelete}>
                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer l'objectif
                        </Button>
                        <DrawerClose asChild><Button variant="secondary" className="w-full rounded-xl">Fermer</Button></DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
	);
}

function CircularProgress({ value, max, size = 180, strokeWidth = 12, direction = "ascending" }: { value: number, max: number, size?: number, strokeWidth?: number, direction?: string }) {
    const safeValue = value || 0; const safeMax = max || 1;
    const radius = (size - strokeWidth) / 2; const circumference = radius * 2 * Math.PI;
    // % "motivation" : peut dépasser 100% si l'objectif est dépassé / si l'indicateur est meilleur que la cible.
    let pctRaw = 0;
    if (direction === 'descending') {
      pctRaw = safeValue === 0 ? 999 : (safeMax / safeValue) * 100;
    } else {
      pctRaw = (safeValue / safeMax) * 100;
    }
    const pctRing = Math.min(100, Math.max(0, pctRaw));
    const offset = circumference - (pctRing / 100) * circumference;
    const gradientId = useMemo(() => `gradient-${Math.random().toString(36).slice(2, 10)}`, []);
    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
              <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-muted/20" />
              <circle cx={size / 2} cy={size / 2} r={radius} stroke={`url(#${gradientId})`} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
              <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-black tracking-tighter text-foreground">{Math.round(Math.min(999, Math.max(0, pctRaw)))}%</span>
              {pctRaw > 100 && <span className="text-[10px] font-bold text-primary -mt-1">+{Math.round(pctRaw - 100)}%</span>}
              <span className="text-[10px] text-muted-foreground mt-1 font-medium bg-muted/40 px-2 py-0.5 rounded-full">{safeValue.toLocaleString()} / {safeMax.toLocaleString()}</span>
            </div>
        </div>
    )
}



function PillTrendBars({ objective }: { objective: any }) {
  const MAX_SCORE = 140

  const formatPillLabel = (dateStr: string, timestamp?: string) => {
    // On préfère le timestamp (fiable) pour afficher une date courte et nette.
    try {
      const d = timestamp ? new Date(timestamp) : null
      if (d && !Number.isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(d)
      }
    } catch {
      // ignore
    }
    // Fallback : on raccourcit ce qui existe déjà.
    const s = String(dateStr || '').trim()
    if (!s) return ''
    return s.replace(/\.$/, '')
  }

  const series = useMemo(() => {
    const history = Array.isArray(objective?.history) ? [...objective.history] : []
    const current = Number(objective?.current || 0)
    const target = Number(objective?.target || 1)
    const direction = objective?.direction

    const safe = history
      .filter((h: any) => h && (h.timestamp || h.date))
      .sort((a: any, b: any) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
      .slice(-10)

    if (safe.length === 0) return { points: [], target, direction, isAbsolute: true }

    const lastVal = Number(safe[safe.length - 1]?.value ?? NaN)
    const isAbsolute = Number.isFinite(lastVal) && Number.isFinite(current) && Math.abs(lastVal - current) <= Math.max(1, Math.abs(current)) * 0.02

    // Si l'historique existant était en "delta", on reconstruit des totaux cohérents à partir de current
    let totals: number[] = []
    if (isAbsolute) {
      totals = safe.map((h: any) => Number(h?.value ?? 0))
    } else {
      const changes = safe.map((h: any) => Number(h?.change ?? h?.value ?? 0)).map((n) => (Number.isFinite(n) ? n : 0))
      const sum = changes.reduce((a, b) => a + b, 0)
      let acc = (Number.isFinite(current) ? current : 0) - sum
      totals = changes.map((ch) => {
        acc += ch
        return acc
      })
    }

    const scorePct = (val: number) => {
      const v = Number.isFinite(val) ? val : 0
      const t = Number.isFinite(target) && target !== 0 ? target : 1
      if (direction === "descending") {
        if (v === 0) return 999
        return (t / v) * 100
      }
      return (v / t) * 100
    }

    const points = safe.map((h: any, i: number) => ({
      date: String(h?.date || ""),
      timestamp: String(h?.timestamp || ""),
      value: totals[i],
      score: scorePct(totals[i]),
    }))

    return { points, target, direction, isAbsolute }
  }, [objective?.history, objective?.current, objective?.target, objective?.direction])

  const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
  const targetLine = (100 / MAX_SCORE) * 100

  if (!series.points.length) {
    return (
      <div className="space-y-2">
        <div className="h-24 flex items-end gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex-1 h-full rounded-full bg-muted/30 overflow-hidden">
              <div className="h-1/3 w-full bg-muted/50 animate-pulse" />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground italic">Pas assez de données : ajoute une première mise à jour.</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Scroll horizontal pour garder des barres lisibles sur mobile */}
      <div className="relative h-28 overflow-x-auto overflow-y-hidden -mx-1 px-1">
        <div className="relative h-28 flex items-end gap-3 min-w-max">
        <div
          className="absolute left-0 right-0 border-t border-dashed border-border/60"
          style={{ bottom: `${targetLine}%` }}
          aria-hidden
        />
        {series.points.map((p, i) => {
          const score = Number.isFinite(p.score) ? p.score : 0
          const hPct = clamp01(Math.min(MAX_SCORE, Math.max(0, score)) / MAX_SCORE) * 100
          return (
            <div key={i} className="w-10 shrink-0 flex flex-col items-center gap-2">
              <div
                className="relative w-full h-24 rounded-full bg-muted/30 overflow-hidden ring-1 ring-white/5"
                title={`${formatPillLabel(p.date, p.timestamp)} • ${Math.round(score)}% • ${Number(p.value || 0).toLocaleString()} ${objective?.unit || ""}`}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t from-purple-500 to-blue-500 transition-[height] duration-300 ease-out"
                  style={{ height: `${hPct}%` }}
                />
                {/* petit highlight pour donner un rendu plus "premium" */}
                <div className="absolute inset-0 opacity-10 bg-gradient-to-tr from-white to-transparent" />
              </div>
              <span className="text-[10px] text-muted-foreground w-full text-center leading-none">
                {formatPillLabel(p.date, p.timestamp)}
              </span>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
