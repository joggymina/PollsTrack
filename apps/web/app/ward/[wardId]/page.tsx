import Link from 'next/link'
import {
  getWardAggregate,
  getWards,
  getConstituencies,
  getCounties,
  getRaces,
} from '@/lib/api'
import { StatsCards } from '@/components/StatsCards'
import { CandidateRanking } from '@/components/CandidateRanking'
import { AutoRefresh } from '@/components/AutoRefresh'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ wardId: string }>
  searchParams: Promise<{ raceId?: string }>
}

export default async function WardPage({ params, searchParams }: Props) {
  const { wardId } = await params
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

  const [aggregate, allWards, allConstituencies, counties] = await Promise.all([
    getWardAggregate(wardId, raceId),
    getWards(),
    getConstituencies(),
    getCounties(),
  ])

  const ward = allWards.find((w) => w.id === wardId)
  const constituency = allConstituencies.find(
    (c) => c.id === ward?.constituencyId
  )
  const county = counties.find((c) => c.id === constituency?.countyId)
  const race = races.find((r) => r.id === raceId) || races[0]

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-blue-600 mb-2">
          <Link href={raceId ? `/?raceId=${raceId}` : '/'} className="hover:underline">
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
        <p className="text-gray-500 mt-1">
          {race?.position || 'Election'} · Live results
        </p>
      </div>

      <StatsCards
        stationsReported={aggregate.stationsReported}
        totalVoted={aggregate.totalVoted}
        totalRejected={aggregate.totalRejected}
      />

      <div className="max-w-2xl">
        <CandidateRanking candidates={aggregate.candidates} />
      </div>

      <AutoRefresh intervalSeconds={20} />
    </div>
  )
}