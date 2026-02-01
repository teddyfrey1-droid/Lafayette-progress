"use client"

import { db } from "@/lib/firebase/client"
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore"

/**
 * Store commandes / fournisseurs
 * - Backend "cloud" (Firestore) dès qu'un companyId réel existe
 * - Fallback "demo" (LocalStorage) si companyId absent / demo-company
 *
 * Important: API conservée, les pages restent synchronisées via un event global.
 */

const STORE_EVENT_NAME = "pulse_orders_store_changed"
export function getOrdersStoreEventName() {
  return STORE_EVENT_NAME
}

export type OrdersBackend = "cloud" | "demo"

export interface OrderProduct {
  id: string
  productId: string
  productName: string
  reference?: string
  quantity: number
  unitPrice: number
  unit: string
  category?: string
  packLabel?: string
  packQuantity?: number
  packUnit?: string
  total: number
}

export interface OrderSupplier {
  id: string
  companyId: string
  name: string
  email: string
  ccEmails?: string[]
  phone?: string
  address?: string
  contactName?: string
  isDefault?: boolean
  deliveryTime?: string
  minOrder?: string
  franco?: string
  orderBefore?: string
  delaiCommande?: string
  deliveryDays?: string[]
  commercial?: string
  notes?: string
  products: SupplierProduct[]
  createdAt: string
}

export interface SupplierProduct {
  id: string
  supplierId: string
  name: string
  reference?: string
  imageUrl?: string
  unitPrice: number
  unit: string
  category?: string
  packLabel?: string
  packQuantity?: number
  packUnit?: string
  minQuantity?: number
}

export interface Order {
  id: string
  companyId: string
  supplierId: string
  supplierName: string
  supplierEmail?: string
  ccEmails?: string[]
  products: OrderProduct[]
  totalAmount: number
  deliveryDate: string
  status: "draft" | "sent" | "confirmed" | "delivered" | "cancelled"
  notes?: string
  createdAt: string
  sentAt?: string
}

interface OrdersState {
  suppliers: OrderSupplier[]
  orders: Order[]
}

// -------------------------
// Backend resolution helpers
// -------------------------

function resolveBackend(companyId: string, backend?: OrdersBackend): OrdersBackend {
  if (backend) return backend
  if (companyId && companyId !== "demo-company") return "cloud"
  return "demo"
}

function nowIso() {
  return new Date().toISOString()
}

