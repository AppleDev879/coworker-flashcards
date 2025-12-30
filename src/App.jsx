import { useState, useMemo, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { useFlashcards } from './hooks/useFlashcards'
import { supabase } from './lib/supabase'
import { parseNames, parseNamesSync } from './utils/parseNames'
import LoginPage from './components/LoginPage'
import Header from './components/Header'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const {
    flashcards,
    loading: dataLoading,
    addFlashcard,
    addFlashcardsBatch,
    updatePhoto,
    updateFlashcard,
    deleteFlashcard,
    generateMnemonic,
    refetch
  } = useFlashcards()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [mode, setMode] = useState('practice')
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const [shuffledIndices, setShuffledIndices] = useState([])
  const [difficulty, setDifficulty] = useState('first') // 'first' or 'full'
  const [newCoworker, setNewCoworker] = useState({ name: '', photoFile: null, photoPreview: null })
  const [generatingMnemonicId, setGeneratingMnemonicId] = useState(null)
  const [editingMnemonicId, setEditingMnemonicId] = useState(null)
  const [customMnemonicText, setCustomMnemonicText] = useState('')
  const [saving, setSaving] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [fetchingImages, setFetchingImages] = useState(new Set()) // Track cards with images being fetched

  // Parse import text for preview (sync, no LLM)
  const parsedPreview = useMemo(() => parseNamesSync(importText), [importText])

  // Filter cards with photos for practice mode
  const practiceCards = useMemo(() => flashcards.filter(c => c.photo_url), [flashcards])
  const draftCount = flashcards.length - practiceCards.length

  // Reset shuffle when cards change
  useEffect(() => {
    setShuffledIndices([])
    setCurrentIndex(0)
  }, [practiceCards.length])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-cream grain-bg flex items-center justify-center">
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-coral/20 rounded-full flex items-center justify-center">
            <div className="w-6 h-6 bg-coral rounded-full animate-pulse" />
          </div>
          <span className="text-warm-gray font-medium">Loading...</span>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage />
  }

  // Use shuffled order if available, otherwise sequential
  const actualCardIndex = shuffledIndices.length > 0 ? shuffledIndices[currentIndex] : currentIndex
  const currentCoworker = practiceCards[actualCardIndex]

  const handleFileUpload = (e, isEditing = false, editId = null) => {
    const file = e.target.files[0]
    if (!file) return

    if (isEditing && editId) {
      // Update existing flashcard photo
      handleUpdatePhoto(editId, file)
    } else {
      // Preview for new flashcard
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
  }

  const handleUpdatePhoto = async (id, file) => {
    setSaving(true)
    try {
      await updatePhoto(id, file)
    } catch (err) {
      console.error('Failed to update photo:', err)
      alert('Failed to update photo. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCoworker = async () => {
    if (!newCoworker.name.trim()) return

    setSaving(true)
    try {
      await addFlashcard(newCoworker.name.trim(), newCoworker.photoFile)
      setNewCoworker({ name: '', photoFile: null, photoPreview: null })
      setMode('manage')
    } catch (err) {
      console.error('Failed to add coworker:', err)
      alert('Failed to add coworker. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveCoworker = async (id) => {
    try {
      await deleteFlashcard(id)
      if (currentIndex >= flashcards.length - 1) {
        setCurrentIndex(Math.max(0, flashcards.length - 2))
      }
    } catch (err) {
      console.error('Failed to remove coworker:', err)
      alert('Failed to remove coworker. Please try again.')
    }
  }

  const handleClearAll = async () => {
    if (!confirm(`Are you sure you want to delete all ${flashcards.length} faces? This cannot be undone.`)) {
      return
    }

    try {
      await Promise.all(flashcards.map(card => deleteFlashcard(card.id)))
      setCurrentIndex(0)
    } catch (err) {
      console.error('Failed to clear all:', err)
      alert('Failed to clear all. Please try again.')
    }
  }

  const handleGenerateMnemonic = async (id) => {
    setGeneratingMnemonicId(id)
    try {
      await generateMnemonic(id)
    } catch (err) {
      console.error('Failed to generate mnemonic:', err)
      alert(err.message || 'Failed to generate mnemonic. Please try again.')
    } finally {
      setGeneratingMnemonicId(null)
    }
  }

  const handleSaveCustomMnemonic = async (id) => {
    if (!customMnemonicText.trim()) return

    setSaving(true)
    try {
      await updateFlashcard(id, { mnemonic: customMnemonicText.trim() })
      setEditingMnemonicId(null)
      setCustomMnemonicText('')
    } catch (err) {
      console.error('Failed to save mnemonic:', err)
      alert('Failed to save mnemonic. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const startEditingMnemonic = (coworker) => {
    setEditingMnemonicId(coworker.id)
    setCustomMnemonicText(coworker.mnemonic || '')
  }

  const cancelEditingMnemonic = () => {
    setEditingMnemonicId(null)
    setCustomMnemonicText('')
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
      setMode('manage')

      // Start fetching images and track progress
      if (cardsWithImages.length > 0) {
        setFetchingImages(cardIdsWithImages)

        const fetchPromises = cardsWithImages.map(async (card) => {
          try {
            await supabase.functions.invoke('fetch-and-store-image', {
              body: { imageUrl: imageUrls[card.name], flashcardId: card.id, userId: user.id }
            })
          } catch (e) {
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

  const checkGuess = () => {
    const guessLower = guess.toLowerCase().trim()
    const fullName = currentCoworker.name.toLowerCase().trim()
    const firstName = fullName.split(' ')[0]

    const target = difficulty === 'first' ? firstName : fullName
    const isCorrect = guessLower === target

    setFeedback(isCorrect ? 'correct' : 'incorrect')
    setShowAnswer(true)
    setStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }))
  }

  const nextCard = () => {
    setGuess('')
    setFeedback(null)
    setShowAnswer(false)
    setCurrentIndex((currentIndex + 1) % practiceCards.length)
  }

  const shuffleCards = () => {
    // Fisher-Yates shuffle
    const indices = [...Array(practiceCards.length).keys()]
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    setShuffledIndices(indices)
    setCurrentIndex(0)
    setGuess('')
    setFeedback(null)
    setShowAnswer(false)
  }

  const restartPractice = () => {
    setStats({ correct: 0, total: 0 })
    shuffleCards() // This resets index, guess, feedback, showAnswer and shuffles
  }

  // Check if practice session is complete
  const isSessionComplete = stats.total > 0 && stats.total >= practiceCards.length

  // Practice Mode
  if (mode === 'practice') {
    if (dataLoading) {
      return (
        <div className="min-h-screen bg-cream grain-bg">
          <Header />
          <div className="flex items-center justify-center p-4 sm:p-6 pt-16 sm:pt-24">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 shimmer rounded-2xl" />
              <span className="text-warm-gray">Loading flashcards...</span>
            </div>
          </div>
        </div>
      )
    }

    if (practiceCards.length === 0) {
      return (
        <div className="min-h-screen bg-cream grain-bg">
          <Header />
          <div className="flex items-center justify-center p-4 sm:p-6 pt-12 sm:pt-24">
            <div className="relative z-10 animate-in w-full max-w-md">
              {/* Decorative blurs */}
              <div className="absolute -top-12 -left-12 w-40 h-40 bg-coral/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-sage/10 rounded-full blur-3xl" />

              <div className="relative bg-paper rounded-2xl shadow-[0_4px_24px_rgba(45,42,38,0.08)] p-6 sm:p-10 text-center">
                <div className="w-20 h-20 bg-cream rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-inner">
                  <svg className="w-10 h-10 text-coral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <h1 className="font-display text-2xl font-semibold text-charcoal mb-3">
                  {draftCount > 0 ? 'No cards ready to practice' : 'No faces yet!'}
                </h1>
                <p className="text-charcoal-light mb-8">
                  {draftCount > 0
                    ? `You have ${draftCount} draft${draftCount > 1 ? 's' : ''} that need${draftCount === 1 ? 's' : ''} photos.`
                    : 'Add your coworkers to start learning their names.'}
                </p>
                <button
                  onClick={() => setMode(draftCount > 0 ? 'manage' : 'add')}
                  className="bg-coral text-cream px-8 py-4 rounded-xl font-medium btn-lift"
                >
                  {draftCount > 0 ? 'Add Photos to Drafts' : 'Add Your First Face'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Session complete - show results
    if (isSessionComplete) {
      const percentage = Math.round((stats.correct / stats.total) * 100)
      const isPerfect = percentage === 100
      const isGreat = percentage >= 80
      const isGood = percentage >= 60

      return (
        <div className="min-h-screen bg-cream grain-bg">
          <Header />
          <div className="flex items-center justify-center p-4 sm:p-6 pt-8 sm:pt-16">
            <div className="relative z-10 animate-in max-w-md w-full">
              {/* Decorative background elements */}
              <div className="absolute -top-16 -left-16 w-48 h-48 bg-sage/15 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-coral/10 rounded-full blur-3xl" />
              {isPerfect && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 w-32 h-32 bg-dusty-rose/20 rounded-full blur-2xl" />
              )}

              <div className="relative bg-paper rounded-3xl shadow-[0_8px_40px_rgba(45,42,38,0.12)] overflow-hidden">
                {/* Celebratory header */}
                <div className={`py-8 px-6 text-center ${
                  isPerfect ? 'bg-gradient-to-br from-sage/20 via-dusty-rose/10 to-coral/10' :
                  isGreat ? 'bg-sage/10' :
                  isGood ? 'bg-dusty-rose/10' :
                  'bg-cream'
                }`}>
                  {/* Trophy/Star icon */}
                  <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                    isPerfect ? 'bg-gradient-to-br from-sage to-sage/80 shadow-lg shadow-sage/30' :
                    isGreat ? 'bg-sage/20' :
                    isGood ? 'bg-dusty-rose/20' :
                    'bg-cream-dark'
                  }`}>
                    {isPerfect ? (
                      <svg className="w-10 h-10 text-cream" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ) : (
                      <svg className={`w-10 h-10 ${isGreat ? 'text-sage' : isGood ? 'text-dusty-rose' : 'text-warm-gray'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                      </svg>
                    )}
                  </div>

                  <h1 className="font-display text-2xl font-semibold text-charcoal mb-2">
                    {isPerfect ? 'Perfect Score!' :
                     isGreat ? 'Great Job!' :
                     isGood ? 'Nice Work!' :
                     'Session Complete'}
                  </h1>
                  <p className="text-charcoal-light">
                    {isPerfect ? 'You know everyone!' :
                     isGreat ? "You're getting really good at this." :
                     isGood ? 'Keep practicing to improve.' :
                     'Practice makes perfect.'}
                  </p>
                </div>

                {/* Score display */}
                <div className="p-6 sm:p-8">
                  <div className="bg-cream rounded-2xl p-4 sm:p-6 mb-6">
                    {/* Big percentage */}
                    <div className="text-center mb-4">
                      <div className={`font-display text-5xl sm:text-6xl font-bold ${
                        isPerfect ? 'text-sage' :
                        isGreat ? 'text-sage' :
                        isGood ? 'text-dusty-rose' :
                        'text-coral'
                      }`}>
                        {percentage}%
                      </div>
                      <div className="text-warm-gray text-sm mt-1">accuracy</div>
                    </div>

                    {/* Breakdown */}
                    <div className="flex justify-center gap-6 sm:gap-8 pt-4 border-t border-cream-dark">
                      <div className="text-center">
                        <div className="font-display text-xl sm:text-2xl font-semibold text-sage">{stats.correct}</div>
                        <div className="text-xs text-warm-gray uppercase tracking-wide">Correct</div>
                      </div>
                      <div className="text-center">
                        <div className="font-display text-xl sm:text-2xl font-semibold text-coral">{stats.total - stats.correct}</div>
                        <div className="text-xs text-warm-gray uppercase tracking-wide">Missed</div>
                      </div>
                      <div className="text-center">
                        <div className="font-display text-xl sm:text-2xl font-semibold text-charcoal">{stats.total}</div>
                        <div className="text-xs text-warm-gray uppercase tracking-wide">Total</div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={restartPractice}
                      className="w-full bg-coral text-cream py-4 rounded-xl font-medium btn-lift flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Try Again
                    </button>
                    <button
                      onClick={() => setMode('manage')}
                      className="w-full py-4 rounded-xl font-medium border-2 border-cream-dark text-charcoal-light hover:bg-cream transition-colors"
                    >
                      Manage Cards
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-cream grain-bg">
        <Header />
        <div className="p-4 sm:p-6 pt-6 sm:pt-8">
          <div className="max-w-md mx-auto animate-in">
            {/* Stats Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="text-sm">
                  {stats.total > 0 && (
                    <span className="bg-paper px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-sm text-charcoal-light border border-cream-dark">
                      <span className="text-sage font-semibold">{stats.correct}</span>
                      <span className="text-warm-gray">/{stats.total}</span>
                      <span className="text-warm-gray ml-1">({Math.round(stats.correct/stats.total*100)}%)</span>
                    </span>
                  )}
                </div>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 bg-paper border border-cream-dark rounded-lg text-sm text-charcoal focus:outline-none focus:border-coral/50 cursor-pointer"
                >
                  <option value="first">First name</option>
                  <option value="full">Full name</option>
                </select>
              </div>
              <button
                onClick={() => setMode('manage')}
                className="text-coral hover:text-coral-dark font-medium transition-colors text-sm sm:text-base"
              >
                Manage Cards
              </button>
            </div>

            {/* Flashcard - Polaroid Style */}
            <div className="polaroid rounded-xl overflow-hidden">
              {/* Photo */}
              <div className="aspect-square bg-cream-dark flex items-center justify-center overflow-hidden photo-hover">
                {currentCoworker?.photo_url ? (
                  <img
                    src={currentCoworker.photo_url}
                    alt="Coworker"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-warm-gray">
                    <svg className="w-20 h-20 mb-2 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Card Info */}
              <div className="pt-4 pb-2 text-center">
                <span className="text-xs font-medium text-warm-gray tracking-wide uppercase">
                  Card {currentIndex + 1} of {practiceCards.length}
                </span>
              </div>

              {/* Input Area */}
              <div className="px-4 pb-6">
                {!showAnswer ? (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && guess && checkGuess()}
                      placeholder={difficulty === 'first' ? "First name?" : "Full name?"}
                      className="w-full px-4 py-3 input-warm rounded-xl text-lg text-charcoal font-medium placeholder:text-warm-gray/60"
                      autoFocus
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={checkGuess}
                        disabled={!guess}
                        className="flex-1 bg-charcoal text-cream py-3 rounded-xl font-medium btn-lift disabled:bg-cream-dark disabled:text-warm-gray disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                      >
                        Check
                      </button>
                      <button
                        onClick={() => {
                          setShowAnswer(true)
                          setFeedback('incorrect')
                          setStats(prev => ({ ...prev, total: prev.total + 1 }))
                        }}
                        className="px-5 py-3 border-2 border-cream-dark rounded-xl text-charcoal-light hover:bg-cream-dark transition-colors"
                      >
                        Reveal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Result */}
                    <div className={`text-center p-5 rounded-xl ${
                      feedback === 'correct'
                        ? 'bg-sage/10 border-2 border-sage/30'
                        : feedback === 'incorrect'
                        ? 'bg-coral/10 border-2 border-coral/30'
                        : 'bg-cream border-2 border-cream-dark'
                    } ${feedback ? 'animate-success' : ''}`}>
                      {feedback === 'correct' && (
                        <div className="text-sage font-medium mb-2 flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Correct!
                        </div>
                      )}
                      {feedback === 'incorrect' && (
                        <div className="text-coral font-medium mb-2 flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Not quite
                        </div>
                      )}
                      <div className="font-display text-2xl font-semibold text-charcoal">{currentCoworker.name}</div>
                    </div>

                    {/* Mnemonic */}
                    {currentCoworker.mnemonic && (
                      <div className="bg-dusty-rose/10 border border-dusty-rose/30 rounded-xl p-4">
                        <div className="text-xs font-semibold text-dusty-rose uppercase tracking-wide mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          Memory Tip
                        </div>
                        <div className="text-charcoal-light leading-relaxed">{currentCoworker.mnemonic}</div>
                      </div>
                    )}

                    <button
                      onClick={nextCard}
                      className="w-full bg-coral text-cream py-3 rounded-xl font-medium btn-lift flex items-center justify-center gap-2"
                    >
                      Next Card
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Shuffle Button */}
            <button
              onClick={shuffleCards}
              className="w-full mt-6 py-3 text-coral font-medium hover:bg-paper rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Shuffle Cards
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Manage Mode
  if (mode === 'manage') {
    return (
      <div className="min-h-screen bg-cream grain-bg">
        <Header />
        <div className="p-4 sm:p-6 pt-6 sm:pt-8">
          <div className="max-w-2xl mx-auto animate-in">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-semibold text-charcoal">Your Faces</h1>
                {draftCount > 0 && (
                  <p className="text-sm text-warm-gray mt-1">
                    {draftCount} draft{draftCount !== 1 ? 's' : ''} need{draftCount === 1 ? 's' : ''} photos
                  </p>
                )}
              </div>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => setMode('add')}
                  className="bg-coral text-cream px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-medium btn-lift flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base flex-1 sm:flex-none justify-center"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add</span>
                </button>
                {flashcards.length > 0 && (
                  <button
                    onClick={() => { setMode('practice'); setStats({ correct: 0, total: 0 }); }}
                    className="bg-sage text-cream px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-medium btn-lift flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base flex-1 sm:flex-none justify-center"
                  >
                    <span>Practice</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {dataLoading ? (
              <div className="bg-paper rounded-2xl p-10 text-center shadow-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 shimmer rounded-2xl" />
                  <span className="text-warm-gray">Loading...</span>
                </div>
              </div>
            ) : flashcards.length === 0 ? (
              <div className="bg-paper rounded-2xl p-10 text-center shadow-sm">
                <div className="w-16 h-16 bg-cream rounded-xl mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <p className="text-charcoal-light">No faces added yet. Click "Add New" to get started!</p>
              </div>
            ) : (
              <div className="space-y-4 stagger-children">
                {flashcards.map((coworker, index) => (
                  <div key={coworker.id} className={`bg-paper rounded-2xl shadow-sm p-4 sm:p-5 flex gap-3 sm:gap-5 hover:shadow-md transition-shadow ${!coworker.photo_url ? 'border-2 border-dashed border-cream-dark' : ''}`} style={{ animationDelay: `${index * 50}ms` }}>
                    {/* Photo */}
                    <div className="w-16 h-16 sm:w-24 sm:h-24 bg-cream-dark rounded-xl flex-shrink-0 overflow-hidden relative group">
                      {/* Draft badge */}
                      {!coworker.photo_url && !fetchingImages.has(coworker.id) && (
                        <span className="absolute top-1 left-1 z-10 px-2 py-0.5 bg-dusty-rose text-cream text-xs font-medium rounded-full">
                          Draft
                        </span>
                      )}
                      {/* Fetching spinner */}
                      {fetchingImages.has(coworker.id) && (
                        <div className="absolute inset-0 z-10 bg-cream-dark flex items-center justify-center">
                          <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      {coworker.photo_url ? (
                        <img src={coworker.photo_url} alt={coworker.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-10 h-10 text-warm-gray/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        </div>
                      )}
                      <label className="absolute inset-0 bg-charcoal/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                        <span className="text-cream text-sm font-medium">{saving ? 'Uploading...' : 'Change'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={saving}
                          onChange={(e) => handleFileUpload(e, true, coworker.id)}
                        />
                      </label>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 py-1">
                      <h3 className="font-display font-semibold text-lg text-charcoal mb-1">{coworker.name}</h3>

                      {/* Mnemonic editing mode */}
                      {editingMnemonicId === coworker.id ? (
                        <div className="mt-2">
                          <textarea
                            value={customMnemonicText}
                            onChange={(e) => setCustomMnemonicText(e.target.value)}
                            placeholder="Enter your memory tip..."
                            className="w-full px-3 py-2 input-warm rounded-lg text-sm resize-none"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleSaveCustomMnemonic(coworker.id)}
                              disabled={saving || !customMnemonicText.trim()}
                              className="px-3 py-1.5 bg-sage text-cream text-sm rounded-lg btn-lift disabled:bg-cream-dark disabled:text-warm-gray"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditingMnemonic}
                              className="px-3 py-1.5 text-sm text-warm-gray hover:text-charcoal"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : coworker.mnemonic ? (
                        <div>
                          <p className="text-sm text-charcoal-light leading-relaxed flex items-start gap-2">
                            <svg className="w-4 h-4 text-dusty-rose flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            {coworker.mnemonic}
                          </p>
                          <div className="flex gap-3 mt-2">
                            <button
                              onClick={() => startEditingMnemonic(coworker)}
                              className="text-xs text-warm-gray hover:text-coral transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleGenerateMnemonic(coworker.id)}
                              disabled={generatingMnemonicId === coworker.id}
                              className="text-xs text-warm-gray hover:text-coral transition-colors"
                            >
                              {generatingMnemonicId === coworker.id ? 'Generating...' : 'Regenerate'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 mt-1">
                          <button
                            onClick={() => handleGenerateMnemonic(coworker.id)}
                            disabled={generatingMnemonicId === coworker.id || !coworker.photo_url}
                            className="text-sm text-coral hover:text-coral-dark disabled:text-warm-gray flex items-center gap-1.5 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            {generatingMnemonicId === coworker.id ? 'Generating...' : 'Generate with AI'}
                          </button>
                          <button
                            onClick={() => startEditingMnemonic(coworker)}
                            className="text-sm text-sage hover:text-sage-light flex items-center gap-1.5 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Write your own
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col justify-center gap-2">
                      <button
                        onClick={() => handleRemoveCoworker(coworker.id)}
                        className="text-xs text-warm-gray hover:text-coral transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                {/* Clear All Button */}
                <div className="pt-8 mt-4 border-t border-cream-dark">
                  <button
                    onClick={handleClearAll}
                    className="w-full py-3 text-sm text-warm-gray hover:text-coral transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Add Mode
  if (mode === 'add') {
    return (
      <div className="min-h-screen bg-cream grain-bg">
        <Header />
        <div className="p-4 sm:p-6 pt-6 sm:pt-8">
          <div className="max-w-md mx-auto animate-in">
            <button
              onClick={() => setMode('manage')}
              className="text-coral hover:text-coral-dark mb-6 flex items-center gap-2 font-medium transition-colors"
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
                      onChange={(e) => handleFileUpload(e)}
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
        </div>
      </div>
    )
  }
}
