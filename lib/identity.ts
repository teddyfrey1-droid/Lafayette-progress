export type CanonicalRole =
  | "super_admin"
  | "admin"
  | "gerant"
  | "directeur"
  | "manager"
  | "assistant_manager"
  | "employe"
  | string;

// Strict hierarchy for anti-escalation (highest first)
export const ROLE_HIERARCHY: CanonicalRole[] = [
  "super_admin",
  "admin",
  "gerant",
  "directeur",
  "manager",
  "assistant_manager",
  "employe",
];

export function normalizeRole(input: unknown): CanonicalRole {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!raw) return "employe";

  // Common legacy / typo variants
  const map: Record<string, CanonicalRole> = {
    employee: "employe",
    employe: "employe",
    "employé": "employe",
    staff: "employe",
    user: "employe",

    manager: "manager",
    "assistant-manager": "assistant_manager",
    assistantmanager: "assistant_manager",
    assistant_manager: "assistant_manager",
    "assistant manager": "assistant_manager",

    directeur: "directeur",
    director: "directeur",

    gerant: "gerant",
    "gérant": "gerant",

    admin: "admin",
    superadmin: "super_admin",
    "super-admin": "super_admin",
    super_admin: "super_admin",
    "super admin": "super_admin",
  };

  return map[raw] ?? raw;
}

export function roleRank(role: CanonicalRole): number {
  const r = normalizeRole(role);
  const idx = ROLE_HIERARCHY.indexOf(r);
  // Unknown roles are treated as lowest privilege.
  return idx === -1 ? ROLE_HIERARCHY.length : idx;
}

export function isAtLeast(role: CanonicalRole, minimum: CanonicalRole): boolean {
  return roleRank(role) <= roleRank(minimum);
}

export function clampContractHours(input: unknown, baseHours = 35): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return baseHours;
  // Contract hours must never exceed baseHours.
  return Math.max(0, Math.min(baseHours, Math.round(n)));
}

export function prorataRatio(contractHours: number, baseHours = 35): number {
  if (!baseHours || baseHours <= 0) return 0;
  const safe = clampContractHours(contractHours, baseHours);
  return Math.max(0, Math.min(1, safe / baseHours));
}
