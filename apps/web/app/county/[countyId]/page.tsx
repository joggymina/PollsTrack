import Link from 'next/link'
import {
  getCountyAggregate,
  getCounties,
  getConstituencies,
  getRaces,
} from '@/lib/api'
import { StatsCards } from '@/components/StatsCards'
import { CandidateRanking } from '@/components/CandidateRanking'
import { AutoRefresh } from '@/components/AutoRefresh'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ countyId: string }>
  searchParams: Promise<{ raceId?: string }>
}

export default async function CountyPage({ params, searchParams }: Props) {
  const { countyId } = await params
  const { raceId: raceIdParam } = await searchParams

  const races = await getRaces()
  const raceId = raceIdParam || races[0]?.id

  if (!raceId) {
    return (
      <div className="text-center py-20 text-gray-500">
        No race selected
      </div>
    )
  }

  const [aggregate, counties, constituencies] = await Promise.all([
    getCountyAggregate(countyId, raceId),
    getCounties(),
    getConstituencies(countyId),
  ])

  const county = counties.find((c) => c.id === countyId)
  const race = races.find((r) => r.id === raceId) || races[0]

  return (
    <div>
      <div className="mb-6">
        <Link
          href={raceId ? `/?raceId=${raceId}` : '/'}
          className="text-sm text-blue-600 hover:underline mb-2 inline-block"
        >
          ← Back to National
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">
          {county?.name || 'County'} Results
        </h2>
        <p className="text-gray-500 mt-1">
          {race?.position || 'Election'} · Live results
        </p>
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
                  href={`/constituency/${constituency.id}?raceId=${raceId}`}
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