import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useFlashcards() {
  const { user } = useAuth()
  const [flashcards, setFlashcards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refetchCounter, setRefetchCounter] = useState(0)

  // Load flashcards on mount, when user changes, or when refetch is called
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setFlashcards(data || [])
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [user, refetchCounter])

  // Refetch function that triggers the effect
  const fetchFlashcards = useCallback(() => {
    setRefetchCounter(c => c + 1)
  }, [])

  // Upload photo to storage with retry logic
  const uploadPhoto = async (file, maxRetries = 3) => {
    if (!user || !file) return null

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`

    let lastError = null
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { error: uploadError } = await supabase.storage
        .from('flashcard-photos')
        .upload(fileName, file)

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('flashcard-photos')
          .getPublicUrl(fileName)
        return publicUrl
      }

      lastError = uploadError
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
      }
    }

    throw lastError
  }

  // Extract file path from URL for deletion
  const getFilePathFromUrl = (url) => {
    if (!url) return null
    try {
      // Parse URL properly to handle query params
      const urlObj = new URL(url)
      const path = urlObj.pathname
      const match = path.match(/flashcard-photos\/(.+)$/)
      return match ? match[1] : null
    } catch (err) {
      // Fallback for malformed URLs
      console.error('Invalid URL:', url, err)
      return null
    }
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
