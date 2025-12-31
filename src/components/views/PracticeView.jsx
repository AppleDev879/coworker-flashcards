import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import RocketGame from '../RocketGame'

export default function PracticeView({
  flashcards,
  loading,
  updateMnemonic,
  onNavigate,
  deckId,
  submitScore,
  isPersonalBest,
  getEntriesByMode,
  refetchLeaderboard
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const [shuffledIndices, setShuffledIndices] = useState([])
  const [difficulty, setDifficulty] = useState('first')
  const [saving, setSaving] = useState(false)

  // Score submission state
  const [scoreSubmitted, setScoreSubmitted] = useState(false)
  const [submittingScore, setSubmittingScore] = useState(false)
  const [leaderboardRank, setLeaderboardRank] = useState(null)

  // Practice mode enhancements
  const [lastGuess, setLastGuess] = useState('')
  const [correctionInput, setCorrectionInput] = useState('')
  const [correctionComplete, setCorrectionComplete] = useState(false)
  const [editingPracticeMnemonic, setEditingPracticeMnemonic] = useState(false)
  const [practiceMnemonicText, setPracticeMnemonicText] = useState('')

  // Game modes
  const [gameMode, setGameMode] = useState('classic')
  const [startTime, setStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [rocketHeight, setRocketHeight] = useState(50)
  const [rocketCrashed, setRocketCrashed] = useState(false)
  const [rocketBoosting, setRocketBoosting] = useState(false)

  // Filter cards with photos for practice
  const practiceCards = useMemo(() => flashcards.filter(c => c.photo_url), [flashcards])
  const draftCount = flashcards.length - practiceCards.length

  // Reset shuffle when cards change
  useEffect(() => {
    setShuffledIndices([])
    setCurrentIndex(0)
  }, [practiceCards.length])

  // Check if practice session is complete
  const isSessionComplete = (stats.total > 0 && stats.total >= practiceCards.length) || rocketCrashed

  // Current coworker based on shuffle order
  const currentCoworker = useMemo(() => {
    const actualIndex = shuffledIndices.length > 0 ? shuffledIndices[currentIndex] : currentIndex
    return practiceCards[actualIndex]
  }, [practiceCards, shuffledIndices, currentIndex])

  // Reset card state
  const resetCardState = useCallback(() => {
    setGuess('')
    setFeedback(null)
    setShowAnswer(false)
    setLastGuess('')
    setCorrectionInput('')
    setCorrectionComplete(false)
    setEditingPracticeMnemonic(false)
    setPracticeMnemonicText('')
  }, [])

  const nextCard = useCallback(() => {
    resetCardState()
    setCurrentIndex(prev => (prev + 1) % practiceCards.length)
  }, [resetCardState, practiceCards.length])

  const nextCardRef = useRef(nextCard)
  useEffect(() => { nextCardRef.current = nextCard }, [nextCard])

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

  // Keyboard shortcuts
  useEffect(() => {
    if (!currentCoworker || isSessionComplete) return

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
  }, [showAnswer, feedback, correctionComplete, currentCoworker, isSessionComplete])

  // Timer for timed mode
  useEffect(() => {
    if (gameMode !== 'timed' || !startTime || isSessionComplete) return
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 100)
    return () => clearInterval(interval)
  }, [gameMode, startTime, isSessionComplete])

  const handleRocketCrash = useCallback(() => {
    setRocketCrashed(true)
    setRocketHeight(0)
  }, [])

  const gravityActive = gameMode === 'rocket' && !showAnswer && !rocketCrashed && !isSessionComplete

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
    setEditingPracticeMnemonic(false)
    setPracticeMnemonicText('')

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

  const restartPractice = () => {
    setStats({ correct: 0, total: 0 })
    setStartTime(null)
    setElapsedTime(0)
    setRocketHeight(50)
    setRocketCrashed(false)
    setRocketBoosting(false)
    setScoreSubmitted(false)
    setSubmittingScore(false)
    setLeaderboardRank(null)
    shuffleCards()
  }

  // Auto-submit score when session completes (for signed-in users)
  useEffect(() => {
    if (!isSessionComplete || !submitScore || scoreSubmitted || submittingScore) return

    const autoSubmitScore = async () => {
      setSubmittingScore(true)
      try {
        const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
        await submitScore({
          gameMode,
          score: stats.correct,
          total: stats.total,
          timeMs: gameMode === 'timed' ? elapsedTime : null
        })
        setScoreSubmitted(true)

        // Refetch leaderboard to get updated rankings
        if (refetchLeaderboard) {
          await refetchLeaderboard()
        }

        // Calculate rank from leaderboard
        if (getEntriesByMode) {
          const entries = getEntriesByMode(gameMode)
          // Find rank based on accuracy and time
          const rank = entries.findIndex(e =>
            e.accuracy === accuracy &&
            (gameMode !== 'timed' || e.time_ms === elapsedTime)
          )
          if (rank !== -1) {
            setLeaderboardRank(rank + 1)
          } else {
            // Estimate rank based on where this score would fall
            const betterScores = entries.filter(e =>
              e.accuracy > accuracy ||
              (e.accuracy === accuracy && gameMode === 'timed' && e.time_ms && e.time_ms < elapsedTime)
            ).length
            setLeaderboardRank(betterScores + 1)
          }
        }
      } catch (err) {
        console.error('Failed to auto-submit score:', err)
        // Don't show error - silent fail for auto-submit
      } finally {
        setSubmittingScore(false)
      }
    }

    autoSubmitScore()
  }, [isSessionComplete, submitScore, scoreSubmitted, submittingScore, stats, gameMode, elapsedTime, getEntriesByMode, refetchLeaderboard])

  const getTargetName = () => {
    if (!currentCoworker) return ''
    const fullName = currentCoworker.name.trim()
    const firstName = fullName.split(' ')[0]
    return difficulty === 'first' ? firstName : fullName
  }

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const tenths = Math.floor((ms % 1000) / 100)
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`
  }

  const handleGameModeChange = (newMode) => {
    if (newMode !== gameMode) {
      setGameMode(newMode)
      restartPractice()
    }
  }

  const checkCorrection = (input) => {
    const target = getTargetName().toLowerCase()
    return input.toLowerCase().trim() === target
  }

  const handleCorrectionChange = (value) => {
    setCorrectionInput(value)
    setCorrectionComplete(checkCorrection(value))
  }

  const handleSavePracticeMnemonic = async () => {
    if (!practiceMnemonicText.trim() || !currentCoworker) return
    setSaving(true)
    try {
      await updateMnemonic(currentCoworker.id, practiceMnemonicText.trim())
      setEditingPracticeMnemonic(false)
      setPracticeMnemonicText('')
    } catch (err) {
      console.error('Failed to save mnemonic:', err)
    } finally {
      setSaving(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 shimmer rounded-2xl" />
          <span className="text-warm-gray">Loading flashcards...</span>
        </div>
      </div>
    )
  }

  // No cards ready
  if (practiceCards.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 pt-8">
        <div className="relative z-10 animate-in w-full max-w-md">
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
              onClick={() => onNavigate(draftCount > 0 ? 'manage' : 'add')}
              className="bg-coral text-cream px-8 py-4 rounded-xl font-medium btn-lift cursor-pointer"
            >
              {draftCount > 0 ? 'Add Photos to Drafts' : 'Add Your First Face'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Session complete
  if (isSessionComplete) {
    const percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    const isPerfect = percentage === 100
    const isGreat = percentage >= 80
    const isGood = percentage >= 60

    const getResultTitle = () => {
      if (gameMode === 'rocket' && rocketCrashed) return 'Mission Failed!'
      if (gameMode === 'rocket') return 'Mission Complete!'
      if (gameMode === 'timed') return `${formatTime(elapsedTime)}`
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
      <div className="flex items-center justify-center p-4 pt-8">
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

              {/* Leaderboard status */}
              {submitScore && (
                <div className="mb-4">
                  {submittingScore ? (
                    <div className="p-4 bg-cream rounded-xl text-center">
                      <div className="flex items-center justify-center gap-2 text-warm-gray">
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Saving to leaderboard...
                      </div>
                    </div>
                  ) : scoreSubmitted && leaderboardRank !== null ? (
                    <div className="p-4 bg-gradient-to-br from-sage/10 to-coral/5 rounded-xl border border-sage/20 text-center">
                      {isPersonalBest && isPersonalBest(gameMode, percentage, elapsedTime) && (
                        <div className="flex items-center justify-center gap-2 text-sage font-medium mb-2">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          New Personal Best!
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                        </svg>
                        <span className="font-display text-lg font-semibold text-charcoal">
                          #{leaderboardRank} on the leaderboard
                        </span>
                      </div>
                    </div>
                  ) : scoreSubmitted ? (
                    <div className="p-4 bg-sage/10 rounded-xl text-center">
                      <div className="flex items-center justify-center gap-2 text-sage font-medium">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Score saved!
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

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
                  onClick={() => onNavigate('manage')}
                  className="w-full py-4 rounded-xl font-medium border-2 border-cream-dark text-charcoal-light hover:bg-cream transition-colors cursor-pointer"
                >
                  Manage Cards
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Active practice
  return (
    <div className="p-4 pt-6">
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

        {/* Stats Header */}
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
          <button
            onClick={() => onNavigate('manage')}
            className="text-coral hover:text-coral-dark font-medium transition-colors text-sm sm:text-base cursor-pointer"
          >
            Manage Cards
          </button>
        </div>

        {/* Flashcard */}
        <div className={gameMode === 'rocket' ? 'bg-paper rounded-xl overflow-hidden shadow-lg' : 'polaroid rounded-xl overflow-hidden'}>
          {gameMode === 'rocket' ? (
            <div className="relative">
              <RocketGame
                rocketHeight={rocketHeight}
                boosting={rocketBoosting}
                crashed={rocketCrashed}
                coworkerPhoto={currentCoworker?.photo_url}
                onCrash={handleRocketCrash}
                gravityActive={gravityActive}
              />
            </div>
          ) : (
            <div className="aspect-square bg-cream-dark flex items-center justify-center overflow-hidden photo-hover">
              {currentCoworker?.photo_url ? (
                <img src={currentCoworker.photo_url} alt="Coworker" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-warm-gray">
                  <svg className="w-20 h-20 mb-2 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
              )}
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
                    className="flex-1 bg-charcoal text-cream py-3 rounded-xl font-medium btn-lift disabled:bg-cream-dark disabled:text-warm-gray disabled:cursor-not-allowed cursor-pointer"
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
                {/* Result */}
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
                      <span className="ml-1 px-2 py-0.5 bg-sage/20 text-sage text-xs rounded-full">via "{lastGuess}"</span>
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

                {/* Mnemonic section */}
                {editingPracticeMnemonic ? (
                  <div className="bg-dusty-rose/10 border border-dusty-rose/30 rounded-xl p-4">
                    <textarea
                      value={practiceMnemonicText}
                      onChange={(e) => setPracticeMnemonicText(e.target.value)}
                      placeholder="Enter your memory tip..."
                      className="w-full px-3 py-2 bg-paper border border-cream-dark rounded-lg text-sm resize-none focus:outline-none focus:border-dusty-rose"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleSavePracticeMnemonic}
                        disabled={saving || !practiceMnemonicText.trim()}
                        className="px-3 py-1.5 bg-sage text-cream text-sm rounded-lg btn-lift disabled:bg-cream-dark disabled:text-warm-gray cursor-pointer"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditingPracticeMnemonic(false); setPracticeMnemonicText(''); }}
                        className="px-3 py-1.5 text-sm text-warm-gray hover:text-charcoal cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : currentCoworker.mnemonic ? (
                  <div className="bg-dusty-rose/10 border border-dusty-rose/30 rounded-xl p-4">
                    <div className="text-xs font-semibold text-dusty-rose uppercase tracking-wide mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Memory Tip
                      </span>
                      <button
                        onClick={() => { setEditingPracticeMnemonic(true); setPracticeMnemonicText(currentCoworker.mnemonic); }}
                        className="text-dusty-rose/70 hover:text-dusty-rose text-xs font-normal normal-case cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="text-charcoal-light leading-relaxed">{currentCoworker.mnemonic}</div>
                  </div>
                ) : feedback === 'incorrect' && (
                  <button
                    onClick={() => { setEditingPracticeMnemonic(true); setPracticeMnemonicText(''); }}
                    className="w-full py-2.5 px-4 border border-cream-dark rounded-xl text-sm text-charcoal-light hover:bg-cream transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Add Tip
                  </button>
                )}

                {/* Correction typing */}
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

                {/* Next card button */}
                <button
                  onClick={nextCard}
                  disabled={feedback === 'incorrect' && !correctionComplete && gameMode === 'classic'}
                  className={`w-full py-3 rounded-xl font-medium btn-lift flex items-center justify-center gap-2 cursor-pointer ${
                    feedback === 'incorrect' && !correctionComplete && gameMode === 'classic'
                      ? 'bg-cream-dark text-warm-gray cursor-not-allowed'
                      : 'bg-coral text-cream'
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

        {/* Shuffle Button */}
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
  )
}
