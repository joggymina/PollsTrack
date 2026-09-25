import Link from 'next/link'
import { Suspense } from 'react'
import {
  getWardAggregate,
  getWards,
  getConstituencies,
  getCounties,
  getPollingStations,
  getRaces,
} from '@/lib/api'
import { filterRacesForLevel, pickDefaultRaceId } from '@/lib/races'
import { StatsCards } from '@/components/StatsCards'
import { CandidateRanking } from '@/components/CandidateRanking'
import { AutoRefresh } from '@/components/AutoRefresh'
import { RaceSelector } from '@/components/RaceSelector'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ wardId: string }>
  searchParams: Promise<{ raceId?: string }>
}

export default async function WardPage({ params, searchParams }: Props) {
  const { wardId } = await params
  const { raceId: raceIdParam } = await searchParams

  const allRaces = await getRaces()
  // Ward → all races (President through MCA)
  const races = filterRacesForLevel(allRaces, 'ward')
  const raceId = pickDefaultRaceId(allRaces, 'ward', raceIdParam)

  if (!raceId) {
    return (
      <div className="text-center py-20 text-gray-500">
        No race selected
      </div>
    )
  }

  const [aggregate, allWards, allConstituencies, counties, stations] =
    await Promise.all([
      getWardAggregate(wardId, raceId),
      getWards(),
      getConstituencies(),
      getCounties(),
      getPollingStations(wardId),
    ])

  const ward = allWards.find((w) => w.id === wardId)
  const constituency = allConstituencies.find(
    (c) => c.id === ward?.constituencyId
  )
  const county = counties.find((c) => c.id === constituency?.countyId)

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-blue-600 mb-2">
          <Link href={`/?raceId=${raceId}`} className="hover:underline">
            National
          </Link>
          <span className="text-gray-400">→</span>
          {county && (
            <>
              <Link
                href={`/county/${county.id}?raceId=${raceId}`}
                className="hover:underline"
              >
                {county.name}
              </Link>
              <span className="text-gray-400">→</span>
            </>
          )}
          {constituency && (
            <>
              <Link
                href={`/constituency/${constituency.id}?raceId=${raceId}`}
                className="hover:underline"
              >
                {constituency.name}
              </Link>
              <span className="text-gray-400">→</span>
            </>
          )}
          <span className="text-gray-600">{ward?.name || 'Ward'}</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">
          {ward?.name || 'Ward'} Results
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
              Polling Stations
            </h2>
            <p className="text-sm text-gray-500">Click to view details</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
            {stations.length === 0 ? (
              <p className="px-6 py-4 text-sm text-gray-500">
                No polling stations found for this ward.
              </p>
            ) : (
              stations.map((station) => (
                <Link
                  key={station.id}
                  href={`/station/${station.id}?raceId=${raceId}`}
                  className="block px-6 py-3 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">
                      {station.name}
                    </span>
                    <span className="text-sm text-gray-400">{station.code}</span>
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