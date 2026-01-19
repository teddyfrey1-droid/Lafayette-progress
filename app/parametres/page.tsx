"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { ArrowLeft, Target, Plus, Edit3, X, Check, Info, EyeOff, Percent, Euro, Gift, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useObjectives } from "@/hooks/use-objectives" // On utilise votre hook
import { doc, updateDoc, addDoc, deleteDoc, collection } from "firebase/firestore"
import { db } from "@/lib/firebase/client"

// Types pour l'interface d'édition
type ObjectiveType = "percentage" | "amount" | "fixed"
type RewardType = "tiered" | "fixed"

export default function ParametresObjectifsPage() {
  const { objectives, loading } = useObjectives()
  const [editingObj, setEditingObj] = useState<any | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // Fonction de suppression
  const handleDelete = async (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer cet objectif ?")) {
      await deleteDoc(doc(db, "objectives", id))
    }
  }

  // Fonction de sauvegarde (Création ou Mise à jour)
  const handleSave = async (formData: any) => {
    try {
        const payload = {
            title: formData.title,
            description: formData.description,
            // Mapping vers le format standard
            type: formData.isPrincipal ? "principal" : "secondary", 
            isActive: formData.isActive,
            // Nouveaux champs de config
            hideRevenue: formData.hideRevenue,
            targetType: formData.targetType,
            rewardType: formData.rewardType,
            target: formData.target || 0,
            unit: formData.unit,
            reward: formData.rewardType === 'fixed' ? formData.fixedReward : formData.paliers.reduce((acc:any, p:any) => acc + p.reward, 0), // Récompense max calculée
            fixedReward: formData.fixedReward || 0,
            paliers: formData.paliers,
            // Champs par défaut si création
            progress: editingObj?.progress || 0,
            unlocked: editingObj?.unlocked || false,
            deadline: editingObj?.deadline || new Date(),
        }

        if (editingObj) {
            await updateDoc(doc(db, "objectives", editingObj.id), payload)
        } else {
            await addDoc(collection(db, "objectives"), payload)
        }
        
        setEditingObj(null)
        setShowAdd(false)
    } catch (e) {
        console.error("Erreur sauvegarde:", e)
        alert("Erreur lors de la sauvegarde")
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        <Link
          href="/parametres"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Paramètres</span>
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuration des objectifs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Pilotez les objectifs en temps réel</p>
          </div>
          <Button size="sm" className="rounded-xl gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>

        {/* Liste des objectifs venant de Firebase */}
        <section className="space-y-4">
          {loading ? (
             <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground"/></div>
          ) : objectives.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground">Aucun objectif configuré.</div>
          ) : (
            objectives.map((obj: any) => (
            <div
              key={obj.id}
              className={cn(
                "pulse-card overflow-hidden transition-all",
                obj.type === "principal" && "border-primary/30",
                !obj.isActive && "opacity-60",
              )}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        obj.type === "principal" ? "bg-primary/15" : "bg-muted",
                      )}
                    >
                      <Target className={cn("w-6 h-6", obj.type === "principal" ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-base">{obj.title}</h3>
                        {obj.type === "principal" && (
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
                      onClick={() => setEditingObj(obj)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(obj.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Configuration Badge Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      {obj.targetType === "percentage" && <Percent className="w-3.5 h-3.5 text-blue-500" />}
                      {obj.targetType === "amount" && <Euro className="w-3.5 h-3.5 text-emerald-500" />}
                      {(!obj.targetType || obj.targetType === "fixed") && <Gift className="w-3.5 h-3.5 text-purple-500" />}
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Type</span>
                    </div>
                    <p className="text-xs font-medium capitalize">{obj.targetType || "Montant"}</p>
                  </div>

                  {obj.target !== undefined && (
                    <div className="p-3 rounded-xl bg-muted/50">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                        Cible
                      </span>
                      <p className="text-xs font-medium">
                         {obj.target.toLocaleString()} {obj.unit}
                      </p>
                    </div>
                  )}

                  {obj.hideRevenue && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[10px] font-semibold text-amber-700 uppercase">Masqué</span>
                      </div>
                      <p className="text-xs font-medium text-amber-700">Affiché en %</p>
                    </div>
                  )}
                </div>

                {/* Paliers Display */}
                {obj.paliers && obj.paliers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Paliers</p>
                    <div className="flex flex-wrap gap-2">
                      {obj.paliers.map((palier: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/30 border border-border"
                        >
                          <div className="w-5 h-5 rounded bg-primary text-white flex items-center justify-center text-[10px] font-bold">
                            {index + 1}
                          </div>
                          <div className="text-xs">
                            <span className="font-semibold">{palier.name}</span>{" "}
                            <span className="text-primary font-bold">+{palier.reward}€</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )))}
        </section>
      </main>

      {/* Drawer pour Ajouter / Modifier */}
      {(editingObj || showAdd) && (
        <ObjectiveDrawer
          objective={editingObj}
          onClose={() => {
            setEditingObj(null)
            setShowAdd(false)
          }}
          onSave={handleSave}
        />
      )}

      <BottomNav />
    </div>
  )
}

// Composant Formulaire (Drawer)
function ObjectiveDrawer({ objective, onClose, onSave }: { objective?: any, onClose: () => void, onSave: (data: any) => void }) {
  // Initialisation des états avec les données existantes ou valeurs par défaut
  const [title, setTitle] = useState(objective?.title || "")
  const [description, setDescription] = useState(objective?.description || "")
  const [isPrincipal, setIsPrincipal] = useState(objective?.type === "principal" || false)
  const [isActive, setIsActive] = useState(objective?.isActive ?? true)
  const [hideRevenue, setHideRevenue] = useState(objective?.hideRevenue || false)
  const [targetType, setTargetType] = useState<ObjectiveType>(objective?.targetType || "amount")
  const [rewardType, setRewardType] = useState<RewardType>(objective?.rewardType || "tiered")
  const [target, setTarget] = useState(objective?.target?.toString() || "")
  const [unit, setUnit] = useState(objective?.unit || "€")
  const [fixedReward, setFixedReward] = useState(objective?.fixedReward?.toString() || "")
  const [paliers, setPaliers] = useState<any[]>(objective?.paliers || [])
  const [currentProgress, setCurrentProgress] = useState(objective?.progress?.toString() || "0") // Pour modifier l'avancement manuel pour l'instant

  const handleSave = () => {
    onSave({
      title, description, isPrincipal, isActive, hideRevenue,
      targetType, rewardType, target: Number(target), unit,
      fixedReward: Number(fixedReward), paliers, progress: Number(currentProgress)
    })
  }

  const addPalier = () => setPaliers([...paliers, { id: Date.now().toString(), name: `Palier ${paliers.length + 1}`, threshold: 0, reward: 0 }])
  const updatePalier = (idx: number, field: string, val: any) => {
    const newPaliers = [...paliers]; newPaliers[idx] = { ...newPaliers[idx], [field]: val }; setPaliers(newPaliers)
  }
  const removePalier = (idx: number) => setPaliers(paliers.filter((_, i) => i !== idx))

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10 flex justify-between items-center">
            <h2 className="font-semibold text-lg">{objective ? "Modifier" : "Créer"} un objectif</h2>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-4 space-y-6 pb-8">
            {/* Champs de base */}
            <div className="space-y-4">
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre (ex: Chiffre d'affaires)" className="font-semibold" />
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description courte" />
                
                {/* Switches */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <span className="text-sm font-medium">Objectif Principal</span>
                    <Switch checked={isPrincipal} onCheckedChange={setIsPrincipal} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <span className="text-sm font-medium">Masquer les montants (afficher %)</span>
                    <Switch checked={hideRevenue} onCheckedChange={setHideRevenue} />
                </div>
            </div>

            {/* Cibles et Progression */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Objectif Cible</label>
                    <div className="relative">
                        <Input type="number" value={target} onChange={e => setTarget(e.target.value)} />
                        <span className="absolute right-3 top-2 text-xs text-muted-foreground">{unit}</span>
                    </div>
                </div>
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Unité</label>
                    <Select value={unit} onValueChange={setUnit}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="€">€</SelectItem>
                            <SelectItem value="%">%</SelectItem>
                            <SelectItem value="pts">pts</SelectItem>
                            <SelectItem value="cli">clients</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* AVANCEMENT MANUEL (TEMPORAIRE POUR TESTER FACILEMENT) */}
            <div className="p-3 border border-blue-200 bg-blue-50 rounded-xl">
                <label className="text-xs font-bold text-blue-700 mb-1 block">Mise à jour Avancement (Manuel)</label>
                <div className="flex gap-2">
                    <Input 
                        type="number" 
                        value={currentProgress} 
                        onChange={e => setCurrentProgress(e.target.value)} 
                        className="bg-white border-blue-200"
                    />
                    <div className="flex items-center text-sm text-blue-700 font-medium">
                        / {target} {unit}
                    </div>
                </div>
                <p className="text-[10px] text-blue-500 mt-1">Modifiez ici pour voir la jauge bouger sur le dashboard.</p>
            </div>

            {/* Paliers */}
            <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-sm">Paliers de primes</h3>
                    <Button size="sm" variant="outline" onClick={addPalier}><Plus className="w-4 h-4 mr-1"/> Ajouter</Button>
                </div>
                {paliers.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                        <Input value={p.name} onChange={e => updatePalier(i, 'name', e.target.value)} placeholder="Nom" className="flex-1" />
                        <Input type="number" value={p.threshold} onChange={e => updatePalier(i, 'threshold', Number(e.target.value))} placeholder="Seuil" className="w-20" />
                        <Input type="number" value={p.reward} onChange={e => updatePalier(i, 'reward', Number(e.target.value))} placeholder="€" className="w-20" />
                        <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removePalier(i)}><X className="w-4 h-4"/></Button>
                    </div>
                ))}
            </div>

            <Button className="w-full py-6 text-lg rounded-xl" onClick={handleSave}>Enregistrer</Button>
        </div>
      </div>
    </>
  )
}
