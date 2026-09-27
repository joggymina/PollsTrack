'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getPublicSettings,
  updatePublicSettings,
  buildShareUrl,
  type PublicSettings,
} from '@/lib/api'
import { getToken, getUser, isLoggedIn, clearAuth } from '@/lib/auth'

export default function AdminPublicSettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }
    if (getUser()?.role !== 'SUPER_ADMIN') {
      router.replace('/agent')
      return
    }
    const token = getToken()!
    getPublicSettings(token)
      .then(setSettings)
      .catch((err: any) => setError(err.message || 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [router])

  async function setPublicEnabled(enabled: boolean) {
    const token = getToken()
    if (!token) return

    // Confirm before turning OFF (avoids accidental hide)
    if (
      !enabled &&
      !confirm(
        'Hide this board from the public homepage?\n\nShare links that include the secret token (?k=…) will still work.'
      )
    ) {
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updatePublicSettings(token, {
        publicViewEnabled: enabled,
      })
      setSettings(updated)
      setMessage(
        enabled
          ? 'Public board is now listed on the homepage'
          : 'Public board is hidden from the homepage'
      )
    } catch (err: any) {
      setError(err.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  async function rotateToken() {
    const token = getToken()
    if (!token) return
    if (
      !confirm(
        'Rotate share token?\n\nOld links with ?k=… will stop working immediately.'
      )
    ) {
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updatePublicSettings(token, {
        rotateShareToken: true,
      })
      setSettings(updated)
      setMessage('New share token generated')
    } catch (err: any) {
      setError(err.message || 'Rotate failed')
    } finally {
      setSaving(false)
    }
  }

  function copyShareLink() {
    if (!settings) return
    const url = buildShareUrl(settings)
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading settings…</div>
    )
  }

  if (!settings) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error || 'Settings not found'}</p>
        <Link href="/admin" className="text-blue-600">
          ← Admin
        </Link>
      </div>
    )
  }

  const shareUrl = buildShareUrl(settings)

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:underline mb-1 inline-block"
          >
            ← Admin
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Public dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{settings.name}</p>
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
        <div className="bg-green-50 text-green-800 text-sm px-4 py-3 rounded-xl">
          {message}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">List on homepage</p>
            <p className="text-sm text-gray-500 mt-0.5">
              When on, anyone can open your board from the public org list (no
              token required). Turning off asks for confirmation.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => setPublicEnabled(!settings.publicViewEnabled)}
            className={`shrink-0 relative w-12 h-7 rounded-full transition-colors ${
              settings.publicViewEnabled ? 'bg-blue-600' : 'bg-gray-300'
            } disabled:opacity-50`}
            aria-label="Toggle public view"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                settings.publicViewEnabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Status:{' '}
          <span
            className={
              settings.publicViewEnabled
                ? 'text-green-700 font-medium'
                : 'text-gray-600'
            }
          >
            {settings.publicViewEnabled ? 'Public' : 'Private'}
          </span>
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <p className="font-semibold text-gray-900">Share link</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Works even when the board is private (uses secret token). Share only
            with people you trust. Rotate asks for confirmation.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-800 break-all font-mono">
          {shareUrl}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyShareLink}
            className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={rotateToken}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50"
          >
            Rotate token
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100"
          >
            Open board
          </a>
        </div>

        <p className="text-xs text-gray-400">
          Slug: <span className="font-mono">{settings.slug}</span>
        </p>
      </div>
    </div>
  )
}