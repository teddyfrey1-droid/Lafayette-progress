"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type React from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
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
  BadgeCheck,
  CheckCircle2,
  Save,
  X,
} from "lucide-react"
import {
  addOrder,
  getOrders,
  getOrdersStoreEventName,
  getSuppliers,
  hydrateOrdersStore,
  markOrderAsSent,
  markOrderAsDelivered,
  saveOrderReceipt,
  updateOrder,
  Order,
  OrderProduct,
  OrderSupplier,
} from "@/lib/demo/orders-store"

import {
  defaultCompanyEmailSettings,
  loadCompanyEmailSettings,
  saveCompanyEmailSettings,
  resolveRecipients,
  type CompanyEmailSettings,
  type EmailMode,
} from "@/lib/email-settings"

import { cn } from "@/lib/utils"

function formatEuro(n: number) {
  const v = Number(n || 0)
  return `${v.toFixed(2).replace(".", ",")} €`
}

function normalizeUnit(u: string) {
  return (u || "").toString().trim().toUpperCase()
}

function unitStep(unitRaw: string) {
  const u = normalizeUnit(unitRaw)
  if (u === "KG") return 0.1
  if (u === "G" || u === "GR" || u === "GRS") return 10
  if (u === "L") return 0.1
  if (u === "ML" || u === "CL") return 10
  return 1
}

