'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getAdminAgents,
  createAdminAgent,
  assignStation,
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

const inputClass =
  'w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500'

type Step = 'county' | 'constituency' | 'ward' | 'station'

export default function AdminAgentsPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<AdminAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Create agent
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [creating, setCreating] = useState(false)

  // Assign — step navigator
  const [assignUserId, setAssignUserId] = useState('')
  const [step, setStep] = useState<Step>('county')
  const [counties, setCounties] = useState<County[]>([])
  const [constituencies, setConstituencies] = useState<ConstituencyOption[]>([])
  const [wards, setWards] = useState<WardOption[]>([])
  const [stations, setStations] = useState<PollingStationOption[]>([])

  const [selectedCounty, setSelectedCounty] = useState<County | null>(null)
  const [selectedConstituency, setSelectedConstituency] =
    useState<ConstituencyOption | null>(null)
  const [selectedWard, setSelectedWard] = useState<WardOption | null>(null)
  const [selectedStation, setSelectedStation] =
    useState<PollingStationOption | null>(null)

  const [loadingStep, setLoadingStep] = useState(false)
  const [assigning, setAssigning] = useState(false)

  async function loadAgents() {
    const token = getToken()!
    setAgents(await getAdminAgents(token))
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
      .then(([, list]) => setCounties(list))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [router])

  async function pickCounty(c: County) {
    setSelectedCounty(c)
    setSelectedConstituency(null)
    setSelectedWard(null)
    setSelectedStation(null)
    setConstituencies([])
    setWards([])
    setStations([])
    setLoadingStep(true)
    setError('')
    try {
      const list = await getConstituencies(c.id)
      setConstituencies(list)
      setStep('constituency')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingStep(false)
    }
  }

  async function pickConstituency(c: ConstituencyOption) {
    setSelectedConstituency(c)
    setSelectedWard(null)
    setSelectedStation(null)
    setWards([])
    setStations([])
    setLoadingStep(true)
    setError('')
    try {
      const list = await getWards(c.id)
      setWards(list)
      setStep('ward')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingStep(false)
    }
  }

  async function pickWard(w: WardOption) {
    setSelectedWard(w)
    setSelectedStation(null)
    setStations([])
    setLoadingStep(true)
    setError('')
    try {
      const list = await getPollingStations(w.id)
      setStations(list)
      setStep('station')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingStep(false)
    }
  }

  function pickStation(s: PollingStationOption) {
    setSelectedStation(s)
  }

  function goBack() {
    setError('')
    if (step === 'station') {
      setSelectedStation(null)
      setStations([])
      setStep('ward')
    } else if (step === 'ward') {
      setSelectedWard(null)
      setWards([])
      setStep('constituency')
    } else if (step === 'constituency') {
      setSelectedConstituency(null)
      setConstituencies([])
      setStep('county')
    }
  }

  function resetLocation() {
    setStep('county')
    setSelectedCounty(null)
    setSelectedConstituency(null)
    setSelectedWard(null)
    setSelectedStation(null)
    setConstituencies([])
    setWards([])
    setStations([])
  }

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
      await loadAgents()
    } catch (err: any) {
      setError(err.message || 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  async function handleAssign(e: FormEvent) {
    e.preventDefault()
    if (!assignUserId || !selectedStation) return
    setError('')
    setMessage('')
    setAssigning(true)
    try {
      const token = getToken()!
      await assignStation(token, {
        userId: assignUserId,
        pollingStationId: selectedStation.id,
      })
      setAssignUserId('')
      resetLocation()
      setMessage(`Assigned: ${selectedStation.name}`)
      await loadAgents()
    } catch (err: any) {
      setError(err.message || 'Assign failed')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading agents…</div>
    )
  }

  const breadcrumb = [
    selectedCounty?.name,
    selectedConstituency?.name,
    selectedWard?.name,
    selectedStation?.name,
  ]
    .filter(Boolean)
    .join(' → ')

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
          className={inputClass}
        />
        <input
          type="tel"
          inputMode="numeric"
          placeholder="2547XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          required
          className={inputClass}
        />
        <button
          type="submit"
          disabled={creating || phone.length < 10}
          className="w-full py-3 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create agent'}
        </button>
      </form>

      {/* Assign station — clickable cascade */}
      <form
        onSubmit={handleAssign}
        className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4"
      >
        <div>
          <h2 className="font-semibold text-gray-900">Assign station</h2>
          <p className="text-xs text-gray-500 mt-1">
            County → Constituency → Ward → Station (loads one level at a time)
          </p>
        </div>

        <select
          value={assignUserId}
          onChange={(e) => setAssignUserId(e.target.value)}
          required
          className={inputClass}
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

        {/* Breadcrumb + back */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 truncate flex-1">
            {breadcrumb || 'Choose a county'}
          </p>
          {step !== 'county' && (
            <button
              type="button"
              onClick={goBack}
              className="text-sm text-blue-600 shrink-0"
            >
              ← Back
            </button>
          )}
        </div>

        {loadingStep && (
          <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
        )}

        {/* Step lists — only current level rendered */}
        {!loadingStep && step === 'county' && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
            {counties.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCounty(c)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100"
              >
                <span className="font-medium text-gray-900">{c.name}</span>
                <span className="text-xs text-gray-400 ml-2">{c.code}</span>
              </button>
            ))}
          </div>
        )}

        {!loadingStep && step === 'constituency' && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
            {constituencies.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">No constituencies</p>
            ) : (
              constituencies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickConstituency(c)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100"
                >
                  <span className="font-medium text-gray-900">{c.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{c.code}</span>
                </button>
              ))
            )}
          </div>
        )}

        {!loadingStep && step === 'ward' && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
            {wards.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">No wards</p>
            ) : (
              wards.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => pickWard(w)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100"
                >
                  <span className="font-medium text-gray-900">{w.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{w.code}</span>
                </button>
              ))
            )}
          </div>
        )}

        {!loadingStep && step === 'station' && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
            {stations.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">No stations</p>
            ) : (
              stations.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickStation(s)}
                  className={`w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100 ${
                    selectedStation?.id === s.id
                      ? 'bg-blue-50 ring-2 ring-inset ring-blue-500'
                      : ''
                  }`}
                >
                  <span className="font-medium text-gray-900">{s.name}</span>
                  <span className="block text-xs text-gray-400 mt-0.5">
                    {s.code}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {selectedStation && (
          <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
            Selected: {selectedStation.name} ({selectedStation.code})
          </p>
        )}

        <button
          type="submit"
          disabled={assigning || !assignUserId || !selectedStation}
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
                      {s.name}{' '}
                      <span className="text-gray-400">({s.code})</span>
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