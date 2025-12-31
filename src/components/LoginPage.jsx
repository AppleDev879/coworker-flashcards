import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream grain-bg flex items-center justify-center p-6">
      <div className="relative z-10 w-full max-w-md">
        {/* Decorative background elements */}
        <div className="absolute -top-8 -left-8 w-32 h-32 bg-coral/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-sage/10 rounded-full blur-3xl" />

        {/* Main card */}
        <div className="relative bg-paper rounded-2xl p-10 shadow-[0_4px_24px_rgba(45,42,38,0.08)] animate-in">
          {/* Logo/Brand */}
          <div className="text-center mb-8 stagger-children">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-cream rounded-2xl mb-6 shadow-inner">
              <svg className="w-10 h-10 text-coral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>

            <h1 className="font-display text-3xl font-semibold text-charcoal tracking-tight mb-3">
              Face Card
            </h1>

            <p className="text-charcoal-light text-base leading-relaxed">
              Remember every name, every face.<br />
              <span className="text-warm-gray">AI-powered memory tips included.</span>
            </p>
          </div>

          {/* Decorative line */}
          <div className="decorative-line w-16 mx-auto mb-8" />

          {/* Error message */}
          {error && (
            <div className="bg-coral/10 border border-coral/20 text-coral-dark px-4 py-3 rounded-xl mb-6 text-sm animate-error">
              {error}
            </div>
          )}

          {/* Sign in button */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-charcoal text-cream px-6 py-4 rounded-xl font-medium btn-lift disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
              <path
                fill="#FBF8F3"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#A8D4BC"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#F4A693"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#E07A5F"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
          </button>

          {/* Footer */}
          <p className="text-warm-gray text-xs text-center mt-8 leading-relaxed">
            Your flashcards are private and secure.<br />
            Only you can see your data.
          </p>
        </div>

        {/* Bottom decorative text */}
        <p className="text-center text-warm-gray/60 text-xs mt-6 font-display italic">
          "A person's name is the sweetest sound."
        </p>
      </div>
    </div>
  )
}
