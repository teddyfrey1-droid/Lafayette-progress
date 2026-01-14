"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { ArrowLeft, Target, Plus, Edit3, X, Check, Info, EyeOff, Percent, Euro, Gift } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

type ObjectiveType = "percentage" | "amount" | "fixed"
type RewardType = "tiered" | "fixed"

interface AdvancedObjective {
  id: string
  title: string
  description: string
  isPrincipal: boolean
  isActive: boolean
  hideRevenue: boolean // Cacher le CA exact et afficher en %
  targetType: ObjectiveType // pourcentage, montant, fixe
  rewardType: RewardType // avec paliers ou prime fixe
  target?: number
  unit: string
  fixedReward?: number // prime fixe sans paliers
  paliers: {
    id: string
    name: string
    threshold: number
    reward: number
  }[]
}

const defaultObjectives: AdvancedObjective[] = [
  {
    id: "obj-1",
    title: "Chiffre d'affaires",
    description: "Objectif CA mensuel",
    isPrincipal: true,
    isActive: true,
    hideRevenue: false,
    targetType: "amount",
    rewardType: "tiered",
    target: 100000,
    unit: "€",
    paliers: [
      { id: "p1", name: "Bronze", threshold: 50000, reward: 100 },
      { id: "p2", name: "Argent", threshold: 75000, reward: 200 },
      { id: "p3", name: "Or", threshold: 100000, reward: 300 },
    ],
  },
  {
    id: "obj-2",
    title: "Taux d'erreur",
    description: "Maintenir moins de 1% d'erreurs",
    isPrincipal: false,
    isActive: true,
    hideRevenue: false,
    targetType: "percentage",
    rewardType: "fixed",
    target: 1,
    unit: "%",
    fixedReward: 50,
    paliers: [],
  },
  {
    id: "obj-3",
    title: "Présence",
    description: "Être présent tous les jours du mois",
    isPrincipal: false,
    isActive: true,
    hideRevenue: false,
    targetType: "fixed",
    rewardType: "fixed",
    unit: "jours",
    fixedReward: 75,
    paliers: [],
  },
]

