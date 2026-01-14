"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import {
  Truck,
  Plus,
  X,
  Edit3,
  Trash2,
  Check,
  Search,
  ArrowLeft,
  GripVertical,
  User,
  Calendar,
  Clock,
  Package,
  PhoneIcon,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"

interface Fournisseur {
  id: string
  name: string
  commercial?: string
  phone: string
  deliveryDays: string[]
  delaiCommande: string // ex: "1 j" = commander 1 jour avant
  orderBefore?: string // ex: "12h00" = commander avant 12h
  franco?: string
  minOrder?: string // montant minimum de commande
  deliveryTime?: string // ex: "Avant 10h", "Après-midi"
  isDefault: boolean
}

const daysOfWeek = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

const defaultFournisseurs: Fournisseur[] = [
  {
    id: "f1",
    name: "FOODEX",
    phone: "01.45.10.24.00",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
    delaiCommande: "1 j",
    orderBefore: "12h00",
    minOrder: "100€",
    deliveryTime: "Avant 10h",
    isDefault: true,
  },
  {
    id: "f2",
    name: "METRO",
    phone: "01.64.19.17.17",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
    delaiCommande: "1 j",
    orderBefore: "14h00",
    minOrder: "150€",
    deliveryTime: "Matin",
    isDefault: true,
  },
  {
    id: "f3",
    name: "ABORDAJ",
    phone: "01.84.80.14.29",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
    delaiCommande: "2 j",
    orderBefore: "16h00",
    deliveryTime: "Après-midi",
    isDefault: true,
  },
  {
    id: "f4",
    name: "Sysco",
    phone: "01.69.11.67.47",
    deliveryDays: ["Lun", "Mer", "Ven"],
    delaiCommande: "1 j",
    orderBefore: "11h00",
    minOrder: "120€",
    isDefault: true,
  },
  {
    id: "f5",
    name: "TERRE AZUR",
    commercial: "Gregory",
    phone: "01.78.68.64.23",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
    delaiCommande: "1 j",
    orderBefore: "15h00",
    franco: "200€",
    deliveryTime: "Matin",
    isDefault: true,
  },
  {
    id: "f6",
    name: "PLG",
    commercial: "Sarah",
    phone: "01.34.82.77.82",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
    delaiCommande: "5 j",
    orderBefore: "10h00",
    isDefault: true,
  },
  {
    id: "f7",
    name: "Vivalya Fruits & Légumes",
    commercial: "Malik",
    phone: "06.59.64.79.46",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
    delaiCommande: "1 j",
    orderBefore: "13h00",
    minOrder: "80€",
    deliveryTime: "Avant 8h",
    isDefault: true,
  },
  {
    id: "f8",
    name: "Vivalya Marée",
    commercial: "Aurelie",
    phone: "01.75.66.26.00",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
    delaiCommande: "1 j",
    orderBefore: "11h00",
    deliveryTime: "Très tôt",
    isDefault: true,
  },
]

