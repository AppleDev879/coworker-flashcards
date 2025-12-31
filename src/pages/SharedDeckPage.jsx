import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePersonalMnemonics } from '../hooks/usePersonalMnemonics'
import { useLeaderboard } from '../hooks/useLeaderboard'
import RocketGame from '../components/RocketGame'
import ManageView from '../components/views/ManageView'
import LeaderboardView from '../components/views/LeaderboardView'

export default function SharedDeckPage() {
  const { shareToken } = useParams()
  const { user } = useAuth()
  const [deck, setDeck] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('practice') // 'practice' | 'browse' | 'leaderboard'

  // Practice state
  const [isPracticing, setIsPracticing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const [shuffledIndices, setShuffledIndices] = useState([])
  const [difficulty, setDifficulty] = useState('first')

  // Game modes
  const [gameMode, setGameMode] = useState('classic')
  const [startTime, setStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [rocketHeight, setRocketHeight] = useState(50)
  const [rocketCrashed, setRocketCrashed] = useState(false)
  const [rocketBoosting, setRocketBoosting] = useState(false)

  // Correction mode for wrong answers
  const [lastGuess, setLastGuess] = useState('')
  const [correctionInput, setCorrectionInput] = useState('')
  const [correctionComplete, setCorrectionComplete] = useState(false)

  // Mnemonic editing (for authenticated users)
  const [editingMnemonic, setEditingMnemonic] = useState(false)
  const [mnemonicText, setMnemonicText] = useState('')
  const [savingMnemonic, setSavingMnemonic] = useState(false)

  // Get flashcard IDs for personal mnemonics
  const flashcardIds = useMemo(() => {
    return (deck?.flashcards || []).map(f => f.id)
  }, [deck])

  // Personal mnemonics hook (only for authenticated users)
  const { getMnemonic, updateMnemonic } = usePersonalMnemonics(flashcardIds)

  // Leaderboard hook
  const { submitScore, isPersonalBest, getEntriesByMode, refetch: refetchLeaderboard } = useLeaderboard(deck?.id)

  useEffect(() => {
    async function fetchSharedDeck() {
      if (!shareToken) return

      // Validate shareToken is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(shareToken)) {
        setError('Invalid share link')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('decks')
          .select(`
            *,
            flashcards (*)
          `)
          .eq('share_token', shareToken)
          .eq('is_shared', true)
          .single()

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setError('This deck is not available. It may have been unshared or deleted.')
          } else {
            throw fetchError
          }
          return
        }

        setDeck(data)
      } catch (err) {
        console.error('Error fetching shared deck:', err)
        setError('Unable to load this deck. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchSharedDeck()
  }, [shareToken])

  // Practice cards (only those with photos)
  const practiceCards = useMemo(() => {
    return (deck?.flashcards || []).filter(c => c.photo_url)
  }, [deck])

  // Current card based on shuffle
  const currentCoworker = useMemo(() => {
    const actualIndex = shuffledIndices.length > 0 ? shuffledIndices[currentIndex] : currentIndex
    return practiceCards[actualIndex]
  }, [practiceCards, shuffledIndices, currentIndex])

  // Session complete check
  const isSessionComplete = (stats.total > 0 && stats.total >= practiceCards.length) || rocketCrashed

  // Get effective mnemonic (personal mnemonic overrides deck's default)
  const getEffectiveMnemonic = useCallback((card) => {
    if (!card) return ''
    // If user is authenticated, check for personal mnemonic first
    if (user) {
      const personal = getMnemonic(card.id)
      if (personal) return personal
    }
    // Fall back to deck's default mnemonic
    return card.mnemonic || ''
  }, [user, getMnemonic])

  // Save mnemonic handler
  const handleSaveMnemonic = async () => {
    if (!currentCoworker || !mnemonicText.trim()) return
    setSavingMnemonic(true)
    try {
      await updateMnemonic(currentCoworker.id, mnemonicText.trim())
      setEditingMnemonic(false)
      setMnemonicText('')
    } catch (err) {
      console.error('Failed to save mnemonic:', err)
      alert('Failed to save memory tip. Please try again.')
    } finally {
      setSavingMnemonic(false)
    }
  }

  // Reset card state
  const resetCardState = useCallback(() => {
    setGuess('')
    setFeedback(null)
    setShowAnswer(false)
    setLastGuess('')
    setCorrectionInput('')
    setCorrectionComplete(false)
    setEditingMnemonic(false)
    setMnemonicText('')
  }, [])

  // Next card
  const nextCard = useCallback(() => {
    resetCardState()
    setCurrentIndex(prev => (prev + 1) % practiceCards.length)
  }, [resetCardState, practiceCards.length])

  const nextCardRef = useRef(nextCard)
  useEffect(() => { nextCardRef.current = nextCard }, [nextCard])

  // Shuffle cards
  const shuffleCards = useCallback(() => {
    const indices = [...Array(practiceCards.length).keys()]
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    setShuffledIndices(indices)
    setCurrentIndex(0)
    resetCardState()
  }, [practiceCards.length, resetCardState])

  // Start practice
  const startPractice = () => {
    setIsPracticing(true)
    setStats({ correct: 0, total: 0 })
    setStartTime(null)
    setElapsedTime(0)
    setRocketHeight(50)
    setRocketCrashed(false)
    shuffleCards()
  }

  // Restart practice
  const restartPractice = () => {
    setStats({ correct: 0, total: 0 })
    setStartTime(null)
    setElapsedTime(0)
    setRocketHeight(50)
    setRocketCrashed(false)
    setRocketBoosting(false)
    shuffleCards()
  }

  // Timer for timed mode
  useEffect(() => {
    if (gameMode !== 'timed' || !startTime || isSessionComplete) return

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 100)

    return () => clearInterval(interval)
  }, [gameMode, startTime, isSessionComplete])

  // Rocket crash handler
  const handleRocketCrash = useCallback(() => {
    setRocketCrashed(true)
    setRocketHeight(0)
  }, [])

  // Gravity active check
  const gravityActive = gameMode === 'rocket' && isPracticing && !showAnswer && !rocketCrashed && !isSessionComplete

  // Keyboard shortcuts
  useEffect(() => {
    if (!isPracticing || !currentCoworker || isSessionComplete) return

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (showAnswer) {
        if (e.key === 'Enter') {
          if (feedback === 'correct' || feedback === 'nickname' || correctionComplete) {
            e.preventDefault()
            nextCardRef.current()
          }
        }
      } else {
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault()
          setShowAnswer(true)
          setFeedback('incorrect')
          setLastGuess('')
          setCorrectionInput('')
          setCorrectionComplete(false)
          setStats(prev => ({ ...prev, total: prev.total + 1 }))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPracticing, showAnswer, feedback, correctionComplete, currentCoworker, isSessionComplete])

  // Check guess
  const checkGuess = () => {
    const guessLower = guess.toLowerCase().trim()
    const fullName = currentCoworker.name.toLowerCase().trim()
    const firstName = fullName.split(' ')[0]
    const nicknames = (currentCoworker.nicknames || []).map(n => n.toLowerCase())

    const target = difficulty === 'first' ? firstName : fullName
    const isCorrect = guessLower === target
    const isNicknameMatch = !isCorrect && difficulty === 'first' && nicknames.includes(guessLower)

    if (gameMode === 'timed' && !startTime) {
      setStartTime(Date.now())
    }

    setLastGuess(guess.trim())
    setCorrectionInput('')
    setCorrectionComplete(false)

    if (isCorrect || isNicknameMatch) {
      setFeedback(isNicknameMatch ? 'nickname' : 'correct')
      setStats(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }))
      if (gameMode === 'rocket') {
        setRocketHeight(prev => Math.min(100, prev + 20))
        setRocketBoosting(true)
        setTimeout(() => setRocketBoosting(false), 500)
        setTimeout(() => {
          setGuess('')
          setFeedback(null)
          setShowAnswer(false)
          setLastGuess('')
          setCorrectionInput('')
          setCorrectionComplete(false)
          setCurrentIndex(prev => (prev + 1) % practiceCards.length)
        }, 800)
      }
    } else {
      setFeedback('incorrect')
      setStats(prev => ({ ...prev, total: prev.total + 1 }))
      if (gameMode === 'rocket') {
        setRocketHeight(prev => {
          const newHeight = Math.max(0, prev - 15)
          if (newHeight <= 0) setRocketCrashed(true)
          return newHeight
        })
      }
    }
    setShowAnswer(true)
  }

  // Get target name
  const getTargetName = () => {
    if (!currentCoworker) return ''
    const fullName = currentCoworker.name.trim()
    const firstName = fullName.split(' ')[0]
    return difficulty === 'first' ? firstName : fullName
  }

  // Format time
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const tenths = Math.floor((ms % 1000) / 100)
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`
  }

  // Check correction
  const checkCorrection = (input) => {
    const target = getTargetName().toLowerCase()
    return input.toLowerCase().trim() === target
  }

  const handleCorrectionChange = (value) => {
    setCorrectionInput(value)
    setCorrectionComplete(checkCorrection(value))
  }

  // Game mode change
  const handleGameModeChange = (newMode) => {
    if (newMode !== gameMode) {
      setGameMode(newMode)
      restartPractice()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grain-bg flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-cream-dark rounded-full" />
          <div className="h-6 w-48 bg-cream-dark rounded-lg mx-auto" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen grain-bg flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 bg-dusty-rose/20 rounded-2xl flex items-center justify-center">
            <svg className="w-10 h-10 text-dusty-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-semibold text-charcoal mb-2">
            Deck Not Available
          </h2>
          <p className="text-warm-gray mb-6">{error}</p>
          {user ? (
            <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-coral text-paper font-medium rounded-xl btn-lift">
              Go to My Decks
            </Link>
          ) : (
            <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-coral text-paper font-medium rounded-xl btn-lift">
              Sign In
            </Link>
          )}
        </div>
      </div>
    )
  }

  const cardCount = deck?.flashcards?.length || 0

  // Session complete screen
  if (isPracticing && isSessionComplete) {
    const percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    const isPerfect = percentage === 100
    const isGreat = percentage >= 80
    const isGood = percentage >= 60

    const getResultTitle = () => {
      if (gameMode === 'rocket' && rocketCrashed) return 'Mission Failed!'
      if (gameMode === 'rocket') return 'Mission Complete!'
      if (gameMode === 'timed') return formatTime(elapsedTime)
      if (isPerfect) return 'Perfect Score!'
      if (isGreat) return 'Great Job!'
      if (isGood) return 'Nice Work!'
      return 'Session Complete'
    }

    const getResultSubtitle = () => {
      if (gameMode === 'rocket' && rocketCrashed) return 'The rocket ran out of fuel!'
      if (gameMode === 'rocket') return 'You reached the finish line!'
      if (gameMode === 'timed') return 'Time to complete'
      if (isPerfect) return 'You know everyone!'
      if (isGreat) return "You're getting really good at this."
      if (isGood) return 'Keep practicing to improve.'
      return 'Practice makes perfect.'
    }

    const getResultIcon = () => {
      if (gameMode === 'rocket' && rocketCrashed) return '💥'
      if (gameMode === 'rocket') return '🚀'
      if (gameMode === 'timed') return '⏱️'
      return null
    }

    const resultIcon = getResultIcon()

    return (
      <div className="min-h-screen grain-bg">
        <header className="bg-paper/80 backdrop-blur-md border-b border-cream-dark sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-coral/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-coral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <h1 className="font-display text-lg font-semibold text-charcoal">Face Card</h1>
            </div>
            {user ? (
              <Link to="/" className="text-sm text-warm-gray hover:text-charcoal transition-colors">My Decks</Link>
            ) : (
              <Link to="/login" className="flex items-center gap-2 px-4 py-2 bg-coral text-paper text-sm font-medium rounded-lg btn-lift">Sign In</Link>
            )}
          </div>
        </header>

        <div className="flex items-center justify-center p-4 sm:p-6 pt-8 sm:pt-16">
          <div className="relative z-10 animate-in max-w-md w-full">
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-sage/15 rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-coral/10 rounded-full blur-3xl" />

            <div className="relative bg-paper rounded-3xl shadow-[0_8px_40px_rgba(45,42,38,0.12)] overflow-hidden">
              <div className={`py-8 px-6 text-center ${
                gameMode === 'rocket' && rocketCrashed ? 'bg-coral/10' :
                gameMode === 'rocket' ? 'bg-gradient-to-br from-sage/20 to-coral/10' :
                gameMode === 'timed' ? 'bg-coral/10' :
                isPerfect ? 'bg-gradient-to-br from-sage/20 via-dusty-rose/10 to-coral/10' :
                isGreat ? 'bg-sage/10' :
                isGood ? 'bg-dusty-rose/10' :
                'bg-cream'
              }`}>
                <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                  gameMode === 'rocket' && rocketCrashed ? 'bg-coral/20' :
                  gameMode === 'rocket' ? 'bg-gradient-to-br from-sage to-sage/80 shadow-lg shadow-sage/30' :
                  gameMode === 'timed' ? 'bg-coral/20' :
                  isPerfect ? 'bg-gradient-to-br from-sage to-sage/80 shadow-lg shadow-sage/30' :
                  isGreat ? 'bg-sage/20' :
                  isGood ? 'bg-dusty-rose/20' :
                  'bg-cream-dark'
                }`}>
                  {resultIcon ? (
                    <span className="text-4xl">{resultIcon}</span>
                  ) : isPerfect ? (
                    <svg className="w-10 h-10 text-cream" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ) : (
                    <svg className={`w-10 h-10 ${isGreat ? 'text-sage' : isGood ? 'text-dusty-rose' : 'text-warm-gray'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                    </svg>
                  )}
                </div>

                <h1 className={`font-display font-semibold text-charcoal mb-2 ${gameMode === 'timed' ? 'text-4xl timer' : 'text-2xl'}`}>
                  {getResultTitle()}
                </h1>
                <p className="text-charcoal-light">{getResultSubtitle()}</p>
              </div>

              <div className="p-6 sm:p-8">
                <div className="bg-cream rounded-2xl p-4 sm:p-6 mb-6">
                  <div className="text-center mb-4">
                    <div className={`font-display text-5xl sm:text-6xl font-bold ${
                      isPerfect ? 'text-sage' : isGreat ? 'text-sage' : isGood ? 'text-dusty-rose' : 'text-coral'
                    }`}>
                      {percentage}%
                    </div>
                    <div className="text-warm-gray text-sm mt-1">accuracy</div>
                  </div>

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

                <div className="space-y-3">
                  <button
                    onClick={restartPractice}
                    className="w-full bg-coral text-cream py-4 rounded-xl font-medium btn-lift flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again
                  </button>
                  <button
                    onClick={() => setIsPracticing(false)}
                    className="w-full py-4 rounded-xl font-medium border-2 border-cream-dark text-charcoal-light hover:bg-cream transition-colors cursor-pointer"
                  >
                    Back to Deck
                  </button>
                </div>

                {!user && (
                  <div className="mt-6 p-4 bg-cream-dark/50 rounded-xl text-center">
                    <p className="text-sm text-charcoal mb-3">
                      <strong>Want to save your score?</strong>
                    </p>
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-coral text-paper font-medium rounded-lg btn-lift text-sm"
                    >
                      Sign in to track scores
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Active practice screen
  if (isPracticing && currentCoworker) {
    return (
      <div className="min-h-screen grain-bg">
        <header className="bg-paper/80 backdrop-blur-md border-b border-cream-dark sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <button
              onClick={() => setIsPracticing(false)}
              className="flex items-center gap-2 text-warm-gray hover:text-charcoal transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">{deck.name}</span>
            </button>
            {user ? (
              <Link to="/" className="text-sm text-warm-gray hover:text-charcoal transition-colors">My Decks</Link>
            ) : (
              <Link to="/login" className="flex items-center gap-2 px-4 py-2 bg-coral text-paper text-sm font-medium rounded-lg btn-lift">Sign In</Link>
            )}
          </div>
        </header>

        <div className="p-4 sm:p-6 pt-6 sm:pt-8">
          <div className="max-w-md mx-auto animate-in">
            {/* Game Mode Selector */}
            <div className="flex justify-center mb-4">
              <div className="inline-flex gap-1 bg-cream-dark rounded-lg p-1">
                {['classic', 'timed', 'rocket'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => handleGameModeChange(mode)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      gameMode === mode ? 'bg-paper text-charcoal shadow-sm' : 'text-warm-gray hover:text-charcoal'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                {gameMode === 'timed' && (
                  <span className="timer bg-coral/10 text-coral px-3 py-1.5 rounded-full text-lg font-semibold border border-coral/20">
                    {formatTime(elapsedTime)}
                  </span>
                )}
                {gameMode !== 'rocket' && stats.total > 0 && (
                  <span className="bg-paper px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-sm text-charcoal-light border border-cream-dark text-sm">
                    <span className="text-sage font-semibold">{stats.correct}</span>
                    <span className="text-warm-gray">/{stats.total}</span>
                    <span className="text-warm-gray ml-1">({Math.round(stats.correct/stats.total*100)}%)</span>
                  </span>
                )}
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 bg-paper border border-cream-dark rounded-lg text-sm text-charcoal focus:outline-none focus:border-coral/50 cursor-pointer"
                >
                  <option value="first">First name</option>
                  <option value="full">Full name</option>
                </select>
              </div>
            </div>

            {/* Flashcard */}
            <div className={gameMode === 'rocket' ? 'bg-paper rounded-xl overflow-hidden shadow-lg' : 'polaroid rounded-xl overflow-hidden'}>
              {gameMode === 'rocket' ? (
                <RocketGame
                  rocketHeight={rocketHeight}
                  boosting={rocketBoosting}
                  crashed={rocketCrashed}
                  coworkerPhoto={currentCoworker?.photo_url}
                  onCrash={handleRocketCrash}
                  gravityActive={gravityActive}
                />
              ) : (
                <div className="aspect-square bg-cream-dark flex items-center justify-center overflow-hidden photo-hover">
                  <img
                    src={currentCoworker.photo_url}
                    alt="Coworker"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="pt-4 pb-2 text-center">
                <span className="text-xs font-medium text-warm-gray tracking-wide uppercase">
                  Card {currentIndex + 1} of {practiceCards.length}
                </span>
              </div>

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
                          setLastGuess('')
                          setCorrectionInput('')
                          setCorrectionComplete(false)
                          setStats(prev => ({ ...prev, total: prev.total + 1 }))
                        }}
                        className="px-5 py-3 border-2 border-cream-dark rounded-xl text-charcoal-light hover:bg-cream-dark transition-colors cursor-pointer"
                      >
                        Reveal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={`text-center p-5 rounded-xl ${
                      feedback === 'correct' || feedback === 'nickname'
                        ? 'bg-sage/10 border-2 border-sage/30'
                        : 'bg-coral/10 border-2 border-coral/30'
                    } animate-success`}>
                      {feedback === 'correct' && (
                        <div className="text-sage font-medium mb-2 flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Correct!
                        </div>
                      )}
                      {feedback === 'nickname' && (
                        <div className="text-sage font-medium mb-2 flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Correct!
                          <span className="ml-1 px-2 py-0.5 bg-sage/20 text-sage text-xs rounded-full">
                            via "{lastGuess}"
                          </span>
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

                    {/* Mnemonic section with edit capability for authenticated users */}
                    {editingMnemonic ? (
                      <div className="bg-dusty-rose/10 border border-dusty-rose/30 rounded-xl p-4">
                        <textarea
                          value={mnemonicText}
                          onChange={(e) => setMnemonicText(e.target.value)}
                          placeholder="Enter your memory tip..."
                          className="w-full px-3 py-2 bg-paper border border-cream-dark rounded-lg text-sm resize-none focus:outline-none focus:border-dusty-rose"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleSaveMnemonic}
                            disabled={savingMnemonic || !mnemonicText.trim()}
                            className="px-3 py-1.5 bg-sage text-cream text-sm rounded-lg btn-lift disabled:bg-cream-dark disabled:text-warm-gray cursor-pointer"
                          >
                            {savingMnemonic ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditingMnemonic(false); setMnemonicText(''); }}
                            className="px-3 py-1.5 text-sm text-warm-gray hover:text-charcoal cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : getEffectiveMnemonic(currentCoworker) ? (
                      <div className="bg-dusty-rose/10 border border-dusty-rose/30 rounded-xl p-4">
                        <div className="text-xs font-semibold text-dusty-rose uppercase tracking-wide mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Memory Tip
                          </span>
                          {user && (
                            <button
                              onClick={() => { setEditingMnemonic(true); setMnemonicText(getEffectiveMnemonic(currentCoworker)); }}
                              className="text-dusty-rose/70 hover:text-dusty-rose text-xs font-normal normal-case cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        <div className="text-charcoal-light leading-relaxed">{getEffectiveMnemonic(currentCoworker)}</div>
                      </div>
                    ) : feedback === 'incorrect' && user && (
                      <button
                        onClick={() => { setEditingMnemonic(true); setMnemonicText(''); }}
                        className="w-full py-2.5 px-4 border border-cream-dark rounded-xl text-sm text-charcoal-light hover:bg-cream transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Add Memory Tip
                      </button>
                    )}

                    {/* Correction typing for wrong answers */}
                    {feedback === 'incorrect' && gameMode === 'classic' && (
                      <div className="bg-cream rounded-xl p-4">
                        <label className="block text-sm text-charcoal-light mb-2">
                          Type "<span className="font-semibold text-charcoal">{getTargetName()}</span>" to continue:
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={correctionInput}
                            onChange={(e) => handleCorrectionChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && correctionComplete && nextCard()}
                            placeholder={getTargetName()}
                            className={`w-full px-4 py-2.5 rounded-lg text-charcoal font-medium transition-colors ${
                              correctionComplete
                                ? 'bg-sage/10 border-2 border-sage/50'
                                : 'bg-paper border-2 border-cream-dark focus:border-coral/50'
                            } focus:outline-none`}
                            autoFocus
                          />
                          {correctionComplete && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sage">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={nextCard}
                          className="mt-2 text-xs text-warm-gray hover:text-charcoal-light transition-colors cursor-pointer"
                        >
                          skip →
                        </button>
                      </div>
                    )}

                    <button
                      onClick={nextCard}
                      disabled={feedback === 'incorrect' && !correctionComplete && gameMode === 'classic'}
                      className={`w-full py-3 rounded-xl font-medium btn-lift flex items-center justify-center gap-2 ${
                        feedback === 'incorrect' && !correctionComplete && gameMode === 'classic'
                          ? 'bg-cream-dark text-warm-gray cursor-not-allowed'
                          : 'bg-coral text-cream cursor-pointer'
                      }`}
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

            <button
              onClick={shuffleCards}
              className="w-full mt-6 py-3 text-coral font-medium hover:bg-paper rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
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

  // Navigation handler
  const handleNavigate = (newMode) => {
    if (newMode === 'practice' && practiceCards.length > 0) {
      startPractice()
    } else {
      setMode(newMode)
    }
  }

  // Render content based on mode
  const renderContent = () => {
    switch (mode) {
      case 'browse':
        return (
          <ManageView
            flashcards={deck?.flashcards || []}
            loading={false}
            onNavigate={handleNavigate}
            readOnly={true}
          />
        )
      case 'leaderboard':
        return <LeaderboardView deckId={deck?.id} />
      case 'practice':
      default:
        return practiceCards.length > 0 ? (
          <div className="bg-paper rounded-2xl p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-coral/10 rounded-2xl flex items-center justify-center">
              <svg className="w-10 h-10 text-coral" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <h3 className="font-display text-2xl font-semibold text-charcoal mb-2">
              Ready to Practice?
            </h3>
            <p className="text-warm-gray mb-8 max-w-sm mx-auto">
              Test your memory with {practiceCards.length} {practiceCards.length === 1 ? 'face' : 'faces'}.
              Choose from Classic, Timed, or Rocket mode!
            </p>
            <button
              onClick={startPractice}
              className="inline-flex items-center gap-3 px-8 py-4 bg-coral text-paper font-medium rounded-xl btn-lift text-lg cursor-pointer"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Start Practice
            </button>

            {!user && (
              <div className="mt-8 p-4 bg-cream-dark/50 rounded-xl">
                <p className="text-sm text-charcoal mb-3">
                  <strong>Want to save your progress?</strong>
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-coral text-paper font-medium rounded-lg btn-lift text-sm"
                >
                  Sign in to track scores
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-paper rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-cream-dark rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-semibold text-charcoal mb-2">
              No Cards Ready
            </h3>
            <p className="text-warm-gray">
              This deck doesn't have any cards with photos yet.
            </p>
          </div>
        )
    }
  }

  // Landing page with tabs
  return (
    <div className="min-h-screen grain-bg">
      <header className="bg-paper/80 backdrop-blur-md border-b border-cream-dark sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-coral/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-coral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h1 className="font-display text-lg font-semibold text-charcoal">Face Card</h1>
          </div>
          {user ? (
            <Link to="/" className="text-sm text-warm-gray hover:text-charcoal transition-colors">My Decks</Link>
          ) : (
            <Link to="/login" className="flex items-center gap-2 px-4 py-2 bg-coral text-paper text-sm font-medium rounded-lg btn-lift">Sign In</Link>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-in relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage/10 text-sage text-sm font-medium rounded-full mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Shared Deck
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal mb-2">
            {deck.name}
          </h1>
          {deck.description && (
            <p className="text-warm-gray mb-4">{deck.description}</p>
          )}
          <div className="flex items-center gap-4 text-warm-gray">
            <span>{cardCount} {cardCount === 1 ? 'face' : 'faces'}</span>
            <span>{practiceCards.length} ready to practice</span>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-8 border-b border-cream-dark pb-px">
          {[
            { id: 'practice', label: 'Practice', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
            { id: 'browse', label: 'Browse', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
            { id: 'leaderboard', label: 'Leaderboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium rounded-t-xl transition-colors cursor-pointer ${
                mode === tab.id
                  ? 'bg-paper text-coral border-b-2 border-coral -mb-px'
                  : 'text-warm-gray hover:text-charcoal'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {renderContent()}
      </main>
    </div>
  )
}
