'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/api'
import { setAuth, isLoggedIn, getUser } from '@/lib/auth'

function redirectByRole(
  role: string,
  router: ReturnType<typeof useRouter>
) {
  if (role === 'SUPER_ADMIN') router.replace('/admin')
  else if (role === 'POSITION_ADMIN') router.replace('/ops')
  else router.replace('/agent')
}

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn()) return
    const user = getUser()
    if (user?.role) redirectByRole(user.role, router)
  }, [router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const digits = phone.replace(/\D/g, '')
      const result = await login(digits)
      setAuth(result.token, result.user)
      redirectByRole(result.user.role, router)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const digitsOnly = phone.replace(/\D/g, '')
  const canSubmit = digitsOnly.length >= 10 && !loading

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Login</h1>
          <p className="text-gray-500 mt-2">
            Enter your registered phone number
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5"
        >
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="2547XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3.5 text-lg text-gray-900 bg-white border border-gray-300 rounded-xl placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              autoComplete="tel"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Format: 2547XXXXXXXX (Kenyan mobile)
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-4 text-lg font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? 'Signing in…'
              : digitsOnly.length < 10
                ? `Enter phone (${digitsOnly.length}/10)`
                : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Agents and admins use the same login.
        </p>
      </div>
    </div>
  )
}