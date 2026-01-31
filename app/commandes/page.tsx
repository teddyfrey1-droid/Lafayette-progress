"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth/auth-provider"
import Link from "next/link"
import {
  Calendar,
  FileText,
  Loader2,
  Mail,
  Package,
  Plus,
  Send,
  Settings,
  Truck,
} from "lucide-react"
import {
  addOrder,
  getOrders,
  getOrdersStoreEventName,
  getSuppliers,
  hydrateOrdersStore,
  markOrderAsSent,
  Order,
  OrderProduct,
  OrderSupplier,
} from "@/lib/demo/orders-store"

function formatEuro(n: number) {
  const v = Number(n || 0)
  return `${v.toFixed(2).replace(".", ",")} €`
}

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function normalizeEmails(raw: string) {
  return (raw || "")
    .split(/[;,\n\t ]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function CommandesPage() {
  const { profile, isDemo, user, company } = useAuth()
  const { toast } = useToast()

  const companyId: string | undefined = isDemo
    ? "demo-company"
    : ((profile as any)?.companyId as string | undefined)

  const companyName = (company?.name || (profile as any)?.companyName || "") as string

  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<OrderSupplier[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null)

  // New order sheet
  const [openNewOrder, setOpenNewOrder] = useState(false)
  const [supplierId, setSupplierId] = useState<string>("")
  const [deliveryDate, setDeliveryDate] = useState<string>(todayISO())
  const [notes, setNotes] = useState<string>("")
  const [ccText, setCcText] = useState<string>("")
  const [productSearch, setProductSearch] = useState<string>("")
  const [orderLines, setOrderLines] = useState<OrderProduct[]>([])

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) || null,
    [suppliers, supplierId],
  )

  const filteredLines = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return orderLines
    return orderLines.filter((p) =>
      `${p.productName} ${p.reference || ""}`.toLowerCase().includes(q),
    )
  }, [orderLines, productSearch])

  const totalAmount = useMemo(() => {
    return orderLines.reduce((sum, p) => sum + (Number(p.total) || 0), 0)
  }, [orderLines])

  // Load & hydrate
  useEffect(() => {
    if (!companyId) return
    let cancelled = false

    setLoading(true)
    hydrateOrdersStore(companyId)
      .then(() => {
        if (cancelled) return
        setSuppliers(getSuppliers(companyId))
        setOrders(getOrders(companyId))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId])

  // Sync (same tab + multi-tabs)
  useEffect(() => {
    if (!companyId) return

    const cid = companyId
    const onAnyChange = (e?: any) => {
      const eventCompanyId = e?.detail?.companyId as string | undefined
      if (eventCompanyId && eventCompanyId !== cid) return
      setSuppliers(getSuppliers(cid))
      setOrders(getOrders(cid))
    }

    const evtName = getOrdersStoreEventName()
    window.addEventListener(evtName, onAnyChange as any)
    window.addEventListener("storage", onAnyChange as any)
    return () => {
      window.removeEventListener(evtName, onAnyChange as any)
      window.removeEventListener("storage", onAnyChange as any)
    }
  }, [companyId])

  // When supplier changes, (re)build order lines from supplier products
  useEffect(() => {
    if (!selectedSupplier) {
      setOrderLines([])
      setCcText("")
      return
    }

    const products = selectedSupplier.products || []
    setOrderLines(
      products.map((p) => ({
        id: `ol_${p.id}`,
        productId: p.id,
        productName: p.name,
        reference: p.reference || undefined,
        quantity: 0,
        unitPrice: Number(p.unitPrice || 0),
        unit: p.unit || "u",
        total: 0,
      })),
    )

    setCcText((selectedSupplier.ccEmails || []).join(", "))
  }, [selectedSupplier])

  const updateQty = (lineId: string, qtyRaw: string) => {
    const qty = Number(qtyRaw || 0)
    setOrderLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l
        const q = Number.isFinite(qty) ? Math.max(0, qty) : 0
        const total = q * (Number(l.unitPrice) || 0)
        return { ...l, quantity: q, total }
      }),
    )
  }

  const handleSend = async () => {
    if (!companyId) return
    if (!selectedSupplier) {
      toast({ title: "Erreur", description: "Sélectionne un fournisseur.", variant: "destructive" })
      return
    }

    if (!selectedSupplier.email || !selectedSupplier.email.trim()) {
      toast({
        title: "Email fournisseur manquant",
        description: "Renseigne l'email du fournisseur dans la page Fournisseurs.",
        variant: "destructive",
      })
      return
    }

    const lines = orderLines.filter((l) => Number(l.quantity) > 0)
    if (lines.length === 0) {
      toast({ title: "Erreur", description: "Ajoute au moins un produit (quantité > 0).", variant: "destructive" })
      return
    }

    if (!deliveryDate) {
      toast({ title: "Erreur", description: "Choisis une date de livraison.", variant: "destructive" })
      return
    }

    const ccEmails = normalizeEmails(ccText)

    try {
      // 1) Create order (draft)
      const newOrder = await addOrder(companyId, {
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        supplierEmail: selectedSupplier.email,
        ccEmails: ccEmails.length ? ccEmails : undefined,
        products: lines,
        totalAmount: lines.reduce((s, p) => s + (Number(p.total) || 0), 0),
        deliveryDate,
        status: "draft",
        notes: notes || undefined,
      })

      setOrders((prev) => [newOrder, ...prev])

      // 2) Send email with PDF attachment
      const orderNumber = newOrder.id.slice(-6).toUpperCase()
      const token = await user?.getIdToken().catch(() => undefined)

      const subject = `Bon de commande ${orderNumber} — ${companyName || "Entreprise"}`

      const res = await fetch("/api/commandes/send-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          toEmail: selectedSupplier.email,
          toName: selectedSupplier.name,
          subject,
          companyName: companyName || "Entreprise",
          ccEmails,
          order: {
            ...newOrder,
            orderNumber,
          },
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Échec envoi email")
      }

      // 3) Mark as sent
      await markOrderAsSent(companyId, newOrder.id)
      setOrders(getOrders(companyId))

      toast({
        title: "✅ Commande envoyée",
        description: `Bon de commande PDF envoyé à ${selectedSupplier.name}.`,
      })

      // Reset sheet
      setOpenNewOrder(false)
      setSupplierId("")
      setNotes("")
      setCcText("")
      setProductSearch("")
      setOrderLines([])
      setDeliveryDate(todayISO())
    } catch (e: any) {
      console.error(e)
      toast({
        title: "Erreur",
        description: e?.message || "Impossible d'envoyer la commande.",
        variant: "destructive",
      })
    }
  }


  const handleResend = async (o: Order) => {
    if (!companyId) return

    const supplier = suppliers.find((s) => s.id === o.supplierId) || null
    const toEmail = String(o.supplierEmail || supplier?.email || "").trim()
    const toName = String(o.supplierName || supplier?.name || "Fournisseur").trim() || "Fournisseur"

    if (!toEmail) {
      toast({
        title: "Email fournisseur manquant",
        description: "Renseigne l'email du fournisseur dans la page Fournisseurs.",
        variant: "destructive",
      })
      return
    }

    const ccEmails = (o.ccEmails && o.ccEmails.length ? o.ccEmails : (supplier?.ccEmails || []))

    setSendingOrderId(o.id)
    try {
      const token = await user?.getIdToken().catch(() => undefined)
      const orderNumber = o.id.slice(-6).toUpperCase()
      const subject = `Bon de commande ${orderNumber} — ${companyName || "Entreprise"}`

      const res = await fetch("/api/commandes/send-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          toEmail,
          toName,
          subject,
          companyName: companyName || "Entreprise",
          ccEmails,
          order: {
            ...o,
            supplierName: toName,
            supplierEmail: toEmail,
            orderNumber,
          },
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Échec envoi email")
      }

      await markOrderAsSent(companyId, o.id)
      setOrders(getOrders(companyId))

      toast({
        title: "✅ Bon renvoyé",
        description: `Bon de commande PDF envoyé à ${toName}.`,
      })
    } catch (e: any) {
      console.error(e)
      toast({
        title: "Erreur",
        description: e?.message || "Impossible d'envoyer la commande.",
        variant: "destructive",
      })
    } finally {
      setSendingOrderId(null)
    }
  }

  return (
    <PermissionGate page="commandes">
      <div className="min-h-screen bg-background pb-24">
        <Header />

        <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {/* Hero */}
          <div className="pulse-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Truck className="w-6 h-6 text-primary" />
                  Passer une commande
                </h1>
                <p className="text-sm text-muted-foreground">
                  Sélectionne un fournisseur, ajuste les quantités, puis envoie un bon de commande en PDF par email.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/fournisseurs" className="hidden sm:inline-flex">
                  <Button variant="outline" className="rounded-xl gap-2">
                    <Settings className="w-4 h-4" />
                    Gérer les fournisseurs
                  </Button>
                </Link>

                <Button onClick={() => setOpenNewOrder(true)} className="rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  Nouvelle commande
                </Button>
              </div>
            </div>

            {!loading && suppliers.length === 0 && (
              <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <Mail className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Aucun fournisseur configuré</p>
                  <p className="text-sm text-amber-700/90 dark:text-amber-200/80">
                    Ajoute au moins un fournisseur et ses produits dans la page Fournisseurs.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Orders list */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Historique
              </h2>
              <p className="text-sm text-muted-foreground">{orders.length} commande(s)</p>
            </div>

            {loading ? (
              <div className="pulse-card p-6 text-sm text-muted-foreground">Chargement…</div>
            ) : orders.length === 0 ? (
              <div className="pulse-card p-8 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aucune commande pour le moment.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {orders
                  .slice()
                  .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
                  .map((o) => {
                    const num = o.id.slice(-6).toUpperCase()
                    const status = o.status === "sent" ? "Envoyée" : "Brouillon"
                    return (
                      <div key={o.id} className="pulse-card p-5 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{o.supplierName}</span>
                            <span className="text-xs px-2 py-1 rounded-lg bg-muted">#{num}</span>
                            <span className={"text-xs px-2 py-1 rounded-lg " + (o.status === "sent" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "bg-amber-500/10 text-amber-700 dark:text-amber-200")}>{status}</span>
                          </div>
                          <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Livraison : {o.deliveryDate || "—"}
                            </span>
                            <span>•</span>
                            <span>Total : {formatEuro(o.totalAmount || 0)}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <Button
                            size="sm"
                            className="rounded-xl gap-2"
                            variant={o.status === "sent" ? "outline" : "default"}
                            onClick={() => handleResend(o)}
                            disabled={sendingOrderId === o.id}
                          >
                            {sendingOrderId === o.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Envoi…
                              </>
                            ) : (
                              <>
                                <Mail className="w-4 h-4" />
                                {o.status === "sent" ? "Renvoyer" : "Envoyer"}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </section>
        </main>

        {/* New order sheet */}
        <Sheet open={openNewOrder} onOpenChange={setOpenNewOrder}>
          <SheetContent side="right" className="w-full sm:max-w-xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                Envoyer une commande
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label>Fournisseur</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un fournisseur" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" />
                  Les produits / emails se configurent dans <Link href="/fournisseurs" className="underline">Fournisseurs</Link>.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de livraison</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Emails en copie (CC)</Label>
                  <Input
                    placeholder="compta@..., achats@..."
                    value={ccText}
                    onChange={(e) => setCcText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Virgule ou point-virgule.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optionnel)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Merci de livrer avant 10h…"
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Produits</Label>
                  <span className="text-sm font-semibold">{formatEuro(totalAmount)}</span>
                </div>
                <Input
                  placeholder="Rechercher un produit…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />

                {!selectedSupplier ? (
                  <div className="p-4 rounded-xl bg-muted text-sm text-muted-foreground">
                    Sélectionne un fournisseur pour voir ses produits.
                  </div>
                ) : (selectedSupplier.products?.length || 0) === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
                    Aucun produit configuré pour ce fournisseur. Ajoute des produits dans la page Fournisseurs.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[42vh] overflow-auto pr-1">
                    {filteredLines.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-card">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.productName}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="truncate">{p.reference || "—"}</span>
                            <span>•</span>
                            <span>{formatEuro(p.unitPrice)}/{p.unit}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={p.quantity}
                            onChange={(e) => updateQty(p.id, e.target.value)}
                            className="w-24"
                          />
                          <div className="text-sm w-24 text-right tabular-nums">{formatEuro(p.total)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleSend} className="w-full rounded-xl gap-2" disabled={!companyId}>
                <Send className="w-4 h-4" />
                Envoyer le bon de commande (PDF)
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <BottomNav />
      </div>
    </PermissionGate>
  )
}
