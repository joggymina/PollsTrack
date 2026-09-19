'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getMe, MeResponse } from '@/lib/api'
import { getToken, getUser, clearAuth, isLoggedIn } from '@/lib/auth'

export default function AgentHomePage() {
  const router = useRouter()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }

    const token = getToken()!
    getMe(token)
      .then(setMe)
      .catch((err) => {
        setError(err.message)
        if (
          err.message.includes('Unauthorized') ||
          err.message.includes('401')
        ) {
          clearAuth()
          router.replace('/login')
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  function handleLogout() {
    clearAuth()
    router.replace('/login')
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
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Hello, {me.name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{me.phone}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          Logout
        </button>
      </div>

      {/* Stations */}
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
          {me.assignedStations.map((station) => (
            <Link
              key={station.id}
              href={`/agent/submit/${station.id}`}
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-blue-300 hover:shadow transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-lg">
                    {station.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {station.code}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {station.ward.name} · {station.ward.constituency.name} ·{' '}
                    {station.ward.constituency.county.name}
                  </p>
                </div>
                <div className="text-blue-600 text-2xl font-light">→</div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-50">
                <span className="inline-block text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                  Submit Results
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-8">
        PollsTrack Agent · {user?.role}
      </p>
    </div>
  )
}