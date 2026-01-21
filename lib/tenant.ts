export type TenantKey = string | null

export function getTenantKey(profile: any): TenantKey {
  if (!profile) return null
  return (profile.companyId || profile.company || profile.companyKey || null) as TenantKey
}

export function tenantMatches(docData: any, tenantKey: TenantKey): boolean {
  if (!tenantKey) return true
  if (!docData) return false

  const candidates = [
    docData.companyId,
    docData.company,
    docData.companyKey,
    docData.companyName,
  ].filter(Boolean)

  if (candidates.length === 0) return true // legacy docs without tenant fields
  return candidates.map((x: any) => String(x)).includes(String(tenantKey))
}
