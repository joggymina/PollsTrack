'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getToken, clearAuth, isLoggedIn, getUser } from '@/lib/auth'
import {
  getRaces,
  getCandidates,
  createCandidate,
  type Race,
  type Candidate,
} from '@/lib/api'

export default function AdminCandidatesPage() {
  const router = useRouter()
  const [races, setRaces] = useState<Race[]>([])
  const [raceId, setRaceId] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [party, setParty] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }
    const user = getUser()
    if (user?.role !== 'SUPER_ADMIN') {
      router.replace('/agent')
      return
    }

    getRaces()
      .then((list) => {
        setRaces(list)
        if (list[0]) setRaceId(list[0].id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load races'))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (!raceId) return
    setError('')
    setMessage('')
    getCandidates(raceId)
      .then(setCandidates)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load candidates')
      )
  }, [raceId])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const token = getToken()
    if (!token || !raceId || !name.trim()) return

    const trimmedCode = code.trim()
    if (trimmedCode) {
      const taken = candidates.find(
        (c) => c.code?.toLowerCase() === trimmedCode.toLowerCase()
      )
      if (taken) {
        setError(
          `Code "${trimmedCode}" is already used by ${taken.name} in this race`
        )
        setMessage('')
        return
      }
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      await createCandidate(token, {
        raceId,
        name: name.trim(),
        code: trimmedCode || undefined,
        party: party.trim() || undefined,
      })
      setName('')
      setCode('')
      setParty('')
      setMessage('Candidate added')
      const list = await getCandidates(raceId)
      setCandidates(list)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to add candidate'
      setError(msg)
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        clearAuth()
        router.replace('/login')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">Loading races…</div>
    )
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="max-w-2xl mx-auto p-6 text-gray-900">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm text-blue-400 hover:underline"
          >
            ← Admin
          </Link>
          <h1 className="text-2xl font-bold text-white mt-1">Candidates</h1>
          <p className="text-sm text-gray-400">
            Add candidates for each race in your organization
          </p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Race / position
        </label>
        <select
          value={raceId}
          onChange={(e) => setRaceId(e.target.value)}
          className={inputClass}
        >
          {races.length === 0 ? (
            <option value="">No races found</option>
          ) : (
            races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.position}
              </option>
            ))
          )}
        </select>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-8 space-y-3"
      >
        <h2 className="font-semibold text-gray-900">Add candidate</h2>
        <input
          type="text"
          placeholder="Full name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Code (e.g. C001)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Party"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}
        <button
          type="submit"
          disabled={saving || !name.trim() || !raceId}
          className="w-full rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add candidate'}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            Current candidates ({candidates.length})
          </h2>
        </div>
        {candidates.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">
            No candidates for this race yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {candidates.map((c) => (
              <li
                key={c.id}
                className="px-5 py-3 flex justify-between items-center gap-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {[c.code, c.party].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}