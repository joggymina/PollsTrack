'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getOpsMe,
  getOpsResultsSummary,
  getOpsAgents,
  createOpsAgent,
  assignOpsStation,
  getPollingStations,
  type PositionAdminUser,
  type PositionAdminScope,
  type OpsAgent,
  type PollingStationOption,
} from '@/lib/api'
import { getToken, getUser, isLoggedIn, clearAuth } from '@/lib/auth'

const inputClass =
  'w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500'

type Tab = 'overview' | 'agents'

export default function OpsHomePage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [me, setMe] = useState<PositionAdminUser | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [agents, setAgents] = useState<OpsAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Create agent
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [creating, setCreating] = useState(false)

  // Assign
  const [scopeId, setScopeId] = useState('')
  const [assignUserId, setAssignUserId] = useState('')
  const [stations, setStations] = useState<PollingStationOption[]>([])
  const [stationId, setStationId] = useState('')
  const [stationsLoading, setStationsLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const token = () => getToken()!

  async function refreshAll(user?: PositionAdminUser) {
    const t = token()
    const u = user || (await getOpsMe(t))
    setMe(u)
    const scopes = u.positionAdminScopes || []
    if (!scopeId && scopes[0]) setScopeId(scopes[0].id)

    const activeScopeId = scopeId || scopes[0]?.id
    if (activeScopeId) {
      const res = await getOpsResultsSummary(t, activeScopeId)
      setSummary(res.data)
    }

    const list = await getOpsAgents(t)
    setAgents(list)
  }

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

    refreshAll()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [router])

  // Load stations only for WARD scope (or when scope has wardId)
  useEffect(() => {
    if (!scopeId || !me) return
    const scope = me.positionAdminScopes.find((s) => s.id === scopeId)
    if (!scope) return

    setStationId('')
    setStations([])

    // Prefer ward-level list; national/county would be huge — require ward for assign UI
    if (scope.level === 'WARD' && scope.ward?.id) {
      setStationsLoading(true)
      getPollingStations(scope.ward.id)
        .then(setStations)
        .catch((e) => setError(e.message))
        .finally(() => setStationsLoading(false))
    } else if (scope.level === 'CONSTITUENCY') {
      setError(
        'Assign UI currently lists stations for WARD scopes. Use a ward-level scope, or we can extend cascade next.'
      )
    }
  }, [scopeId, me])

  async function handleCreateAgent(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    const cleaned = phone.replace(/\D/g, '')
    if (!/^2547\d{8}$/.test(cleaned)) {
      setError('Phone must be 2547XXXXXXXX')
      return
    }
    setCreating(true)
    try {
      await createOpsAgent(token(), { name: name.trim(), phone: cleaned })
      setName('')
      setPhone('')
      setMessage('Agent created — now assign a station')
      await refreshAll()
    } catch (err: any) {
      setError(err.message || 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  async function handleAssign(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!assignUserId || !stationId || !scopeId) {
      setError('Select agent, scope and station')
      return
    }
    setAssigning(true)
    try {
      await assignOpsStation(token(), {
        userId: assignUserId,
        pollingStationId: stationId,
        scopeId,
      })
      setMessage('Station assigned')
      setStationId('')
      await refreshAll()
    } catch (err: any) {
      setError(err.message || 'Assign failed')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading ops…</div>
    )
  }

  const scopes: PositionAdminScope[] = me?.positionAdminScopes || []

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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('overview')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium ${
            tab === 'overview'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-700'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab('agents')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium ${
            tab === 'agents'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-700'
          }`}
        >
          Agents
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">
          {message}
        </div>
      )}

      {tab === 'overview' && (
        <>
          {scopes.map((s) => (
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
        </>
      )}

      {tab === 'agents' && (
        <>
          <form
            onSubmit={handleCreateAgent}
            className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3"
          >
            <h2 className="font-semibold text-gray-900">Create agent</h2>
            <input
              className={inputClass}
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className={inputClass}
              type="tel"
              inputMode="numeric"
              placeholder="2547XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              required
            />
            <button
              type="submit"
              disabled={creating || phone.length < 12}
              className="w-full py-3 font-semibold text-white bg-blue-600 rounded-xl disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create agent'}
            </button>
          </form>

          <form
            onSubmit={handleAssign}
            className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3"
          >
            <h2 className="font-semibold text-gray-900">Assign station</h2>

            {scopes.length > 1 && (
              <div>
                <label className="text-xs text-gray-500">Scope</label>
                <select
                  className={inputClass}
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                >
                  {scopes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.race.position} · {s.level}
                      {s.ward ? ` · ${s.ward.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500">Agent</label>
              <select
                className={inputClass}
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                required
              >
                <option value="">Select agent…</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.phone})
                  </option>
                ))}
              </select>
              {agents.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Create an agent first (they appear here after first assign, or
                  create then assign in one flow).
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Station (in your scope only)
              </label>
              <select
                className={inputClass}
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                required
                disabled={stationsLoading || stations.length === 0}
              >
                <option value="">
                  {stationsLoading
                    ? 'Loading…'
                    : stations.length === 0
                      ? 'No stations in this scope'
                      : 'Select station…'}
                </option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={assigning || !assignUserId || !stationId}
              className="w-full py-3 font-semibold text-white bg-blue-600 rounded-xl disabled:opacity-50"
            >
              {assigning ? 'Assigning…' : 'Assign station'}
            </button>
          </form>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Your agents ({agents.length})
            </h2>
            {agents.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-2xl border border-gray-100 p-4"
              >
                <p className="font-semibold text-gray-900">{a.name}</p>
                <p className="text-sm text-gray-500">{a.phone}</p>
                {a.stations.length > 0 && (
                  <ul className="mt-2 text-sm text-gray-700 space-y-0.5">
                    {a.stations.map((s) => (
                      <li key={s.id}>
                        {s.name}{' '}
                        <span className="text-gray-400">({s.code})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
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