"use client"

import { db } from "@/lib/firebase/client"
import { doc, getDoc, setDoc } from "firebase/firestore"

export type EmailMode = "cc" | "bcc"

export type EmailDefaults = {
  mode: EmailMode
  emails: string[]
}

export type CompanyEmailSettings = {
  order: EmailDefaults
  receiptOk: EmailDefaults
  receiptIssue: EmailDefaults
  updatedAt?: string
}

const STORAGE_PREFIX = "pulse_email_settings_"

export function defaultCompanyEmailSettings(): CompanyEmailSettings {
  return {
    order: { mode: "bcc", emails: [] },
    receiptOk: { mode: "bcc", emails: [] },
    receiptIssue: { mode: "bcc", emails: [] },
  }
}

function normalizeList(emails: unknown): string[] {
  if (!Array.isArray(emails)) return []
  const out: string[] = []
  for (const e of emails) {
    const v = String(e || "").trim().toLowerCase()
    if (!v) continue
    if (!out.includes(v)) out.push(v)
  }
  return out
}

function normalizeMode(m: unknown): EmailMode {
  return m === "cc" ? "cc" : "bcc"
}

function safeParse(raw: string | null): any {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function loadCompanyEmailSettings(companyId: string): Promise<CompanyEmailSettings> {
  // Demo fallback
  if (!companyId || companyId === "demo-company") {
    if (typeof window === "undefined") return defaultCompanyEmailSettings()
    const cached = safeParse(localStorage.getItem(`${STORAGE_PREFIX}${companyId || "demo"}`))
    if (!cached) return defaultCompanyEmailSettings()
    return {
      order: { mode: normalizeMode(cached?.order?.mode), emails: normalizeList(cached?.order?.emails) },
      receiptOk: { mode: normalizeMode(cached?.receiptOk?.mode), emails: normalizeList(cached?.receiptOk?.emails) },
      receiptIssue: { mode: normalizeMode(cached?.receiptIssue?.mode), emails: normalizeList(cached?.receiptIssue?.emails) },
      updatedAt: cached?.updatedAt,
    }
  }

  const ref = doc(db, "companies", companyId, "settings", "emails")
  const snap = await getDoc(ref)
  if (!snap.exists()) return defaultCompanyEmailSettings()
  const d: any = snap.data() || {}
  return {
    order: { mode: normalizeMode(d?.order?.mode), emails: normalizeList(d?.order?.emails) },
    receiptOk: { mode: normalizeMode(d?.receiptOk?.mode), emails: normalizeList(d?.receiptOk?.emails) },
    receiptIssue: { mode: normalizeMode(d?.receiptIssue?.mode), emails: normalizeList(d?.receiptIssue?.emails) },
    updatedAt: d?.updatedAt,
  }
}

export async function saveCompanyEmailSettings(companyId: string, settings: CompanyEmailSettings): Promise<void> {
  const payload: CompanyEmailSettings = {
    order: { mode: normalizeMode(settings?.order?.mode), emails: normalizeList(settings?.order?.emails) },
    receiptOk: { mode: normalizeMode(settings?.receiptOk?.mode), emails: normalizeList(settings?.receiptOk?.emails) },
    receiptIssue: { mode: normalizeMode(settings?.receiptIssue?.mode), emails: normalizeList(settings?.receiptIssue?.emails) },
    updatedAt: new Date().toISOString(),
  }

  // Demo fallback
  if (!companyId || companyId === "demo-company") {
    if (typeof window !== "undefined") {
      localStorage.setItem(`${STORAGE_PREFIX}${companyId || "demo"}`, JSON.stringify(payload))
    }
    return
  }

  const ref = doc(db, "companies", companyId, "settings", "emails")
  await setDoc(ref, payload, { merge: true })
}

export function resolveRecipients(
  defaults: EmailDefaults,
  manualCc: string[] | undefined,
): { ccEmails: string[]; bccEmails: string[]; contactsCount: number } {
  const unique = (arr: string[]) => Array.from(new Set(arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean)))
  const defaultsList = unique(defaults?.emails || [])
  const manualList = unique(manualCc || [])

  // Manual emails remain CC (visible) to keep it simple and explicit.
  const ccEmails = unique([...(defaults?.mode === "cc" ? defaultsList : []), ...manualList])
  const bccEmails = unique(defaults?.mode === "bcc" ? defaultsList : [])
  const contactsCount = defaultsList.length
  return { ccEmails, bccEmails, contactsCount }
}
