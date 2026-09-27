import Link from 'next/link'
import { Suspense } from 'react'
import {
  getCountyAggregate,
  getCounties,
  getConstituencies,
  getRaces,
  type OrgAccessParams,
} from '@/lib/api'
import { filterRacesForLevel, pickDefaultRaceId } from '@/lib/races'
import { StatsCards } from '@/components/StatsCards'
import { CandidateRanking } from '@/components/CandidateRanking'
import { AutoRefresh } from '@/components/AutoRefresh'
import { RaceSelector } from '@/components/RaceSelector'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ countyId: string }>
  searchParams: Promise<{ raceId?: string; org?: string; k?: string }>
}

export default async function CountyPage({ params, searchParams }: Props) {
  const { countyId } = await params
  const sp = await searchParams
  const access: OrgAccessParams = {
    org: sp.org ?? null,
    k: sp.k ?? null,
  }

  const allRaces = await getRaces(access)
  // County level → President + Governor + Senator + Woman Rep
  const races = filterRacesForLevel(allRaces, 'county')
  const raceId = pickDefaultRaceId(allRaces, 'county', sp.raceId)

  if (!raceId) {
    return (
      <div className="text-center py-20 text-gray-500 space-y-2">
        <p>No race selected</p>
        {!access.org && (
          <p className="text-sm">
            Open this page with an organization share link.
          </p>
        )}
      </div>
    )
  }

  const [aggregate, counties, constituencies] = await Promise.all([
    getCountyAggregate(countyId, raceId, access),
    getCounties(),
    getConstituencies(countyId),
  ])

  const county = counties.find((c) => c.id === countyId)

  const orgQs = new URLSearchParams()
  if (access.org) orgQs.set('org', access.org)
  if (access.k) orgQs.set('k', access.k)
  const orgSuffix = orgQs.toString() ? `&${orgQs.toString()}` : ''

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-blue-600 mb-2">
          <Link
            href={`/?raceId=${raceId}${orgSuffix}`}
            className="hover:underline"
          >
            National
          </Link>
          <span className="text-gray-400">→</span>
          <span className="text-gray-600">{county?.name || 'County'}</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          {county?.name || 'County'} Results
        </h2>
        <Suspense fallback={<p className="text-gray-500 mt-1">Loading…</p>}>
          <RaceSelector races={races} currentRaceId={raceId} />
        </Suspense>
      </div>

      <StatsCards
        stationsReported={aggregate.stationsReported}
        totalVoted={aggregate.totalVoted}
        totalRejected={aggregate.totalRejected}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CandidateRanking candidates={aggregate.candidates} />
        </div>
        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              Constituencies
            </h2>
            <p className="text-sm text-gray-500">Click to view details</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
            {constituencies.length === 0 ? (
              <p className="px-6 py-4 text-sm text-gray-500">
                No constituencies found for this county.
              </p>
            ) : (
              constituencies.map((constituency) => (
                <Link
                  key={constituency.id}
                  href={`/constituency/${constituency.id}?raceId=${raceId}${orgSuffix}`}
                  className="block px-6 py-3 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">
                      {constituency.name}
                    </span>
                    <span className="text-sm text-gray-400">
                      {constituency.code}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <AutoRefresh intervalSeconds={20} />
    </div>
  )
}