import Link from 'next/link'
import { Suspense } from 'react'
import { getNationalAggregate, getCounties, getRaces } from '@/lib/api'
import { filterRacesForLevel, pickDefaultRaceId } from '@/lib/races'
import { StatsCards } from '@/components/StatsCards'
import { CandidateRanking } from '@/components/CandidateRanking'
import { AutoRefresh } from '@/components/AutoRefresh'
import { RaceSelector } from '@/components/RaceSelector'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ raceId?: string }>
}

export default async function NationalPage({ searchParams }: Props) {
  const { raceId: raceIdParam } = await searchParams
  const allRaces = await getRaces()

  // National level → President only
  const races = filterRacesForLevel(allRaces, 'national')
  const raceId = pickDefaultRaceId(allRaces, 'national', raceIdParam)

  if (!raceId || races.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        No national races found. Seed a President race first.
      </div>
    )
  }

  const [aggregate, counties] = await Promise.all([
    getNationalAggregate(raceId),
    getCounties(),
  ])

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">National Overview</h2>
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
            <h2 className="text-lg font-semibold text-gray-900">Counties</h2>
            <p className="text-sm text-gray-500">Click to view details</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
            {counties.map((county) => (
              <Link
                key={county.id}
                href={`/county/${county.id}?raceId=${raceId}`}
                className="block px-6 py-3 hover:bg-blue-50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">{county.name}</span>
                  <span className="text-sm text-gray-400">{county.code}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <AutoRefresh intervalSeconds={20} />
    </div>
  )
}