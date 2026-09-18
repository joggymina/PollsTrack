import Link from 'next/link'
import { getCountyAggregate, getCounties, getRaces } from '@/lib/api'
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

  const [aggregate, counties] = await Promise.all([
    getCountyAggregate(countyId, raceId),
    getCounties(),
  ])

  const county = counties.find((c) => c.id === countyId)

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline mb-2 inline-block"
        >
          ← Back to National
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">
          {county?.name || 'County'} Results
        </h2>
        <p className="text-gray-500 mt-1">
          {races[0]?.position} · Live results
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