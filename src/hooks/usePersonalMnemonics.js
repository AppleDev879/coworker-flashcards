import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/**
 * Hook for managing personal mnemonics on any deck's cards.
 * Works for both owned decks and shared decks.
 *
 * @param {string[]} flashcardIds - Array of flashcard IDs to fetch mnemonics for
 * @returns {Object} - mnemonics map, loading state, and update function
 */
export function usePersonalMnemonics(flashcardIds = []) {
  const { user } = useAuth()
  const [mnemonics, setMnemonics] = useState({}) // { flashcardId: mnemonic }
  const [loading, setLoading] = useState(true)

  // Fetch user's personal mnemonics for the given flashcard IDs
  const fetchMnemonics = useCallback(async () => {
    if (!user || flashcardIds.length === 0) {
      setMnemonics({})
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('user_card_mnemonics')
        .select('flashcard_id, mnemonic')
        .eq('user_id', user.id)
        .in('flashcard_id', flashcardIds)

      if (error) throw error

      const mnemonicsMap = {}
      if (data) {
        data.forEach(m => {
          mnemonicsMap[m.flashcard_id] = m.mnemonic
        })
      }

      setMnemonics(mnemonicsMap)
    } catch (err) {
      console.error('Error fetching personal mnemonics:', err)
    } finally {
      setLoading(false)
    }
  }, [user, flashcardIds.join(',')])

  useEffect(() => {
    fetchMnemonics()
  }, [fetchMnemonics])

  // Update or create a personal mnemonic
  const updateMnemonic = async (flashcardId, mnemonicText) => {
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('user_card_mnemonics')
      .upsert({
        user_id: user.id,
        flashcard_id: flashcardId,
        mnemonic: mnemonicText,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,flashcard_id'
      })

    if (error) throw error

    // Update local state
    setMnemonics(prev => ({
      ...prev,
      [flashcardId]: mnemonicText
    }))
  }

  // Delete a personal mnemonic
  const deleteMnemonic = async (flashcardId) => {
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('user_card_mnemonics')
      .delete()
      .eq('user_id', user.id)
      .eq('flashcard_id', flashcardId)

    if (error) throw error

    // Update local state
    setMnemonics(prev => {
      const next = { ...prev }
      delete next[flashcardId]
      return next
    })
  }

  // Get mnemonic for a specific flashcard
  const getMnemonic = (flashcardId) => mnemonics[flashcardId] || ''

  return {
    mnemonics,
    loading,
    getMnemonic,
    updateMnemonic,
    deleteMnemonic,
    refetch: fetchMnemonics
  }
}
