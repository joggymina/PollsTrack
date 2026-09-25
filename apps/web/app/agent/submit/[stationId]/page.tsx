'use client'

import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
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
import { getToken, getUser, clearAuth, isLoggedIn } from '@/lib/auth'
import { addToQueue } from '@/lib/offline-queue'

const inputClass =
  'w-full px-4 py-3 text-lg text-gray-900 bg-white border border-gray-300 rounded-xl placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'

const voteInputClass =
  'w-24 px-3 py-3 text-lg text-center text-gray-900 bg-white border border-gray-300 rounded-xl placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none'

const selectClass =
  'w-full px-4 py-3.5 text-base text-gray-900 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'

const readOnlyClass =
  'w-full px-4 py-3 text-lg text-gray-900 bg-gray-50 border border-gray-200 rounded-xl'

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
  const [rejectedBallots, setRejectedBallots] = useState('0')
  const [formPhoto, setFormPhoto] = useState<string | null>(null)
  const [photoName, setPhotoName] = useState('')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [offlineSaved, setOfflineSaved] = useState(false)

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

    async function load() {
      try {
        const [me, raceList] = await Promise.all([getMe(token!), getRaces()])

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
        if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
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

  function onPhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Photo must be under 2MB')
      return
    }

    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      setFormPhoto(reader.result as string)
      setPhotoName(file.name)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    setOfflineSaved(false)

    const token = getToken()
    const user = getUser()
    if (!token || !user || !station || !selectedRaceId) return

    try {
      for (const c of candidates) {
        if (votes[c.id] === '' || votes[c.id] === undefined) {
          throw new Error(`Enter votes for ${c.name}`)
        }
      }

      // Registered voters always from DB — never from user input
      const payload = {
        pollingStationId: station.id,
        raceId: selectedRaceId,
        totalRegistered:
          station.registeredVoters != null
            ? station.registeredVoters
            : undefined,
        totalVoted: totalVoted ? parseInt(totalVoted, 10) : undefined,
        rejectedBallots: rejectedBallots
          ? parseInt(rejectedBallots, 10)
          : 0,
        clientSubmittedAt: new Date().toISOString(),
        formPhotoUrl: formPhoto || undefined,
        votes: candidates.map((c) => ({
          candidateId: c.id,
          votes: parseInt(votes[c.id] || '0', 10),
        })),
      }

      try {
        await submitResults(token, payload)
        setSuccess(true)
      } catch (err: any) {
        const isNetworkError =
          !navigator.onLine ||
          err.message?.includes('Failed to fetch') ||
          err.message?.includes('NetworkError') ||
          err.message?.includes('network') ||
          err.message?.includes('fetch')

        if (isNetworkError || !navigator.onLine) {
          addToQueue(payload, station.name, user.id)
          setOfflineSaved(true)
        } else {
          throw err
        }
      }
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

  if (success || offlineSaved) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div
          className={`rounded-2xl p-8 border ${
            offlineSaved
              ? 'bg-amber-50 border-amber-100'
              : 'bg-green-50 border-green-100'
          }`}
        >
          <div className="text-4xl mb-3">{offlineSaved ? '📦' : '✓'}</div>
          <h2
            className={`text-xl font-bold ${
              offlineSaved ? 'text-amber-800' : 'text-green-800'
            }`}
          >
            {offlineSaved ? 'Saved Offline' : 'Results Submitted'}
          </h2>
          <p
            className={`mt-2 ${
              offlineSaved ? 'text-amber-700' : 'text-green-600'
            }`}
          >
            {offlineSaved
              ? `${station?.name} results were saved on this device. They will sync automatically when you are back online.`
              : `${station?.name} results have been recorded successfully.`}
          </p>
          <div className="mt-6 space-y-3">
            <Link
              href="/agent"
              className={`block w-full py-3.5 font-semibold text-white rounded-xl ${
                offlineSaved
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
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

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Turnout</h3>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Total Registered (from IEBC register)
            </label>
            <div className={readOnlyClass}>
              {station.registeredVoters != null
                ? station.registeredVoters.toLocaleString()
                : 'Not set in database'}
            </div>
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

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Form photo (optional)</h3>
          <p className="text-sm text-gray-500">
            Take or upload a photo of the official results form (max 2MB).
          </p>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhotoChange}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700"
          />

          {formPhoto && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 truncate">{photoName}</p>
              <img
                src={formPhoto}
                alt="Form preview"
                className="w-full max-h-48 object-contain rounded-xl border border-gray-100"
              />
              <button
                type="button"
                onClick={() => {
                  setFormPhoto(null)
                  setPhotoName('')
                }}
                className="text-sm text-red-600"
              >
                Remove photo
              </button>
            </div>
          )}
        </div>

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