import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/**
 * Hook for managing leaderboard entries for a deck.
 *
 * @param {string} deckId - The deck ID to fetch leaderboard for
 * @returns {Object} - leaderboard data, personal best, and submission function
 */
export function useLeaderboard(deckId) {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [personalBest, setPersonalBest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch leaderboard entries for this deck
  const fetchLeaderboard = useCallback(async () => {
    if (!deckId) {
      setEntries([])
      setPersonalBest(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch top 10 entries for each game mode
      const { data: allEntries, error: fetchError } = await supabase
        .from('leaderboard_entries')
        .select('*')
        .eq('deck_id', deckId)
        .order('accuracy', { ascending: false })
        .order('time_ms', { ascending: true, nullsFirst: false })
        .limit(50) // Get more than we need to filter by mode

      if (fetchError) throw fetchError

      setEntries(allEntries || [])

      // If user is authenticated, fetch their personal best per mode
      if (user) {
        const { data: userBest } = await supabase
          .from('leaderboard_entries')
          .select('*')
          .eq('deck_id', deckId)
          .eq('user_id', user.id)
          .order('accuracy', { ascending: false })
          .order('time_ms', { ascending: true, nullsFirst: false })

        if (userBest && userBest.length > 0) {
          // Group by game mode and get best for each
          const bestByMode = {}
          userBest.forEach(entry => {
            if (!bestByMode[entry.game_mode] ||
                entry.accuracy > bestByMode[entry.game_mode].accuracy ||
                (entry.accuracy === bestByMode[entry.game_mode].accuracy &&
                 entry.time_ms && bestByMode[entry.game_mode].time_ms &&
                 entry.time_ms < bestByMode[entry.game_mode].time_ms)) {
              bestByMode[entry.game_mode] = entry
            }
          })
          setPersonalBest(bestByMode)
        }
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [deckId, user])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Submit a score to the leaderboard
  const submitScore = async ({ gameMode, score, total, timeMs, playerName }) => {
    if (!user) throw new Error('Must be logged in to submit scores')
    if (!deckId) throw new Error('No deck specified')

    const { data, error: submitError } = await supabase
      .from('leaderboard_entries')
      .insert({
        deck_id: deckId,
        user_id: user.id,
        player_name: playerName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
        game_mode: gameMode,
        score,
        total,
        time_ms: timeMs || null
      })
      .select()
      .single()

    if (submitError) throw submitError

    // Refresh leaderboard
    await fetchLeaderboard()

    return data
  }

  // Get entries for a specific game mode
  const getEntriesByMode = (mode) => {
    return entries
      .filter(e => e.game_mode === mode)
      .slice(0, 10) // Top 10 per mode
  }

  // Check if a score would be a personal best
  const isPersonalBest = (gameMode, accuracy, timeMs) => {
    if (!personalBest || !personalBest[gameMode]) return true

    const current = personalBest[gameMode]
    if (accuracy > current.accuracy) return true
    if (accuracy === current.accuracy && timeMs && current.time_ms && timeMs < current.time_ms) return true

    return false
  }

  return {
    entries,
    personalBest,
    loading,
    error,
    submitScore,
    getEntriesByMode,
    isPersonalBest,
    refetch: fetchLeaderboard
  }
}
