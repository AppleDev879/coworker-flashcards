import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDecks } from '../hooks/useDecks'
import CreateDeckModal from '../components/CreateDeckModal'

export default function DeckListPage() {
  const { decks, loading, createDeck } = useDecks()
  const [showCreateModal, setShowCreateModal] = useState(false)

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-cream-dark rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-[4/3] bg-cream-dark rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-in">
      {/* Page header with decorative flourish */}
      <div className="mb-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-warm-gray text-sm font-medium tracking-wide uppercase mb-1">
              Your Collection
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal">
              Face Decks
            </h2>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-coral text-paper font-medium rounded-xl btn-lift shadow-lg shadow-coral/20 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="hidden sm:inline">New Deck</span>
          </button>
        </div>
        <div className="decorative-line w-24 mt-4" />
      </div>

      {/* Deck grid */}
      {decks.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 bg-cream-dark rounded-2xl flex items-center justify-center">
            <svg className="w-10 h-10 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <h3 className="font-display text-xl font-semibold text-charcoal mb-2">
            No decks yet
          </h3>
          <p className="text-warm-gray mb-6 max-w-sm mx-auto">
            Create your first deck to start memorizing faces. Each deck can hold a different group of people.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-coral text-paper font-medium rounded-xl btn-lift shadow-lg shadow-coral/20 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Your First Deck
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}

          {/* Add new deck card */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="group aspect-[4/3] bg-cream-dark/50 border-2 border-dashed border-cream-dark hover:border-coral/40 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer hover:bg-cream-dark/70"
          >
            <div className="w-14 h-14 bg-cream-dark group-hover:bg-coral/10 rounded-xl flex items-center justify-center mb-3 transition-colors">
              <svg className="w-7 h-7 text-warm-gray group-hover:text-coral transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-warm-gray group-hover:text-charcoal font-medium transition-colors">
              Add New Deck
            </span>
          </button>
        </div>
      )}

      {/* Create deck modal */}
      {showCreateModal && (
        <CreateDeckModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (name, description) => {
            await createDeck(name, description)
            setShowCreateModal(false)
          }}
        />
      )}
    </div>
  )
}

function DeckCard({ deck }) {
  // Get a preview of card photos (first 4)
  const previewPhotos = deck.flashcards?.slice(0, 4).map(c => c.photo_url).filter(Boolean) || []
  const cardCount = deck.flashcards?.length || 0
  const photosWithImages = deck.flashcards?.filter(c => c.photo_url).length || 0

  return (
    <Link
      to={`/deck/${deck.id}`}
      className="group block"
    >
      <div className="polaroid rounded-2xl overflow-hidden cursor-pointer" style={{ padding: 0, transform: 'rotate(0deg)' }}>
        {/* Photo grid preview */}
        <div className="aspect-[4/3] bg-cream-dark relative overflow-hidden">
          {previewPhotos.length > 0 ? (
            <div className="grid grid-cols-2 grid-rows-2 h-full">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="relative overflow-hidden">
                  {previewPhotos[i] ? (
                    <img
                      src={previewPhotos[i]}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-cream-dark" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-warm-gray/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Play button on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-14 h-14 bg-paper/90 rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-coral ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Shared badge */}
          {deck.is_shared && (
            <div className="absolute top-3 right-3 px-2.5 py-1 bg-sage/90 text-paper text-xs font-medium rounded-full flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Shared
            </div>
          )}
        </div>

        {/* Deck info */}
        <div className="p-4 bg-paper">
          <h3 className="font-display text-lg font-semibold text-charcoal mb-1 truncate">
            {deck.name}
          </h3>
          <div className="flex items-center gap-3 text-sm text-warm-gray">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              {cardCount} {cardCount === 1 ? 'face' : 'faces'}
            </span>
            {cardCount > photosWithImages && (
              <span className="text-dusty-rose">
                {cardCount - photosWithImages} draft{cardCount - photosWithImages !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
