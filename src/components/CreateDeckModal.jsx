import { useState } from 'react'

export default function CreateDeckModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setLoading(true)
      setError(null)
      await onCreate(name.trim(), description.trim())
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-paper rounded-2xl shadow-2xl w-full max-w-md animate-in overflow-hidden">
        {/* Decorative header */}
        <div className="h-2 decorative-line" style={{ borderRadius: 0 }} />

        <div className="p-6">
          <h2 className="font-display text-2xl font-semibold text-charcoal mb-1">
            Create New Deck
          </h2>
          <p className="text-warm-gray text-sm mb-6">
            A deck is a collection of faces to memorize together
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="deck-name" className="block text-sm font-medium text-charcoal mb-1.5">
                Deck Name
              </label>
              <input
                id="deck-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Work Team, Book Club, Neighbors"
                className="w-full px-4 py-3 rounded-xl input-warm"
                autoFocus
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="deck-description" className="block text-sm font-medium text-charcoal mb-1.5">
                Description <span className="text-warm-gray font-normal">(optional)</span>
              </label>
              <textarea
                id="deck-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a note about this group..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl input-warm resize-none"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-coral/10 border border-coral/20 rounded-xl text-coral text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-3 text-charcoal font-medium rounded-xl border-2 border-cream-dark hover:bg-cream-dark/50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 px-4 py-3 bg-coral text-paper font-medium rounded-xl btn-lift shadow-lg shadow-coral/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  'Create Deck'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
