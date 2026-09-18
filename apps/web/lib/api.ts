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

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store', // always get fresh data for live dashboard
  })
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  return res.json()
}

export async function getNationalAggregate(raceId: string): Promise<AggregateResult> {
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

// For now we hardcode or fetch the first available race
// Later we can add a proper races endpoint
export async function getRaces(): Promise<Race[]> {
  // Temporary: return the known race from your seed data
  // You can later add GET /races to the API
  return [
    {
      id: 'cmu5rxtlu0001v8vj5p0cfcix',
      position: 'Member of County Assembly',
    },
  ]
}