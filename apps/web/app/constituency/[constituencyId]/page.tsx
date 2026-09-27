import Link from 'next/link'
import { Suspense } from 'react'
import {
  getConstituencyAggregate,
  getConstituencies,
  getWards,
  getCounties,
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
  params: Promise<{ constituencyId: string }>
  searchParams: Promise<{ raceId?: string; org?: string; k?: string }>
}

export default async function ConstituencyPage({ params, searchParams }: Props) {
  const { constituencyId } = await params
  const sp = await searchParams
  const access: OrgAccessParams = {
    org: sp.org ?? null,
    k: sp.k ?? null,
  }

  const allRaces = await getRaces(access)
  // Constituency → President + Governor + Senator + Woman Rep + MP
  const races = filterRacesForLevel(allRaces, 'constituency')
  const raceId = pickDefaultRaceId(allRaces, 'constituency', sp.raceId)

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

  const [aggregate, allConstituencies, wards, counties] = await Promise.all([
    getConstituencyAggregate(constituencyId, raceId, access),
    getConstituencies(),
    getWards(constituencyId),
    getCounties(),
  ])

  const constituency = allConstituencies.find((c) => c.id === constituencyId)
  const county = counties.find((c) => c.id === constituency?.countyId)

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
          {county && (
            <>
              <Link
                href={`/county/${county.id}?raceId=${raceId}${orgSuffix}`}
                className="hover:underline"
              >
                {county.name}
              </Link>
              <span className="text-gray-400">→</span>
            </>
          )}
          <span className="text-gray-600">
            {constituency?.name || 'Constituency'}
          </span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">
          {constituency?.name || 'Constituency'} Results
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
            <h2 className="text-lg font-semibold text-gray-900">Wards</h2>
            <p className="text-sm text-gray-500">Click to view details</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
            {wards.length === 0 ? (
              <p className="px-6 py-4 text-sm text-gray-500">
                No wards found for this constituency.
              </p>
            ) : (
              wards.map((ward) => (
                <Link
                  key={ward.id}
                  href={`/ward/${ward.id}?raceId=${raceId}${orgSuffix}`}
                  className="block px-6 py-3 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{ward.name}</span>
                    <span className="text-sm text-gray-400">{ward.code}</span>
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