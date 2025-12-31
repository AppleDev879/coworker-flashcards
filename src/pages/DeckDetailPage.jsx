import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDeckFlashcards } from '../hooks/useDeckFlashcards'
import PracticeView from '../components/views/PracticeView'
import ManageView from '../components/views/ManageView'
import AddCardView from '../components/views/AddCardView'
import LeaderboardView from '../components/views/LeaderboardView'
import ShareModal from '../components/ShareModal'
import { useLeaderboard } from '../hooks/useLeaderboard'

export default function DeckDetailPage() {
  const { deckId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [deck, setDeck] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('practice') // 'practice' | 'manage' | 'add' | 'leaderboard'
  const [showShareModal, setShowShareModal] = useState(false)

  // Use leaderboard hook
  const { submitScore, isPersonalBest, getEntriesByMode, refetch: refetchLeaderboard } = useLeaderboard(deckId)

  // Use the deck flashcards hook
  const {
    flashcards,
    loading: cardsLoading,
    addFlashcard,
    addFlashcardsBatch,
    updateFlashcard,
    updateMnemonic,
    updatePhoto,
    deleteFlashcard,
    addNickname,
    generateMnemonic,
    refetch
  } = useDeckFlashcards(deckId)

  useEffect(() => {
    async function fetchDeck() {
      if (!deckId) return

      try {
        setLoading(true)

        const { data, error } = await supabase
          .from('decks')
          .select('*')
          .eq('id', deckId)
          .single()

        if (error) throw error

        setDeck(data)
      } catch (err) {
        console.error('Error fetching deck:', err)
        navigate('/')
      } finally {
        setLoading(false)
      }
    }

    fetchDeck()
  }, [deckId, navigate])

  // Check if current user is the deck owner (must be before early returns)
  const isOwner = user && deck && deck.owner_id === user.id

  // If non-owner tries to access owner-only mode, redirect to practice
  useEffect(() => {
    if (!isOwner && (mode === 'manage' || mode === 'add')) {
      setMode('practice')
    }
  }, [isOwner, mode])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-cream-dark rounded-full" />
            <div className="h-8 w-64 bg-cream-dark rounded-lg" />
          </div>
          <div className="h-96 bg-cream-dark rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="font-display text-2xl font-semibold text-charcoal mb-2">
          Deck not found
        </h2>
        <p className="text-warm-gray mb-6">
          This deck may have been deleted or you don't have access.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-coral text-paper font-medium rounded-xl btn-lift"
        >
          Go Home
        </Link>
      </div>
    )
  }

  const cardCount = flashcards.length
  const practiceableCards = flashcards.filter(c => c.photo_url).length

  // Navigation handler for views
  const handleNavigate = (newMode) => {
    setMode(newMode)
  }

  // Sharing functions (with ownership verification for defense in depth)
  const handleToggleShare = async (isShared) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('decks')
        .update({ is_shared: isShared, updated_at: new Date().toISOString() })
        .eq('id', deckId)
        .eq('owner_id', user.id) // Verify ownership
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('You do not have permission to modify this deck')
        }
        throw error
      }
      setDeck(prev => ({ ...prev, ...data }))
    } catch (err) {
      console.error('Failed to toggle sharing:', err)
      alert(err.message || 'Failed to update sharing settings.')
    }
  }

  const handleRegenerateToken = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('decks')
        .update({
          share_token: crypto.randomUUID(),
          updated_at: new Date().toISOString()
        })
        .eq('id', deckId)
        .eq('owner_id', user.id) // Verify ownership
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('You do not have permission to modify this deck')
        }
        throw error
      }
      setDeck(prev => ({ ...prev, ...data }))
    } catch (err) {
      console.error('Failed to regenerate token:', err)
      alert(err.message || 'Failed to regenerate share link.')
    }
  }

  // Render the active view
  const renderContent = () => {
    switch (mode) {
      case 'practice':
        return (
          <PracticeView
            flashcards={flashcards}
            loading={cardsLoading}
            updateMnemonic={updateMnemonic}
            onNavigate={handleNavigate}
            deckId={deckId}
            submitScore={submitScore}
            isPersonalBest={isPersonalBest}
            getEntriesByMode={getEntriesByMode}
            refetchLeaderboard={refetchLeaderboard}
          />
        )
      case 'manage':
        return (
          <ManageView
            flashcards={flashcards}
            loading={cardsLoading}
            updateFlashcard={updateFlashcard}
            updateMnemonic={updateMnemonic}
            updatePhoto={updatePhoto}
            deleteFlashcard={deleteFlashcard}
            addNickname={addNickname}
            generateMnemonic={generateMnemonic}
            onNavigate={handleNavigate}
            readOnly={!isOwner}
          />
        )
      case 'add':
        return (
          <AddCardView
            user={user}
            onBack={() => setMode('manage')}
            addFlashcard={addFlashcard}
            addFlashcardsBatch={addFlashcardsBatch}
            refetch={refetch}
          />
        )
      case 'leaderboard':
        return <LeaderboardView deckId={deckId} />
      default:
        return null
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-in">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-warm-gray hover:text-charcoal transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Decks
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal mb-2">
              {deck.name}
            </h1>
            <div className="flex items-center gap-4 text-warm-gray">
              <span>{cardCount} {cardCount === 1 ? 'face' : 'faces'}</span>
              {practiceableCards < cardCount && (
                <span className="text-dusty-rose">
                  {cardCount - practiceableCards} need photos
                </span>
              )}
              {deck.is_shared && (
                <span className="flex items-center gap-1.5 text-sage">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Shared
                </span>
              )}
            </div>
          </div>

          {/* Share button - only for owners */}
          {isOwner && (
            <button
              onClick={() => setShowShareModal(true)}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium rounded-xl transition-colors cursor-pointer ${
                deck.is_shared
                  ? 'bg-sage/10 text-sage border-2 border-sage/30 hover:bg-sage/20'
                  : 'text-charcoal border-2 border-cream-dark hover:bg-cream-dark/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {deck.is_shared ? 'Shared' : 'Share'}
            </button>
          )}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-8 border-b border-cream-dark pb-px">
        {[
          { id: 'practice', label: 'Practice', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z', ownerOnly: false },
          { id: 'manage', label: isOwner ? 'Manage' : 'Browse', icon: isOwner ? 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' : 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z', ownerOnly: false },
          { id: 'add', label: 'Add Faces', icon: 'M12 4.5v15m7.5-7.5h-15', ownerOnly: true },
          { id: 'leaderboard', label: 'Leaderboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', ownerOnly: false }
        ].filter(tab => !tab.ownerOnly || isOwner).map(tab => (
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

      {/* Share Modal */}
      <ShareModal
        deck={deck}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onToggleShare={handleToggleShare}
        onRegenerateToken={handleRegenerateToken}
      />
    </div>
  )
}
