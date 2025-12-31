import { useState } from 'react'

/**
 * ShareModal - Modal for managing deck sharing settings
 *
 * Props:
 * - deck: The deck object with share_token and is_shared
 * - isOpen: Whether modal is visible
 * - onClose: Function to close the modal
 * - onToggleShare: Function to toggle sharing (called with isShared boolean)
 * - onRegenerateToken: Function to regenerate share token
 */
export default function ShareModal({
  deck,
  isOpen,
  onClose,
  onToggleShare,
  onRegenerateToken
}) {
  const [copied, setCopied] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  if (!isOpen || !deck) return null

  const shareUrl = `${window.location.origin}/shared/${deck.share_token}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = shareUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleToggleShare = async () => {
    setToggling(true)
    try {
      await onToggleShare(!deck.is_shared)
    } finally {
      setToggling(false)
    }
  }

  const handleRegenerate = async () => {
    if (!confirm('This will invalidate the current share link. Anyone with the old link will no longer be able to access this deck. Continue?')) {
      return
    }
    setRegenerating(true)
    try {
      await onRegenerateToken()
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-paper rounded-2xl shadow-[0_8px_40px_rgba(45,42,38,0.15)] w-full max-w-md animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cream-dark">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            Share Deck
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-warm-gray hover:text-charcoal transition-colors cursor-pointer rounded-lg hover:bg-cream-dark"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Toggle sharing */}
          <div className="flex items-center justify-between mb-6 p-4 bg-cream rounded-xl">
            <div>
              <div className="font-medium text-charcoal mb-0.5">Enable sharing</div>
              <div className="text-sm text-warm-gray">Anyone with the link can practice</div>
            </div>
            <button
              onClick={handleToggleShare}
              disabled={toggling}
              className={`relative w-14 h-8 rounded-full transition-colors cursor-pointer ${
                deck.is_shared ? 'bg-sage' : 'bg-cream-dark'
              }`}
            >
              <span
                className={`absolute top-1 w-6 h-6 rounded-full bg-paper shadow-sm transition-transform ${
                  deck.is_shared ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Share link section */}
          {deck.is_shared && (
            <div className="space-y-4 animate-in">
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-2">
                  Share link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-4 py-2.5 bg-cream rounded-lg text-charcoal text-sm font-mono truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-2.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      copied
                        ? 'bg-sage text-cream'
                        : 'bg-coral text-paper hover:bg-coral/90'
                    }`}
                  >
                    {copied ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </span>
                    ) : (
                      'Copy'
                    )}
                  </button>
                </div>
              </div>

              {/* Info about what guests can do */}
              <div className="p-4 bg-sage/10 rounded-xl">
                <div className="text-sm text-charcoal-light">
                  <div className="font-medium text-sage mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    What guests can do:
                  </div>
                  <ul className="space-y-1 text-warm-gray">
                    <li className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Practice all cards
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      View memory tips
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Edit cards (login required)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Save scores (login required)</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Regenerate link */}
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="w-full py-2.5 text-sm text-warm-gray hover:text-coral transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {regenerating ? 'Regenerating...' : 'Generate new link'}
              </button>
            </div>
          )}

          {!deck.is_shared && (
            <p className="text-center text-warm-gray text-sm">
              Enable sharing to get a link you can send to others.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
