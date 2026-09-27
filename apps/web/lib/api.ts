const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export type CandidateTotal = {
  candidateId: string
  name: string
  code: string | null
  party: string | null
  totalVotes: number
}

export type AggregateResult = {
  level: string
  raceId: string
  stationsReported: number
  totalVoted: number
  totalRejected: number
  candidates: CandidateTotal[]
  countyId?: string
}

export type County = {
  id: string
  code: string
  name: string
}

export type Race = {
  id: string
  position: string
  scope?: string | null
}

export type Candidate = {
  id: string
  name: string
  code: string | null
  party: string | null
  raceId: string
}

export type AssignedStation = {
  id: string
  code: string
  name: string
  registeredVoters: number | null
  ward: {
    id: string
    name: string
    constituency: {
      id: string
      name: string
      county: {
        id: string
        name: string
      }
    }
  }
}

export type MeResponse = {
  id: string
  name: string
  phone: string
  role: string
  isActive: boolean
  organizationId?: string | null
  assignedStations: AssignedStation[]
}

export type StationResultSummary = {
  id: string
  pollingStationId: string
  raceId: string
  status: string
  submittedById?: string
}

export type AdminAgent = {
  id: string
  name: string
  phone: string
  role: string
  isActive: boolean
  createdAt?: string
  stations: { id: string; code: string; name: string }[]
}

export type PollingStationOption = {
  id: string
  code: string
  name: string
}

export type ConstituencyOption = {
  id: string
  code: string
  name: string
  countyId: string
}

export type WardOption = {
  id: string
  code: string
  name: string
  constituencyId: string
}

export type StationResultDetail = {
  id: string
  pollingStationId: string
  raceId: string
  totalRegistered: number | null
  totalVoted: number | null
  rejectedBallots: number | null
  status: string
  clientSubmittedAt: string | null
  serverReceivedAt: string | null
  votes: {
    candidateId: string
    votes: number
    candidate: {
      id: string
      name: string
      code: string | null
      party: string | null
    }
  }[]
  pollingStation: {
    id: string
    code: string
    name: string
  }
  race: {
    id: string
    position: string
  }
}

export type PositionAdminScope = {
  id: string
  level: string
  race: { id: string; position: string; scope: string }
  county: { id: string; name: string; code: string } | null
  constituency: { id: string; name: string; code: string } | null
  ward: { id: string; name: string; code: string } | null
}

export type PositionAdminUser = {
  id: string
  name: string
  phone: string
  role: string
  isActive?: boolean
  positionAdminScopes: PositionAdminScope[]
}

// ---------- Organizations ----------

export type Organization = {
  id: string
  name: string
  slug: string
  primaryLevel: 'NATIONAL' | 'COUNTY' | 'CONSTITUENCY' | 'WARD'
  countyId: string | null
  constituencyId: string | null
  wardId: string | null
  publicViewEnabled?: boolean
  county?: { id: string; name: string; code: string } | null
  constituency?: { id: string; name: string; code: string } | null
  ward?: { id: string; name: string; code: string } | null
}

export type CreateOrgPayload = {
  name: string
  primaryLevel: 'NATIONAL' | 'COUNTY' | 'CONSTITUENCY' | 'WARD'
  countyId?: string | null
  constituencyId?: string | null
  wardId?: string | null
  adminName: string
  adminPhone: string
}

export type PublicOrg = {
  id: string
  name: string
  slug: string
  primaryLevel: string
}

export type PublicSettings = {
  id: string
  name: string
  slug: string
  publicViewEnabled: boolean
  publicShareToken: string | null
  hasShareToken?: boolean
}

/** Optional org + share token for public dashboard API calls */
export type OrgAccessParams = {
  org?: string | null
  k?: string | null
}

function withOrgQuery(
  path: string,
  access?: OrgAccessParams,
  extra?: Record<string, string | undefined>
): string {
  const q = new URLSearchParams()
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value != null && value !== '') q.set(key, value)
    }
  }
  if (access?.org) q.set('org', access.org)
  if (access?.k) q.set('k', access.k)
  const s = q.toString()
  if (!s) return path
  return path.includes('?') ? `${path}&${s}` : `${path}?${s}`
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error || `API error: ${res.status}`
    )
  }
  return res.json()
}

// ---------- Public dashboard helpers ----------

