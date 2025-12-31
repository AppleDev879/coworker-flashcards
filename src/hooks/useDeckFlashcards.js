import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/**
 * Hook for managing flashcards within a specific deck.
 * Flashcards now belong to decks (not directly to users).
 * Mnemonics are stored separately in user_card_mnemonics table.
 */
export function useDeckFlashcards(deckId) {
  const { user } = useAuth()
  const [flashcards, setFlashcards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch flashcards for this deck
  const fetchFlashcards = useCallback(async () => {
    if (!deckId) {
      setFlashcards([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch flashcards with user's personal mnemonics if authenticated
      let query = supabase
        .from('flashcards')
        .select('*')
        .eq('deck_id', deckId)
        .order('created_at', { ascending: false })

      const { data: cards, error: fetchError } = await query

      if (fetchError) throw fetchError

      // If user is authenticated, fetch their personal mnemonics
      let mnemonicsMap = {}
      if (user) {
        const cardIds = cards?.map(c => c.id) || []
        if (cardIds.length > 0) {
          const { data: mnemonics } = await supabase
            .from('user_card_mnemonics')
            .select('flashcard_id, mnemonic')
            .eq('user_id', user.id)
            .in('flashcard_id', cardIds)

          if (mnemonics) {
            mnemonicsMap = Object.fromEntries(
              mnemonics.map(m => [m.flashcard_id, m.mnemonic])
            )
          }
        }
      }

      // Merge mnemonics into flashcard objects
      const cardsWithMnemonics = (cards || []).map(card => ({
        ...card,
        mnemonic: mnemonicsMap[card.id] || ''
      }))

      setFlashcards(cardsWithMnemonics)
    } catch (err) {
      console.error('Error fetching flashcards:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [deckId, user])

  useEffect(() => {
    fetchFlashcards()
  }, [fetchFlashcards])

  // Upload photo to storage
  const uploadPhoto = async (file) => {
    if (!user || !file) return null

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('flashcard-photos')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('flashcard-photos')
      .getPublicUrl(fileName)

    return publicUrl
  }

  // Extract file path from URL for deletion
  const getFilePathFromUrl = (url) => {
    if (!url) return null
    try {
      const urlObj = new URL(url)
      const path = urlObj.pathname
      const match = path.match(/flashcard-photos\/(.+)$/)
      return match ? match[1] : null
    } catch {
      return null
    }
  }

  // Add a new flashcard to this deck
  const addFlashcard = async (name, photoFile) => {
    if (!user) throw new Error('Not authenticated')
    if (!deckId) throw new Error('No deck selected')

    let photoUrl = null
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile)
    }

    const { data, error: insertError } = await supabase
      .from('flashcards')
      .insert({
        deck_id: deckId,
        name,
        photo_url: photoUrl
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Add with empty mnemonic for display
    const cardWithMnemonic = { ...data, mnemonic: '' }
    setFlashcards(prev => [cardWithMnemonic, ...prev])
    return cardWithMnemonic
  }

  // Add multiple flashcards at once (for batch import)
  const addFlashcardsBatch = async (names) => {
    if (!user) throw new Error('Not authenticated')
    if (!deckId) throw new Error('No deck selected')
    if (!names || names.length === 0) return []

    const records = names.map(name => ({
      deck_id: deckId,
      name: name.trim(),
      photo_url: null
    }))

    const { data, error: insertError } = await supabase
      .from('flashcards')
      .insert(records)
      .select()

    if (insertError) throw insertError

    // Add with empty mnemonics for display
    const cardsWithMnemonics = (data || []).map(card => ({
      ...card,
      mnemonic: ''
    }))

    setFlashcards(prev => [...cardsWithMnemonics, ...prev])
    return cardsWithMnemonics
  }

  // Update a flashcard (name, photo, nicknames - NOT mnemonic)
  const updateFlashcard = async (id, updates) => {
    // Filter out mnemonic - it's stored separately now
    const { mnemonic: _, ...dbUpdates } = updates

    if (Object.keys(dbUpdates).length > 0) {
      const { data, error: updateError } = await supabase
        .from('flashcards')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      // Preserve the mnemonic from local state
      const currentCard = flashcards.find(c => c.id === id)
      const updatedCard = { ...data, mnemonic: currentCard?.mnemonic || '' }

      setFlashcards(prev =>
        prev.map(card => card.id === id ? updatedCard : card)
      )
      return updatedCard
    }

    return flashcards.find(c => c.id === id)
  }

  // Update mnemonic (stored in user_card_mnemonics table)
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
    setFlashcards(prev =>
      prev.map(card =>
        card.id === flashcardId
          ? { ...card, mnemonic: mnemonicText }
          : card
      )
    )
  }

  // Update photo for existing flashcard
  const updatePhoto = async (id, photoFile) => {
    const flashcard = flashcards.find(f => f.id === id)

    // Delete old photo if exists
    if (flashcard?.photo_url) {
      const oldPath = getFilePathFromUrl(flashcard.photo_url)
      if (oldPath) {
        await supabase.storage.from('flashcard-photos').remove([oldPath])
      }
    }

    // Upload new photo
    const photoUrl = await uploadPhoto(photoFile)
    return updateFlashcard(id, { photo_url: photoUrl })
  }

  // Delete a flashcard
  const deleteFlashcard = async (id) => {
    const flashcard = flashcards.find(f => f.id === id)

    // Delete photo from storage if exists
    if (flashcard?.photo_url) {
      const filePath = getFilePathFromUrl(flashcard.photo_url)
      if (filePath) {
        await supabase.storage.from('flashcard-photos').remove([filePath])
      }
    }

    // Delete the record (cascade will delete user_card_mnemonics)
    const { error: deleteError } = await supabase
      .from('flashcards')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    setFlashcards(prev => prev.filter(card => card.id !== id))
  }

  // Add a nickname to a flashcard
  const addNickname = async (id, nickname) => {
    const flashcard = flashcards.find(f => f.id === id)
    const currentNicknames = flashcard?.nicknames || []

    // Don't add duplicates
    if (currentNicknames.some(n => n.toLowerCase() === nickname.toLowerCase())) {
      return flashcard
    }

    return updateFlashcard(id, {
      nicknames: [...currentNicknames, nickname.trim()]
    })
  }

  // Generate mnemonic via Edge Function
  const generateMnemonic = async (id) => {
    if (!user) throw new Error('Not authenticated')

    const flashcard = flashcards.find(f => f.id === id)
    if (!flashcard?.photo_url) {
      throw new Error('Please add a photo first to generate a mnemonic')
    }

    const { data, error: fnError } = await supabase.functions.invoke(
      'generate-mnemonic',
      {
        body: {
          name: flashcard.name,
          photoUrl: flashcard.photo_url
        }
      }
    )

    if (fnError) throw fnError

    if (data?.mnemonic) {
      await updateMnemonic(id, data.mnemonic)
      return { ...flashcard, mnemonic: data.mnemonic }
    }

    throw new Error('Failed to generate mnemonic')
  }

  return {
    flashcards,
    loading,
    error,
    addFlashcard,
    addFlashcardsBatch,
    updateFlashcard,
    updateMnemonic,
    updatePhoto,
    deleteFlashcard,
    addNickname,
    generateMnemonic,
    refetch: fetchFlashcards
  }
}
