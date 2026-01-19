"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { ArrowLeft, Target, Plus, Edit3, X, Check, EyeOff, Percent, Euro, Gift, Trash2, Loader2, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
// 👇 CONNEXION FIREBASE
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { useObjectives } from "@/hooks/use-objectives"

// Types pour l'interface
type ObjectiveType = "percentage" | "amount" | "fixed"
type RewardType = "tiered" | "fixed"

export default function ParametresObjectifsPage() {
  // Récupération des données réelles depuis Firebase
  const { objectives, loading } = useObjectives()
  const [editingObj, setEditingObj] = useState<any | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // --- ACTIONS FIREBASE ---

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet objectif ?")) {
      try {
        await deleteDoc(doc(db, "objectives", id))
      } catch (e) {
        console.error("Erreur suppression:", e)
        alert("Erreur lors de la suppression.")
      }
    }
  }

  const handleSave = async (formData: any) => {
    try {
      // Construction de l'objet pour Firestore
      const payload = {
        title: formData.title,
        description: formData.description || "",
        // Mapping pour le dashboard
        isPrincipal: formData.isPrincipal, 
        type: formData.isPrincipal ? "principal" : "secondary",
        isActive: formData.isActive,
        hideRevenue: formData.hideRevenue,
        targetType: formData.targetType,
        rewardType: formData.rewardType,
        target: Number(formData.target || 0),
        unit: formData.unit,
        fixedReward: Number(formData.fixedReward || 0),
        // Calcul de la récompense totale affichée
        reward: formData.rewardType === 'fixed' 
          ? Number(formData.fixedReward || 0) 
          : formData.paliers.reduce((acc:any, p:any) => acc + Number(p.reward), 0),
        paliers: formData.paliers.map((p: any) => ({
           id: p.id || `p-${Date.now()}-${Math.random()}`, // ID unique pour chaque palier
           name: p.name,
           threshold: Number(p.threshold),
           reward: Number(p.reward)
        })),
        // Mise à jour de la progression (Manuel pour l'instant)
        progress: Number(formData.progress || 0),
        updatedAt: new Date()
      }

      if (editingObj?.id) {
        // Mode Modification
        await updateDoc(doc(db, "objectives", editingObj.id), payload)
      } else {
        // Mode Création
        await addDoc(collection(db, "objectives"), {
            ...payload,
            createdAt: new Date()
        })
      }

      // Reset
      setEditingObj(null)
      setShowAdd(false)
    } catch (e) {
      console.error("Erreur sauvegarde:", e)
      alert("Erreur lors de la sauvegarde. Vérifiez la console.")
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        <Link href="/parametres" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Paramètres</span>
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuration des objectifs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Pilotez les objectifs du dashboard en temps réel</p>
          </div>
          <Button size="sm" className="rounded-xl gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>

        {/* LISTE DES OBJECTIFS */}
        <section className="space-y-4">
          {loading ? (
             <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>
          ) : objectives.length === 0 ? (
             <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-muted-foreground/30">
                <Target className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-50"/>
                <p className="text-muted-foreground font-medium">Aucun objectif configuré.</p>
                <p className="text-xs text-muted-foreground mt-1">Cliquez sur "Ajouter" pour commencer.</p>
             </div>
          ) : (
            objectives.map((obj: any) => (
            <div
              key={obj.id}
              className={cn(
                "pulse-card overflow-hidden transition-all",
                (obj.isPrincipal || obj.type === "principal") && "border-primary/40 shadow-sm",
                !obj.isActive && "opacity-60 grayscale",
              )}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        (obj.isPrincipal || obj.type === "principal") ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent",
                      )}
                    >
                      <Target className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-base">{obj.title}</h3>
                        {(obj.isPrincipal || obj.type === "principal") && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                            PRINCIPAL
                          </span>
                        )}
                        {!obj.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold">
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
                      className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                      onClick={() => setEditingObj(obj)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50"
                      onClick={() => handleDelete(obj.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* INFO RAPIDE */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-muted/40">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Type</span>
                    <p className="text-xs font-semibold capitalize">{obj.targetType === "amount" ? "Montant" : obj.targetType || "Standard"}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Cible</span>
                    <p className="text-xs font-semibold">{obj.target?.toLocaleString()} {obj.unit}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Avancement</span>
                    <p className={cn("text-xs font-bold", obj.progress >= obj.target ? "text-green-600" : "text-blue-600")}>
                        {obj.progress?.toLocaleString()} {obj.unit}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-xl bg-muted/40">
                     <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Prime Max</span>
                      <p className="text-xs font-bold text-primary">{obj.reward} €</p>
                  </div>
                </div>

                {/* PALIERS */}
                {obj.paliers && obj.paliers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Paliers configurés</p>
                    <div className="flex flex-wrap gap-2">
                      {obj.paliers.sort((a:any, b:any) => a.threshold - b.threshold).map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border text-xs">
                           <span className="font-medium">{p.name}</span>
                           <span className="text-muted-foreground text-[10px]">({p.threshold})</span>
                           <span className="font-bold text-primary">+{p.reward}€</span>
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

      {/* DRAWER ÉDITION / AJOUT */}
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

// --- COMPOSANT FORMULAIRE (DRAWER) ---
function ObjectiveDrawer({ objective, onClose, onSave }: { objective?: any, onClose: () => void, onSave: (obj: any) => void }) {
  // États locaux du formulaire
  const [title, setTitle] = useState(objective?.title || "")
  const [description, setDescription] = useState(objective?.description || "")
  const [isPrincipal, setIsPrincipal] = useState(objective?.isPrincipal || objective?.type === "principal" || false)
  const [isActive, setIsActive] = useState(objective?.isActive ?? true)
  const [hideRevenue, setHideRevenue] = useState(objective?.hideRevenue || false)
  const [targetType, setTargetType] = useState<ObjectiveType>(objective?.targetType || "amount")
  const [rewardType, setRewardType] = useState<RewardType>(objective?.rewardType || "tiered")
  const [target, setTarget] = useState(objective?.target?.toString() || "")
  const [unit, setUnit] = useState(objective?.unit || "€")
  const [fixedReward, setFixedReward] = useState(objective?.fixedReward?.toString() || "")
  const [paliers, setPaliers] = useState<any[]>(objective?.paliers || [])
  
  // CHAMP CRUCIAL : Avancement Manuel
  const [progress, setProgress] = useState(objective?.progress?.toString() || "0")

  const handleSubmit = () => {
    onSave({
      title, description, isPrincipal, isActive, hideRevenue,
      targetType, rewardType, target, unit, fixedReward, paliers,
      progress // On envoie la progression manuelle
    })
  }

  // Gestion des paliers
  const addPalier = () => setPaliers([...paliers, { id: Date.now().toString(), name: `Palier ${paliers.length + 1}`, threshold: 0, reward: 0 }])
  const updatePalier = (idx: number, field: string, val: any) => {
    const newPaliers = [...paliers]; newPaliers[idx] = { ...newPaliers[idx], [field]: val }; setPaliers(newPaliers)
  }
  const removePalier = (idx: number) => setPaliers(paliers.filter((_, i) => i !== idx))

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[92vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom">
        
        {/* Header Drawer */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-md rounded-t-3xl p-4 border-b border-border z-10 flex justify-between items-center">
           <h2 className="font-bold text-lg">{objective ? "Modifier l'objectif" : "Nouvel objectif"}</h2>
           <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted"><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-5 space-y-8 pb-10">
          
          {/* 1. INFOS DE BASE */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Informations Générales</h3>
            <div className="space-y-3">
              <Input 
                 value={title} 
                 onChange={e => setTitle(e.target.value)} 
                 placeholder="Titre (ex: Chiffre d'affaires)" 
                 className="font-semibold text-lg"
              />
              <Input 
                 value={description} 
                 onChange={e => setDescription(e.target.value)} 
                 placeholder="Description courte" 
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/50">
                  <span className="text-sm font-medium">Objectif Principal</span>
                  <Switch checked={isPrincipal} onCheckedChange={setIsPrincipal} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/50">
                  <span className="text-sm font-medium">Actif</span>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-muted-foreground"/>
                    <span className="text-sm font-medium">Masquer Montant</span>
                  </div>
                  <Switch checked={hideRevenue} onCheckedChange={setHideRevenue} />
                </div>
              </div>
            </div>
          </section>

          {/* 2. CIBLE ET PROGRESSION (LE PLUS IMPORTANT) */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wide">Cible & Progression</h3>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-xs font-semibold mb-1.5 block ml-1">Cible à atteindre</label>
                  <Input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0" className="font-mono" />
               </div>
               <div>
                  <label className="text-xs font-semibold mb-1.5 block ml-1">Unité</label>
                  <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="€">€ (Euros)</SelectItem>
                          <SelectItem value="%">% (Pourcentage)</SelectItem>
                          <SelectItem value="pts">pts (Points)</SelectItem>
                          <SelectItem value="cli">Clients</SelectItem>
                      </SelectContent>
                  </Select>
               </div>
            </div>

            {/* ZONE DE MISE À JOUR MANUELLE */}
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-3">
               <div className="flex items-center gap-2 text-blue-700">
                  <Edit3 className="w-4 h-4" />
                  <label className="text-sm font-bold">Avancement Actuel (Manuel)</label>
               </div>
               <div className="flex gap-3 items-center">
                 <Input 
                    type="number" 
                    value={progress} 
                    onChange={e => setProgress(e.target.value)} 
                    className="bg-white border-blue-200 font-mono text-lg font-bold text-blue-800"
                 />
                 <span className="text-sm font-medium text-blue-600">/ {target} {unit}</span>
               </div>
               <p className="text-[10px] text-blue-500">
                 Modifiez ce chiffre pour mettre à jour la jauge sur le Dashboard des employés.
               </p>
            </div>
          </section>

          {/* 3. RÉCOMPENSES */}
          <section className="space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-purple-600 uppercase tracking-wide">Paliers & Primes</h3>
                <Button size="sm" variant="outline" onClick={addPalier} className="h-8 rounded-full border-dashed border-purple-200 text-purple-700 hover:bg-purple-50">
                  <Plus className="w-3 h-3 mr-1"/> Ajouter un palier
                </Button>
             </div>
             
             <div className="space-y-3">
               {paliers.length === 0 && (
                 <p className="text-center text-xs text-muted-foreground py-4 italic">Aucun palier défini. Ajoutez-en un pour débloquer des primes.</p>
               )}
               {paliers.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center p-2 rounded-xl bg-muted/30 border border-border/50">
                      <div className="flex-1 min-w-0">
                         <label className="text-[10px] text-muted-foreground ml-1">Nom</label>
                         <Input value={p.name} onChange={e => updatePalier(i, 'name', e.target.value)} className="h-8 text-sm"/>
                      </div>
                      <div className="w-20">
                         <label className="text-[10px] text-muted-foreground ml-1">Seuil</label>
                         <Input type="number" value={p.threshold} onChange={e => updatePalier(i, 'threshold', e.target.value)} className="h-8 text-sm"/>
                      </div>
                      <div className="w-20">
                         <label className="text-[10px] text-muted-foreground ml-1">Prime</label>
                         <Input type="number" value={p.reward} onChange={e => updatePalier(i, 'reward', e.target.value)} className="h-8 text-sm font-bold text-primary"/>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => removePalier(i)} className="mt-4 h-8 w-8 text-muted-foreground hover:text-red-500"><X className="w-4 h-4"/></Button>
                  </div>
               ))}
             </div>
          </section>

          <Button className="w-full py-6 text-lg rounded-xl shadow-lg shadow-primary/20" onClick={handleSubmit} disabled={!title}>
            <Save className="w-5 h-5 mr-2" /> Enregistrer les modifications
          </Button>
        </div>
      </div>
    </>
  )
}
