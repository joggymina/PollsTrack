'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getPositionAdmins,
  createPositionAdmin,
  getRaces,
  getCounties,
  getConstituencies,
  getWards,
  type PositionAdminUser,
  type Race,
  type County,
  type ConstituencyOption,
  type WardOption,
} from '@/lib/api'
import { getToken, getUser, isLoggedIn, clearAuth } from '@/lib/auth'

type Level = 'NATIONAL' | 'COUNTY' | 'CONSTITUENCY' | 'WARD'

const inputClass =
  'w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500'

export default function PositionAdminsPage() {
  const router = useRouter()
  const [list, setList] = useState<PositionAdminUser[]>([])
  const [races, setRaces] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [raceId, setRaceId] = useState('')
  const [level, setLevel] = useState<Level>('WARD')
  const [counties, setCounties] = useState<County[]>([])
  const [countyId, setCountyId] = useState('')
  const [constituencies, setConstituencies] = useState<ConstituencyOption[]>([])
  const [constituencyId, setConstituencyId] = useState('')
  const [wards, setWards] = useState<WardOption[]>([])
  const [wardId, setWardId] = useState('')
  const [creating, setCreating] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)

  async function load() {
    const token = getToken()!
    const [admins, raceList] = await Promise.all([
      getPositionAdmins(token),
      getRaces(),
    ])
    setList(admins)
    setRaces(raceList)
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
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (level === 'NATIONAL') {
      setCountyId('')
      setConstituencyId('')
      setWardId('')
      return
    }
    if (counties.length > 0) return
    setGeoLoading(true)
    getCounties()
      .then(setCounties)
      .catch((e) => setError(e.message))
      .finally(() => setGeoLoading(false))
  }, [level, counties.length])

  useEffect(() => {
    if (!countyId || (level !== 'CONSTITUENCY' && level !== 'WARD')) {
      setConstituencies([])
      setConstituencyId('')
      setWards([])
      setWardId('')
      return
    }
    setGeoLoading(true)
    getConstituencies(countyId)
      .then(setConstituencies)
      .catch((e) => setError(e.message))
      .finally(() => setGeoLoading(false))
  }, [countyId, level])

  useEffect(() => {
    if (!constituencyId || level !== 'WARD') {
      setWards([])
      setWardId('')
      return
    }
    setGeoLoading(true)
    getWards(constituencyId)
      .then(setWards)
      .catch((e) => setError(e.message))
      .finally(() => setGeoLoading(false))
  }, [constituencyId, level])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    const cleaned = phone.replace(/\D/g, '')
    if (!/^2547\d{8}$/.test(cleaned)) {
      setError('Phone must be 2547XXXXXXXX')
      return
    }
    if (!raceId) {
      setError('Select a position (race)')
      return
    }
    setCreating(true)
    try {
      const token = getToken()!
      await createPositionAdmin(token, {
        name: name.trim(),
        phone: cleaned,
        raceId,
        level,
        countyId: level === 'NATIONAL' ? null : countyId || null,
        constituencyId:
          level === 'CONSTITUENCY' || level === 'WARD'
            ? constituencyId || null
            : null,
        wardId: level === 'WARD' ? wardId || null : null,
      })
      setName('')
      setPhone('')
      setMessage('Position admin created')
      await load()
    } catch (err: any) {
      setError(err.message || 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading…</div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← Admin
          </Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">
            Position admins
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Position → level → place · {list.length} registered
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

      <form
        onSubmit={handleCreate}
        className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3"
      >
        <h2 className="font-semibold text-gray-900">Create position admin</h2>

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

        <div>
          <label className="text-xs text-gray-500">1. Position (race)</label>
          <select
            className={inputClass}
            value={raceId}
            onChange={(e) => setRaceId(e.target.value)}
            required
          >
            <option value="">Select position…</option>
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.position}
                {r.scope ? ` (${r.scope})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500">2. Level</label>
          <select
            className={inputClass}
            value={level}
            onChange={(e) => setLevel(e.target.value as Level)}
          >
            <option value="NATIONAL">National</option>
            <option value="COUNTY">County</option>
            <option value="CONSTITUENCY">Constituency</option>
            <option value="WARD">Ward</option>
          </select>
        </div>

        {level !== 'NATIONAL' && (
          <div>
            <label className="text-xs text-gray-500">3. County</label>
            <select
              className={inputClass}
              value={countyId}
              onChange={(e) => setCountyId(e.target.value)}
              required
            >
              <option value="">
                {geoLoading ? 'Loading…' : 'Select county…'}
              </option>
              {counties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {(level === 'CONSTITUENCY' || level === 'WARD') && (
          <div>
            <label className="text-xs text-gray-500">Constituency</label>
            <select
              className={inputClass}
              value={constituencyId}
              onChange={(e) => setConstituencyId(e.target.value)}
              required
              disabled={!countyId}
            >
              <option value="">Select constituency…</option>
              {constituencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {level === 'WARD' && (
          <div>
            <label className="text-xs text-gray-500">Ward</label>
            <select
              className={inputClass}
              value={wardId}
              onChange={(e) => setWardId(e.target.value)}
              required
              disabled={!constituencyId}
            >
              <option value="">Select ward…</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={creating || phone.length < 12 || !raceId}
          className="w-full py-3 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create position admin'}
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Registered ({list.length})
        </h2>
        {list.map((u) => (
          <div
            key={u.id}
            className="bg-white rounded-2xl border border-gray-100 p-4"
          >
            <p className="font-semibold text-gray-900">{u.name}</p>
            <p className="text-sm text-gray-500">{u.phone}</p>
            {(u.positionAdminScopes || []).map((s) => (
              <p key={s.id} className="text-xs text-gray-600 mt-2">
                {s.race.position} · {s.level}
                {s.county ? ` · ${s.county.name}` : ''}
                {s.constituency ? ` · ${s.constituency.name}` : ''}
                {s.ward ? ` · ${s.ward.name}` : ''}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}