import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useDecks() {
  const { user } = useAuth()
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDecks = useCallback(async () => {
    if (!user) {
      setDecks([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch decks with flashcard count
      const { data, error: fetchError } = await supabase
        .from('decks')
        .select(`
          *,
          flashcards (
            id,
            photo_url
          )
        `)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setDecks(data || [])
    } catch (err) {
      console.error('Error fetching decks:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchDecks()
  }, [fetchDecks])

  const createDeck = async (name, description = '') => {
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('decks')
      .insert({
        owner_id: user.id,
        name,
        description
      })
      .select()
      .single()

    if (error) throw error

    // Add to local state with empty flashcards array
    setDecks(prev => [{ ...data, flashcards: [] }, ...prev])
    return data
  }

  const updateDeck = async (id, updates) => {
    const { data, error } = await supabase
      .from('decks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Update local state
    setDecks(prev => prev.map(d =>
      d.id === id ? { ...d, ...data } : d
    ))
    return data
  }

  const deleteDeck = async (id) => {
    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Remove from local state
    setDecks(prev => prev.filter(d => d.id !== id))
  }

  const toggleSharing = async (id, isShared) => {
    return updateDeck(id, { is_shared: isShared })
  }

  const regenerateShareToken = async (id) => {
    const { data, error } = await supabase
      .from('decks')
      .update({
        share_token: crypto.randomUUID(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    setDecks(prev => prev.map(d =>
      d.id === id ? { ...d, ...data } : d
    ))
    return data
  }

  return {
    decks,
    loading,
    error,
    createDeck,
    updateDeck,
    deleteDeck,
    toggleSharing,
    regenerateShareToken,
    refetch: fetchDecks
  }
}
