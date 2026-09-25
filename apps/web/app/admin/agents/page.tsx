'use client'

import { useEffect, useMemo, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getAdminAgents,
  createAdminAgent,
  assignStation,
  unassignStation,
  getPollingStations,
  type AdminAgent,
  type PollingStationOption,
} from '@/lib/api'
import { getToken, getUser, isLoggedIn, clearAuth } from '@/lib/auth'

export default function AdminAgentsPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<AdminAgent[]>([])
  const [stations, setStations] = useState<PollingStationOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Search / filter
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
  const [stationSearch, setStationSearch] = useState('')

  // Create agent
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [creating, setCreating] = useState(false)

  // Assign
  const [assignUserId, setAssignUserId] = useState('')
  const [assignStationId, setAssignStationId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [unassigningKey, setUnassigningKey] = useState<string | null>(null)

  async function load() {
    const token = getToken()!
    const [agentList, stationList] = await Promise.all([
      getAdminAgents(token),
      getPollingStations().catch(() => [] as PollingStationOption[]),
    ])
    setAgents(agentList)
    setStations(stationList)
  }

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }
    if (getUser()?.role !== 'SUPER_ADMIN') {
      router.replace('/agent')
      return
    }

    load()
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [router])

  // stationId → list of agents already on it
  const stationAssignees = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>()
    for (const a of agents) {
      for (const s of a.stations || []) {
        const list = map.get(s.id) || []
        list.push({ id: a.id, name: a.name })
        map.set(s.id, list)
      }
    }
    return map
  }, [agents])

  const selectedAssignees = assignStationId
    ? stationAssignees.get(assignStationId) || []
    : []

  const filteredStations = useMemo(() => {
    const q = stationSearch.trim().toLowerCase()
    if (!q) return stations
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
    )
  }, [stations, stationSearch])

  const filteredAgents = useMemo(() => {
    let list = agents
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.phone.includes(q)
      )
    }
    if (filter === 'assigned') {
      list = list.filter((a) => (a.stations?.length || 0) > 0)
    }
    if (filter === 'unassigned') {
      list = list.filter(
        (a) => a.role === 'AGENT' && (a.stations?.length || 0) === 0
      )
    }
    return list
  }, [agents, search, filter])

  const assignedCount = agents.filter((a) => (a.stations?.length || 0) > 0).length
  const unassignedCount = agents.filter(
    (a) => a.role === 'AGENT' && (a.stations?.length || 0) === 0
  ).length

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    const cleaned = phone.replace(/\D/g, '')
    if (!/^2547\d{8}$/.test(cleaned)) {
      setError('Phone must be Kenyan format: 2547XXXXXXXX (12 digits)')
      return
    }
    setCreating(true)
    try {
      const token = getToken()!
      await createAdminAgent(token, {
        name: name.trim(),
        phone: cleaned,
        role: 'AGENT',
      })
      setName('')
      setPhone('')
      setMessage('Agent created')
      await load()
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
    if (!assignUserId || !assignStationId) return

    const agent = agents.find((a) => a.id === assignUserId)
    const station = stations.find((s) => s.id === assignStationId)
    const others = selectedAssignees.filter((x) => x.id !== assignUserId)

    let confirmMsg = `Assign "${station?.name || 'station'}" to ${agent?.name || 'agent'}?`
    if (others.length > 0) {
      confirmMsg += `\n\nAlready assigned to: ${others.map((o) => o.name).join(', ')}`
    }
    if (!window.confirm(confirmMsg)) return

    setAssigning(true)
    try {
      const token = getToken()!
      await assignStation(token, {
        userId: assignUserId,
        pollingStationId: assignStationId,
      })
      setAssignUserId('')
      setAssignStationId('')
      setStationSearch('')
      setMessage('Station assigned')
      await load()
    } catch (err: any) {
      setError(err.message || 'Assign failed')
    } finally {
      setAssigning(false)
    }
  }

  async function handleUnassign(
    userId: string,
    stationId: string,
    stationName: string
  ) {
    if (!window.confirm(`Unassign "${stationName}" from this agent?`)) return
    setError('')
    setMessage('')
    const key = `${userId}-${stationId}`
    setUnassigningKey(key)
    try {
      const token = getToken()!
      await unassignStation(token, { userId, pollingStationId: stationId })
      setMessage('Station unassigned')
      await load()
    } catch (err: any) {
      setError(err.message || 'Unassign failed')
    } finally {
      setUnassigningKey(null)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading agents…</div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← Admin
          </Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Agents</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {agents.length} total · {assignedCount} assigned · {unassignedCount}{' '}
            unassigned
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
      {message && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">
          {message}
        </div>
      )}

      {/* Create agent */}
      <form
        onSubmit={handleCreate}
        className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3"
      >
        <h2 className="font-semibold text-gray-900">Create agent</h2>
        <input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="tel"
          inputMode="numeric"
          placeholder="2547XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          required
          className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={creating || phone.length < 12}
          className="w-full py-3 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create agent'}
        </button>
      </form>

      {/* Assign station */}
      <form
        onSubmit={handleAssign}
        className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3"
      >
        <h2 className="font-semibold text-gray-900">Assign station</h2>

        <select
          value={assignUserId}
          onChange={(e) => setAssignUserId(e.target.value)}
          required
          className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select agent…</option>
          {agents
            .filter((a) => a.role === 'AGENT')
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.phone}) · {a.stations?.length || 0} station
                {(a.stations?.length || 0) === 1 ? '' : 's'}
              </option>
            ))}
        </select>

        <input
          type="search"
          placeholder="Search station by name or code…"
          value={stationSearch}
          onChange={(e) => setStationSearch(e.target.value)}
          className="w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={assignStationId}
          onChange={(e) => setAssignStationId(e.target.value)}
          required
          className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select station…</option>
          {filteredStations.map((s) => {
            const assignees = stationAssignees.get(s.id) || []
            const tag =
              assignees.length > 0
                ? ` · assigned: ${assignees.map((x) => x.name).join(', ')}`
                : ''
            return (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code}){tag}
              </option>
            )
          })}
        </select>

        {selectedAssignees.length > 0 && (
          <div className="bg-amber-50 text-amber-800 text-sm px-3 py-2 rounded-xl">
            Already assigned to:{' '}
            <strong>{selectedAssignees.map((a) => a.name).join(', ')}</strong>
          </div>
        )}

        <button
          type="submit"
          disabled={assigning || !assignUserId || !assignStationId}
          className="w-full py-3 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
        >
          {assigning ? 'Assigning…' : 'Assign station'}
        </button>
      </form>

      {/* Search + filter agents */}
      <div className="space-y-2">
        <input
          type="search"
          placeholder="Search agents by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          {(['all', 'assigned', 'unassigned'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                filter === f
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'assigned' ? 'Assigned' : 'Unassigned'}
            </button>
          ))}
        </div>
      </div>

      {/* Agent list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Agents ({filteredAgents.length})
        </h2>
        {filteredAgents.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">
            No agents match
          </p>
        )}
        {filteredAgents.map((a) => (
          <div
            key={a.id}
            className="bg-white rounded-2xl border border-gray-100 p-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-gray-900">{a.name}</p>
                <p className="text-sm text-gray-500">{a.phone}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {a.stations?.length || 0} station
                  {(a.stations?.length || 0) === 1 ? '' : 's'}
                </p>
              </div>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-lg ${
                  a.role === 'SUPER_ADMIN'
                    ? 'bg-purple-50 text-purple-700'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                {a.role}
              </span>
            </div>
            {(a.stations?.length || 0) > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-1">Stations</p>
                <ul className="text-sm text-gray-700 space-y-2">
                  {(a.stations || []).map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>
                        {s.name}{' '}
                        <span className="text-gray-400">({s.code})</span>
                      </span>
                      {a.role === 'AGENT' && (
                        <button
                          type="button"
                          onClick={() => handleUnassign(a.id, s.id, s.name)}
                          disabled={unassigningKey === `${a.id}-${s.id}`}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50 shrink-0"
                        >
                          {unassigningKey === `${a.id}-${s.id}`
                            ? '…'
                            : 'Unassign'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}