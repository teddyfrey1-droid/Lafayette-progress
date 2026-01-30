"use client";

/**
 * Local demo store
 * - Persists ONLY in the browser (localStorage)
 * - Keyed by companyId
 * - Used when a company is on Starter + Trial (demo mode)
 */

export type DemoObjective = {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  type?: "principal" | "secondaire";
  direction?: "ascending" | "descending";
  isActive?: boolean;
  isConfidential?: boolean;
  current: number;
  target: number;
  unit: string;
  createdAt: string;
  periodStart?: string;
  periodEnd?: string | null;
  periodMonths?: number | null;
  deadline?: string | null;
  history?: { date: string; value: number; change: number; timestamp: string }[];
  paliers?: { id: string; name: string; threshold: number; reward: number }[];
  fixedReward?: number;
};

export type DemoMember = {
  id: string;
  companyId: string;
  companyName: string;
  company?: string;
  displayName: string;
  email: string;
  role: string;
  contractHours: number;
  baseHours?: number;
  avatar?: string;
  objectives?: number;
  completedObjectives?: number;
  createdAt: string;
  lastLogin?: string | null;
  disabled?: boolean;
  excludeFromPrimes?: boolean;
  pushEnabled?: boolean;
};

export type DemoPrimeHistory = {
  id: string;
  companyId: string;
  month: string;
  date: string; // ISO
  amount: number;
  status: "pending" | "validated" | "paid";
  userId?: string;
};

export type DemoPilotageConfig = {
  companyId: string;
  baseHours: number;
  budgetMax: number;
};

export type DemoState = {
  version: string;
  companyId: string;
  createdAt: string;
  periodStart?: string;
  periodEnd?: string | null;
  periodMonths?: number | null;
  updatedAt: string;
  members: DemoMember[];
  objectives: DemoObjective[];
  primes: DemoPrimeHistory[];
  pilotage: DemoPilotageConfig;
};

// Force demo data to re-seed automatically when the app is redeployed.
// On Vercel, `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` is available in the browser bundle.
// For local dev, fall back to a stable value unless you set NEXT_PUBLIC_DEMO_VERSION.
const DEMO_VERSION = (
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_DEMO_VERSION ??
  "1"
).toString();
const keyFor = (companyId: string) => `pulse_demo_state:${companyId}`;

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function addMonthsIso(iso: string, months: number) {
  const d = new Date(iso)
  const m = Number(months)
  if (!Number.isFinite(m) || m === 0) return d.toISOString()
  d.setMonth(d.getMonth() + m)
  return d.toISOString()
}

export function readDemoState(companyId: string): DemoState | null {
  if (typeof window === "undefined") return null;
  const data = safeParse<DemoState>(window.localStorage.getItem(keyFor(companyId)));
  if (!data) return null;
  if (data.companyId !== companyId) return null;
  if (data.version !== DEMO_VERSION) return null;
  return data;
}

export function writeDemoState(companyId: string, next: DemoState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(companyId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(`pulse_demo_change:${companyId}`));
}

export function clearDemoState(companyId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyFor(companyId));
  window.dispatchEvent(new CustomEvent(`pulse_demo_change:${companyId}`));
}

