'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getAdminAgents,
  createAdminAgent,
  assignStation,
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

  // Create agent form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [creating, setCreating] = useState(false)

  // Assign form
  const [assignUserId, setAssignUserId] = useState('')
  const [assignStationId, setAssignStationId] = useState('')
  const [assigning, setAssigning] = useState(false)

  async function load() {
    const token = getToken()!
    const [agentList, stationList] = await Promise.all([
      getAdminAgents(token),
      getPollingStations().catch(() => []),
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
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [router])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setCreating(true)
    try {
      const token = getToken()!
      await createAdminAgent(token, {
        name: name.trim(),
        phone: phone.replace(/\D/g, ''),
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
    setAssigning(true)
    try {
      const token = getToken()!
      await assignStation(token, {
        userId: assignUserId,
        pollingStationId: assignStationId,
      })
      setAssignUserId('')
      setAssignStationId('')
      setMessage('Station assigned')
      await load()
    } catch (err: any) {
      setError(err.message || 'Assign failed')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading agents…</div>
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← Admin
          </Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Agents</h1>
        </div>
        <button
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
          disabled={creating || phone.length < 10}
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
                {a.name} ({a.phone})
              </option>
            ))}
        </select>
        <select
          value={assignStationId}
          onChange={(e) => setAssignStationId(e.target.value)}
          required
          className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select station…</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={assigning || !assignUserId || !assignStationId}
          className="w-full py-3 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
        >
          {assigning ? 'Assigning…' : 'Assign station'}
        </button>
      </form>

      {/* Agent list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          All agents ({agents.length})
        </h2>
        {agents.map((a) => (
          <div
            key={a.id}
            className="bg-white rounded-2xl border border-gray-100 p-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-gray-900">{a.name}</p>
                <p className="text-sm text-gray-500">{a.phone}</p>
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
            {a.stations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-1">Stations</p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {a.stations.map((s) => (
                    <li key={s.id}>
                      {s.name} <span className="text-gray-400">({s.code})</span>
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