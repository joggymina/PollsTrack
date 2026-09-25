import Link from 'next/link'
import { Suspense } from 'react'
import {
  getStationResult,
  getPollingStation,
  getRaces,
} from '@/lib/api'
import { filterRacesForLevel, pickDefaultRaceId } from '@/lib/races'
import { StatsCards } from '@/components/StatsCards'
import { CandidateRanking } from '@/components/CandidateRanking'
import { AutoRefresh } from '@/components/AutoRefresh'
import { RaceSelector } from '@/components/RaceSelector'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ stationId: string }>
  searchParams: Promise<{ raceId?: string }>
}

export default async function StationPage({ params, searchParams }: Props) {
  const { stationId } = await params
  const { raceId: raceIdParam } = await searchParams

  const allRaces = await getRaces()
  const races = filterRacesForLevel(allRaces, 'station')
  const raceId = pickDefaultRaceId(allRaces, 'station', raceIdParam)

  if (!raceId) {
    return (
      <div className="text-center py-20 text-gray-500">
        No race selected
      </div>
    )
  }

  const [result, station] = await Promise.all([
    getStationResult(stationId, raceId),
    getPollingStation(stationId),
  ])

  const ward = station?.ward
  const constituency = ward?.constituency
  const county = constituency?.county
  const stationName =
    result?.pollingStation?.name || station?.name || 'Polling Station'

  const candidates =
    result?.votes
      ?.map((v) => ({
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
        {/* Full breadcrumb – same style as ward/constituency pages */}
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

          {ward && (
            <>
              <Link
                href={`/ward/${ward.id}?raceId=${raceId}`}
                className="hover:underline"
              >
                {ward.name}
              </Link>
              <span className="text-gray-400">→</span>
            </>
          )}

          <span className="text-gray-600">{stationName}</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">
          {stationName} Results
        </h2>
        <Suspense fallback={<p className="text-gray-500 mt-1">Loading…</p>}>
          <RaceSelector races={races} currentRaceId={raceId} />
        </Suspense>
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
              <>
                {' '}
                · Received{' '}
                {new Date(result.serverReceivedAt).toLocaleString()}
              </>
            )}
          </p>
        </>
      )}

      <AutoRefresh intervalSeconds={20} />
    </div>
  )
}