export function ensureDemoSeed(companyId: string, companyName: string) {
  if (typeof window === "undefined") return;
  const existing = readDemoState(companyId);
  if (existing) return;

  // --- Seed designed to show realistic prime potential (~170€ for 35h) ---
  const createdAt = nowIso();

  const objectives: DemoObjective[] = [
    {
      id: `demo-obj-${companyId}-principal`,
      companyId,
      title: "Objectif principal : CA du mois",
      description: "Débloque les objectifs secondaires une fois atteint.",
      type: "principal",
      direction: "ascending",
      isActive: true,
      current: 56000,
      target: 55000,
      unit: "€",
      createdAt,
      periodStart: createdAt,
      periodMonths: 1,
      periodEnd: addMonthsIso(createdAt, 1),
      history: [
        { date: "2 jan", value: 12000, change: 12000, timestamp: createdAt },
        { date: "9 jan", value: 18000, change: 18000, timestamp: createdAt },
        { date: "16 jan", value: 26000, change: 26000, timestamp: createdAt },
      ],
      paliers: [
        { id: "p1", name: "Palier 1", threshold: 50000, reward: 40 },
        { id: "p2", name: "Palier 2", threshold: 55000, reward: 40 },
      ],
    },
    {
      id: `demo-obj-${companyId}-fc`,
      companyId,
      title: "Food cost",
      description: "Rester sous le seuil sur la semaine.",
      type: "secondaire",
      direction: "descending",
      isActive: true,
      current: 27,
      target: 26,
      unit: "%",
      createdAt,
      periodStart: createdAt,
      periodMonths: 1,
      periodEnd: addMonthsIso(createdAt, 1),
      paliers: [
        { id: "p1", name: "OK", threshold: 27, reward: 10 },
        { id: "p2", name: "Top", threshold: 26, reward: 20 },
      ],
    },
    {
      id: `demo-obj-${companyId}-reviews`,
      companyId,
      title: "Avis clients",
      description: "Atteindre un objectif d'avis positifs.",
      type: "secondaire",
      direction: "ascending",
      isActive: true,
      current: 18,
      target: 20,
      unit: "avis",
      createdAt,
      periodStart: createdAt,
      periodMonths: 2,
      periodEnd: addMonthsIso(createdAt, 2),
      paliers: [
        { id: "p1", name: "Bien", threshold: 15, reward: 15 },
        { id: "p2", name: "Excellent", threshold: 20, reward: 15 },
      ],
    },
    {
      id: `demo-obj-${companyId}-temps`,
      companyId,
      title: "Temps d'attente",
      description: "Réduire le temps moyen de préparation.",
      type: "secondaire",
      direction: "descending",
      isActive: true,
      current: 6.2,
      target: 6,
      unit: "min",
      createdAt,
      periodStart: createdAt,
      periodMonths: null,
      periodEnd: null,
      paliers: [
        { id: "p1", name: "Sous contrôle", threshold: 7, reward: 10 },
        { id: "p2", name: "Optimisé", threshold: 6, reward: 10 },
        { id: "p3", name: "Excellent", threshold: 5.5, reward: 10 },
      ],
    },
  ];

  const members: DemoMember[] = [
    {
      id: `demo-u-${companyId}-1`,
      companyId,
      companyName,
      company: companyName,
      displayName: "Marie Dupont",
      email: "marie.dupont@demo.pulse",
      role: "manager",
      contractHours: 35,
      createdAt,
      lastLogin: createdAt,
      disabled: false,
      excludeFromPrimes: false,
      pushEnabled: true,
    },
    {
      id: `demo-u-${companyId}-2`,
      companyId,
      companyName,
      company: companyName,
      displayName: "Jean Martin",
      email: "jean.martin@demo.pulse",
      role: "employee",
      contractHours: 35,
      createdAt,
      lastLogin: createdAt,
      disabled: false,
      excludeFromPrimes: false,
      pushEnabled: false,
    },
    {
      id: `demo-u-${companyId}-3`,
      companyId,
      companyName,
      company: companyName,
      displayName: "Sofia Bernard",
      email: "sofia.bernard@demo.pulse",
      role: "employee",
      contractHours: 28,
      createdAt,
      lastLogin: null,
      disabled: false,
      excludeFromPrimes: false,
      pushEnabled: true,
    },
    {
      id: `demo-u-${companyId}-4`,
      companyId,
      companyName,
      company: companyName,
      displayName: "Pierre Leroy",
      email: "pierre.leroy@demo.pulse",
      role: "employee",
      contractHours: 20,
      createdAt,
      lastLogin: createdAt,
      disabled: false,
      excludeFromPrimes: true,
      pushEnabled: false,
    },
  ];

  const primes: DemoPrimeHistory[] = [
    {
      id: `demo-prime-${companyId}-jan`,
      companyId,
      month: "Janvier 2026",
      date: nowIso(),
      amount: 0,
      status: "pending",
    },
    {
      id: `demo-prime-${companyId}-dec`,
      companyId,
      month: "Décembre 2025",
      date: new Date("2025-12-31T12:00:00.000Z").toISOString(),
      amount: 145,
      status: "paid",
    },
    {
      id: `demo-prime-${companyId}-nov`,
      companyId,
      month: "Novembre 2025",
      date: new Date("2025-11-30T12:00:00.000Z").toISOString(),
      amount: 120,
      status: "validated",
    },
  ];

  const state: DemoState = {
    version: DEMO_VERSION,
    companyId,
    createdAt,
    updatedAt: createdAt,
    members,
    objectives,
    primes,
    pilotage: { companyId, baseHours: 35, budgetMax: 2000 },
  };

  writeDemoState(companyId, state);
}

export function subscribeDemo(companyId: string, cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const onChange = () => cb();
  const evName = `pulse_demo_change:${companyId}`;
  window.addEventListener(evName as any, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(evName as any, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function withState(companyId: string, fn: (s: DemoState) => DemoState) {
  const curr = readDemoState(companyId);
  if (!curr) return;
  const next = fn({ ...curr, updatedAt: nowIso() });
  writeDemoState(companyId, next);
}

// ---- Convenience helpers for pages/hooks ----

export function demoGetObjectives(companyId: string) {
  return readDemoState(companyId)?.objectives || [];
}

export function demoUpdateObjective(companyId: string, id: string, patch: Partial<DemoObjective>) {
  withState(companyId, (s) => ({
    ...s,
    objectives: s.objectives.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  }));
}

export function demoAddObjective(companyId: string, objective: DemoObjective) {
  withState(companyId, (s) => ({ ...s, objectives: [objective, ...s.objectives] }));
}

export function demoDeleteObjective(companyId: string, id: string) {
  withState(companyId, (s) => ({ ...s, objectives: s.objectives.filter((o) => o.id !== id) }));
}

export function demoGetMembers(companyId: string) {
  return readDemoState(companyId)?.members || [];
}

export function demoUpdateMember(companyId: string, id: string, patch: Partial<DemoMember>) {
  withState(companyId, (s) => ({
    ...s,
    members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  }));
}

export function demoAddMember(companyId: string, member: DemoMember) {
  withState(companyId, (s) => ({ ...s, members: [member, ...s.members] }));
}

export function demoDeleteMember(companyId: string, id: string) {
  withState(companyId, (s) => ({ ...s, members: s.members.filter((m) => m.id !== id) }));
}

export function demoGetPrimes(companyId: string) {
  return readDemoState(companyId)?.primes || [];
}

export function demoUpdatePrime(companyId: string, id: string, patch: Partial<DemoPrimeHistory>) {
  withState(companyId, (s) => ({
    ...s,
    primes: s.primes.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  }));
}

export function demoDeletePrime(companyId: string, id: string) {
  withState(companyId, (s) => ({ ...s, primes: s.primes.filter((p) => p.id !== id) }));
}

export function demoAddPrime(companyId: string, prime: DemoPrimeHistory) {
  withState(companyId, (s) => ({ ...s, primes: [prime, ...s.primes] }));
}

export function demoGetPilotage(companyId: string) {
  return readDemoState(companyId)?.pilotage || null;
}

export function demoSetPilotage(companyId: string, patch: Partial<DemoPilotageConfig>) {
  withState(companyId, (s) => ({ ...s, pilotage: { ...s.pilotage, ...patch } }));
}