export default function ParametresObjectifsPage() {
  const [objectives, setObjectives] = useState<AdvancedObjective[]>(defaultObjectives)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        {/* Back link */}
        <Link
          href="/parametres"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Paramètres</span>
        </Link>

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuration des objectifs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Paramètres avancés pour les objectifs et primes</p>
          </div>
          <Button size="sm" className="rounded-xl gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>

        {/* Info Banner */}
        <div className="pulse-card p-5 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">Options de configuration disponibles</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Objectif en pourcentage (ex: taux d'erreur moins de 1%)</li>
                <li>• Objectif en montant (ex: CA de 100 000€)</li>
                <li>• Prime fixe sans paliers ou prime avec paliers progressifs</li>
                <li>• Option pour cacher le CA exact et afficher uniquement la progression en %</li>
                <li>• Marquer un objectif comme principal ou secondaire</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Objectives List */}
        <section className="space-y-4">
          {objectives.map((obj) => (
            <div
              key={obj.id}
              className={cn(
                "pulse-card overflow-hidden transition-all",
                obj.isPrincipal && "border-primary/30",
                !obj.isActive && "opacity-60",
              )}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        obj.isPrincipal ? "bg-primary/15" : "bg-muted",
                      )}
                    >
                      <Target className={cn("w-6 h-6", obj.isPrincipal ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-base">{obj.title}</h3>
                        {obj.isPrincipal && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                            PRINCIPAL
                          </span>
                        )}
                        {!obj.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                            INACTIF
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{obj.description}</p>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => setEditingId(obj.id)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Type d'objectif */}
                  <div className="p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      {obj.targetType === "percentage" && <Percent className="w-3.5 h-3.5 text-blue-500" />}
                      {obj.targetType === "amount" && <Euro className="w-3.5 h-3.5 text-emerald-500" />}
                      {obj.targetType === "fixed" && <Gift className="w-3.5 h-3.5 text-purple-500" />}
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Type</span>
                    </div>
                    <p className="text-xs font-medium">
                      {obj.targetType === "percentage" && "Pourcentage"}
                      {obj.targetType === "amount" && "Montant"}
                      {obj.targetType === "fixed" && "Fixe"}
                    </p>
                  </div>

                  {/* Cible */}
                  {obj.target !== undefined && (
                    <div className="p-3 rounded-xl bg-muted/50">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                        Cible
                      </span>
                      <p className="text-xs font-medium">
                        {obj.targetType === "percentage" && `< ${obj.target}${obj.unit}`}
                        {obj.targetType === "amount" && `${obj.target.toLocaleString()} ${obj.unit}`}
                        {obj.targetType === "fixed" && "-"}
                      </p>
                    </div>
                  )}

                  {/* Type de prime */}
                  <div className="p-3 rounded-xl bg-muted/50">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Prime</span>
                    <p className="text-xs font-medium">
                      {obj.rewardType === "fixed" && `Fixe: ${obj.fixedReward}€`}
                      {obj.rewardType === "tiered" && `${obj.paliers.length} paliers`}
                    </p>
                  </div>

                  {/* CA caché */}
                  {obj.hideRevenue && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[10px] font-semibold text-amber-700 uppercase">CA Masqué</span>
                      </div>
                      <p className="text-xs font-medium text-amber-700">Affiché en %</p>
                    </div>
                  )}
                </div>

                {/* Paliers */}
                {obj.rewardType === "tiered" && obj.paliers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Paliers configurés</p>
                    <div className="flex flex-wrap gap-2">
                      {obj.paliers.map((palier, index) => (
                        <div
                          key={palier.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20"
                        >
                          <div className="w-5 h-5 rounded bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-[10px] font-bold">
                            {index + 1}
                          </div>
                          <div className="text-xs">
                            <span className="font-semibold">{palier.name}:</span>{" "}
                            <span className="text-muted-foreground">
                              {palier.threshold.toLocaleString()} {obj.unit}
                            </span>{" "}
                            <span className="text-primary font-bold">→ +{palier.reward}€</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* Edit/Add Drawer */}
      {(editingId || showAdd) && (
        <ObjectiveDrawer
          objective={editingId ? objectives.find((o) => o.id === editingId) : undefined}
          onClose={() => {
            setEditingId(null)
            setShowAdd(false)
          }}
          onSave={(obj) => {
            if (editingId) {
              setObjectives(objectives.map((o) => (o.id === editingId ? { ...obj, id: editingId } : o)))
            } else {
              setObjectives([...objectives, { ...obj, id: `obj-${Date.now()}` }])
            }
            setEditingId(null)
            setShowAdd(false)
          }}
        />
      )}

      <BottomNav />
    </div>
  )
}

function ObjectiveDrawer({
  objective,
  onClose,
  onSave,
}: {
  objective?: AdvancedObjective
  onClose: () => void
  onSave: (obj: Omit<AdvancedObjective, "id">) => void
}) {
  const [title, setTitle] = useState(objective?.title || "")
  const [description, setDescription] = useState(objective?.description || "")
  const [isPrincipal, setIsPrincipal] = useState(objective?.isPrincipal || false)
  const [isActive, setIsActive] = useState(objective?.isActive ?? true)
  const [hideRevenue, setHideRevenue] = useState(objective?.hideRevenue || false)
  const [targetType, setTargetType] = useState<ObjectiveType>(objective?.targetType || "amount")
  const [rewardType, setRewardType] = useState<RewardType>(objective?.rewardType || "tiered")
  const [target, setTarget] = useState(objective?.target?.toString() || "")
  const [unit, setUnit] = useState(objective?.unit || "€")
  const [fixedReward, setFixedReward] = useState(objective?.fixedReward?.toString() || "")
  const [paliers, setPaliers] = useState(objective?.paliers || [])

  const handleSave = () => {
    onSave({
      title,
      description,
      isPrincipal,
      isActive,
      hideRevenue,
      targetType,
      rewardType,
      target: target ? Number(target) : undefined,
      unit,
      fixedReward: fixedReward ? Number(fixedReward) : undefined,
      paliers,
    })
  }

  const addPalier = () => {
    setPaliers([
      ...paliers,
      {
        id: `p${Date.now()}`,
        name: `Palier ${paliers.length + 1}`,
        threshold: 0,
        reward: 0,
      },
    ])
  }

  const updatePalier = (index: number, field: "name" | "threshold" | "reward", value: string | number) => {
    const updated = [...paliers]
    updated[index] = { ...updated[index], [field]: value }
    setPaliers(updated)
  }

  const removePalier = (index: number) => {
    setPaliers(paliers.filter((_, i) => i !== index))
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">{objective ? "Modifier" : "Ajouter"} un objectif</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6 pb-8">
          {/* Infos générales */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary">Informations générales</h3>

            <div>
              <label className="text-sm font-medium">Titre *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Ex: Chiffre d'affaires"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Ex: Objectif CA mensuel"
              />
            </div>

            {/* Switches */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Objectif principal</p>
                  <p className="text-xs text-muted-foreground">Marquer comme objectif prioritaire</p>
                </div>
                <Switch checked={isPrincipal} onCheckedChange={setIsPrincipal} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Objectif actif</p>
                  <p className="text-xs text-muted-foreground">Activer ou désactiver cet objectif</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-700">Masquer le CA exact</p>
                    <p className="text-xs text-amber-600">Afficher uniquement la progression en %</p>
                  </div>
                </div>
                <Switch checked={hideRevenue} onCheckedChange={setHideRevenue} />
              </div>
            </div>
          </div>

          {/* Type d'objectif */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-emerald-600">Type d'objectif</h3>

            <div>
              <label className="text-sm font-medium mb-2 block">Mode de mesure</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "percentage" as ObjectiveType, label: "Pourcentage", icon: Percent },
                  { value: "amount" as ObjectiveType, label: "Montant", icon: Euro },
                  { value: "fixed" as ObjectiveType, label: "Fixe", icon: Gift },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setTargetType(type.value)}
                    className={cn(
                      "p-3 rounded-xl text-xs font-medium transition-all flex flex-col items-center gap-2",
                      targetType === type.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    <type.icon className="w-5 h-5" />
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {targetType !== "fixed" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Cible</label>
                  <Input
                    type="number"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="rounded-xl mt-1"
                    placeholder="Ex: 100000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unité</label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger className="rounded-xl mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="€">€ (Euros)</SelectItem>
                      <SelectItem value="%">% (Pourcentage)</SelectItem>
                      <SelectItem value="clients">Clients</SelectItem>
                      <SelectItem value="points">Points</SelectItem>
                      <SelectItem value="jours">Jours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Type de prime */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-purple-600">Type de prime</h3>

            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "fixed" as RewardType, label: "Prime fixe" },
                { value: "tiered" as RewardType, label: "Avec paliers" },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setRewardType(type.value)}
                  className={cn(
                    "p-3 rounded-xl text-xs font-medium transition-all",
                    rewardType === type.value
                      ? "bg-purple-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {rewardType === "fixed" && (
              <div>
                <label className="text-sm font-medium">Montant de la prime</label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    value={fixedReward}
                    onChange={(e) => setFixedReward(e.target.value)}
                    className="rounded-xl pr-8"
                    placeholder="Ex: 100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                </div>
              </div>
            )}

            {rewardType === "tiered" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Paliers</label>
                  <Button size="sm" variant="outline" className="rounded-xl gap-1 bg-transparent" onClick={addPalier}>
                    <Plus className="w-3 h-3" />
                    Ajouter
                  </Button>
                </div>

                {paliers.map((palier, index) => (
                  <div key={palier.id} className="pulse-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Input
                        value={palier.name}
                        onChange={(e) => updatePalier(index, "name", e.target.value)}
                        className="rounded-xl flex-1 mr-2"
                        placeholder="Nom du palier"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-red-500"
                        onClick={() => removePalier(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        value={palier.threshold}
                        onChange={(e) => updatePalier(index, "threshold", Number(e.target.value))}
                        className="rounded-xl"
                        placeholder="Seuil"
                      />
                      <div className="relative">
                        <Input
                          type="number"
                          value={palier.reward}
                          onChange={(e) => updatePalier(index, "reward", Number(e.target.value))}
                          className="rounded-xl pr-8"
                          placeholder="Prime"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          €
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button className="w-full rounded-xl py-6 text-base" onClick={handleSave} disabled={!title}>
            <Check className="w-5 h-5 mr-2" />
            {objective ? "Sauvegarder les modifications" : "Créer l'objectif"}
          </Button>
        </div>
      </div>
    </>
  )
}