function makeId(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now()}_${rand}`
}

function dispatchChange(companyId: string) {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent(STORE_EVENT_NAME, { detail: { companyId } }))
  } catch {
    // ignore
  }
}

// -------------------------
// DEMO backend (LocalStorage)
// -------------------------

const STORAGE_KEY = "pulse_orders_store"
const MIGRATION_FLAG_PREFIX = "pulse_orders_store_migrated_to"

function getDemoState(companyId: string): OrdersState {
  if (typeof window === "undefined") return { suppliers: [], orders: [] }
  const key = `${STORAGE_KEY}_${companyId}`
  let raw = localStorage.getItem(key)

  // Migration best-effort : évite "disparition" quand companyId devient dispo
  if (!raw && companyId && companyId !== "demo-company") {
    try {
      const migratedFlagKey = `${MIGRATION_FLAG_PREFIX}:${companyId}`
      const alreadyMigrated = localStorage.getItem(migratedFlagKey)
      if (!alreadyMigrated) {
        const legacyRaw = localStorage.getItem(`${STORAGE_KEY}_demo-company`)
        if (legacyRaw) {
          const legacyParsed = JSON.parse(legacyRaw) as Partial<OrdersState>
          const hasLegacyData =
            (Array.isArray(legacyParsed?.suppliers) && legacyParsed!.suppliers!.length > 0) ||
            (Array.isArray(legacyParsed?.orders) && legacyParsed!.orders!.length > 0)

          if (hasLegacyData) {
            localStorage.setItem(key, legacyRaw)
            raw = legacyRaw
          }
        }
        localStorage.setItem(migratedFlagKey, "1")
      }
    } catch {
      // ignore
    }
  }

  if (!raw) return { suppliers: [], orders: [] }
  try {
    return JSON.parse(raw)
  } catch {
    return { suppliers: [], orders: [] }
  }
}

function setDemoState(companyId: string, state: OrdersState) {
  if (typeof window === "undefined") return
  const key = `${STORAGE_KEY}_${companyId}`
  localStorage.setItem(key, JSON.stringify(state))
  dispatchChange(companyId)
}

function ensureSupplierShape(s: any, companyId: string): OrderSupplier {
  const products = Array.isArray(s?.products) ? s.products : []
  return {
    id: (s?.id || makeId("sup")).toString(),
    companyId,
    name: (s?.name || "").toString(),
    email: (s?.email || "").toString(),
    ccEmails: Array.isArray(s?.ccEmails) ? s.ccEmails.map((e: any) => String(e).trim()).filter(Boolean) : undefined,
    phone: s?.phone,
    address: s?.address,
    contactName: s?.contactName,
    isDefault: s?.isDefault,
    deliveryTime: s?.deliveryTime,
    minOrder: s?.minOrder,
    franco: s?.franco,
    orderBefore: s?.orderBefore,
    delaiCommande: s?.delaiCommande,
    deliveryDays: Array.isArray(s?.deliveryDays) ? s.deliveryDays : undefined,
    commercial: s?.commercial,
    notes: s?.notes,
    products: products.map((p: any) => ({
      id: (p?.id || makeId("prod")).toString(),
      supplierId: (p?.supplierId || (s?.id || "")).toString(),
      name: (p?.name || "").toString(),
      reference: p?.reference,
      imageUrl: p?.imageUrl,
      unitPrice: Number(p?.unitPrice || 0),
      unit: (p?.unit || "").toString(),
      category: p?.category,
      packLabel: p?.packLabel,
      packQuantity: p?.packQuantity ? Number(p.packQuantity) : undefined,
      packUnit: p?.packUnit,
      minQuantity: p?.minQuantity ? Number(p.minQuantity) : undefined,
    })),
    createdAt: (s?.createdAt || nowIso()).toString(),
  }
}
function ensureOrderShape(o: any, companyId: string): Order {
  return {
    id: (o?.id || makeId("ord")).toString(),
    companyId,
    supplierId: (o?.supplierId || "").toString(),
    supplierName: (o?.supplierName || "").toString(),
    supplierEmail: o?.supplierEmail,
    ccEmails: Array.isArray(o?.ccEmails) ? o.ccEmails.map((e: any) => String(e).trim()).filter(Boolean) : undefined,
    products: Array.isArray(o?.products) ? o.products : [],
    totalAmount: Number(o?.totalAmount || 0),
    deliveryDate: (o?.deliveryDate || "").toString(),
    status: (o?.status || "draft") as any,
    notes: o?.notes,
    createdAt: (o?.createdAt || nowIso()).toString(),
    sentAt: o?.sentAt,
  }
}


// -------------------------
// CLOUD backend (Firestore)
// -------------------------

type CloudCache = {
  suppliers: OrderSupplier[]
  orders: Order[]
  hydrated: boolean
  unsubSuppliers?: () => void
  unsubOrders?: () => void
}

const cloudCacheByCompany = new Map<string, CloudCache>()

const CLOUD_MIGRATION_FLAG_PREFIX = "pulse_orders_store_cloud_migrated"

async function migrateLocalToCloudIfNeeded(companyId: string) {
  if (typeof window === "undefined") return
  try {
    const flagKey = `${CLOUD_MIGRATION_FLAG_PREFIX}:${companyId}`
    if (localStorage.getItem(flagKey)) return

    // Check cloud already has data
    const suppliersSnap = await getDocs(collection(db, "companies", companyId, "suppliers"))
    const ordersSnap = await getDocs(collection(db, "companies", companyId, "orders"))
    const cloudHasData = suppliersSnap.size > 0 || ordersSnap.size > 0
    if (cloudHasData) {
      localStorage.setItem(flagKey, "1")
      return
    }

    // Prefer local state under companyId, else demo-company
    const raw1 = localStorage.getItem(`${STORAGE_KEY}_${companyId}`)
    const raw2 = localStorage.getItem(`${STORAGE_KEY}_demo-company`)
    const raw = raw1 || raw2
    if (!raw) {
      localStorage.setItem(flagKey, "1")
      return
    }

    const parsed = JSON.parse(raw) as Partial<OrdersState>
    const suppliers = Array.isArray(parsed?.suppliers) ? parsed!.suppliers! : []
    const orders = Array.isArray(parsed?.orders) ? parsed!.orders! : []

    if (suppliers.length === 0 && orders.length === 0) {
      localStorage.setItem(flagKey, "1")
      return
    }

    // Write suppliers & orders to Firestore
    await Promise.all([
      ...suppliers.map(async (s: any) => {
        const sup = ensureSupplierShape(s, companyId)
        await setDoc(doc(db, "companies", companyId, "suppliers", sup.id), sup, { merge: true })
      }),
      ...orders.map(async (o: any) => {
        const ord: Order = {
          id: (o?.id || makeId("ord")).toString(),
          companyId,
          supplierId: (o?.supplierId || "").toString(),
          supplierName: (o?.supplierName || "").toString(),
          supplierEmail: o?.supplierEmail,
          ccEmails: Array.isArray(o?.ccEmails) ? o.ccEmails.map((e: any) => String(e).trim()).filter(Boolean) : undefined,
          products: Array.isArray(o?.products) ? o.products : [],
          totalAmount: Number(o?.totalAmount || 0),
          deliveryDate: (o?.deliveryDate || "").toString(),
          status: (o?.status || "draft") as any,
          notes: o?.notes,
          createdAt: (o?.createdAt || nowIso()).toString(),
          sentAt: o?.sentAt,
        }
        await setDoc(doc(db, "companies", companyId, "orders", ord.id), ord, { merge: true })
      }),
    ])

    localStorage.setItem(flagKey, "1")
  } catch (e) {
    console.error("Migration local->cloud failed", e)
  }
}

function ensureCloudCache(companyId: string): CloudCache {
  const existing = cloudCacheByCompany.get(companyId)
  if (existing) return existing
  const created: CloudCache = { suppliers: [], orders: [], hydrated: false }
  cloudCacheByCompany.set(companyId, created)
  return created
}

export async function hydrateOrdersStore(companyId: string, backend?: OrdersBackend) {
  const mode = resolveBackend(companyId, backend)
  if (mode === "demo") return

  const cache = ensureCloudCache(companyId)
  if (cache.hydrated) return

  // Best-effort migration if the user previously created data while companyId wasn't available
  await migrateLocalToCloudIfNeeded(companyId)

  // Initial fetch
  try {
    const [suppliersSnap, ordersSnap] = await Promise.all([
      getDocs(collection(db, "companies", companyId, "suppliers")),
      getDocs(collection(db, "companies", companyId, "orders")),
    ])
    cache.suppliers = suppliersSnap.docs.map((d) => ensureSupplierShape({ ...(d.data() as any), id: d.id }, companyId))
    cache.orders = ordersSnap.docs.map((d) => ensureOrderShape({ ...(d.data() as any), id: d.id }, companyId))
  } catch (e) {
    console.error("hydrateOrdersStore failed", e)
  }

  // Realtime subscriptions (multi-device / multi-users)
  if (!cache.unsubSuppliers) {
    cache.unsubSuppliers = onSnapshot(
      collection(db, "companies", companyId, "suppliers"),
      (snap) => {
        cache.suppliers = snap.docs.map((d) => ensureSupplierShape({ ...(d.data() as any), id: d.id }, companyId))
        dispatchChange(companyId)
      },
      (err) => {
        console.error("suppliers onSnapshot error", err)
      },
    )
  }
  if (!cache.unsubOrders) {
    cache.unsubOrders = onSnapshot(
      collection(db, "companies", companyId, "orders"),
      (snap) => {
        cache.orders = snap.docs.map((d) => ensureOrderShape({ ...(d.data() as any), id: d.id }, companyId))
        dispatchChange(companyId)
      },
      (err) => {
        console.error("orders onSnapshot error", err)
      },
    )
  }

  cache.hydrated = true
  dispatchChange(companyId)
}

// -------------------------
// Public API (read)
// -------------------------

export function getSuppliers(companyId: string, backend?: OrdersBackend): OrderSupplier[] {
  const mode = resolveBackend(companyId, backend)
  if (mode === "cloud") {
    const cache = ensureCloudCache(companyId)
    // ensure hydration in background if caller didn't call hydrate
    void hydrateOrdersStore(companyId, "cloud")
    return cache.suppliers
  }
  return getDemoState(companyId).suppliers
}

export function getOrders(companyId: string, backend?: OrdersBackend): Order[] {
  const mode = resolveBackend(companyId, backend)
  if (mode === "cloud") {
    const cache = ensureCloudCache(companyId)
    void hydrateOrdersStore(companyId, "cloud")
    return cache.orders
  }
  return getDemoState(companyId).orders
}

// -------------------------
// Public API (write)
// -------------------------

export async function addSupplier(
  companyId: string,
  supplier: Omit<OrderSupplier, "id" | "companyId" | "products" | "createdAt">,
  backend?: OrdersBackend,
): Promise<OrderSupplier> {
  const mode = resolveBackend(companyId, backend)
  if (mode === "cloud") {
    await hydrateOrdersStore(companyId, "cloud")
    const id = makeId("sup")
    const newSupplier: OrderSupplier = {
      ...supplier,
      id,
      companyId,
      products: [],
      createdAt: nowIso(),
    }
    await setDoc(doc(db, "companies", companyId, "suppliers", id), newSupplier)
    return newSupplier
  }

  const state = getDemoState(companyId)
  const newSupplier: OrderSupplier = {
    ...supplier,
    id: makeId("sup"),
    companyId,
    products: [],
    createdAt: nowIso(),
  }
  state.suppliers.push(newSupplier)
  setDemoState(companyId, state)
  return newSupplier
}

export async function updateSupplier(
  companyId: string,
  supplierId: string,
  patch: Partial<OrderSupplier>,
  backend?: OrdersBackend,
) {
  const mode = resolveBackend(companyId, backend)
  if (mode === "cloud") {
    await updateDoc(doc(db, "companies", companyId, "suppliers", supplierId), patch as any)
    return
  }

  const state = getDemoState(companyId)
  const idx = state.suppliers.findIndex((s) => s.id === supplierId)
  if (idx < 0) return
  state.suppliers[idx] = { ...state.suppliers[idx], ...patch }
  setDemoState(companyId, state)
}

export async function deleteSupplier(companyId: string, supplierId: string, backend?: OrdersBackend) {
  const mode = resolveBackend(companyId, backend)
  if (mode === "cloud") {
    await deleteDoc(doc(db, "companies", companyId, "suppliers", supplierId))
    return
  }

  const state = getDemoState(companyId)
  state.suppliers = state.suppliers.filter((s) => s.id !== supplierId)
  setDemoState(companyId, state)
}

export async function addProduct(
  companyId: string,
  supplierId: string,
  product: Omit<SupplierProduct, "id" | "supplierId">,
  backend?: OrdersBackend,
): Promise<SupplierProduct> {
  const mode = resolveBackend(companyId, backend)
  const newProduct: SupplierProduct = {
    ...product,
    id: makeId("prod"),
    supplierId,
  }

  if (mode === "cloud") {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "companies", companyId, "suppliers", supplierId)
      const snap = await tx.get(ref)
      if (!snap.exists()) throw new Error("Fournisseur non trouvé")
      const data = snap.data() as any
      const products = Array.isArray(data.products) ? data.products : []
      products.push(newProduct)
      tx.update(ref, { products })
    })
    return newProduct
  }

  const state = getDemoState(companyId)
  const supplierIdx = state.suppliers.findIndex((s) => s.id === supplierId)
  if (supplierIdx < 0) throw new Error("Fournisseur non trouvé")
  state.suppliers[supplierIdx].products.push(newProduct)
  setDemoState(companyId, state)
  return newProduct
}

export async function updateProduct(
  companyId: string,
  supplierId: string,
  productId: string,
  patch: Partial<SupplierProduct>,
  backend?: OrdersBackend,
) {
  const mode = resolveBackend(companyId, backend)
  if (mode === "cloud") {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "companies", companyId, "suppliers", supplierId)
      const snap = await tx.get(ref)
      if (!snap.exists()) return
      const data = snap.data() as any
      const products: SupplierProduct[] = Array.isArray(data.products) ? data.products : []
      const idx = products.findIndex((p) => p.id === productId)
      if (idx < 0) return
      products[idx] = { ...products[idx], ...patch }
      tx.update(ref, { products })
    })
    return
  }

  const state = getDemoState(companyId)
  const supplierIdx = state.suppliers.findIndex((s) => s.id === supplierId)
  if (supplierIdx < 0) return
  const productIdx = state.suppliers[supplierIdx].products.findIndex((p) => p.id === productId)
  if (productIdx < 0) return
  state.suppliers[supplierIdx].products[productIdx] = { ...state.suppliers[supplierIdx].products[productIdx], ...patch }
  setDemoState(companyId, state)
}

export async function deleteProduct(
  companyId: string,
  supplierId: string,
  productId: string,
  backend?: OrdersBackend,
) {
  const mode = resolveBackend(companyId, backend)
  if (mode === "cloud") {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "companies", companyId, "suppliers", supplierId)
      const snap = await tx.get(ref)
      if (!snap.exists()) return
      const data = snap.data() as any
      const products: SupplierProduct[] = Array.isArray(data.products) ? data.products : []
      const next = products.filter((p) => p.id !== productId)
      tx.update(ref, { products: next })
    })
    return
  }

  const state = getDemoState(companyId)
  const supplierIdx = state.suppliers.findIndex((s) => s.id === supplierId)
  if (supplierIdx < 0) return
  state.suppliers[supplierIdx].products = state.suppliers[supplierIdx].products.filter((p) => p.id !== productId)
  setDemoState(companyId, state)
}

export async function addOrder(
  companyId: string,
  order: Omit<Order, "id" | "companyId" | "createdAt" | "status" | "sentAt"> & { status?: Order["status"] },
  backend?: OrdersBackend,
): Promise<Order> {
  const mode = resolveBackend(companyId, backend)
  const newOrder: Order = {
    ...order,
    id: makeId("ord"),
    companyId,
    status: order.status || "draft",
    createdAt: nowIso(),
  }

  if (mode === "cloud") {
    await setDoc(doc(db, "companies", companyId, "orders", newOrder.id), newOrder)
    return newOrder
  }

  const state = getDemoState(companyId)
  state.orders.push(newOrder)
  setDemoState(companyId, state)
  return newOrder
}

export async function updateOrder(companyId: string, orderId: string, patch: Partial<Order>, backend?: OrdersBackend) {
  const mode = resolveBackend(companyId, backend)
  if (mode === "cloud") {
    await updateDoc(doc(db, "companies", companyId, "orders", orderId), patch as any)
    return
  }

  const state = getDemoState(companyId)
  const idx = state.orders.findIndex((o) => o.id === orderId)
  if (idx < 0) return
  state.orders[idx] = { ...state.orders[idx], ...patch }
  setDemoState(companyId, state)
}

export async function deleteOrder(companyId: string, orderId: string, backend?: OrdersBackend) {
  const mode = resolveBackend(companyId, backend)
  if (mode === "cloud") {
    await deleteDoc(doc(db, "companies", companyId, "orders", orderId))
    return
  }

  const state = getDemoState(companyId)
  state.orders = state.orders.filter((o) => o.id !== orderId)
  setDemoState(companyId, state)
}

export async function markOrderAsSent(companyId: string, orderId: string, backend?: OrdersBackend) {
  await updateOrder(
    companyId,
    orderId,
    { status: "sent", sentAt: nowIso() },
    backend,
  )
}
