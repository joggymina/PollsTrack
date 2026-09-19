'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  getMe,
  getRaces,
  getCandidates,
  submitResults,
  type AssignedStation,
  type Race,
  type Candidate,
} from '@/lib/api'
import { getToken, clearAuth, isLoggedIn } from '@/lib/auth'

// Shared input styles for visibility
const inputClass =
  'w-full px-4 py-3 text-lg text-gray-900 bg-white border border-gray-300 rounded-xl placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'

const voteInputClass =
  'w-24 px-3 py-3 text-lg text-center text-gray-900 bg-white border border-gray-300 rounded-xl placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none'

const selectClass =
  'w-full px-4 py-3.5 text-base text-gray-900 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'

export default function SubmitResultsPage() {
  const router = useRouter()
  const params = useParams()
  const stationId = params.stationId as string

  const [station, setStation] = useState<AssignedStation | null>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [selectedRaceId, setSelectedRaceId] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [votes, setVotes] = useState<Record<string, string>>({})
  const [totalVoted, setTotalVoted] = useState('')
  const [totalRegistered, setTotalRegistered] = useState('')
  const [rejectedBallots, setRejectedBallots] = useState('0')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }

    const token = getToken()!

    async function load() {
      try {
        const [me, raceList] = await Promise.all([getMe(token), getRaces()])

        const found = me.assignedStations.find((s) => s.id === stationId)
        if (!found) {
          setError('You are not assigned to this station')
          setLoading(false)
          return
        }

        setStation(found)
        setRaces(raceList)
        if (raceList.length === 1) {
          setSelectedRaceId(raceList[0].id)
        }
      } catch (err: any) {
        setError(err.message)
        if (err.message.includes('Unauthorized')) {
          clearAuth()
          router.replace('/login')
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [stationId, router])

  useEffect(() => {
    if (!selectedRaceId) {
      setCandidates([])
      return
    }

    getCandidates(selectedRaceId)
      .then((list) => {
        setCandidates(list)
        const initial: Record<string, string> = {}
        list.forEach((c) => {
          initial[c.id] = ''
        })
        setVotes(initial)
      })
      .catch((err) => setError(err.message))
  }, [selectedRaceId])

  function updateVote(candidateId: string, value: string) {
    if (value === '' || /^\d+$/.test(value)) {
      setVotes((prev) => ({ ...prev, [candidateId]: value }))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const token = getToken()
    if (!token || !station || !selectedRaceId) return

    try {
      for (const c of candidates) {
        if (votes[c.id] === '' || votes[c.id] === undefined) {
          throw new Error(`Enter votes for ${c.name}`)
        }
      }

      await submitResults(token, {
        pollingStationId: station.id,
        raceId: selectedRaceId,
        totalRegistered: totalRegistered
          ? parseInt(totalRegistered, 10)
          : undefined,
        totalVoted: totalVoted ? parseInt(totalVoted, 10) : undefined,
        rejectedBallots: rejectedBallots
          ? parseInt(rejectedBallots, 10)
          : 0,
        clientSubmittedAt: new Date().toISOString(),
        votes: candidates.map((c) => ({
          candidateId: c.id,
          votes: parseInt(votes[c.id] || '0', 10),
        })),
      })

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading form…</div>
    )
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-8">
          <div className="text-4xl mb-3">✓</div>
          <h2 className="text-xl font-bold text-green-800">
            Results Submitted
          </h2>
          <p className="text-green-600 mt-2">
            {station?.name} results have been recorded successfully.
          </p>
          <div className="mt-6 space-y-3">
            <Link
              href="/agent"
              className="block w-full py-3.5 font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700"
            >
              Back to My Stations
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!station) {
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
      {/* Header */}
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
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Race selector */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Race / Position
          </label>
          <select
            value={selectedRaceId}
            onChange={(e) => setSelectedRaceId(e.target.value)}
            className={selectClass}
            required
          >
            <option value="">Select race…</option>
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.position}
              </option>
            ))}
          </select>
        </div>

        {/* Turnout numbers */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Turnout</h3>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Total Registered (optional)
            </label>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={totalRegistered}
              onChange={(e) => setTotalRegistered(e.target.value)}
              className={inputClass}
              placeholder="e.g. 520"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Total Voted
            </label>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={totalVoted}
              onChange={(e) => setTotalVoted(e.target.value)}
              className={inputClass}
              placeholder="e.g. 410"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Rejected Ballots
            </label>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={rejectedBallots}
              onChange={(e) => setRejectedBallots(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Candidate votes */}
        {candidates.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Candidate Votes</h3>

            {candidates.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {c.code || '—'} {c.party ? `· ${c.party}` : ''}
                  </p>
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  required
                  value={votes[c.id] ?? ''}
                  onChange={(e) => updateVote(c.id, e.target.value)}
                  className={voteInputClass}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !selectedRaceId || candidates.length === 0}
          className="w-full py-4 text-lg font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Results'}
        </button>

        <p className="text-center text-xs text-gray-400">
          Results cannot be edited after submission. Double-check the numbers.
        </p>
      </form>
    </div>
  )
}