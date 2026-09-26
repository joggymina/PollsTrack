'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createOrganization,
  getCounties,
  getConstituencies,
  getWards,
  type County,
  type ConstituencyOption,
  type WardOption,
} from '@/lib/api'
import { setAuth } from '@/lib/auth'

const inputClass =
  'w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500'

type Level = 'NATIONAL' | 'COUNTY' | 'CONSTITUENCY' | 'WARD'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  const [name, setName] = useState('')
  const [primaryLevel, setPrimaryLevel] = useState<Level>('NATIONAL')
  const [countyId, setCountyId] = useState('')
  const [constituencyId, setConstituencyId] = useState('')
  const [wardId, setWardId] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminPhone, setAdminPhone] = useState('')

  const [counties, setCounties] = useState<County[]>([])
  const [constituencies, setConstituencies] = useState<ConstituencyOption[]>([])
  const [wards, setWards] = useState<WardOption[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getCounties().then(setCounties).catch(() => {})
  }, [])

  useEffect(() => {
    setConstituencyId('')
    setWardId('')
    setConstituencies([])
    setWards([])
    if (!countyId) return
    getConstituencies(countyId).then(setConstituencies).catch(() => {})
  }, [countyId])

  useEffect(() => {
    setWardId('')
    setWards([])
    if (!constituencyId) return
    getWards(constituencyId).then(setWards).catch(() => {})
  }, [constituencyId])

  function canGoStep2() {
    if (!name.trim()) return false
    if (primaryLevel === 'COUNTY' && !countyId) return false
    if (primaryLevel === 'CONSTITUENCY' && (!countyId || !constituencyId))
      return false
    if (
      primaryLevel === 'WARD' &&
      (!countyId || !constituencyId || !wardId)
    )
      return false
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const phone = adminPhone.replace(/\D/g, '')
      if (!/^2547\d{8}$/.test(phone)) {
        throw new Error('Phone must be 2547XXXXXXXX (12 digits)')
      }
      if (!adminName.trim()) throw new Error('Admin name is required')

      const result = await createOrganization({
        name: name.trim(),
        primaryLevel,
        countyId: primaryLevel === 'NATIONAL' ? null : countyId || null,
        constituencyId:
          primaryLevel === 'NATIONAL' || primaryLevel === 'COUNTY'
            ? null
            : constituencyId || null,
        wardId: primaryLevel === 'WARD' ? wardId || null : null,
        adminName: adminName.trim(),
        adminPhone: phone,
      })

      // Adjust if your auth helper uses different names
      setAuth(result.token, result.user)
      router.replace('/admin')
    } catch (err: any) {
      setError(err.message || 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Create your organization
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Set up a private team workspace. Results stay inside your organization.
      </p>

      {step === 1 && (
        <div className="space-y-5 bg-white rounded-2xl border border-gray-100 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization name
            </label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bomet East MCA Desk"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Operating level
            </label>
            <select
              className={inputClass}
              value={primaryLevel}
              onChange={(e) => setPrimaryLevel(e.target.value as Level)}
            >
              <option value="NATIONAL">National</option>
              <option value="COUNTY">County</option>
              <option value="CONSTITUENCY">Constituency</option>
              <option value="WARD">Ward</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              This is the ceiling of your team’s access.
            </p>
          </div>

          {primaryLevel !== 'NATIONAL' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                County
              </label>
              <select
                className={inputClass}
                value={countyId}
                onChange={(e) => setCountyId(e.target.value)}
              >
                <option value="">Select county…</option>
                {counties.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {(primaryLevel === 'CONSTITUENCY' || primaryLevel === 'WARD') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Constituency
              </label>
              <select
                className={inputClass}
                value={constituencyId}
                onChange={(e) => setConstituencyId(e.target.value)}
                disabled={!countyId}
              >
                <option value="">Select constituency…</option>
                {constituencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {primaryLevel === 'WARD' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ward
              </label>
              <select
                className={inputClass}
                value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                disabled={!constituencyId}
              >
                <option value="">Select ward…</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            disabled={!canGoStep2()}
            onClick={() => setStep(2)}
            className="w-full py-3.5 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 bg-white rounded-2xl border border-gray-100 p-6"
        >
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-sm text-blue-600"
          >
            ← Back
          </button>

          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{name}</span>
            {' · '}
            {primaryLevel}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin full name
            </label>
            <input
              className={inputClass}
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin phone
            </label>
            <input
              className={inputClass}
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              placeholder="2547XXXXXXXX"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              This phone is used to log in as organization SUPER_ADMIN.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create organization'}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 font-medium">
          Log in
        </Link>
      </p>
    </div>
  )
}