export default function FournisseursPage() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>(defaultFournisseurs)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Fournisseur | null>(null)

  const filteredFournisseurs = fournisseurs.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.commercial && f.commercial.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const handleDelete = (id: string) => {
    setFournisseurs(fournisseurs.filter((f) => f.id !== id))
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        {/* Back link */}
        <Link
          href="/gestion-fournisseurs"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Gestion & Fournisseurs</span>
        </Link>

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fournisseurs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Contacts, livraisons et conditions de commande</p>
          </div>
          <Button size="sm" className="rounded-xl gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un fournisseur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Info card */}
        <div className="pulse-card p-5 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 border-primary/20">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">Guide de lecture des cartes fournisseurs</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Chaque fournisseur affiche les informations clés pour faciliter vos commandes
              </p>
            </div>
          </div>

          {/* Legend badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-amber-700">Délai + Heure limite</div>
                <div className="text-amber-600">Commander X jours avant Xh</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Package className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-blue-700">Minimum de commande</div>
                <div className="text-blue-600">Montant minimal requis</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-emerald-700">Horaire de livraison</div>
                <div className="text-emerald-600">Créneau de réception</div>
              </div>
            </div>
          </div>
        </div>

        {/* Fournisseurs List */}
        <section className="space-y-4">
          {filteredFournisseurs.map((fournisseur) => (
            <div key={fournisseur.id} className="pulse-card overflow-hidden hover:shadow-lg transition-shadow">
              {/* Header avec nom et actions */}
              <div className="p-5 pb-4">
                <div className="flex items-start gap-4">
                  {/* Drag handle */}
                  <div className="mt-1 cursor-grab text-muted-foreground hover:text-foreground">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Nom et contact */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-xl text-foreground mb-2">{fournisseur.name}</h3>

                        {/* Contact info dans un badge */}
                        <div className="flex flex-wrap gap-2">
                          {fournisseur.commercial && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                              <User className="w-3.5 h-3.5 text-purple-600" />
                              <span className="text-xs font-medium text-purple-700">{fournisseur.commercial}</span>
                            </div>
                          )}
                          <a
                            href={`tel:${fournisseur.phone.replace(/\./g, "")}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
                          >
                            <PhoneIcon className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-medium text-primary">{fournisseur.phone}</span>
                          </a>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => setEditing(fournisseur)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => handleDelete(fournisseur.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Badges d'informations importantes en grand */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      {/* Délai de commande - Badge principal */}
                      <div className="flex flex-col gap-1 p-3 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-600/10 border border-amber-500/30">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-amber-600" />
                          </div>
                          <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">
                            Délai & Heure
                          </span>
                        </div>
                        <div>
                          <div className="text-base font-bold text-amber-700">
                            Commander {fournisseur.delaiCommande} avant
                          </div>
                          {fournisseur.orderBefore && (
                            <div className="text-sm font-semibold text-amber-600">Avant {fournisseur.orderBefore}</div>
                          )}
                        </div>
                      </div>

                      {/* Minimum de commande */}
                      {(fournisseur.minOrder || fournisseur.franco) && (
                        <div className="flex flex-col gap-1 p-3 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/10 border border-blue-500/30">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                              <Package className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">
                              Minimum
                            </span>
                          </div>
                          <div className="text-lg font-bold text-blue-700">
                            {fournisseur.minOrder || fournisseur.franco}
                          </div>
                        </div>
                      )}

                      {/* Heure de livraison */}
                      {fournisseur.deliveryTime && (
                        <div className="flex flex-col gap-1 p-3 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/10 border border-emerald-500/30">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                              <Truck className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">
                              Livraison
                            </span>
                          </div>
                          <div className="text-lg font-bold text-emerald-700">{fournisseur.deliveryTime}</div>
                        </div>
                      )}
                    </div>

                    {/* Jours de livraison - Version plus compacte et visuelle */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Jours de livraison disponibles
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {daysOfWeek.map((day) => {
                          const isActive = fournisseur.deliveryDays.includes(day)
                          return (
                            <div
                              key={day}
                              className={cn(
                                "flex-1 text-center py-2.5 rounded-xl font-bold text-xs transition-all",
                                isActive
                                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md scale-105"
                                  : "bg-muted/60 text-muted-foreground/60",
                              )}
                            >
                              {day}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredFournisseurs.length === 0 && (
            <div className="pulse-card p-12 text-center">
              <Truck className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Aucun fournisseur trouvé</p>
            </div>
          )}
        </section>
      </main>

      {/* Add Drawer */}
      {showAdd && (
        <FournisseurDrawer
          onClose={() => setShowAdd(false)}
          onSave={(fournisseur) => {
            setFournisseurs([...fournisseurs, { ...fournisseur, id: `f${Date.now()}`, isDefault: false }])
            setShowAdd(false)
          }}
        />
      )}

      {/* Edit Drawer */}
      {editing && (
        <FournisseurDrawer
          fournisseur={editing}
          onClose={() => setEditing(null)}
          onSave={(updated) => {
            setFournisseurs(fournisseurs.map((f) => (f.id === updated.id ? updated : f)))
            setEditing(null)
          }}
        />
      )}

      <BottomNav />
    </div>
  )
}

function FournisseurDrawer({
  fournisseur,
  onClose,
  onSave,
}: {
  fournisseur?: Fournisseur
  onClose: () => void
  onSave: (fournisseur: Fournisseur) => void
}) {
  const [name, setName] = useState(fournisseur?.name || "")
  const [commercial, setCommercial] = useState(fournisseur?.commercial || "")
  const [phone, setPhone] = useState(fournisseur?.phone || "")
  const [deliveryDays, setDeliveryDays] = useState<string[]>(fournisseur?.deliveryDays || [])
  const [delaiCommande, setDelaiCommande] = useState(fournisseur?.delaiCommande || "1 j")
  const [orderBefore, setOrderBefore] = useState(fournisseur?.orderBefore || "")
  const [minOrder, setMinOrder] = useState(fournisseur?.minOrder || "")
  const [franco, setFranco] = useState(fournisseur?.franco || "")
  const [deliveryTime, setDeliveryTime] = useState(fournisseur?.deliveryTime || "")

  const toggleDay = (day: string) => {
    if (deliveryDays.includes(day)) {
      setDeliveryDays(deliveryDays.filter((d) => d !== day))
    } else {
      setDeliveryDays([...deliveryDays, day])
    }
  }

  const handleSave = () => {
    onSave({
      id: fournisseur?.id || "",
      name,
      commercial: commercial || undefined,
      phone,
      deliveryDays,
      delaiCommande,
      orderBefore: orderBefore || undefined,
      minOrder: minOrder || undefined,
      franco: franco || undefined,
      deliveryTime: deliveryTime || undefined,
      isDefault: fournisseur?.isDefault || false,
    })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">{fournisseur ? "Modifier" : "Ajouter"} un fournisseur</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6 pb-8">
          {/* Section : Informations générales */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary flex items-center gap-2">
              <User className="w-4 h-4" />
              Informations générales
            </h3>

            <div>
              <label className="text-sm font-medium">Nom du fournisseur *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Ex: METRO"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Commercial</label>
                <Input
                  value={commercial}
                  onChange={(e) => setCommercial(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder="Ex: Sarah"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Téléphone *</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder="01.00.00.00.00"
                />
              </div>
            </div>
          </div>

          {/* Section : Livraison */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-emerald-600 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Conditions de livraison
            </h3>

            <div>
              <label className="text-sm font-medium mb-2 block">Jours de livraison</label>
              <div className="flex gap-2 flex-wrap">
                {daysOfWeek.map((day) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "flex-1 min-w-[45px] py-2.5 rounded-xl text-xs font-semibold transition-all",
                      deliveryDays.includes(day)
                        ? "bg-emerald-500 text-white shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Heure de livraison</label>
              <Input
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Ex: Avant 10h, Matin, Après-midi"
              />
              <p className="text-xs text-muted-foreground mt-1">À quel moment de la journée ?</p>
            </div>
          </div>

          {/* Section : Conditions de commande */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-amber-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Conditions de commande
            </h3>

            <div>
              <label className="text-sm font-medium mb-2 block">Délai de commande</label>
              <div className="flex gap-2">
                {["1 j", "2 j", "3 j", "5 j", "7 j"].map((delai) => (
                  <button
                    key={delai}
                    onClick={() => setDelaiCommande(delai)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all",
                      delaiCommande === delai
                        ? "bg-amber-500 text-white shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    {delai}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Commander X jour(s) avant la livraison</p>
            </div>

            <div>
              <label className="text-sm font-medium">Commander avant (heure limite)</label>
              <Input
                value={orderBefore}
                onChange={(e) => setOrderBefore(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Ex: 12h00, 14h30"
              />
              <p className="text-xs text-muted-foreground mt-1">Heure limite pour passer commande</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Minimum de commande</label>
                <Input
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder="Ex: 100€"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Franco (port offert)</label>
                <Input
                  value={franco}
                  onChange={(e) => setFranco(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder="Ex: 200€"
                />
              </div>
            </div>
          </div>

          <Button className="w-full rounded-xl py-6 text-base" onClick={handleSave} disabled={!name || !phone}>
            <Check className="w-5 h-5 mr-2" />
            {fournisseur ? "Sauvegarder les modifications" : "Ajouter le fournisseur"}
          </Button>
        </div>
      </div>
    </>
  )
}
