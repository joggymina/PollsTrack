'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getMe, getResults, getRaces, type MeResponse, type Race } from '@/lib/api'
import { getToken, getUser, clearAuth, isLoggedIn } from '@/lib/auth'
import { getPendingCount } from '@/lib/offline-queue'
import { syncOfflineQueue } from '@/lib/sync-offline'

const ME_CACHE_KEY = 'pollstrack_me_cache'

function getCachedMe(): MeResponse | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ME_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MeResponse
  } catch {
    return null
  }
}

function setCachedMe(me: MeResponse) {
  localStorage.setItem(ME_CACHE_KEY, JSON.stringify(me))
}

export default function AgentHomePage() {
  const router = useRouter()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isOfflineCache, setIsOfflineCache] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [races, setRaces] = useState<Race[]>([])
  /** Keys: `${stationId}:${raceId}` */
  const [submittedKeys, setSubmittedKeys] = useState<Set<string>>(new Set())

  function refreshPendingCount() {
    const user = getUser()
    setPendingCount(user ? getPendingCount(user.id) : 0)
  }

  function loadProgress() {
    Promise.all([getRaces(), getResults()])
      .then(([raceList, results]) => {
        setRaces(raceList)
        const keys = new Set<string>()
        for (const r of results) {
          if (r.pollingStationId && r.raceId) {
            keys.add(`${r.pollingStationId}:${r.raceId}`)
          }
        }
        setSubmittedKeys(keys)
      })
      .catch(() => {
        // Page still usable without progress flags
      })
  }

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

    getMe(token)
      .then((meData) => {
        if (cancelled) return
        setMe(meData)
        setCachedMe(meData)
        setIsOfflineCache(false)
        setLoading(false)
        setError('')
        refreshPendingCount()

        if (
          typeof navigator !== 'undefined' &&
          navigator.onLine &&
          getUser() &&
          getPendingCount(getUser()!.id) > 0
        ) {
          syncOfflineQueue().then(({ synced }) => {
            if (cancelled) return
            if (synced > 0) {
              refreshPendingCount()
              setSyncMessage(`${synced} offline result(s) synced`)
              loadProgress()
            }
          })
        }
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err?.message || 'Failed to load'
        const isNetworkError =
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError') ||
          msg.includes('Network request failed') ||
          (typeof navigator !== 'undefined' && !navigator.onLine)

        if (isNetworkError) {
          const cached = getCachedMe()
          if (cached) {
            setMe(cached)
            setIsOfflineCache(true)
            setLoading(false)
            setError('')
            refreshPendingCount()
            return
          }
        }
        if (msg.includes('Unauthorized') || msg.includes('401')) {
          clearAuth()
          localStorage.removeItem(ME_CACHE_KEY)
          router.replace('/login')
          return
        }
        setError(msg)
        setLoading(false)
      })

    loadProgress()

    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    function handleOnline() {
      refreshPendingCount()
      setIsOfflineCache(false)
      const token = getToken()
      if (token) {
        getMe(token)
          .then((meData) => {
            setMe(meData)
            setCachedMe(meData)
          })
          .catch(() => {})
        loadProgress()
      }
      const user = getUser()
      if (user && getPendingCount(user.id) > 0) {
        setSyncing(true)
        syncOfflineQueue().then(({ synced, failed }) => {
          refreshPendingCount()
          setSyncing(false)
          if (synced > 0) {
            setSyncMessage(`${synced} offline result(s) synced successfully`)
            loadProgress()
          }
          if (failed > 0) {
            setSyncMessage((prev) =>
              prev ? `${prev}. ${failed} failed.` : `${failed} failed to sync`
            )
          }
        })
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const totalRaces = races.length

  const progressByStation = useMemo(() => {
    const map = new Map<string, number>()
    if (!me || totalRaces === 0) return map
    for (const s of me.assignedStations) {
      let done = 0
      for (const r of races) {
        if (submittedKeys.has(`${s.id}:${r.id}`)) done++
      }
      map.set(s.id, done)
    }
    return map
  }, [me, races, submittedKeys, totalRaces])

  function handleLogout() {
    clearAuth()
    localStorage.removeItem(ME_CACHE_KEY)
    router.replace('/login')
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMessage('')
    const { synced, failed } = await syncOfflineQueue()
    refreshPendingCount()
    setSyncing(false)
    if (synced > 0) {
      setSyncMessage(`${synced} synced`)
      loadProgress()
    }
    if (failed > 0) {
      setSyncMessage((m) => (m ? `${m}, ${failed} failed` : `${failed} failed`))
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">
        Loading your stations…
      </div>
    )
  }

  if (error && !me) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => router.replace('/login')}
          className="text-blue-600 font-medium"
        >
          Back to login
        </button>
      </div>
    )
  }

  if (!me) return null

  const user = getUser()

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hello, {me.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{me.phone}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          Logout
        </button>
      </div>

      {isOfflineCache && (
        <div className="mb-4 bg-gray-100 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600">
          Showing cached stations · you are offline
        </div>
      )}

      {pendingCount > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-amber-900">
              {pendingCount} result{pendingCount > 1 ? 's' : ''} waiting to sync
            </p>
            <p className="text-sm text-amber-700">
              {typeof navigator !== 'undefined' && navigator.onLine
                ? 'You are online. Tap Sync to upload.'
                : 'You are offline. Results will sync when connection returns.'}
            </p>
          </div>
          <button
            type="button"
            disabled={
              syncing ||
              (typeof navigator !== 'undefined' && !navigator.onLine)
            }
            onClick={handleSync}
            className="shrink-0 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      )}

      {syncMessage && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
          {syncMessage}
        </p>
      )}

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Your Assigned Stations
        </h2>
      </div>

      {me.assignedStations.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-6 text-center">
          <p className="text-yellow-800 font-medium">No stations assigned</p>
          <p className="text-sm text-yellow-600 mt-1">
            Contact your coordinator to get assigned to a polling station.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {me.assignedStations.map((station) => {
            const done = progressByStation.get(station.id) ?? 0
            const allDone = totalRaces > 0 && done >= totalRaces
            return (
              <Link
                key={station.id}
                href={`/agent/station/${station.id}`}
                className={`block bg-white rounded-2xl border shadow-sm p-5 transition-all ${
                  allDone
                    ? 'border-green-200'
                    : 'border-gray-100 hover:border-blue-300 hover:shadow'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-lg truncate">
                      {station.name}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{station.code}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {station.ward.name} · {station.ward.constituency.name} ·{' '}
                      {station.ward.constituency.county.name}
                    </p>
                  </div>
                  <span className="text-blue-600 text-2xl font-light shrink-0">
                    →
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-50">
                  {totalRaces === 0 ? (
                    <span className="text-sm text-gray-500">No races loaded</span>
                  ) : allDone ? (
                    <span className="inline-block text-sm font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                      ✓ All {totalRaces} races submitted
                    </span>
                  ) : (
                    <span className="inline-block text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">
                      {done} of {totalRaces} races done · Open
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-8">
        PollsTrack Agent · {user?.role}
      </p>
    </div>
  )
}