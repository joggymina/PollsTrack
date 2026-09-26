'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getOpsMe, getOpsResultsSummary, type PositionAdminUser } from '@/lib/api'
import { getToken, getUser, isLoggedIn, clearAuth } from '@/lib/auth'

export default function OpsHomePage() {
  const router = useRouter()
  const [me, setMe] = useState<PositionAdminUser | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }
    const role = getUser()?.role
    if (role !== 'POSITION_ADMIN' && role !== 'SUPER_ADMIN') {
      router.replace('/agent')
      return
    }

    const token = getToken()!
    getOpsMe(token)
      .then(async (user) => {
        setMe(user)
        const scope = user.positionAdminScopes?.[0]
        if (scope) {
          const res = await getOpsResultsSummary(token, scope.id)
          setSummary(res.data)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading ops…</div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ops dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {me?.name} · Position admin
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearAuth()
            router.replace('/login')
          }}
          className="text-sm text-gray-500 hover:text-red-600"
        >
          Logout
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {(me?.positionAdminScopes || []).map((s) => (
        <div
          key={s.id}
          className="bg-white rounded-2xl border border-gray-100 p-4"
        >
          <p className="font-semibold text-gray-900">{s.race.position}</p>
          <p className="text-sm text-gray-500">
            {s.level}
            {s.county ? ` · ${s.county.name}` : ''}
            {s.constituency ? ` · ${s.constituency.name}` : ''}
            {s.ward ? ` · ${s.ward.name}` : ''}
          </p>
        </div>
      ))}

      {summary && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">
            Results from your agents
          </h2>
          <p className="text-sm text-gray-500">
            Stations reported: {summary.stationsReported} · Voted:{' '}
            {summary.totalVoted}
          </p>
          <ul className="space-y-2">
            {(summary.candidates || []).map((c: any) => (
              <li
                key={c.candidateId}
                className="flex justify-between text-sm border-b border-gray-50 pb-2"
              >
                <span>
                  {c.name}
                  {c.party ? ` · ${c.party}` : ''}
                </span>
                <span className="font-semibold">{c.totalVotes}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400">
            Full race (all candidates) only where your agents submitted.
          </p>
        </div>
      )}

      <Link
        href="/"
        className="block text-center text-sm text-blue-600 hover:underline"
      >
        Public dashboard
      </Link>
    </div>
  )
}