export async function getNationalAggregate(
  raceId: string,
  access?: OrgAccessParams
): Promise<AggregateResult> {
  const path = withOrgQuery('/results/aggregate/national', access, {
    raceId,
  })
  const data = await fetchJson<{ data: AggregateResult }>(path)
  return data.data
}

export async function getCountyAggregate(
  countyId: string,
  raceId: string,
  access?: OrgAccessParams
): Promise<AggregateResult> {
  const path = withOrgQuery(
    `/results/aggregate/county/${countyId}`,
    access,
    { raceId }
  )
  const data = await fetchJson<{ data: AggregateResult }>(path)
  return data.data
}

export async function getConstituencyAggregate(
  constituencyId: string,
  raceId: string,
  access?: OrgAccessParams
): Promise<AggregateResult> {
  const path = withOrgQuery(
    `/results/aggregate/constituency/${constituencyId}`,
    access,
    { raceId }
  )
  const data = await fetchJson<{ data: AggregateResult }>(path)
  return data.data
}

export async function getWardAggregate(
  wardId: string,
  raceId: string,
  access?: OrgAccessParams
): Promise<AggregateResult> {
  const path = withOrgQuery(`/results/aggregate/ward/${wardId}`, access, {
    raceId,
  })
  const data = await fetchJson<{ data: AggregateResult }>(path)
  return data.data
}

export async function getStationResult(
  stationId: string,
  raceId: string,
  access?: OrgAccessParams
): Promise<StationResultDetail | null> {
  try {
    const path = withOrgQuery('/results', access, {
      pollingStationId: stationId,
      raceId,
    })
    const data = await fetchJson<{ data: StationResultDetail[] }>(path)
    return data.data?.[0] || null
  } catch {
    return null
  }
}

export async function getCounties(): Promise<County[]> {
  const data = await fetchJson<{ data: County[] }>('/counties')
  return data.data
}

export async function getConstituencies(
  countyId?: string
): Promise<ConstituencyOption[]> {
  const q = countyId ? `?countyId=${countyId}` : ''
  const data = await fetchJson<{ data: ConstituencyOption[] }>(
    `/constituencies${q}`
  )
  return data.data
}

export async function getWards(
  constituencyId?: string
): Promise<WardOption[]> {
  const q = constituencyId ? `?constituencyId=${constituencyId}` : ''
  const data = await fetchJson<{ data: WardOption[] }>(`/wards${q}`)
  return data.data
}

export async function getPollingStations(
  wardId?: string
): Promise<PollingStationOption[]> {
  const q = wardId ? `?wardId=${wardId}` : ''
  const data = await fetchJson<{ data: PollingStationOption[] }>(
    `/polling-stations${q}`
  )
  return data.data
}

export async function getRaces(access?: OrgAccessParams): Promise<Race[]> {
  try {
    const path = withOrgQuery('/races', access)
    const data = await fetchJson<{ data: Race[] }>(path)
    return data.data
  } catch {
    return []
  }
}

export async function getCandidates(
  raceId: string,
  access?: OrgAccessParams
): Promise<Candidate[]> {
  const path = withOrgQuery(`/races/${raceId}/candidates`, access)
  const data = await fetchJson<{ data: Candidate[] }>(path)
  return data.data
}

export async function getResults(
  access?: OrgAccessParams
): Promise<StationResultSummary[]> {
  const path = withOrgQuery('/results', access)
  const data = await fetchJson<{ data: StationResultSummary[] }>(path)
  return data.data
}

export async function getPublicOrganizations(): Promise<PublicOrg[]> {
  const data = await fetchJson<{ data: PublicOrg[] }>('/organizations/public')
  return data.data
}

// ---------- Auth + Agent helpers ----------

export async function login(phone: string): Promise<{
  token: string
  user: {
    id: string
    name: string
    phone: string
    role: string
    organizationId?: string | null
  }
}> {
  return fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
}

