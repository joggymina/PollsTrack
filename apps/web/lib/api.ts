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
  assignedStations: AssignedStation[]
}

export type StationResultSummary = {
  id: string
  pollingStationId: string
  raceId: string
  status: string
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

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `API error: ${res.status}`)
  }
  return res.json()
}

// ---------- Public dashboard helpers ----------

export async function getNationalAggregate(
  raceId: string
): Promise<AggregateResult> {
  const data = await fetchJson<{ data: AggregateResult }>(
    `/results/aggregate/national?raceId=${raceId}`
  )
  return data.data
}

export async function getCountyAggregate(
  countyId: string,
  raceId: string
): Promise<AggregateResult> {
  const data = await fetchJson<{ data: AggregateResult }>(
    `/results/aggregate/county/${countyId}?raceId=${raceId}`
  )
  return data.data
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

export async function getRaces(): Promise<Race[]> {
  try {
    const data = await fetchJson<{ data: Race[] }>('/races')
    return data.data
  } catch {
    return [
      {
        id: 'cmu5rxtlu0001v8vj5p0cfcix',
        position: 'Member of County Assembly',
      },
    ]
  }
}

export async function getCandidates(raceId: string): Promise<Candidate[]> {
  const data = await fetchJson<{ data: Candidate[] }>(
    `/races/${raceId}/candidates`
  )
  return data.data
}

export async function getResults(): Promise<StationResultSummary[]> {
  const data = await fetchJson<{ data: StationResultSummary[] }>('/results')
  return data.data
}

// ---------- Auth + Agent helpers ----------

export async function login(
  phone: string
): Promise<{
  token: string
  user: { id: string; name: string; phone: string; role: string }
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