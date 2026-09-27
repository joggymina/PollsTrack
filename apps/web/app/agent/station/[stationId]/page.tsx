'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  getMe,
  getRaces,
  getResults,
  type AssignedStation,
  type Race,
} from '@/lib/api'
import { getToken, clearAuth, isLoggedIn } from '@/lib/auth'

export default function StationRacesPage() {
  const router = useRouter()
  const params = useParams()
  const stationId = params.stationId as string

  const [station, setStation] = useState<AssignedStation | null>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [submittedRaceIds, setSubmittedRaceIds] = useState<Set<string>>(
    new Set()
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }
    const token = getToken()
    if (!token) {
      clearAuth()
      router.replace('/login')
      return
    }

    let cancelled = false

    async function load() {
      try {
        const [me, raceList, results] = await Promise.all([
          getMe(token!),
          getRaces(),
          getResults().catch(() => []),
        ])
        if (cancelled) return

        const found = me.assignedStations.find((s) => s.id === stationId)
        if (!found) {
          setError('You are not assigned to this station')
          setLoading(false)
          return
        }

        setStation(found)
        setRaces(raceList)

        const submitted = new Set<string>()
        for (const r of results) {
          if (r.pollingStationId === stationId && r.raceId) {
            submitted.add(r.raceId)
          }
        }
        setSubmittedRaceIds(submitted)
      } catch (err: any) {
        if (cancelled) return
        const msg = err?.message || 'Failed to load'
        if (msg.includes('Unauthorized') || msg.includes('401')) {
          clearAuth()
          router.replace('/login')
          return
        }
        setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [stationId, router])

  const doneCount = useMemo(() => {
    return races.filter((r) => submittedRaceIds.has(r.id)).length
  }, [races, submittedRaceIds])

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading races…</div>
    )
  }

  if (error || !station) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error || 'Station not found'}</p>
        <Link href="/agent" className="text-blue-600 font-medium">
          Back to stations
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <Link
          href="/agent"
          className="text-sm text-blue-600 hover:underline mb-2 inline-block"
        >
          ← Back to stations
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{station.name}</h1>
        <p className="text-sm text-gray-500">
          {station.code} · {station.ward.name}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {doneCount} of {races.length} races submitted
        </p>
      </div>

      {races.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-6 text-center">
          <p className="text-yellow-800 font-medium">No races found</p>
          <p className="text-sm text-yellow-600 mt-1">
            Ask your admin to seed election races.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {races.map((race) => {
            const submitted = submittedRaceIds.has(race.id)
            if (submitted) {
              return (
                <div
                  key={race.id}
                  className="bg-white rounded-2xl border border-green-200 p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {race.position}
                    </p>
                    {race.scope && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {race.scope}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                    ✓ Submitted
                  </span>
                </div>
              )
            }
            return (
              <Link
                key={race.id}
                href={`/agent/submit/${stationId}?raceId=${race.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-4 hover:border-blue-300 hover:shadow-sm transition-all flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-gray-900">{race.position}</p>
                  {race.scope && (
                    <p className="text-xs text-gray-400 mt-0.5">{race.scope}</p>
                  )}
                </div>
                <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                  Submit →
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}