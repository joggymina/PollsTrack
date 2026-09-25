/**
 * Kenya-style race scopes and which dashboard levels may show them.
 *
 * NATIONAL      → President
 * COUNTY        → Governor, Senator, Woman Rep
 * CONSTITUENCY  → Member of Parliament
 * WARD          → Member of County Assembly
 */

export type RaceScope = 'NATIONAL' | 'COUNTY' | 'CONSTITUENCY' | 'WARD' | string

export type RaceWithScope = {
  id: string
  position: string
  scope?: RaceScope | null
}

export type DashboardLevel =
  | 'national'
  | 'county'
  | 'constituency'
  | 'ward'
  | 'station'

/** Scopes allowed at each dashboard level (higher offices roll down). */
const SCOPES_BY_LEVEL: Record<DashboardLevel, RaceScope[]> = {
  national: ['NATIONAL'],
  county: ['NATIONAL', 'COUNTY'],
  constituency: ['NATIONAL', 'COUNTY', 'CONSTITUENCY'],
  ward: ['NATIONAL', 'COUNTY', 'CONSTITUENCY', 'WARD'],
  station: ['NATIONAL', 'COUNTY', 'CONSTITUENCY', 'WARD'],
}

/** Preferred display order within a level. */
const POSITION_ORDER = [
  'President',
  'Governor',
  'Senator',
  'Woman Representative',
  'Women Representative',
  'Member of Parliament',
  'Member of County Assembly',
]

function normalizeScope(scope?: string | null): string {
  return (scope || '').toUpperCase().trim()
}

/**
 * Infer scope from position name when DB scope is missing/wrong.
 */
export function inferScope(position: string, scope?: string | null): RaceScope {
  const s = normalizeScope(scope)
  if (
    s === 'NATIONAL' ||
    s === 'COUNTY' ||
    s === 'CONSTITUENCY' ||
    s === 'WARD'
  ) {
    return s
  }
  const p = position.toLowerCase()
  if (p.includes('president')) return 'NATIONAL'
  if (
    p.includes('governor') ||
    p.includes('senator') ||
    p.includes('woman rep') ||
    p.includes('women rep')
  ) {
    return 'COUNTY'
  }
  if (p.includes('parliament') || p.includes(' mp') || p === 'mp') {
    return 'CONSTITUENCY'
  }
  if (p.includes('county assembly') || p.includes('mca')) {
    return 'WARD'
  }
  return s || 'WARD'
}

function sortRaces(races: RaceWithScope[]): RaceWithScope[] {
  return [...races].sort((a, b) => {
    const ai = POSITION_ORDER.findIndex(
      (p) => a.position.toLowerCase() === p.toLowerCase()
    )
    const bi = POSITION_ORDER.findIndex(
      (p) => b.position.toLowerCase() === p.toLowerCase()
    )
    const ao = ai === -1 ? 999 : ai
    const bo = bi === -1 ? 999 : bi
    if (ao !== bo) return ao - bo
    return a.position.localeCompare(b.position)
  })
}

/**
 * Filter races for a dashboard level.
 * National → President only
 * County → President + county races
 * Constituency → + MP
 * Ward / Station → all
 */
export function filterRacesForLevel(
  races: RaceWithScope[],
  level: DashboardLevel
): RaceWithScope[] {
  const allowed = new Set(
    SCOPES_BY_LEVEL[level].map((s) => s.toUpperCase())
  )

  const filtered = races.filter((r) => {
    const scope = inferScope(r.position, r.scope)
    return allowed.has(scope)
  })

  return sortRaces(filtered)
}

/**
 * Pick default race for a level:
 * - national → President
 * - otherwise → first in ordered filtered list (or keep raceId if still valid)
 */
export function pickDefaultRaceId(
  races: RaceWithScope[],
  level: DashboardLevel,
  preferredRaceId?: string | null
): string | undefined {
  const filtered = filterRacesForLevel(races, level)
  if (filtered.length === 0) return undefined

  if (preferredRaceId && filtered.some((r) => r.id === preferredRaceId)) {
    return preferredRaceId
  }

  if (level === 'national') {
    const president = filtered.find(
      (r) =>
        inferScope(r.position, r.scope) === 'NATIONAL' ||
        r.position.toLowerCase().includes('president')
    )
    if (president) return president.id
  }

  return filtered[0]?.id
}