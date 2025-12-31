import { useState } from 'react'
import { useLeaderboard } from '../../hooks/useLeaderboard'

/**
 * LeaderboardView - Display rankings and personal bests
 *
 * Props:
 * - deckId: The deck ID to show leaderboard for
 */
export default function LeaderboardView({ deckId }) {
  const { entries, personalBest, loading, getEntriesByMode } = useLeaderboard(deckId)
  const [selectedMode, setSelectedMode] = useState('classic')

  const modes = [
    { id: 'classic', label: 'Classic', icon: '🎯' },
    { id: 'timed', label: 'Timed', icon: '⏱️' },
    { id: 'rocket', label: 'Rocket', icon: '🚀' }
  ]

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatTime = (ms) => {
    if (!ms) return '-'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const tenths = Math.floor((ms % 1000) / 100)
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`
  }

  const modeEntries = getEntriesByMode(selectedMode)
  const userBest = personalBest?.[selectedMode]

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-cream-dark rounded-xl" />
        <div className="h-64 bg-cream-dark rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="animate-in">
      {/* Mode selector */}
      <div className="flex gap-2 mb-6">
        {modes.map(mode => (
          <button
            key={mode.id}
            onClick={() => setSelectedMode(mode.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              selectedMode === mode.id
                ? 'bg-coral text-paper'
                : 'bg-cream text-charcoal-light hover:bg-cream-dark'
            }`}
          >
            <span>{mode.icon}</span>
            {mode.label}
          </button>
        ))}
      </div>

      {/* Personal best card */}
      {userBest && (
        <div className="mb-6 p-5 bg-gradient-to-br from-sage/10 to-coral/5 rounded-2xl border border-sage/20">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-sage" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="font-medium text-sage">Your Personal Best</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-3xl font-display font-bold text-charcoal">
                  {userBest.accuracy}%
                </div>
                <div className="text-xs text-warm-gray uppercase tracking-wide">Accuracy</div>
              </div>
              {userBest.time_ms && (
                <div>
                  <div className="text-2xl font-display font-semibold text-charcoal">
                    {formatTime(userBest.time_ms)}
                  </div>
                  <div className="text-xs text-warm-gray uppercase tracking-wide">Time</div>
                </div>
              )}
              <div>
                <div className="text-lg font-medium text-charcoal">
                  {userBest.score}/{userBest.total}
                </div>
                <div className="text-xs text-warm-gray uppercase tracking-wide">Score</div>
              </div>
            </div>
            <div className="text-right text-sm text-warm-gray">
              {formatDate(userBest.created_at)}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard table */}
      <div className="bg-paper rounded-2xl shadow-[0_4px_24px_rgba(45,42,38,0.08)] overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-cream-dark">
          <h3 className="font-display text-lg font-semibold text-charcoal flex items-center gap-2">
            <svg className="w-5 h-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            </svg>
            Top 10 - {modes.find(m => m.id === selectedMode)?.label}
          </h3>
        </div>

        {modeEntries.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-cream rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
            </div>
            <h4 className="font-display text-lg font-semibold text-charcoal mb-2">
              No Scores Yet
            </h4>
            <p className="text-warm-gray text-sm">
              Be the first to set a score in {modes.find(m => m.id === selectedMode)?.label} mode!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-cream-dark">
            {modeEntries.map((entry, index) => {
              const isFirst = index === 0
              const isSecond = index === 1
              const isThird = index === 2

              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 px-4 sm:px-6 py-4 ${
                    isFirst ? 'bg-gradient-to-r from-[#FFD700]/10 to-transparent' :
                    isSecond ? 'bg-gradient-to-r from-[#C0C0C0]/10 to-transparent' :
                    isThird ? 'bg-gradient-to-r from-[#CD7F32]/10 to-transparent' :
                    ''
                  }`}
                >
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm ${
                    isFirst ? 'bg-[#FFD700] text-charcoal' :
                    isSecond ? 'bg-[#C0C0C0] text-charcoal' :
                    isThird ? 'bg-[#CD7F32] text-paper' :
                    'bg-cream text-charcoal-light'
                  }`}>
                    {index + 1}
                  </div>

                  {/* Player name */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-charcoal truncate">
                      {entry.player_name}
                    </div>
                    <div className="text-xs text-warm-gray">
                      {formatDate(entry.created_at)}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 sm:gap-6 text-right">
                    {entry.time_ms && (
                      <div className="hidden sm:block">
                        <div className="font-medium text-charcoal timer">
                          {formatTime(entry.time_ms)}
                        </div>
                        <div className="text-xs text-warm-gray">time</div>
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-charcoal">
                        {entry.score}/{entry.total}
                      </div>
                      <div className="text-xs text-warm-gray">score</div>
                    </div>
                    <div>
                      <div className={`font-display text-xl font-bold ${
                        entry.accuracy >= 90 ? 'text-sage' :
                        entry.accuracy >= 70 ? 'text-dusty-rose' :
                        'text-coral'
                      }`}>
                        {entry.accuracy}%
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