function convertPackToProductUnit(packQty: number | undefined, packUnitRaw: string | undefined, productUnitRaw: string) {
  const packUnit = normalizeUnit(packUnitRaw || "")
  const productUnit = normalizeUnit(productUnitRaw)
  if (!packQty || !packUnit) return undefined

  // Mass
  if (productUnit === "KG" && (packUnit === "KG" || packUnit === "KGS")) return packQty
  if (productUnit === "KG" && (packUnit === "G" || packUnit === "GR" || packUnit === "GRS")) return packQty / 1000
  if ((productUnit === "G" || productUnit === "GR" || productUnit === "GRS") && (packUnit === "KG" || packUnit === "KGS")) return packQty * 1000
  if ((productUnit === "G" || productUnit === "GR" || productUnit === "GRS") && (packUnit === "G" || packUnit === "GR" || packUnit === "GRS")) return packQty

  // Volume
  if (productUnit === "L" && packUnit === "L") return packQty
  if (productUnit === "L" && packUnit === "ML") return packQty / 1000
  if (productUnit === "L" && packUnit === "CL") return packQty / 100
  if (productUnit === "ML" && packUnit === "L") return packQty * 1000
  if (productUnit === "ML" && packUnit === "ML") return packQty
  if (productUnit === "CL" && packUnit === "L") return packQty * 100
  if (productUnit === "CL" && packUnit === "CL") return packQty

  // Pieces-like
  if (productUnit === packUnit) return packQty

  return undefined
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

function getFrancoThresholdEuros(supplier: OrderSupplier | null): number | null {
  if (!supplier) return null
  const v = Number((supplier as any).francoThreshold)
  if (Number.isFinite(v) && v > 0) return v
  const raw = (supplier.franco || "").toString()
  const m = raw.replace(/\s/g, "").match(/([0-9]+(?:[\.,][0-9]+)?)/)
  if (!m) return null
  const n = Number(String(m[1]).replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

function ProductCard({
  line,
  step,
  packAdd,
  onIncrement,
  onDecrement,
  onSetQty,
  onAddPack,
}: {
  line: OrderProduct
  step: number
  packAdd: number | undefined
  onIncrement: (fromEl: HTMLElement | null) => void
  onDecrement: () => void
  onSetQty: (qtyRaw: string) => void
  onAddPack: (fromEl: HTMLElement | null) => void
}) {
  const startX = useRef<number | null>(null)
  const [dx, setDx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const qty = Number(line.quantity || 0)
  const lineTotal = Number(line.total || 0)
  const packLabel = (line.packLabel || "").toString().trim()

  const resetDrag = () => {
    setDx(0)
    setIsDragging(false)
    startX.current = null
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX
    setIsDragging(true)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || startX.current === null) return
    const next = e.clientX - startX.current
    const clamped = Math.max(-90, Math.min(90, next))
    setDx(clamped)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return
    const finalDx = dx
    const target = e.currentTarget as HTMLElement
    resetDrag()
    if (finalDx > 60) {
      onIncrement(target)
    } else if (finalDx < -60) {
      onDecrement()
    }
  }

  return (
    <div
      className={cn(
        "relative p-4",
        "touch-pan-y select-none",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={resetDrag}
      style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: isDragging ? "none" : "transform 220ms" }}
    >
      {/* Swipe affordances */}
      <div className={cn(
        "absolute inset-y-0 left-0 w-20 flex items-center justify-center",
        "bg-emerald-500/10",
        dx > 8 ? "opacity-100" : "opacity-0",
        "transition-opacity",
      )}
        aria-hidden>
        <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">+1</div>
      </div>
      <div className={cn(
        "absolute inset-y-0 right-0 w-20 flex items-center justify-center",
        "bg-rose-500/10",
        dx < -8 ? "opacity-100" : "opacity-0",
        "transition-opacity",
      )}
        aria-hidden>
        <div className="text-xs font-semibold text-rose-700 dark:text-rose-200">-1</div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium leading-tight">{line.productName}</div>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
            <span className="truncate">{line.reference || "—"}</span>
            <span>•</span>
            <span>{formatEuro(line.unitPrice)}/{line.unit}</span>
            {packLabel ? (
              <>
                <span>•</span>
                <span>Colisage: {packLabel}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {packAdd !== undefined && packAdd > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={(e) => onAddPack(e.currentTarget as any)}
              >
                + colis
              </Button>
            )}

            {/* Stepper */}
            <div className="flex items-center rounded-xl border border-border overflow-hidden bg-background">
              <button
                type="button"
                className={cn(
                  "px-3 py-2 text-sm font-semibold",
                  "active:scale-95 transition-transform",
                  qty <= 0 ? "text-muted-foreground" : "text-foreground",
                )}
                onClick={onDecrement}
                aria-label="Retirer"
              >
                −
              </button>
              <Input
                type="number"
                min={0}
                step={step}
                value={line.quantity}
                onChange={(e) => onSetQty(e.target.value)}
                className="w-20 border-0 rounded-none text-center tabular-nums"
              />
              <button
                type="button"
                className={cn(
                  "px-3 py-2 text-sm font-semibold text-primary",
                  "active:scale-95 transition-transform",
                )}
                onClick={(e) => onIncrement(e.currentTarget as any)}
                aria-label="Ajouter"
              >
                +
              </button>
            </div>
          </div>

          <div className="text-sm w-24 text-right tabular-nums font-semibold">{formatEuro(lineTotal)}</div>
        </div>
      </div>
    </div>
  )
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
  const [ccList, setCcList] = useState<string[]>([])
  const [ccInput, setCcInput] = useState<string>("")
  const [openEmailSettings, setOpenEmailSettings] = useState(false)
  const [emailSettings, setEmailSettings] = useState<CompanyEmailSettings>(defaultCompanyEmailSettings())
  const [savingEmailSettings, setSavingEmailSettings] = useState(false)
  const [emailSettingsDraft, setEmailSettingsDraft] = useState<CompanyEmailSettings>(defaultCompanyEmailSettings())
  const [productSearch, setProductSearch] = useState<string>("")
  const [orderLines, setOrderLines] = useState<OrderProduct[]>([])

  // Cart summary (mobile rail)
  const [openCartSummary, setOpenCartSummary] = useState(false)

  // UI micro-interactions
  const cartTargetRef = useRef<HTMLDivElement | null>(null)
  const [cartBump, setCartBump] = useState(false)
  const francoCardRef = useRef<HTMLDivElement | null>(null)
  const francoCelebratedRef = useRef(false)

  // Order details / réception
  const [openOrderDetails, setOpenOrderDetails] = useState(false)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [detailsMode, setDetailsMode] = useState<"view" | "receive">("view")
  const [receiptLines, setReceiptLines] = useState<OrderProduct[]>([])

  useEffect(() => {
    if (!companyId) return
    let mounted = true
    loadCompanyEmailSettings(companyId)
      .then((s) => {
        if (mounted) setEmailSettings(s)
      })
      .catch(() => {
        // ignore
      })
    return () => {
      mounted = false
    }
  }, [companyId])

  useEffect(() => {
    if (!openEmailSettings) return
    setEmailSettingsDraft(emailSettings)
  }, [openEmailSettings, emailSettings])


  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) || null,
    [suppliers, supplierId],
  )

  const totalAmount = useMemo(() => {
    return orderLines.reduce((sum, p) => sum + (Number(p.total) || 0), 0)
  }, [orderLines])

  const francoThreshold = useMemo(() => getFrancoThresholdEuros(selectedSupplier), [selectedSupplier])
  const francoProgress = useMemo(() => {
    if (!francoThreshold || francoThreshold <= 0) return null
    const pct = Math.min(100, Math.round((totalAmount / francoThreshold) * 100))
    const remaining = Math.max(0, francoThreshold - totalAmount)
    return { pct, remaining }
  }, [francoThreshold, totalAmount])

  const triggerFrancoCelebration = () => {
    if (typeof window === "undefined") return
    const host = francoCardRef.current
    if (!host) return
    try {
      // light haptic on supported devices
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        ;(navigator as any).vibrate?.(25)
      }

      const rect = host.getBoundingClientRect()
      const count = 14
      for (let i = 0; i < count; i++) {
        const p = document.createElement("div")
        p.style.position = "fixed"
        p.style.left = `${rect.left + rect.width * (0.2 + Math.random() * 0.6)}px`
        p.style.top = `${rect.top + rect.height * 0.2}px`
        p.style.width = "6px"
        p.style.height = "10px"
        p.style.borderRadius = "2px"
        p.style.background = i % 3 === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"
        p.style.zIndex = "9999"
        p.style.pointerEvents = "none"
        const dx = (Math.random() - 0.5) * 220
        const dy = 220 + Math.random() * 220
        const rot = (Math.random() - 0.5) * 240
        p.animate(
          [
            { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg)`, opacity: 0 },
          ],
          {
            duration: 650 + Math.random() * 250,
            easing: "cubic-bezier(.2,.9,.2,1)",
            fill: "forwards",
          },
        )
        document.body.appendChild(p)
        window.setTimeout(() => p.remove(), 1100)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!francoProgress) {
      francoCelebratedRef.current = false
      return
    }
    if (francoProgress.remaining <= 0 && !francoCelebratedRef.current) {
      francoCelebratedRef.current = true
      triggerFrancoCelebration()
    }
    if (francoProgress.remaining > 0) {
      francoCelebratedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [francoProgress?.remaining])

  const filteredLines = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return orderLines
    return orderLines.filter((p) =>
      `${p.productName} ${p.reference || ""}`.toLowerCase().includes(q),
    )
  }, [orderLines, productSearch])


  const pendingReceptionOrders = useMemo(() => {
    return orders.filter((o) => o.status === "sent" || o.status === "confirmed")
  }, [orders])

  const deliveredOrders = useMemo(() => {
    return orders.filter((o) => o.status === "delivered")
  }, [orders])

  const draftOrders = useMemo(() => {
    return orders.filter((o) => o.status === "draft")
  }, [orders])

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
      setCcList([])
      setCcInput("")
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
        category: (p as any).category,
        packLabel: (p as any).packLabel,
        packQuantity: (p as any).packQuantity,
        packUnit: (p as any).packUnit,
        total: 0,
      })),
    )

    setCcList((selectedSupplier.ccEmails || []).map((e: any) => String(e).toLowerCase()))
    setCcInput("")
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

  const flyToTotal = (fromEl: HTMLElement | null) => {
    if (typeof window === "undefined") return
    if (!fromEl || !cartTargetRef.current) return
    try {
      const from = fromEl.getBoundingClientRect()
      const to = cartTargetRef.current.getBoundingClientRect()
      const dot = document.createElement("div")
      dot.style.position = "fixed"
      dot.style.left = `${from.left + from.width / 2}px`
      dot.style.top = `${from.top + from.height / 2}px`
      dot.style.width = "30px"
      dot.style.height = "30px"
      dot.style.borderRadius = "9999px"
      dot.style.background = "hsl(var(--primary))"
      dot.style.boxShadow = "0 8px 20px rgba(0,0,0,.14)"
      dot.style.display = "flex"
      dot.style.alignItems = "center"
      dot.style.justifyContent = "center"
      dot.style.color = "white"
      dot.style.fontWeight = "700"
      dot.style.fontSize = "16px"
      dot.textContent = "+"
      dot.style.zIndex = "9999"
      dot.style.pointerEvents = "none"
      dot.style.transform = "translate(-50%, -50%) scale(1)"
      dot.style.transition = "transform 420ms cubic-bezier(.2,.9,.2,1), left 420ms cubic-bezier(.2,.9,.2,1), top 420ms cubic-bezier(.2,.9,.2,1), opacity 420ms"
      document.body.appendChild(dot)

      // Next frame -> animate
      requestAnimationFrame(() => {
        dot.style.left = `${to.left + to.width / 2}px`
        dot.style.top = `${to.top + to.height / 2}px`
        dot.style.transform = "translate(-50%, -50%) scale(0.6)"
        dot.style.opacity = "0.9"
      })

      window.setTimeout(() => {
        dot.style.opacity = "0"
      }, 320)

      window.setTimeout(() => {
        dot.remove()
        setCartBump(true)
        window.setTimeout(() => setCartBump(false), 260)
      }, 520)
    } catch {
      // ignore
    }
  }

  const changeQty = (lineId: string, delta: number, fromEl?: HTMLElement | null) => {
    if (!delta) return
    if (delta > 0) flyToTotal(fromEl || null)
    setOrderLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l
        const q = Math.max(0, Number(l.quantity || 0) + delta)
        const total = q * (Number(l.unitPrice) || 0)
        return { ...l, quantity: q, total }
      }),
    )
  }

  const isValidEmail = (email: string) => {
    // Simple check (enough for UI)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const addCcFromInput = () => {
    const parts = normalizeEmails(ccInput)
    if (!parts.length) return

    const next = [...ccList]
    for (const raw of parts) {
      const email = String(raw).toLowerCase()
      if (!isValidEmail(email)) {
        toast({
          title: "Email invalide",
          description: `"${raw}" n'est pas un email valide.`,
          variant: "destructive",
        })
        continue
      }
      if (!next.includes(email)) next.push(email)
    }

    setCcList(next)
    setCcInput("")
  }

  const saveEmailDefaults = async () => {
    if (!companyId) return
    try {
      setSavingEmailSettings(true)
      const saved = await saveCompanyEmailSettings(companyId, emailSettingsDraft)
      setEmailSettings(saved)
      setOpenEmailSettings(false)
      toast({ title: "✅ Réglages enregistrés", description: "Les emails par défaut seront utilisés automatiquement." })
    } catch (e: any) {
      console.error(e)
      toast({ title: "Erreur", description: e?.message || "Impossible d'enregistrer les réglages.", variant: "destructive" })
    } finally {
      setSavingEmailSettings(false)
    }
  }

  const removeCc = (email: string) => {
    setCcList((prev) => prev.filter((e) => e !== email))
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

    const manualCc = Array.from(new Set([...(ccList || []), ...normalizeEmails(ccInput)]))
    const { ccEmails, bccEmails, contactsCount } = resolveRecipients(emailSettings.order, manualCc)

    try {
      // 1) Create order (draft)
      const newOrder = await addOrder(companyId, {
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        supplierEmail: selectedSupplier.email,
        ccEmails: ccEmails.length ? ccEmails : undefined,
        // Store BCC used for audit (supplier won't see those)
        bccEmails: bccEmails.length ? bccEmails : undefined,
        products: lines,
        totalAmount: lines.reduce((s, p) => s + (Number(p.total) || 0), 0),
        deliveryDate,
        status: "draft",
        notes: notes || undefined,
      })

      setOrders((prev) => [newOrder, ...prev])

      // 2) Send email with PDF attachment
      const orderNumber = (newOrder.orderNumber || newOrder.id.slice(-6)).toUpperCase()
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
          bccEmails,
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
        description: `Bon de commande PDF envoyé à ${selectedSupplier.name}. ${contactsCount ? `Copie envoyée à vos ${contactsCount} contact(s) pré-enregistrés.` : ""}`.trim(),
      })

      // Reset sheet
      setOpenNewOrder(false)
      setSupplierId("")
      setNotes("")
      setCcList([])
      setCcInput("")
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

    const manualCc = (o.ccEmails && o.ccEmails.length ? o.ccEmails : (supplier?.ccEmails || [])) as string[]
    const { ccEmails, bccEmails, contactsCount } = resolveRecipients(emailSettings.order, manualCc)

    setSendingOrderId(o.id)
    try {
      const token = await user?.getIdToken().catch(() => undefined)
      const orderNumber = (o.orderNumber || o.id.slice(-6)).toUpperCase()
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
          bccEmails,
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
        description: `Bon de commande PDF envoyé à ${toName}. ${contactsCount ? `Copie envoyée à vos ${contactsCount} contact(s) pré-enregistrés.` : ""}`.trim(),
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


  const openDetails = (o: Order, mode: "view" | "receive") => {
    setActiveOrder(o)
    setDetailsMode(mode)
    // Init réception lignes
    const init = (o.products || []).map((p) => ({
      ...p,
      receivedQuantity: typeof (p as any).receivedQuantity === "number" ? (p as any).receivedQuantity : Number(p.quantity || 0),
      receivedOk: typeof (p as any).receivedOk === "boolean" ? (p as any).receivedOk : undefined,
      receivedNote: typeof (p as any).receivedNote === "string" ? (p as any).receivedNote : "",
    })) as OrderProduct[]
    setReceiptLines(init)
    setOpenOrderDetails(true)
  }

  const markAllOk = () => {
    setReceiptLines((prev) =>
      prev.map((l) => ({
        ...l,
        receivedOk: true,
        receivedQuantity: typeof l.receivedQuantity === "number" ? l.receivedQuantity : Number(l.quantity || 0),
      })),
    )
  }

  const setLineReceipt = (lineId: string, patch: Partial<OrderProduct>) => {
    setReceiptLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }

  const receiptProgress = useMemo(() => {
    const total = receiptLines.length || 0
    const done = receiptLines.filter((l) => typeof (l as any).receivedOk === "boolean").length
    return { total, done }
  }, [receiptLines])

  const saveReceipt = async () => {
    if (!companyId || !activeOrder) return
    try {
      await saveOrderReceipt(companyId, activeOrder.id, receiptLines)
      setOrders(getOrders(companyId))
      toast({ title: "✅ Réception enregistrée", description: "Tu peux finaliser plus tard si besoin." })
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || "Impossible d'enregistrer la réception.", variant: "destructive" })
    }
  }

  const finalizeReceipt = async () => {
    if (!companyId || !activeOrder) return

    // Validation: chaque ligne doit être OK ou Problème (+ note)
    const missingChoice = receiptLines.find((l) => typeof (l as any).receivedOk !== "boolean")
    if (missingChoice) {
      toast({
        title: "Il manque des validations",
        description: "Valide chaque produit (OK ou Problème) avant de finaliser la réception.",
        variant: "destructive",
      })
      return
    }

    const missingNote = receiptLines.find((l) => (l as any).receivedOk === false && !String((l as any).receivedNote || "").trim())
    if (missingNote) {
      toast({
        title: "Note manquante",
        description: "Ajoute une note pour chaque produit marqué en Problème.",
        variant: "destructive",
      })
      return
    }

    const hasProblems = receiptLines.some((l) => (l as any).receivedOk === false)

    try {
      await updateOrder(companyId, activeOrder.id, {
        products: receiptLines,
        status: "delivered",
        deliveredAt: new Date().toISOString(),
      } as any)

      setOrders(getOrders(companyId))
      toast({ title: "✅ Commande réceptionnée", description: "La commande est passée dans l'historique." })
      setOpenOrderDetails(false)

      // Envoi automatique d'un PDF après validation de réception
      if (hasProblems) {
        try {
          const supplier = suppliers.find((s) => s.id === activeOrder.supplierId)
          const toEmail = String(activeOrder.supplierEmail || supplier?.email || "").trim()
          const toName = String(activeOrder.supplierName || supplier?.name || "Fournisseur")
          if (!toEmail) {
            toast({
              title: "Non-conformité non envoyée",
              description: "Email fournisseur manquant (renseigne-le dans Fournisseurs).",
              variant: "destructive",
            })
            return
          }

          const manualCc = (activeOrder.ccEmails && activeOrder.ccEmails.length ? activeOrder.ccEmails : (supplier?.ccEmails || [])) as string[]
          const { ccEmails, bccEmails, contactsCount } = resolveRecipients(emailSettings.receiptIssue, manualCc)

          const token = await user?.getIdToken().catch(() => undefined)
          const orderNumber = (activeOrder.orderNumber || activeOrder.id.slice(-6)).toUpperCase()
          const subject = `Commande non conforme ${orderNumber} — ${companyName || "Entreprise"}`

          const res = await fetch("/api/commandes/send-nonconformity", {
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
              bccEmails,
              order: {
                ...activeOrder,
                products: receiptLines,
                supplierName: toName,
                supplierEmail: toEmail,
                orderNumber,
              },
            }),
          })

          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data?.success) throw new Error(data?.error || "Échec envoi non-conformité")

          toast({
            title: "📩 Non-conformité envoyée",
            description: `PDF envoyé à ${toName} (lignes en rouge). ${contactsCount ? `Copie envoyée à vos ${contactsCount} contact(s) pré-enregistrés.` : ""}`.trim(),
          })
        } catch (e: any) {
          console.error(e)
          toast({
            title: "Non-conformité",
            description: e?.message || "Impossible d'envoyer le PDF de non-conformité (la réception reste validée).",
            variant: "destructive",
          })
        }
      } else {
        // Réception conforme
        try {
          const supplier = suppliers.find((s) => s.id === activeOrder.supplierId)
          const toEmail = String(activeOrder.supplierEmail || supplier?.email || "").trim()
          const toName = String(activeOrder.supplierName || supplier?.name || "Fournisseur")
          if (!toEmail) {
            toast({
              title: "Réception - email manquant",
              description: "Email fournisseur manquant (renseigne-le dans Fournisseurs).",
              variant: "destructive",
            })
            return
          }

          const manualCc = (activeOrder.ccEmails && activeOrder.ccEmails.length ? activeOrder.ccEmails : (supplier?.ccEmails || [])) as string[]
          const { ccEmails, bccEmails, contactsCount } = resolveRecipients(emailSettings.receiptOk, manualCc)

          const token = await user?.getIdToken().catch(() => undefined)
          const orderNumber = (activeOrder.orderNumber || activeOrder.id.slice(-6)).toUpperCase()
          const subject = `Réception validée ${orderNumber} — ${companyName || "Entreprise"}`

          const res = await fetch("/api/commandes/send-receipt-ok", {
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
              bccEmails,
              order: {
                ...activeOrder,
                products: receiptLines,
                supplierName: toName,
                supplierEmail: toEmail,
                orderNumber,
              },
            }),
          })

          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data?.success) throw new Error(data?.error || "Échec envoi réception")

          toast({
            title: "📩 Réception confirmée",
            description: `Bon de réception envoyé à ${toName}. ${contactsCount ? `Copie envoyée à vos ${contactsCount} contact(s) pré-enregistrés.` : ""}`.trim(),
          })
        } catch (e: any) {
          console.error(e)
          toast({
            title: "Réception",
            description: e?.message || "Impossible d'envoyer le PDF de réception (la réception reste validée).",
            variant: "destructive",
          })
        }
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || "Impossible de finaliser la réception.", variant: "destructive" })
    }
  }


  return (
    <PermissionGate moduleId="commandes" redirect>
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

          
          {/* Commandes */}
          <section className="space-y-6">
            {/* À réceptionner */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  En attente de réception
                </h2>
                <p className="text-sm text-muted-foreground">{pendingReceptionOrders.length}</p>
              </div>

              {loading ? (
                <div className="pulse-card p-6 text-sm text-muted-foreground">Chargement…</div>
              ) : pendingReceptionOrders.length === 0 ? (
                <div className="pulse-card p-8 flex items-start gap-3">
                  <Package className="w-10 h-10 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-semibold">Rien à réceptionner</p>
                    <p className="text-sm text-muted-foreground">Les commandes envoyées apparaîtront ici jusqu’à validation.</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {pendingReceptionOrders
                    .slice()
                    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
                    .map((o) => {
                      const num = o.id.slice(-6).toUpperCase()
                      return (
                        <div key={o.id} className="pulse-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <button
                            type="button"
                            className="text-left flex-1 min-w-0"
                            onClick={() => openDetails(o, "view")}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate">{o.supplierName}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-muted">#{num}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-200">
                                Envoyée
                              </span>
                            </div>

                            <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Livraison : {o.deliveryDate || "—"}
                              </span>
                              <span>•</span>
                              <span>Total : {formatEuro(o.totalAmount || 0)}</span>
                            </div>
                          </button>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl gap-2"
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
                                  Renvoyer le bon
                                </>
                              )}
                            </Button>

                            <Button size="sm" className="rounded-xl gap-2" onClick={() => openDetails(o, "receive")}>
                              <Package className="w-4 h-4" />
                              Réceptionner
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* Brouillons */}
            {!loading && draftOrders.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Brouillons
                  </h2>
                  <p className="text-sm text-muted-foreground">{draftOrders.length}</p>
                </div>

                <div className="grid gap-3">
                  {draftOrders
                    .slice()
                    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
                    .map((o) => {
                      const num = o.id.slice(-6).toUpperCase()
                      return (
                        <div key={o.id} className="pulse-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <button type="button" className="text-left flex-1 min-w-0" onClick={() => openDetails(o, "view")}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate">{o.supplierName}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-muted">#{num}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-muted/40 text-muted-foreground">
                                Brouillon
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Livraison : {o.deliveryDate || "—"}
                              </span>
                              <span>•</span>
                              <span>Total : {formatEuro(o.totalAmount || 0)}</span>
                            </div>
                          </button>

                          <Button
                            size="sm"
                            className="rounded-xl gap-2"
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
                                <Send className="w-4 h-4" />
                                Envoyer
                              </>
                            )}
                          </Button>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Historique */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5 text-primary" />
                  Commandes reçues
                </h2>
                <p className="text-sm text-muted-foreground">{deliveredOrders.length}</p>
              </div>

              {loading ? (
                <div className="pulse-card p-6 text-sm text-muted-foreground">Chargement…</div>
              ) : deliveredOrders.length === 0 ? (
                <div className="pulse-card p-8 text-center">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Aucune commande réceptionnée pour le moment.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {deliveredOrders
                    .slice()
                    .sort((a, b) => (b.deliveredAt || b.createdAt || "").localeCompare(a.deliveredAt || a.createdAt || ""))
                    .map((o) => {
                      const num = o.id.slice(-6).toUpperCase()
                      return (
                        <div key={o.id} className="pulse-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <button type="button" className="text-left flex-1 min-w-0" onClick={() => openDetails(o, "view")}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate">{o.supplierName}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-muted">#{num}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
                                Reçue
                              </span>
                            </div>

                            <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Livraison : {o.deliveryDate || "—"}
                              </span>
                              <span>•</span>
                              <span>Total : {formatEuro(o.totalAmount || 0)}</span>
                            </div>
                          </button>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl gap-2"
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
                                  Renvoyer le bon
                                </>
                              )}
                            </Button>
                            <Button size="sm" className="rounded-xl gap-2" variant="secondary" onClick={() => openDetails(o, "view")}>
                              <FileText className="w-4 h-4" />
                              Voir
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </section>

        </main>

        {/* New order sheet */}
        <Sheet open={openNewOrder} onOpenChange={setOpenNewOrder}>
          <SheetContent side="right" className="w-screen max-w-none h-screen p-0 sm:max-w-none">
  <div className="flex h-full flex-col">
    <div className="border-b border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Send className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate">Envoyer une commande</div>
            <div className="text-xs text-muted-foreground truncate">
              {selectedSupplier ? selectedSupplier.name : "Sélectionne un fournisseur"}
            </div>
          </div>
        </div>

        <div
          ref={cartTargetRef}
          className={cn("text-right transition-transform", cartBump ? "scale-105" : "scale-100")}
        >
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-base font-semibold tabular-nums">{formatEuro(totalAmount)}</div>
        </div>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
          Les produits / emails se configurent dans{" "}
          <Link href="/fournisseurs" className="underline">
            Fournisseurs
          </Link>
          .
        </div>

        {selectedSupplier && francoThreshold && francoProgress && (
          <div ref={francoCardRef} className="mt-3 pulse-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={cn(
                  "text-sm font-semibold",
                  francoProgress.remaining <= 0 ? "text-emerald-700 dark:text-emerald-200" : "",
                )}>
                  {francoProgress.remaining <= 0 ? "Franco atteint 🎉" : "Objectif franco"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Seuil fournisseur : {formatEuro(francoThreshold)}
                </div>
              </div>
              <div className="text-right">
                {francoProgress.remaining <= 0 ? (
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">OK</div>
                ) : (
                  <div className="text-xs font-semibold">-{formatEuro(francoProgress.remaining)}</div>
                )}
              </div>
            </div>
            <div className="mt-3">
              <Progress value={francoProgress.pct} />
              <div className="mt-1 text-[11px] text-muted-foreground">{francoProgress.pct}%</div>
            </div>
          </div>
        )}
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
          <div className="flex items-center justify-between gap-2">
            <Label>Emails de confirmation</Label>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 rounded-lg gap-2" onClick={() => setOpenEmailSettings(true)}>
              <Settings className="w-4 h-4" />
              Réglages
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Envoi auto : {emailSettings.order.emails.length} contact(s) ({emailSettings.order.mode.toUpperCase()})
          </p>

          {ccList.length ? (
            <div className="flex flex-wrap gap-2">
              {ccList.map((email) => (
                <Badge key={email} variant="secondary" className="rounded-full pl-3 pr-2 py-1 flex items-center gap-1">
                  <span className="text-xs">{email}</span>
                  <button
                    type="button"
                    onClick={() => removeCc(email)}
                    className="ml-1 inline-flex items-center justify-center rounded-full hover:bg-background/60 p-1"
                    aria-label={"Retirer " + email}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun email en copie.</p>
          )}

          <div className="flex items-center gap-2">
            <Input
              placeholder="Ajouter un email (ex: compta@entreprise.com)"
              value={ccInput}
              onChange={(e) => setCcInput(e.target.value)}
              onKeyDown={(e) => {
                if (["Enter", ",", ";", "Tab"].includes(e.key)) {
                  // Allow quick add with Enter / comma / semicolon / tab
                  e.preventDefault()
                  addCcFromInput()
                }
              }}
            />
            <Button type="button" variant="secondary" className="shrink-0" onClick={addCcFromInput}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">Tu peux coller plusieurs emails (virgule, espace, point-virgule). Appuie sur +.</p>
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
        <Label>Produits</Label>

        <Input placeholder="Rechercher un produit…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />

        {!selectedSupplier ? (
          <div className="p-4 rounded-xl bg-muted text-sm text-muted-foreground">
            Sélectionne un fournisseur pour voir ses produits.
          </div>
        ) : (selectedSupplier.products?.length || 0) === 0 ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
            Aucun produit configuré pour ce fournisseur. Ajoute des produits dans la page Fournisseurs.
          </div>
        ) : (
          <div className="space-y-2">
            {(() => {
              const groups = new Map<string, typeof filteredLines>()
              for (const line of filteredLines) {
                const cat = (line.category || "Sans catégorie").toString().trim() || "Sans catégorie"
                if (!groups.has(cat)) groups.set(cat, [])
                groups.get(cat)!.push(line)
              }
              return Array.from(groups.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([cat, items]) => (
                  <div key={cat} className="pulse-card p-0 overflow-hidden">
                    <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                      <div className="text-xs font-semibold tracking-wide uppercase">{cat}</div>
                      <div className="text-xs text-muted-foreground">{items.length}</div>
                    </div>

                    <div className="divide-y divide-border">
                      {items.map((p) => {
                        const step = unitStep(p.unit)
                        const packAdd = convertPackToProductUnit(p.packQuantity, p.packUnit, p.unit)
                        return (
                          <ProductCard
                            key={p.id}
                            line={p}
                            step={step}
                            packAdd={packAdd}
                            onSetQty={(v) => updateQty(p.id, v)}
                            onDecrement={() => changeQty(p.id, -step)}
                            onIncrement={(fromEl) => changeQty(p.id, step, fromEl)}
                            onAddPack={(fromEl) => {
                              if (packAdd !== undefined && packAdd > 0) changeQty(p.id, packAdd, fromEl)
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))
            })()}
          </div>
        )}
      </div>
    </div>

    <div className="border-t border-border bg-card p-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center justify-between sm:block">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-semibold tabular-nums">{formatEuro(totalAmount)}</div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:min-w-[320px]">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl gap-2 justify-center"
            onClick={() => setOpenCartSummary(true)}
            disabled={!selectedSupplier}
          >
            <Package className="w-4 h-4" />
            Panier ({orderLines.filter((l) => Number(l.quantity || 0) > 0).length})
          </Button>
          <Button
            onClick={handleSend}
            className="rounded-xl gap-2 justify-center"
            disabled={!companyId || !selectedSupplier}
          >
            <Send className="w-4 h-4" />
            Envoyer (PDF)
          </Button>
        </div>
      </div>
    </div>
  </div>
</SheetContent>
        </Sheet>

        {/* Cart summary */}
        <Dialog open={openCartSummary} onOpenChange={setOpenCartSummary}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Panier</DialogTitle>
              <DialogDescription>
                Récapitulatif des produits avec quantité &gt; 0.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {orderLines
                .filter((l) => Number(l.quantity || 0) > 0)
                .sort((a, b) => (a.category || "").toString().localeCompare((b.category || "").toString()))
                .map((l) => (
                  <div key={l.id} className="pulse-card p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold leading-tight break-words">{l.productName}</div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                        <span>{(l.category || "Sans catégorie").toString()}</span>
                        <span>•</span>
                        <span>{formatEuro(l.unitPrice)}/{l.unit}</span>
                        {l.packLabel ? (
                          <>
                            <span>•</span>
                            <span>Colisage: {String(l.packLabel)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">Qté</div>
                      <div className="text-sm font-bold tabular-nums">
                        {Number(l.quantity || 0).toLocaleString("fr-FR")} {l.unit}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{formatEuro(Number(l.total || 0))}</div>
                    </div>
                  </div>
                ))}

              {orderLines.filter((l) => Number(l.quantity || 0) > 0).length === 0 ? (
                <div className="p-4 rounded-xl bg-muted text-sm text-muted-foreground">Aucun produit dans le panier.</div>
              ) : null}
            </div>

            <DialogFooter className="gap-2">
              <div className="mr-auto text-sm font-semibold">Total : {formatEuro(totalAmount)}</div>
              <Button type="button" variant="outline" onClick={() => setOpenCartSummary(false)}>
                Fermer
              </Button>
              <Button type="button" onClick={handleSend} disabled={!companyId || !selectedSupplier}>
                Envoyer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Email defaults settings */}
        <Dialog open={openEmailSettings} onOpenChange={setOpenEmailSettings}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Réglages emails automatiques</DialogTitle>
              <DialogDescription>
                Configure les destinataires internes par défaut (CC ou BCC). Ils seront ajoutés automatiquement lors de l’envoi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {(
                [
                  { key: "order" as const, label: "Bon de commande" },
                  { key: "receiptOk" as const, label: "Réception conforme" },
                  { key: "receiptIssue" as const, label: "Non-conformité" },
                ]
              ).map((cfg) => (
                <div key={cfg.key} className="pulse-card p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{cfg.label}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Mode</span>
                      <Select
                        value={emailSettingsDraft[cfg.key].mode}
                        onValueChange={(v) =>
                          setEmailSettingsDraft((prev) => ({
                            ...prev,
                            [cfg.key]: { ...prev[cfg.key], mode: (v as EmailMode) || "bcc" },
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bcc">BCC (discret)</SelectItem>
                          <SelectItem value="cc">CC (visible)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Textarea
                    value={emailSettingsDraft[cfg.key].emails.join(", ")}
                    onChange={(e) =>
                      setEmailSettingsDraft((prev) => ({
                        ...prev,
                        [cfg.key]: {
                          ...prev[cfg.key],
                          emails: normalizeEmails(e.target.value),
                        },
                      }))
                    }
                    placeholder="ex: compta@entreprise.com, manager@entreprise.com"
                    className="min-h-[70px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sépare par virgule / espace / point-virgule. (BCC recommandé pour ne pas exposer les emails internes au fournisseur.)
                  </p>
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenEmailSettings(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={saveEmailDefaults} disabled={savingEmailSettings}>
                {savingEmailSettings ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Order details / réception */}
        <Sheet open={openOrderDetails} onOpenChange={setOpenOrderDetails}>
          <SheetContent side="bottom" className="w-screen max-w-none h-screen p-0 sm:max-w-none">
            <div className="flex h-full flex-col">
              <div className="border-b border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <div className="text-lg font-semibold truncate">
                        {activeOrder ? `${activeOrder.supplierName}` : "Commande"}
                      </div>
                      {activeOrder && (
                        <span className="text-xs px-2 py-1 rounded-lg bg-muted">
                          #{activeOrder.id.slice(-6).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Livraison : {activeOrder?.deliveryDate || "—"}
                      </span>
                      <span>•</span>
                      <span>Total : {formatEuro(activeOrder?.totalAmount || 0)}</span>
                      {activeOrder?.status === "delivered" && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                            <BadgeCheck className="w-4 h-4" />
                            Reçue
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {detailsMode === "receive" && (
                      <Button variant="outline" className="rounded-xl gap-2" onClick={markAllOk}>
                        <CheckCircle2 className="w-4 h-4" />
                        Tout OK
                      </Button>
                    )}
                    <Button variant="outline" className="rounded-xl" onClick={() => setOpenOrderDetails(false)}>
                      Fermer
                    </Button>
                  </div>
                </div>

                {detailsMode === "receive" && (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Validation : <span className="font-semibold text-foreground">{receiptProgress.done}</span> /{" "}
                      <span className="font-semibold text-foreground">{receiptProgress.total}</span>
                    </div>
                    <div className="w-40">
                      <Progress value={receiptProgress.total ? (receiptProgress.done / receiptProgress.total) * 100 : 0} className="h-2" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeOrder && activeOrder.notes && (
                  <div className="pulse-card p-4 border border-border/50">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Notes</div>
                    <div className="text-sm whitespace-pre-wrap">{activeOrder.notes}</div>
                  </div>
                )}

                {activeOrder ? (
                  <div className="space-y-3">
                    {(() => {
                      const groups = new Map<string, OrderProduct[]>()
                      for (const l of receiptLines) {
                        const cat = (l.category || "Sans catégorie").toString().trim() || "Sans catégorie"
                        if (!groups.has(cat)) groups.set(cat, [])
                        groups.get(cat)!.push(l)
                      }
                      const sorted = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
                      return sorted.map(([cat, items]) => (
                        <div key={cat} className="pulse-card p-0 overflow-hidden">
                          <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                            <div className="text-xs font-semibold tracking-wide uppercase">{cat}</div>
                            <div className="text-xs text-muted-foreground">{items.length}</div>
                          </div>

                          <div className="divide-y divide-border">
                            {items.map((p) => {
                              const orderedQty = Number(p.quantity || 0)
                              const receivedQty = typeof (p as any).receivedQuantity === "number" ? (p as any).receivedQuantity : orderedQty
                              const receivedOk = (p as any).receivedOk as boolean | undefined
                              const isProblem = receivedOk === false
                              const isOk = receivedOk === true

                              return (
                                <div key={p.id} className="p-4 flex flex-col gap-3">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="font-semibold leading-tight break-words">{p.productName}</div>
                                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                                        <span className="truncate">{p.reference || "—"}</span>
                                        <span>•</span>
                                        <span>{formatEuro(p.unitPrice)}/{p.unit}</span>
                                        {p.packLabel ? (
                                          <>
                                            <span>•</span>
                                            <span>Colisage : {p.packLabel}</span>
                                          </>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                      <div className="text-xs text-muted-foreground">Total</div>
                                      <div className="text-sm font-semibold tabular-nums">{formatEuro(Number(p.total || 0))}</div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="pulse-card p-3 bg-muted/20 border border-border/50">
                                      <div className="text-[11px] text-muted-foreground">Commandé</div>
                                      <div className="text-sm font-bold tabular-nums">
                                        {orderedQty.toLocaleString("fr-FR")} {p.unit}
                                      </div>
                                    </div>

                                    <div className="pulse-card p-3 bg-muted/20 border border-border/50">
                                      <div className="text-[11px] text-muted-foreground">Reçu</div>
                                      {detailsMode === "receive" ? (
                                        <Input
                                          type="number"
                                          min={0}
                                          step={unitStep(p.unit)}
                                          value={receivedQty}
                                          onChange={(e) => setLineReceipt(p.id, { receivedQuantity: Number(e.target.value) })}
                                          className="mt-1"
                                        />
                                      ) : (
                                        <div className="text-sm font-bold tabular-nums mt-1">
                                          {(typeof (p as any).receivedQuantity === "number"
                                            ? (p as any).receivedQuantity
                                            : orderedQty
                                          ).toLocaleString("fr-FR")}{" "}
                                          {p.unit}
                                        </div>
                                      )}
                                    </div>

                                    <div className="pulse-card p-3 bg-muted/20 border border-border/50">
                                      <div className="text-[11px] text-muted-foreground">Statut</div>

                                      {detailsMode === "receive" ? (
                                        <div className="mt-1 flex gap-2">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant={isOk ? "default" : "outline"}
                                            className="rounded-xl flex-1"
                                            onClick={() => setLineReceipt(p.id, { receivedOk: true, receivedNote: "" })}
                                          >
                                            OK
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant={isProblem ? "destructive" : "outline"}
                                            className="rounded-xl flex-1"
                                            onClick={() => setLineReceipt(p.id, { receivedOk: false })}
                                          >
                                            Problème
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="mt-1">
                                          {receivedOk === true ? (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
                                              OK
                                            </span>
                                          ) : receivedOk === false ? (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-200">
                                              Problème
                                            </span>
                                          ) : (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-muted/40 text-muted-foreground">
                                              —
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {detailsMode === "receive" && isProblem && (
                                    <div className="space-y-2">
                                      <Label>Note (obligatoire si problème)</Label>
                                      <Textarea
                                        value={String((p as any).receivedNote || "")}
                                        onChange={(e) => setLineReceipt(p.id, { receivedNote: e.target.value })}
                                        placeholder="Ex: Manque 2kg, carton abîmé, produit non conforme…"
                                        className="min-h-[70px]"
                                      />
                                    </div>
                                  )}

                                  {detailsMode !== "receive" && receivedOk === false && String((p as any).receivedNote || "").trim() && (
                                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                                      <div className="text-xs font-bold text-rose-700 dark:text-rose-200 mb-1">Note</div>
                                      <div className="text-sm text-rose-900 dark:text-rose-50 whitespace-pre-wrap">
                                        {String((p as any).receivedNote || "")}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                ) : (
                  <div className="pulse-card p-6 text-sm text-muted-foreground">Aucune commande sélectionnée.</div>
                )}
              </div>

              {detailsMode === "receive" && (
                <div className="border-t border-border bg-card p-4">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <Button variant="outline" className="rounded-xl gap-2" onClick={saveReceipt}>
                      <Save className="w-4 h-4" />
                      Enregistrer (sans finaliser)
                    </Button>
                    <Button className="rounded-xl gap-2 sm:min-w-[320px] justify-center" onClick={finalizeReceipt}>
                      <BadgeCheck className="w-4 h-4" />
                      Valider la réception
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>


        <BottomNav />
      </div>
    </PermissionGate>
  )
}
