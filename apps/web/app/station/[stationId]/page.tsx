import Link from 'next/link'
import {
  getStationResult,
  getPollingStations,
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
  params: Promise<{ stationId: string }>
  searchParams: Promise<{ raceId?: string }>
}

export default async function StationPage({ params, searchParams }: Props) {
  const { stationId } = await params
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

  const [result, allStations, allWards, allConstituencies, counties] =
    await Promise.all([
      getStationResult(stationId, raceId),
      getPollingStations(),
      getWards(),
      getConstituencies(),
      getCounties(),
    ])

  const station = allStations.find((s) => s.id === stationId)
  // We may not have wardId on the list type – result has pollingStation name
  const race = races.find((r) => r.id === raceId) || races[0]

  const candidates =
    result?.votes
      .map((v) => ({
        candidateId: v.candidate.id,
        name: v.candidate.name,
        code: v.candidate.code,
        party: v.candidate.party,
        totalVotes: v.votes,
      }))
      .sort((a, b) => b.totalVotes - a.totalVotes) || []

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-blue-600 mb-2">
          <Link href={raceId ? `/?raceId=${raceId}` : '/'} className="hover:underline">
            National
          </Link>
          <span className="text-gray-400">→</span>
          <span className="text-gray-600">
            {result?.pollingStation?.name || station?.name || 'Polling Station'}
          </span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">
          {result?.pollingStation?.name || station?.name || 'Polling Station'} Results
        </h2>
        <p className="text-gray-500 mt-1">
          {race?.position || 'Election'} · Station-level results
        </p>
      </div>

      {!result ? (
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-8 text-center">
          <p className="text-yellow-800 font-medium">No results submitted yet</p>
          <p className="text-sm text-yellow-600 mt-1">
            This polling station has not submitted results for this race.
          </p>
        </div>
      ) : (
        <>
          <StatsCards
            stationsReported={1}
            totalVoted={result.totalVoted ?? 0}
            totalRejected={result.rejectedBallots ?? 0}
          />

          <div className="max-w-2xl">
            <CandidateRanking candidates={candidates} />
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Status: <span className="font-medium">{result.status}</span>
            {result.serverReceivedAt && (
              <> · Received {new Date(result.serverReceivedAt).toLocaleString()}</>
            )}
          </p>
        </>
      )}

      <AutoRefresh intervalSeconds={20} />
    </div>
  )
}