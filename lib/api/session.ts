import { adminAuth, adminDb } from "@/lib/firebase/admin"
import { normalizeRole, CanonicalRole, isAtLeast, roleRank } from "@/lib/identity"

export interface SessionUser {
  uid: string
  email?: string
  role: CanonicalRole
  companyId?: string | null
  companyName?: string | null
}

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization")
  if (!authHeader) return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  try {
    const decoded = await adminAuth.verifyIdToken(match[1])
    const uid = decoded.uid
    const snap = await adminDb.collection("users").doc(uid).get()
    const data = snap.exists ? (snap.data() as any) : {}

    return {
      uid,
      email: decoded.email || data?.email,
      role: normalizeRole(data?.role),
      companyId: (data?.companyId || data?.company || null) as any,
      companyName: (data?.companyName || data?.company || null) as any,
    }
  } catch {
    return null
  }
}

export function requireSession(session: SessionUser | null): SessionUser {
  if (!session) throw new Error("AUTH_REQUIRED")
  return session
}

export function requireAtLeast(session: SessionUser, minimum: CanonicalRole): void {
  if (!isAtLeast(session.role, minimum)) throw new Error("FORBIDDEN")
}

// Prevent privilege escalation: requester cannot assign a role above their own, and only admin+ can assign admin/super_admin.
export function assertCanAssignRole(requesterRole: CanonicalRole, desiredRole: CanonicalRole): void {
  const req = normalizeRole(requesterRole)
  const desired = normalizeRole(desiredRole)

  if (["super_admin", "admin"].includes(desired) && !["super_admin", "admin"].includes(req)) {
    throw new Error("FORBIDDEN_ROLE_ASSIGN")
  }

  // Lower rank number = higher privilege
  if (roleRank(desired) < roleRank(req)) {
    throw new Error("FORBIDDEN_ROLE_ASSIGN")
  }
}
