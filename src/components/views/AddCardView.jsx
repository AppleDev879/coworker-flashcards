import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { parseNames, parseNamesSync } from '../../utils/parseNames'

/**
 * Add Card View - Single card or batch import
 *
 * Props:
 * - user: Current authenticated user
 * - onBack: Function to navigate back to manage view
 * - addFlashcard: Function to add a single flashcard
 * - addFlashcardsBatch: Function to add multiple flashcards
 * - refetch: Function to refresh flashcards list
 */
export default function AddCardView({
  user,
  onBack,
  addFlashcard,
  addFlashcardsBatch,
  refetch
}) {
  const [newCoworker, setNewCoworker] = useState({ name: '', photoFile: null, photoPreview: null })
  const [saving, setSaving] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [debouncedImportText, setDebouncedImportText] = useState('')
  const [fetchingImages, setFetchingImages] = useState(new Set())

  // Debounce import text for preview to prevent lag on large inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedImportText(importText)
    }, 300)
    return () => clearTimeout(timer)
  }, [importText])

  // Parse import text for preview (sync, no LLM)
  const parsedPreview = useMemo(() => parseNamesSync(debouncedImportText), [debouncedImportText])

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setNewCoworker(prev => ({
        ...prev,
        photoFile: file,
        photoPreview: event.target.result
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleAddCoworker = async () => {
    if (!newCoworker.name.trim()) return

    setSaving(true)
    try {
      await addFlashcard(newCoworker.name.trim(), newCoworker.photoFile)
      setNewCoworker({ name: '', photoFile: null, photoPreview: null })
      onBack() // Go back to manage view after adding
    } catch (err) {
      console.error('Failed to add coworker:', err)
      alert('Failed to add coworker. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleBatchImport = async () => {
    if (parsedPreview.names.length === 0 && !parsedPreview.needsLLM) return

    setImporting(true)
    try {
      // Use full async parser (includes LLM fallback if needed)
      const { names, imageUrls } = await parseNames(importText)
      if (names.length === 0) {
        alert('No names found in the input.')
        return
      }

      // Bulk insert all names
      const newCards = await addFlashcardsBatch(names)

      // Collect cards that have image URLs to fetch
      const cardsWithImages = newCards.filter(card => imageUrls[card.name])
      const cardIdsWithImages = new Set(cardsWithImages.map(card => card.id))

      setImportText('')
      onBack() // Go back to manage view

      // Start fetching images and track progress
      if (cardsWithImages.length > 0) {
        setFetchingImages(cardIdsWithImages)

        const fetchPromises = cardsWithImages.map(async (card) => {
          try {
            await supabase.functions.invoke('fetch-and-store-image', {
              body: { imageUrl: imageUrls[card.name], flashcardId: card.id, userId: user.id }
            })
          } catch {
            // Silently fail individual fetches
          } finally {
            setFetchingImages(prev => {
              const next = new Set(prev)
              next.delete(card.id)
              return next
            })
          }
        })

        // Refetch flashcards when all done to get updated photo URLs
        Promise.all(fetchPromises).then(() => refetch())
      }
    } catch (err) {
      console.error('Failed to import:', err)
      alert('Failed to import names. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto animate-in">
      <button
        onClick={onBack}
        className="text-coral hover:text-coral-dark mb-6 flex items-center gap-2 font-medium transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="bg-paper rounded-2xl shadow-[0_4px_24px_rgba(45,42,38,0.08)] p-8">
        <h2 className="font-display text-xl font-semibold text-charcoal mb-6">Add a New Face</h2>

        {/* Photo Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-charcoal-light mb-3">Photo</label>
          <div className="aspect-square bg-cream rounded-xl overflow-hidden relative group cursor-pointer border-2 border-dashed border-cream-dark hover:border-coral/50 transition-colors">
            {newCoworker.photoPreview ? (
              <img src={newCoworker.photoPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-warm-gray">
                <div className="w-16 h-16 bg-cream-dark rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-charcoal-light">Click to upload photo</div>
                <div className="text-xs text-warm-gray mt-1">or drag and drop</div>
              </div>
            )}
            <label className="absolute inset-0 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                aria-label="Upload photo for new coworker"
              />
            </label>
          </div>
        </div>

        {/* Decorative line */}
        <div className="decorative-line w-12 mx-auto mb-6" />

        {/* Name Input */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-charcoal-light mb-3">Name</label>
          <input
            type="text"
            value={newCoworker.name}
            onChange={(e) => setNewCoworker(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter their full name"
            className="w-full px-4 py-3 input-warm rounded-xl text-charcoal placeholder:text-warm-gray/60"
          />
        </div>

        <button
          onClick={handleAddCoworker}
          disabled={!newCoworker.name.trim() || saving}
          className="w-full bg-coral text-cream py-4 rounded-xl font-medium btn-lift disabled:bg-cream-dark disabled:text-warm-gray disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          {saving ? 'Adding...' : 'Add Face'}
        </button>
      </div>

      {/* Batch Import Section */}
      <div className="mt-8 bg-paper rounded-2xl shadow-[0_4px_24px_rgba(45,42,38,0.08)] p-8">
        <h2 className="font-display text-xl font-semibold text-charcoal mb-2">
          Import Multiple Names
        </h2>
        <p className="text-sm text-charcoal-light mb-4">
          Paste a list of names (one per line, comma-separated, or JSON)
        </p>

        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={`John Smith\nJane Doe\nMike Johnson\n\n— or JSON —\n[{"name": "John", "photo": "https://..."}]`}
          className="w-full h-40 px-4 py-3 input-warm rounded-xl text-charcoal placeholder:text-warm-gray/40 font-mono text-sm resize-none"
        />

        {(parsedPreview.names.length > 0 || parsedPreview.needsLLM) && (
          <div className="mt-4 p-4 bg-cream rounded-xl">
            {parsedPreview.names.length > 0 ? (
              <>
                <div className="text-sm text-charcoal-light mb-2">
                  Found {parsedPreview.names.length} name{parsedPreview.names.length !== 1 ? 's' : ''}:
                </div>
                <div className="flex flex-wrap gap-2">
                  {parsedPreview.names.slice(0, 10).map((name, i) => (
                    <span key={i} className="px-3 py-1 bg-paper rounded-full text-sm text-charcoal shadow-sm">
                      {name}
                    </span>
                  ))}
                  {parsedPreview.names.length > 10 && (
                    <span className="px-3 py-1 text-sm text-warm-gray">
                      +{parsedPreview.names.length - 10} more
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-charcoal-light flex items-center gap-2">
                <svg className="w-4 h-4 text-dusty-rose" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Complex format detected — AI will extract names on import
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleBatchImport}
          disabled={(parsedPreview.names.length === 0 && !parsedPreview.needsLLM) || importing}
          className="mt-4 w-full bg-sage text-cream py-4 rounded-xl font-medium btn-lift disabled:bg-cream-dark disabled:text-warm-gray disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          {importing
            ? 'Importing...'
            : parsedPreview.needsLLM && parsedPreview.names.length === 0
            ? 'Import with AI'
            : `Import ${parsedPreview.names.length} Name${parsedPreview.names.length !== 1 ? 's' : ''} as Drafts`}
        </button>
      </div>
    </div>
  )
}
