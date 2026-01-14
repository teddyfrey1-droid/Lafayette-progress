"use client"

import { useState, useMemo } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { objectives as initialObjectives, teamMembers, pilotageSettings, calculateProRataPrime } from "@/lib/demo-data"
import {
  Target,
  TrendingUp,
  Clock,
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  Euro,
  Users,
  Layers,
  AlertCircle,
  Save,
  Calculator,
  Wallet,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

type TabValue = "objectifs" | "paliers" | "pilotage" | "equipe"

interface EditingPalier {
  objectiveId: string
  palierId: string
  name: string
  threshold: number
  reward: number
}

export default function PilotagePage() {
  const [activeTab, setActiveTab] = useState<TabValue>("pilotage")
  const [baseHours, setBaseHours] = useState(pilotageSettings.baseHours)
  const [showEditHours, setShowEditHours] = useState(false)
  const [editingPalier, setEditingPalier] = useState<EditingPalier | null>(null)
  const [showAddPalier, setShowAddPalier] = useState<string | null>(null)
  const [showObjectiveDetail, setShowObjectiveDetail] = useState<string | null>(null)

  const [budgetMax, setBudgetMax] = useState(2000)
  const [simulatedPaliers, setSimulatedPaliers] = useState<Record<string, Record<string, number>>>(() => {
    const initial: Record<string, Record<string, number>> = {}
    initialObjectives.forEach((obj) => {
      initial[obj.id] = {}
      obj.paliers.forEach((p) => {
        initial[obj.id][p.id] = p.reward
      })
    })
    return initial
  })
  const [expandedObjective, setExpandedObjective] = useState<string | null>(null)

  // Calculate costs based on simulation
  const simulationData = useMemo(() => {
    const objectiveCosts: {
      id: string
      title: string
      cost: number
      paliers: { id: string; name: string; reward: number }[]
    }[] = []
    let totalCost = 0

    initialObjectives.forEach((obj) => {
      let objCost = 0
      const paliersList: { id: string; name: string; reward: number }[] = []

      obj.paliers.forEach((p) => {
        const reward = simulatedPaliers[obj.id]?.[p.id] ?? p.reward
        objCost += reward
        paliersList.push({ id: p.id, name: p.name, reward })
      })

      objectiveCosts.push({ id: obj.id, title: obj.title, cost: objCost, paliers: paliersList })
      totalCost += objCost
    })

    // Calculate team total (all members at max)
    const teamTotalCost = teamMembers.reduce((sum, m) => {
      return sum + calculateProRataPrime(totalCost, m.contractHours, baseHours)
    }, 0)

    // Simulation for 35h employee
    const prime35h = calculateProRataPrime(totalCost, 35, baseHours)

    return {
      objectiveCosts,
      totalCost,
      teamTotalCost,
      prime35h,
      budgetDiff: budgetMax - teamTotalCost,
      isOverBudget: teamTotalCost > budgetMax,
    }
  }, [simulatedPaliers, baseHours, budgetMax])

  // Update palier reward in simulation
  const updatePalierReward = (objectiveId: string, palierId: string, value: number) => {
    setSimulatedPaliers((prev) => ({
      ...prev,
      [objectiveId]: {
        ...prev[objectiveId],
        [palierId]: value,
      },
    }))
  }

  // Calculate team totals
  const totalPotentialPrime = initialObjectives.reduce((sum, obj) => sum + obj.reward, 0)
  const activeObjectives = initialObjectives.filter((obj) => obj.isActive).length

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pilotage</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gérez les objectifs et les primes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 bg-transparent"
              onClick={() => setShowEditHours(true)}
            >
              <Clock className="w-4 h-4" />
              {baseHours}h
            </Button>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold">{activeObjectives}</p>
            <p className="text-[11px] text-muted-foreground">Objectifs actifs</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent/10 flex items-center justify-center">
              <Euro className="w-5 h-5 text-accent" />
            </div>
            <p className="text-xl font-bold">{totalPotentialPrime}€</p>
            <p className="text-[11px] text-muted-foreground">Prime potentielle</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-chart-3/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-chart-3" />
            </div>
            <p className="text-xl font-bold">{teamMembers.length}</p>
            <p className="text-[11px] text-muted-foreground">Collaborateurs</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="pulse-card p-4 bg-primary/5 border-primary/20">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Primes équitables</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Les primes sont identiques pour tous, calculées au prorata des heures de contrat sur une base de{" "}
                {baseHours}h.
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="grid w-full grid-cols-4 h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger
              value="objectifs"
              className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              Objectifs
            </TabsTrigger>
            <TabsTrigger
              value="paliers"
              className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              Paliers
            </TabsTrigger>
            <TabsTrigger
              value="pilotage"
              className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              Pilotage
            </TabsTrigger>
            <TabsTrigger
              value="equipe"
              className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              Équipe
            </TabsTrigger>
          </TabsList>

          {/* Objectifs Tab */}
          <TabsContent value="objectifs" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Configuration des objectifs</h2>
              <Button size="sm" variant="outline" className="rounded-xl gap-1 bg-transparent">
                <Plus className="w-4 h-4" />
                Ajouter
              </Button>
            </div>

            <div className="space-y-3">
              {initialObjectives.map((obj) => (
                <div
                  key={obj.id}
                  className="pulse-card p-4 cursor-pointer"
                  onClick={() => setShowObjectiveDetail(obj.id)}
                >
                  <div className="text-center mb-3">
                    <div
                      className={cn(
                        "w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2",
                        obj.type === "principal" ? "bg-primary/15" : "bg-muted",
                      )}
                    >
                      {obj.type === "principal" ? (
                        <Target className="w-6 h-6 text-primary" />
                      ) : (
                        <TrendingUp className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="font-medium text-sm">{obj.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {obj.paliers.length} paliers • {obj.reward}€ max
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Switch checked={obj.isActive} />
                      <span className="text-xs text-muted-foreground">{obj.isActive ? "Actif" : "Inactif"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(obj.progress / obj.target) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {Math.round((obj.progress / obj.target) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Paliers Tab */}
          <TabsContent value="paliers" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Configuration des paliers</h2>
            </div>

            {initialObjectives.map((obj) => (
              <div key={obj.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{obj.title}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl h-8 text-xs"
                    onClick={() => setShowAddPalier(obj.id)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Palier
                  </Button>
                </div>

                <div className="space-y-2">
                  {obj.paliers.map((palier, index) => (
                    <div
                      key={palier.id}
                      className={cn(
                        "pulse-card p-3 flex items-center gap-3",
                        palier.unlocked && "bg-primary/5 border-primary/20",
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                          palier.unlocked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{palier.name}</span>
                          {palier.unlocked && <Check className="w-3 h-3 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {palier.target.toLocaleString()} {obj.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">+{palier.reward}€</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 rounded-lg"
                        onClick={() =>
                          setEditingPalier({
                            objectiveId: obj.id,
                            palierId: palier.id,
                            name: palier.name,
                            threshold: palier.target,
                            reward: palier.reward,
                          })
                        }
                      >
                        <Edit3 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Pilotage Tab - Simulation */}
          <TabsContent value="pilotage" className="space-y-4 mt-4">
            {/* Budget Overview */}
            <div className="pulse-card p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Budget & Simulation</h3>
                  <p className="text-xs text-muted-foreground">Ajustez les paliers et visualisez les coûts</p>
                </div>
              </div>

              {/* Budget Max Input */}
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Budget maximum alloué</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(Number(e.target.value))}
                    className="rounded-xl text-lg font-bold"
                  />
                  <span className="text-lg font-bold text-muted-foreground">€</span>
                </div>
              </div>

              {/* Budget Comparison */}
              <div
                className={cn(
                  "p-4 rounded-xl mb-4",
                  simulationData.isOverBudget
                    ? "bg-red-500/10 border border-red-500/30"
                    : "bg-green-500/10 border border-green-500/30",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">Coût total équipe</span>
                  <span
                    className={cn("text-lg font-bold", simulationData.isOverBudget ? "text-red-400" : "text-green-400")}
                  >
                    {simulationData.teamTotalCost}€
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      simulationData.isOverBudget ? "bg-red-500" : "bg-green-500",
                    )}
                    style={{ width: `${Math.min((simulationData.teamTotalCost / budgetMax) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Budget: {budgetMax}€</span>
                  <span
                    className={cn("font-semibold", simulationData.isOverBudget ? "text-red-400" : "text-green-400")}
                  >
                    {simulationData.isOverBudget ? "Dépassement: " : "Reste: "}
                    {Math.abs(simulationData.budgetDiff)}€
                  </span>
                </div>
              </div>

              {/* 35h Simulation */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Calculator className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Simulation pour un 35h</p>
                    <p className="text-2xl font-bold">{simulationData.prime35h}€</p>
                    <p className="text-xs text-muted-foreground">si tous les objectifs sont atteints</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pulse-card p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Ajustement des paliers</h3>
                  <p className="text-xs text-muted-foreground">Modifiez les montants de chaque palier</p>
                </div>
              </div>

              <div className="space-y-3">
                {simulationData.objectiveCosts.map((obj) => (
                  <div key={obj.id} className="pulse-card p-3 bg-muted/30">
                    <button
                      className="w-full flex items-center justify-between"
                      onClick={() => setExpandedObjective(expandedObjective === obj.id ? null : obj.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{obj.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary">{obj.cost}€</span>
                        {expandedObjective === obj.id ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {expandedObjective === obj.id && (
                      <div className="mt-4 space-y-6 pt-3 border-t border-border">
                        {obj.paliers.map((palier, index) => (
                          <div key={palier.id} className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold bg-gradient-to-br from-primary to-accent text-white">
                                  {index + 1}
                                </div>
                                <span className="text-sm font-medium">{palier.name}</span>
                              </div>
                              <span className="text-lg font-bold text-primary">{palier.reward}€</span>
                            </div>

                            <div className="space-y-3 px-1">
                              <Slider
                                value={[palier.reward]}
                                min={0}
                                max={500}
                                step={5}
                                onValueChange={([value]) => updatePalierReward(obj.id, palier.id, value)}
                                className="w-full"
                              />

                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>0€</span>
                                <Input
                                  type="number"
                                  value={palier.reward}
                                  onChange={(e) => updatePalierReward(obj.id, palier.id, Number(e.target.value))}
                                  className="w-20 h-8 text-center rounded-lg text-xs font-medium"
                                />
                                <span>500€</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Cost Summary */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Coût total par personne (base {baseHours}h)</span>
                  <span className="text-lg font-bold">{simulationData.totalCost}€</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Coût total équipe</span>
                  <span className="text-lg font-bold text-primary">{simulationData.teamTotalCost}€</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Equipe Tab */}
          <TabsContent value="equipe" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Primes au prorata</h2>
              <span className="text-xs text-muted-foreground">Base {baseHours}h</span>
            </div>

            <div className="space-y-3">
              {teamMembers.map((member) => {
                const prorataPrime = calculateProRataPrime(simulationData.totalCost, member.contractHours, baseHours)
                const ratio = member.contractHours / baseHours

                return (
                  <div key={member.id} className="pulse-card p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          {member.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{prorataPrime}€</p>
                        <p className="text-[10px] text-muted-foreground">potentiel</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-muted-foreground">Contrat:</span>{" "}
                          <span className="font-medium">{member.contractHours}h</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Ratio:</span>{" "}
                          <span className="font-medium">{Math.round(ratio * 100)}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${ratio * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            <div className="pulse-card p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Budget total primes</p>
                  <p className="text-2xl font-bold">{simulationData.teamTotalCost}€</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Si 100% atteint</p>
                  <p className="text-sm font-medium text-primary">
                    {simulationData.totalCost}€ / personne (base {baseHours}h)
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Hours Modal */}
      {showEditHours && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setShowEditHours(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 p-4 pb-8">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold">Base horaire</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowEditHours(false)} className="rounded-xl">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm">Heures de référence</Label>
                <p className="text-xs text-muted-foreground mb-2">Base de calcul pour le prorata des primes</p>
                <div className="flex gap-2">
                  {[20, 24, 28, 35, 39].map((h) => (
                    <button
                      key={h}
                      onClick={() => setBaseHours(h)}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-sm font-medium transition-all",
                        baseHours === h
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80",
                      )}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm">Valeur personnalisée</Label>
                <Input
                  type="number"
                  value={baseHours}
                  onChange={(e) => setBaseHours(Number(e.target.value))}
                  className="rounded-xl mt-2"
                  min={1}
                  max={48}
                />
              </div>

              <Button className="w-full rounded-xl" onClick={() => setShowEditHours(false)}>
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Edit Palier Modal */}
      {editingPalier && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setEditingPalier(null)} />
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 p-4 pb-8">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold">Modifier le palier</h2>
              <Button variant="ghost" size="icon" onClick={() => setEditingPalier(null)} className="rounded-xl">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm">Nom du palier</Label>
                <Input
                  value={editingPalier.name}
                  onChange={(e) => setEditingPalier({ ...editingPalier, name: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>

              <div>
                <Label className="text-sm">Seuil à atteindre</Label>
                <Input
                  type="number"
                  value={editingPalier.threshold}
                  onChange={(e) =>
                    setEditingPalier({
                      ...editingPalier,
                      threshold: Number(e.target.value),
                    })
                  }
                  className="rounded-xl mt-1"
                />
              </div>

              <div>
                <Label className="text-sm">Récompense (€)</Label>
                <Input
                  type="number"
                  value={editingPalier.reward}
                  onChange={(e) =>
                    setEditingPalier({
                      ...editingPalier,
                      reward: Number(e.target.value),
                    })
                  }
                  className="rounded-xl mt-1"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl bg-transparent text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
                <Button className="flex-1 rounded-xl" onClick={() => setEditingPalier(null)}>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Palier Modal */}
      {showAddPalier && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setShowAddPalier(null)} />
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 p-4 pb-8">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold">Ajouter un palier</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowAddPalier(null)} className="rounded-xl">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm">Nom du palier</Label>
                <Input placeholder="Ex: Diamant" className="rounded-xl mt-1" />
              </div>

              <div>
                <Label className="text-sm">Seuil à atteindre</Label>
                <Input type="number" placeholder="150000" className="rounded-xl mt-1" />
              </div>

              <div>
                <Label className="text-sm">Récompense (€)</Label>
                <Input type="number" placeholder="750" className="rounded-xl mt-1" />
              </div>

              <Button className="w-full rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter le palier
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Objective Detail Modal */}
      {showObjectiveDetail && (
        <ObjectiveDetailModal objectiveId={showObjectiveDetail} onClose={() => setShowObjectiveDetail(null)} />
      )}

      <BottomNav />
    </div>
  )
}

function ObjectiveDetailModal({
  objectiveId,
  onClose,
}: {
  objectiveId: string
  onClose: () => void
}) {
  const objective = initialObjectives.find((o) => o.id === objectiveId)
  if (!objective) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Détails de l'objectif</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          <div className="text-center">
            <div
              className={cn(
                "w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3",
                objective.type === "principal" ? "bg-primary/15" : "bg-muted",
              )}
            >
              <Target
                className={cn("w-7 h-7", objective.type === "principal" ? "text-primary" : "text-muted-foreground")}
              />
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3 className="font-bold text-lg">{objective.title}</h3>
              {objective.type === "principal" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                  Principal
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{objective.description}</p>
          </div>

          {/* Settings Form */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div>
                <p className="text-sm font-medium">Objectif actif</p>
                <p className="text-xs text-muted-foreground">Visible par l'équipe</p>
              </div>
              <Switch checked={objective.isActive} />
            </div>

            <div>
              <Label className="text-sm">Objectif cible</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" value={objective.target} className="rounded-xl" />
                <span className="text-sm text-muted-foreground w-12">{objective.unit}</span>
              </div>
            </div>

            <div>
              <Label className="text-sm">Description</Label>
              <Input value={objective.description} className="rounded-xl mt-1" />
            </div>
          </div>

          {/* Paliers Summary */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Paliers configurés</h4>
            <div className="space-y-2">
              {objective.paliers.map((palier, index) => (
                <div key={palier.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm">{palier.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{palier.target.toLocaleString()}</span>
                    <span className="text-sm font-semibold text-primary">+{palier.reward}€</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full rounded-xl">
            <Save className="w-4 h-4 mr-2" />
            Enregistrer les modifications
          </Button>
        </div>
      </div>
    </>
  )
}
