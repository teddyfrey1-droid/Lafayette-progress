"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input" // Assurez-vous d'avoir ce composant
import { Label } from "@/components/ui/label"
import { BadgeCheck, CheckCircle2, Clock, Coins, Pencil, Trash2, Save, X } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"
import { usePrimes, PrimeHistory } from "@/hooks/use-primes"
import { useCurrentUser } from "@/lib/use-current-user"

// Fonction utilitaire pour l'affichage (inchangée)
function statusMeta(status: string) {
  switch (status) {
    case "paid": return { label: "Payée", icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20" }
    case "validated": return { label: "Validée", icon: BadgeCheck, className: "bg-blue-500/15 text-blue-700 border-blue-500/20" }
    default: return { label: "En cours", icon: Clock, className: "bg-amber-500/15 text-amber-700 border-amber-500/20" }
  }
}

export default function PrimesPage() {
  const { profile } = useAuth()
  const user = useCurrentUser()
  const { primes, loading, canEditHistory, updatePrime, deletePrime } = usePrimes()
  
  const [selectedPrime, setSelectedPrime] = useState<PrimeHistory | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  
  // États locaux pour le formulaire d'édition
  const [editAmount, setEditAmount] = useState<string>("")
  const [editStatus, setEditStatus] = useState<string>("")

  // Gestion de l'édition
  const handleEditClick = (p: PrimeHistory) => {
    setEditAmount(p.amount.toString())
    setEditStatus(p.status)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!selectedPrime) return;
    try {
      await updatePrime(selectedPrime.id, {
        amount: parseFloat(editAmount),
        status: editStatus as any
      });
      setIsEditing(false);
      setSelectedPrime(null); // Fermer le drawer après sauvegarde
    } catch (e) {
      alert("Erreur lors de la mise à jour");
    }
  }

  const handleDelete = async () => {
    if (!selectedPrime) return;
    await deletePrime(selectedPrime.id);
    setSelectedPrime(null);
  }

  // Si on est admin, on voit tout, sinon on pourrait filtrer par userId si nécessaire
  // Pour l'instant on affiche l'historique global ou perso selon votre logique business. 
  // Ici : on affiche tout ce qui vient de la collection "primes_history".
  
  return (
    <PermissionGate moduleId="primes" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Coins className="w-6 h-6 text-primary" />
              Historique des Primes
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
               {canEditHistory ? "Gestion et historique des primes." : "Consultez vos anciennes primes."}
            </p>
          </div>

          <section className="space-y-3">
             {loading ? (
                <p className="text-center text-muted-foreground py-10">Chargement...</p>
             ) : primes.length === 0 ? (
                <div className="text-center py-10 bg-muted/30 rounded-xl">
                   <p className="text-muted-foreground">Aucune prime dans l'historique.</p>
                </div>
             ) : (
              <div className="space-y-3">
                {primes.map((p) => {
                  const meta = statusMeta(p.status)
                  const Icon = meta.icon
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPrime(p)
                        setIsEditing(false)
                      }}
                      className="w-full text-left pulse-card p-4 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <Coins className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold leading-tight">{p.month}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Montant : <span className="font-medium text-foreground">{p.amount.toLocaleString("fr-FR")} €</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={cn("border", meta.className)}>
                                <Icon className="w-3.5 h-3.5 mr-1" />
                                {meta.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </main>

        <BottomNav />

        {/* DRAWER DE DÉTAIL / ÉDITION */}
        <Sheet open={!!selectedPrime} onOpenChange={(open) => !open && setSelectedPrime(null)}>
          <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>
                 {isEditing ? "Modifier la prime" : selectedPrime?.month}
              </SheetTitle>
            </SheetHeader>

            {selectedPrime && (
              <div className="space-y-6">
                
                {isEditing ? (
                  /* MODE ÉDITION (ADMIN SEULEMENT) */
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <Label>Montant (€)</Label>
                       <Input 
                          type="number" 
                          value={editAmount} 
                          onChange={(e) => setEditAmount(e.target.value)} 
                       />
                    </div>
                    <div className="space-y-2">
                       <Label>Statut</Label>
                       <select 
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                       >
                          <option value="pending">En cours</option>
                          <option value="validated">Validée</option>
                          <option value="paid">Payée</option>
                       </select>
                    </div>
                    <div className="flex gap-3 pt-4">
                       <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Annuler</Button>
                       <Button className="flex-1" onClick={handleSave}><Save className="w-4 h-4 mr-2"/> Enregistrer</Button>
                    </div>
                  </div>
                ) : (
                  /* MODE LECTURE */
                  <>
                    <div className="flex flex-col items-center justify-center py-6 bg-muted/20 rounded-2xl">
                       <span className="text-3xl font-bold text-primary">{selectedPrime.amount.toLocaleString("fr-FR")} €</span>
                       <span className="text-sm text-muted-foreground mt-1">{statusMeta(selectedPrime.status).label}</span>
                    </div>

                    {/* Actions Admin */}
                    {canEditHistory && (
                      <div className="border-t pt-4 mt-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Administration</p>
                        <div className="flex gap-3">
                          <Button variant="outline" className="flex-1" onClick={() => handleEditClick(selectedPrime)}>
                            <Pencil className="w-4 h-4 mr-2" /> Modifier
                          </Button>
                          <Button variant="destructive" className="flex-1" onClick={handleDelete}>
                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </PermissionGate>
  )
}
