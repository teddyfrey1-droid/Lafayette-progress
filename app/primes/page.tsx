"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BadgeCheck, CheckCircle2, Clock, Coins, Pencil, Trash2, Save, X, Download, FileText } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"
import { usePrimes, PrimeHistory } from "@/hooks/use-primes"
import { useCurrentUser } from "@/lib/use-current-user"
import { exportToPulseCSV } from "@/lib/csv-export"
import { db } from "@/lib/firebase/client"
import { collection, getDocs, query, where } from "firebase/firestore"
import { readDemoState } from "@/lib/demo/local-demo-store"
// ✅ Import du générateur PDF
import { generatePrimePDF } from "@/lib/pdf-export"

// Fonction utilitaire pour l'affichage (inchangée)
function statusMeta(status: string) {
  switch (status) {
    case "paid": return { label: "Payée", icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20" }
    case "validated": return { label: "Validée", icon: BadgeCheck, className: "bg-blue-500/15 text-blue-700 border-blue-500/20" }
    default: return { label: "En attente", icon: Clock, className: "bg-amber-500/15 text-amber-700 border-amber-500/20" }
  }
}

export default function PrimesPage() {
  const { profile, company, isDemo } = useAuth()
  const user = useCurrentUser()
  const { primes, loading, updatePrime, deletePrime } = usePrimes()
  
  const [selectedPrime, setSelectedPrime] = useState<PrimeHistory | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  
  // États locaux pour le formulaire d'édition
  const [editAmount, setEditAmount] = useState<string>("")
  const [editStatus, setEditStatus] = useState<string>("")


  const isManager = !!user.isManagerOrAdmin

  const pendingPrimes = useMemo(() => primes.filter((p) => p.status === "pending"), [primes])
  const settledPrimes = useMemo(() => primes.filter((p) => p.status !== "pending"), [primes])

  const [tab, setTab] = useState<"pending" | "history">(() => (pendingPrimes.length > 0 ? "pending" : "history"))

  useEffect(() => {
    if (!isManager) return
    // Si on n'a plus de primes en attente, on bascule sur l'historique
    if (tab === "pending" && pendingPrimes.length === 0) setTab("history")
    if (tab === "history" && pendingPrimes.length > 0 && settledPrimes.length === 0) setTab("pending")
  }, [isManager, pendingPrimes.length, settledPrimes.length, tab])

  const displayedPrimes = useMemo(() => {
    if (!isManager) return primes
    return tab === "pending" ? pendingPrimes : settledPrimes
  }, [isManager, primes, tab, pendingPrimes, settledPrimes])


  const companyId = useMemo(() => ((profile as any)?.companyId as string | undefined) || "demo-company", [profile])

  // --- NOUVEAU : GESTION PDF ---
  const handleExportPDF = () => {
    if (!selectedPrime) return
    
    generatePrimePDF({
        userName: user.displayName || "Collaborateur",
        companyName: ((company as any)?.name) || ((profile as any)?.companyName) || "Mon Entreprise",
        month: selectedPrime.month,
        status: selectedPrime.status,
        amount: selectedPrime.amount,
        date: selectedPrime.date.toISOString()
    })
  }

  // --- EXPORT CSV (Code existant préservé) ---
  const handleExportCSV = async () => {
    if (primes.length === 0) return

    const statusLabels: Record<string, string> = {
      pending: "En cours",
      validated: "Validée",
      paid: "Payée",
    }

    const companyName =
      ((company as any)?.name as string | undefined) ||
      ((company as any)?.companyName as string | undefined) ||
      ((profile as any)?.companyName as string | undefined) ||
      ((profile as any)?.company as string | undefined) ||
      "Mon Établissement"

    const exportedBy = user.displayName || user.email || "Utilisateur"

    // --- Récupération des noms salariés ---
    const ids = Array.from(new Set(primes.map((p) => p.userId).filter(Boolean))) as string[]
    const nameById: Record<string, string> = {}

    if (ids.length > 0) {
      if (isDemo) {
        const demo = readDemoState(companyId)
        for (const m of demo?.members || []) {
          nameById[m.id] = m.displayName
        }
      } else {
        try {
          const chunks: string[][] = []
          for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))

          for (const chunk of chunks) {
            const q = query(collection(db, "users"), where("uid", "in", chunk))
            const snap = await getDocs(q)
            snap.forEach((d) => {
              const data = d.data() as any
              const uid = (data?.uid || d.id) as string
              const dn = (data?.displayName || data?.name || "").toString().trim()
              const email = (data?.email || "").toString().trim()
              nameById[uid] = dn || email || uid
            })
          }
        } catch (e) {
          console.warn("Export CSV: impossible de charger les noms utilisateurs", e)
        }
      }
    }

    const splitName = (displayName: string) => {
      const clean = (displayName || "").trim()
      if (!clean) return { first: "", last: "" }
      const parts = clean.split(/\s+/)
      const first = parts.shift() || ""
      const last = parts.join(" ")
      return { first, last }
    }

    const toDetail = (p: PrimeHistory) => {
      const anyP = p as any
      const d = anyP?.details ?? anyP?.detail ?? anyP?.breakdown
      if (!d) return ""
      if (typeof d === "string") return d
      try {
        return JSON.stringify(d)
      } catch {
        return String(d)
      }
    }

    const exportData = primes.map((p) => {
      const name = p.userId ? (nameById[p.userId] || "") : ""
      const { first, last } = splitName(name)
      return {
        Entreprise: companyName,
        Prénom: first,
        Nom: last,
        Mois: p.month,
        "Montant (€)": p.amount,
        Statut: statusLabels[p.status] || p.status,
        Date: p.date.toLocaleDateString("fr-FR"),
        Détail: toDetail(p),
        PrimeId: p.id,
        UserId: p.userId || "",
      }
    })

    exportToPulseCSV(
      "primes_historique",
      exportData,
      ["Entreprise", "Prénom", "Nom", "Mois", "Montant (€)", "Statut", "Date", "Détail", "PrimeId", "UserId"],
      {
        companyName,
        exportedBy,
        logoText: "PULSE",
        title: "Primes — Historique",
      },
    )
  }

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
      setSelectedPrime(null);
    } catch (e) {
      alert("Erreur lors de la mise à jour");
    }
  }

  const handleDelete = async () => {
    if (!selectedPrime) return;
    await deletePrime(selectedPrime.id);
    setSelectedPrime(null);
  }


  const setPrimeStatus = async (nextStatus: PrimeHistory["status"]) => {
    if (!selectedPrime) return
    try {
      await updatePrime(selectedPrime.id, { status: nextStatus })
      setSelectedPrime({ ...selectedPrime, status: nextStatus })
    } catch (e) {
      alert("Erreur lors de la mise à jour du statut")
    }
  }
  
  return (
    <PermissionGate moduleId="primes" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />

        <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Coins className="w-6 h-6 text-primary" />
                Historique des Primes
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                 {user.isManagerOrAdmin ? "Gestion et historique des primes." : "Consultez vos anciennes primes."}
              </p>
            </div>
            
            {/* Bouton Export CSV - Visible pour managers/admins */}
            {primes.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl gap-2"
                onClick={handleExportCSV}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
          </div>


          {isManager && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("pending")}
                className={cn(
                  "px-3 py-2 rounded-xl text-sm font-semibold border transition-all",
                  tab === "pending"
                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/25 shadow-sm"
                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50",
                )}
              >
                En attente
                {pendingPrimes.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-black bg-amber-500 text-white">
                    {pendingPrimes.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setTab("history")}
                className={cn(
                  "px-3 py-2 rounded-xl text-sm font-semibold border transition-all",
                  tab === "history"
                    ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50",
                )}
              >
                Historique
                <span className="ml-2 text-xs font-bold text-muted-foreground">{settledPrimes.length}</span>
              </button>
            </div>
          )}

          <section className="space-y-3">
             {loading ? (
                <p className="text-center text-muted-foreground py-10">Chargement...</p>
             ) : primes.length === 0 ? (
                <div className="text-center py-10 bg-muted/30 rounded-xl">
                   <p className="text-muted-foreground">Aucune prime dans l'historique.</p>
                </div>
             ) : (
              <div className="space-y-3">
                {displayedPrimes.map((p) => {
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
                          <option value="pending">En attente</option>
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

                    {/* ✅ BOUTON PDF AJOUTÉ ICI */}
                    <Button className="w-full rounded-xl py-6 shadow-md" onClick={handleExportPDF}>
                        <FileText className="w-5 h-5 mr-2" /> 
                        Télécharger le récapitulatif PDF
                    </Button>

                    {/* Actions Admin */}
                    {user.isManagerOrAdmin && (
                      <div className="border-t pt-4 mt-4 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validation</p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setPrimeStatus("pending")}
                            disabled={selectedPrime.status === "pending"}
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            Mettre en attente
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setPrimeStatus("validated")}
                            disabled={selectedPrime.status === "validated" || selectedPrime.status === "paid"}
                          >
                            <BadgeCheck className="w-4 h-4 mr-2" />
                            Valider
                          </Button>

                          <Button
                            className="rounded-xl"
                            onClick={() => setPrimeStatus("paid")}
                            disabled={selectedPrime.status === "paid"}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Marquer payée
                          </Button>
                        </div>

                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">Administration</p>
                        <div className="flex gap-3">
                          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => handleEditClick(selectedPrime)}>
                            <Pencil className="w-4 h-4 mr-2" /> Modifier
                          </Button>
                          <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleDelete}>
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
