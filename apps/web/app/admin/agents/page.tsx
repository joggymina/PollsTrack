'use client'

import { useEffect, useMemo, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getAdminAgents,
  createAdminAgent,
  assignStation,
  unassignStation,
  getCounties,
  getConstituencies,
  getWards,
  getPollingStations,
  type AdminAgent,
  type County,
  type ConstituencyOption,
  type WardOption,
  type PollingStationOption,
} from '@/lib/api'
import { getToken, getUser, isLoggedIn, clearAuth } from '@/lib/auth'

type Tab = 'create' | 'assign' | 'list'

export default function AdminAgentsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('list')
  const [agents, setAgents] = useState<AdminAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // List tab
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
  const [unassigningKey, setUnassigningKey] = useState<string | null>(null)

  // Create tab
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [creating, setCreating] = useState(false)

  // Assign tab – cascade
  const [assignUserId, setAssignUserId] = useState('')
  const [counties, setCounties] = useState<County[]>([])
  const [countySearch, setCountySearch] = useState('')
  const [selectedCounty, setSelectedCounty] = useState<County | null>(null)
  const [constituencies, setConstituencies] = useState<ConstituencyOption[]>([])
  const [selectedConstituency, setSelectedConstituency] =
    useState<ConstituencyOption | null>(null)
  const [wards, setWards] = useState<WardOption[]>([])
  const [selectedWard, setSelectedWard] = useState<WardOption | null>(null)
  const [stations, setStations] = useState<PollingStationOption[]>([])
  const [assignStationId, setAssignStationId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [cascadeLoading, setCascadeLoading] = useState(false)

  async function loadAgents() {
    const token = getToken()!
    const list = await getAdminAgents(token)
    setAgents(list)
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

    Promise.all([loadAgents(), getCounties()])
      .then(([, countyList]) => setCounties(countyList))
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [router])

  // ---- Derived ----
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

  const filteredCounties = useMemo(() => {
    const q = countySearch.trim().toLowerCase()
    if (!q) return counties
    return counties.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    )
  }, [counties, countySearch])

  const filteredAgents = useMemo(() => {
    let list = agents
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) => a.name.toLowerCase().includes(q) || a.phone.includes(q)
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

  const assignedCount = agents.filter((a) => (a.stations?.length || 0) > 0)
    .length
  const unassignedCount = agents.filter(
    (a) => a.role === 'AGENT' && (a.stations?.length || 0) === 0
  ).length

  // ---- Cascade handlers ----
  async function pickCounty(c: County) {
    setSelectedCounty(c)
    setSelectedConstituency(null)
    setSelectedWard(null)
    setStations([])
    setAssignStationId('')
    setCascadeLoading(true)
    try {
      const list = await getConstituencies(c.id)
      setConstituencies(list)
    } catch (err: any) {
      setError(err.message || 'Failed to load constituencies')
    } finally {
      setCascadeLoading(false)
    }
  }

  async function pickConstituency(c: ConstituencyOption) {
    setSelectedConstituency(c)
    setSelectedWard(null)
    setStations([])
    setAssignStationId('')
    setCascadeLoading(true)
    try {
      const list = await getWards(c.id)
      setWards(list)
    } catch (err: any) {
      setError(err.message || 'Failed to load wards')
    } finally {
      setCascadeLoading(false)
    }
  }

  async function pickWard(w: WardOption) {
    setSelectedWard(w)
    setAssignStationId('')
    setCascadeLoading(true)
    try {
      const list = await getPollingStations(w.id)
      setStations(list)
    } catch (err: any) {
      setError(err.message || 'Failed to load stations')
    } finally {
      setCascadeLoading(false)
    }
  }

  function cascadeBack() {
    if (selectedWard) {
      setSelectedWard(null)
      setStations([])
      setAssignStationId('')
      return
    }
    if (selectedConstituency) {
      setSelectedConstituency(null)
      setWards([])
      return
    }
    if (selectedCounty) {
      setSelectedCounty(null)
      setConstituencies([])
      return
    }
  }

  // ---- Actions ----
  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    const cleaned = phone.replace(/\D/g, '')
    if (!/^2547\d{8}$/.test(cleaned)) {
      setError('Phone must be 2547XXXXXXXX (12 digits)')
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
      await loadAgents()
      setTab('list')
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

    let msg = `Assign "${station?.name || 'station'}" to ${agent?.name || 'agent'}?`
    if (others.length > 0) {
      msg += `\n\nAlready assigned to: ${others.map((o) => o.name).join(', ')}`
    }
    if (!window.confirm(msg)) return

    setAssigning(true)
    try {
      const token = getToken()!
      await assignStation(token, {
        userId: assignUserId,
        pollingStationId: assignStationId,
      })
      setAssignStationId('')
      setMessage('Station assigned')
      await loadAgents()
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
    if (!window.confirm(`Unassign "${stationName}"?`)) return
    setError('')
    setMessage('')
    const key = `${userId}-${stationId}`
    setUnassigningKey(key)
    try {
      const token = getToken()!
      await unassignStation(token, { userId, pollingStationId: stationId })
      setMessage('Station unassigned')
      await loadAgents()
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'create', label: 'Create' },
    { id: 'assign', label: 'Assign' },
    { id: 'list', label: 'List' },
  ]

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
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

      {/* Tabs */}
      <div className="flex rounded-xl border border-gray-200 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              setError('')
              setMessage('')
            }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              tab === t.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
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

      {/* ===== CREATE ===== */}
      {tab === 'create' && (
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
      )}

      {/* ===== ASSIGN ===== */}
      {tab === 'assign' && (
        <form
          onSubmit={handleAssign}
          className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3"
        >
          <h2 className="font-semibold text-gray-900">Assign station</h2>
          <p className="text-xs text-gray-500">
            County → Constituency → Ward → Station
          </p>

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

          {/* Breadcrumb + back */}
          {(selectedCounty || selectedConstituency || selectedWard) && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-blue-700 font-medium truncate">
                {[
                  selectedCounty?.name,
                  selectedConstituency?.name,
                  selectedWard?.name,
                ]
                  .filter(Boolean)
                  .join(' → ')}
              </p>
              <button
                type="button"
                onClick={cascadeBack}
                className="text-blue-600 hover:underline shrink-0 ml-2"
              >
                ← Back
              </button>
            </div>
          )}

          {/* Level: counties */}
          {!selectedCounty && (
            <>
              <input
                type="search"
                placeholder="Search county…"
                value={countySearch}
                onChange={(e) => setCountySearch(e.target.value)}
                className="w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
                {filteredCounties.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCounty(c)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 flex justify-between"
                  >
                    <span className="font-medium text-gray-900">{c.name}</span>
                    <span className="text-sm text-gray-400">{c.code}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Level: constituencies */}
          {selectedCounty && !selectedConstituency && (
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
              {cascadeLoading ? (
                <p className="px-4 py-3 text-sm text-gray-500">Loading…</p>
              ) : constituencies.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">None found</p>
              ) : (
                constituencies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickConstituency(c)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 flex justify-between"
                  >
                    <span className="font-medium text-gray-900">{c.name}</span>
                    <span className="text-sm text-gray-400">{c.code}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Level: wards */}
          {selectedConstituency && !selectedWard && (
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
              {cascadeLoading ? (
                <p className="px-4 py-3 text-sm text-gray-500">Loading…</p>
              ) : wards.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">None found</p>
              ) : (
                wards.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => pickWard(w)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 flex justify-between"
                  >
                    <span className="font-medium text-gray-900">{w.name}</span>
                    <span className="text-sm text-gray-400">{w.code}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Level: stations */}
          {selectedWard && (
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
              {cascadeLoading ? (
                <p className="px-4 py-3 text-sm text-gray-500">Loading…</p>
              ) : stations.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">None found</p>
              ) : (
                stations.map((s) => {
                  const assignees = stationAssignees.get(s.id) || []
                  const selected = assignStationId === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setAssignStationId(s.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-blue-50 ${
                        selected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-gray-900">
                          {s.name}
                        </span>
                        <span className="text-sm text-gray-400 shrink-0">
                          {s.code}
                        </span>
                      </div>
                      {assignees.length > 0 && (
                        <p className="text-xs text-amber-700 mt-0.5">
                          Assigned: {assignees.map((a) => a.name).join(', ')}
                        </p>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          )}

          {selectedAssignees.length > 0 && assignStationId && (
            <div className="bg-amber-50 text-amber-800 text-sm px-3 py-2 rounded-xl">
              Already assigned to:{' '}
              <strong>
                {selectedAssignees.map((a) => a.name).join(', ')}
              </strong>
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
      )}

      {/* ===== LIST ===== */}
      {tab === 'list' && (
        <div className="space-y-3">
          <input
            type="search"
            placeholder="Search by name or phone…"
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
                {f === 'all'
                  ? 'All'
                  : f === 'assigned'
                    ? 'Assigned'
                    : 'Unassigned'}
              </button>
            ))}
          </div>

          {filteredAgents.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
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
                            onClick={() =>
                              handleUnassign(a.id, s.id, s.name)
                            }
                            disabled={
                              unassigningKey === `${a.id}-${s.id}`
                            }
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
      )}
    </div>
  )
}