export async function getMe(token: string): Promise<MeResponse> {
  const data = await fetchJson<{ data: MeResponse }>('/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data.data
}

export type SubmitResultsPayload = {
  pollingStationId: string
  raceId: string
  totalRegistered?: number
  totalVoted?: number
  rejectedBallots?: number
  clientSubmittedAt: string
  formPhotoUrl?: string
  votes: { candidateId: string; votes: number }[]
}

export async function submitResults(
  token: string,
  payload: SubmitResultsPayload
) {
  return fetchJson('/results', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
}

// ---------- Organization helpers ----------

export async function createOrganization(body: CreateOrgPayload): Promise<{
  organization: Organization
  user: {
    id: string
    name: string
    phone: string
    role: string
    organizationId: string
  }
  token: string
}> {
  const data = await fetchJson<{
    data: {
      organization: Organization
      user: {
        id: string
        name: string
        phone: string
        role: string
        organizationId: string
      }
      token: string
    }
  }>('/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return data.data
}

export async function getMyOrganization(token: string): Promise<Organization> {
  const data = await fetchJson<{ data: Organization }>('/organizations/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data.data
}

export async function getPublicSettings(
  token: string
): Promise<PublicSettings> {
  const data = await fetchJson<{ data: PublicSettings }>(
    '/organizations/me/public-settings',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return data.data
}

export async function updatePublicSettings(
  token: string,
  body: { publicViewEnabled?: boolean; rotateShareToken?: boolean }
): Promise<PublicSettings> {
  const data = await fetchJson<{ data: PublicSettings }>(
    '/organizations/me/public-settings',
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  )
  return data.data
}

/** Build public dashboard share URL for an org */
export function buildShareUrl(settings: {
  slug: string
  publicShareToken?: string | null
}): string {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_WEB_URL || 'https://pollstrack-web.vercel.app'
  const q = new URLSearchParams()
  q.set('org', settings.slug)
  if (settings.publicShareToken) q.set('k', settings.publicShareToken)
  return `${base}/?${q.toString()}`
}

// ---------- Admin helpers ----------

export async function getAdminAgents(token: string): Promise<AdminAgent[]> {
  const data = await fetchJson<{ data: AdminAgent[] }>('/admin/agents', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data.data
}

export async function createAdminAgent(
  token: string,
  body: { phone: string; name: string; role?: string }
) {
  return fetchJson<{ data: AdminAgent }>('/admin/agents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

export async function assignStation(
  token: string,
  body: { userId: string; pollingStationId: string }
) {
  return fetchJson('/admin/assignments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

export type PollingStationDetail = {
  id: string
  code: string
  name: string
  registeredVoters: number | null
  wardId: string
  ward: {
    id: string
    code: string
    name: string
    constituency: {
      id: string
      code: string
      name: string
      county: {
        id: string
        code: string
        name: string
      }
    }
  }
}

export async function getPollingStation(
  id: string
): Promise<PollingStationDetail | null> {
  try {
    const data = await fetchJson<{ data: PollingStationDetail }>(
      `/polling-stations/${id}`
    )
    return data.data
  } catch {
    return null
  }
}

export async function unassignStation(
  token: string,
  body: { userId: string; pollingStationId: string }
) {
  return fetchJson('/admin/assignments', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

// ---------- Position admin (ops) ----------

export async function createPositionAdmin(
  token: string,
  body: {
    phone: string
    name: string
    raceId: string
    level: string
    countyId?: string | null
    constituencyId?: string | null
    wardId?: string | null
  }
) {
  return fetchJson<{ data: PositionAdminUser }>('/admin/position-admins', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

export async function getPositionAdmins(
  token: string
): Promise<PositionAdminUser[]> {
  const data = await fetchJson<{ data: PositionAdminUser[] }>(
    '/admin/position-admins',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return data.data
}

export async function getOpsMe(token: string): Promise<PositionAdminUser> {
  const data = await fetchJson<{ data: PositionAdminUser }>('/ops/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data.data
}

export async function getOpsResultsSummary(token: string, scopeId: string) {
  return fetchJson<{ data: unknown }>(
    `/ops/results/summary?scopeId=${encodeURIComponent(scopeId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
}

export type OpsAgent = {
  id: string
  name: string
  phone: string
  role: string
  isActive: boolean
  stations: { id: string; code: string; name: string }[]
}

export async function getOpsAgents(token: string): Promise<OpsAgent[]> {
  const data = await fetchJson<{ data: OpsAgent[] }>('/ops/agents', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data.data
}

export async function createOpsAgent(
  token: string,
  body: { phone: string; name: string }
) {
  return fetchJson<{ data: OpsAgent }>('/ops/agents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

export async function assignOpsStation(
  token: string,
  body: { userId: string; pollingStationId: string; scopeId: string }
) {
  return fetchJson('/ops/assignments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

export async function createCandidate(
  token: string,
  body: {
    raceId: string
    name: string
    code?: string
    party?: string
  }
) {
  return fetchJson<{
    data: {
      id: string
      name: string
      code: string | null
      party: string | null
      raceId: string
      isActive: boolean
    }
  }>('/admin/candidates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}