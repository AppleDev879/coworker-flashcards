import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useFlashcards() {
  const { user } = useAuth()
  const [flashcards, setFlashcards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch all flashcards for the current user
  const fetchFlashcards = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setFlashcards(data || [])
    }
    setLoading(false)
  }, [user])

  // Load flashcards on mount and when user changes
  useEffect(() => {
    fetchFlashcards()
  }, [fetchFlashcards])

  // Upload photo to storage and return public URL
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
    const match = url.match(/flashcard-photos\/(.+)$/)
    return match ? match[1] : null
  }

  // Add a new flashcard
  const addFlashcard = async (name, photoFile) => {
    if (!user) throw new Error('Not authenticated')

    let photoUrl = null
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile)
    }

    const { data, error: insertError } = await supabase
      .from('flashcards')
      .insert({
        user_id: user.id,
        name,
        photo_url: photoUrl,
        mnemonic: ''
      })
      .select()
      .single()

    if (insertError) throw insertError

    setFlashcards(prev => [data, ...prev])
    return data
  }

  // Add multiple flashcards at once (for batch import)
  const addFlashcardsBatch = async (names) => {
    if (!user) throw new Error('Not authenticated')
    if (!names || names.length === 0) return []

    const records = names.map(name => ({
      user_id: user.id,
      name: name.trim(),
      photo_url: null,
      mnemonic: ''
    }))

    const { data, error: insertError } = await supabase
      .from('flashcards')
      .insert(records)
      .select()

    if (insertError) throw insertError

    setFlashcards(prev => [...(data || []), ...prev])
    return data || []
  }

  // Update a flashcard (name, photo, or mnemonic)
  const updateFlashcard = async (id, updates) => {
    const { data, error: updateError } = await supabase
      .from('flashcards')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    setFlashcards(prev =>
      prev.map(card => card.id === id ? data : card)
    )
    return data
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

    // Delete the record
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
      return updateFlashcard(id, { mnemonic: data.mnemonic })
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
    updatePhoto,
    deleteFlashcard,
    addNickname,
    generateMnemonic,
    refetch: fetchFlashcards
  }
}
