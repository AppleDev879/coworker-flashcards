import { useState } from 'react'

export default function ManageView({
  flashcards,
  loading,
  updateFlashcard,
  updateMnemonic,
  updatePhoto,
  deleteFlashcard,
  addNickname,
  generateMnemonic,
  onNavigate,
  fetchingImages = new Set(),
  readOnly = false
}) {
  const [generatingMnemonicId, setGeneratingMnemonicId] = useState(null)
  const [editingMnemonicId, setEditingMnemonicId] = useState(null)
  const [customMnemonicText, setCustomMnemonicText] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingNicknameId, setEditingNicknameId] = useState(null)
  const [newNicknameText, setNewNicknameText] = useState('')
  const [addingNickname, setAddingNickname] = useState(false)

  const practiceCards = flashcards.filter(c => c.photo_url)
  const draftCount = flashcards.length - practiceCards.length

  const handleFileUpload = async (e, coworkerId) => {
    const file = e.target.files[0]
    if (!file) return

    setSaving(true)
    try {
      await updatePhoto(coworkerId, file)
    } catch (err) {
      console.error('Failed to update photo:', err)
      alert('Failed to update photo. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveCoworker = async (id) => {
    try {
      await deleteFlashcard(id)
    } catch (err) {
      console.error('Failed to remove coworker:', err)
      alert('Failed to remove coworker. Please try again.')
    }
  }

  const handleClearAll = async () => {
    if (!confirm(`Are you sure you want to delete all ${flashcards.length} faces? This cannot be undone.`)) {
      return
    }
    try {
      await Promise.all(flashcards.map(card => deleteFlashcard(card.id)))
    } catch (err) {
      console.error('Failed to clear all:', err)
      alert('Failed to clear all. Please try again.')
    }
  }

  const handleGenerateMnemonic = async (id) => {
    setGeneratingMnemonicId(id)
    try {
      await generateMnemonic(id)
    } catch (err) {
      console.error('Failed to generate mnemonic:', err)
      alert(err.message || 'Failed to generate mnemonic. Please try again.')
    } finally {
      setGeneratingMnemonicId(null)
    }
  }

  const handleSaveCustomMnemonic = async (id) => {
    if (!customMnemonicText.trim()) return

    setSaving(true)
    try {
      await updateMnemonic(id, customMnemonicText.trim())
      setEditingMnemonicId(null)
      setCustomMnemonicText('')
    } catch (err) {
      console.error('Failed to save mnemonic:', err)
      alert('Failed to save mnemonic. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const startEditingMnemonic = (coworker) => {
    setEditingMnemonicId(coworker.id)
    setCustomMnemonicText(coworker.mnemonic || '')
  }

  const cancelEditingMnemonic = () => {
    setEditingMnemonicId(null)
    setCustomMnemonicText('')
  }

  const handleAddNicknameManage = async (coworkerId) => {
    if (!newNicknameText.trim()) return
    setAddingNickname(true)
    try {
      await addNickname(coworkerId, newNicknameText.trim())
      setNewNicknameText('')
      setEditingNicknameId(null)
    } catch (err) {
      console.error('Failed to add nickname:', err)
    } finally {
      setAddingNickname(false)
    }
  }

  const handleRemoveNickname = async (coworkerId, nicknameToRemove) => {
    const coworker = flashcards.find(f => f.id === coworkerId)
    if (!coworker) return
    const updatedNicknames = (coworker.nicknames || []).filter(n => n !== nicknameToRemove)
    try {
      await updateFlashcard(coworkerId, { nicknames: updatedNicknames })
    } catch (err) {
      console.error('Failed to remove nickname:', err)
    }
  }

  if (loading) {
    return (
      <div className="bg-paper rounded-2xl p-10 text-center shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 shimmer rounded-2xl" />
          <span className="text-warm-gray">Loading...</span>
        </div>
      </div>
    )
  }

  if (flashcards.length === 0) {
    return (
      <div className="bg-paper rounded-2xl p-10 text-center shadow-sm">
        <div className="w-16 h-16 bg-cream rounded-xl mx-auto mb-4 flex items-center justify-center">
          <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <p className="text-charcoal-light mb-6">
          {readOnly ? 'No faces in this deck yet.' : 'No faces added yet. Add some to get started!'}
        </p>
        {!readOnly && (
          <button
            onClick={() => onNavigate('add')}
            className="bg-coral text-cream px-6 py-3 rounded-xl font-medium btn-lift cursor-pointer"
          >
            Add First Face
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 stagger-children">
      {/* Header actions */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm text-warm-gray">
            {flashcards.length} {flashcards.length === 1 ? 'face' : 'faces'}
            {!readOnly && draftCount > 0 && ` · ${draftCount} need${draftCount === 1 ? 's' : ''} photos`}
          </p>
        </div>
        <div className="flex gap-2">
          {!readOnly && (
            <button
              onClick={() => onNavigate('add')}
              className="flex items-center gap-2 px-4 py-2 bg-coral text-cream rounded-xl font-medium btn-lift cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          )}
          {practiceCards.length > 0 && (
            <button
              onClick={() => onNavigate('practice')}
              className="flex items-center gap-2 px-4 py-2 bg-sage text-cream rounded-xl font-medium btn-lift cursor-pointer"
            >
              Practice
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Card list */}
      {flashcards.map((coworker, index) => (
        <div
          key={coworker.id}
          className={`bg-paper rounded-2xl shadow-sm p-4 sm:p-5 flex gap-3 sm:gap-5 hover:shadow-md transition-shadow ${!coworker.photo_url ? 'border-2 border-dashed border-cream-dark' : ''}`}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {/* Photo */}
          <div className={`w-16 h-16 sm:w-24 sm:h-24 bg-cream-dark rounded-xl flex-shrink-0 overflow-hidden relative ${!readOnly ? 'group' : ''}`}>
            {!readOnly && !coworker.photo_url && !fetchingImages.has(coworker.id) && (
              <span className="absolute top-1 left-1 z-10 px-2 py-0.5 bg-dusty-rose text-cream text-xs font-medium rounded-full">
                Draft
              </span>
            )}
            {fetchingImages.has(coworker.id) && (
              <div className="absolute inset-0 z-10 bg-cream-dark flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {coworker.photo_url ? (
              <img src={coworker.photo_url} alt={coworker.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-10 h-10 text-warm-gray/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
            )}
            {!readOnly && (
              <label className="absolute inset-0 bg-charcoal/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <span className="text-cream text-sm font-medium">{saving ? 'Uploading...' : 'Change'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={saving}
                  onChange={(e) => handleFileUpload(e, coworker.id)}
                />
              </label>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 py-1">
            <h3 className="font-display font-semibold text-lg text-charcoal mb-1">{coworker.name}</h3>

            {/* Nicknames */}
            <div className="mb-3">
              {coworker.nicknames && coworker.nicknames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {coworker.nicknames.map((nickname, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-dusty-rose/10 text-dusty-rose text-xs rounded-full">
                      {nickname}
                      {!readOnly && (
                        <button
                          onClick={() => handleRemoveNickname(coworker.id, nickname)}
                          className="hover:text-coral transition-colors cursor-pointer"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {!readOnly && (
                editingNicknameId === coworker.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newNicknameText}
                      onChange={(e) => setNewNicknameText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNicknameManage(coworker.id)}
                      placeholder="Enter nickname..."
                      className="flex-1 px-2 py-1 text-sm input-warm rounded-lg"
                      autoFocus
                    />
                    <button
                      onClick={() => handleAddNicknameManage(coworker.id)}
                      disabled={addingNickname || !newNicknameText.trim()}
                      className="px-2 py-1 bg-sage text-cream text-xs rounded-lg btn-lift disabled:bg-cream-dark disabled:text-warm-gray cursor-pointer"
                    >
                      {addingNickname ? '...' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setEditingNicknameId(null); setNewNicknameText('') }}
                      className="px-2 py-1 text-xs text-warm-gray hover:text-charcoal cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingNicknameId(coworker.id)}
                    className="text-xs text-warm-gray hover:text-dusty-rose transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add nickname
                  </button>
                )
              )}
            </div>

            {/* Mnemonic */}
            {readOnly ? (
              // Read-only: just show mnemonic if exists
              coworker.mnemonic && (
                <p className="text-sm text-charcoal-light leading-relaxed flex items-start gap-2">
                  <svg className="w-4 h-4 text-dusty-rose flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {coworker.mnemonic}
                </p>
              )
            ) : editingMnemonicId === coworker.id ? (
              <div className="mt-2">
                <textarea
                  value={customMnemonicText}
                  onChange={(e) => setCustomMnemonicText(e.target.value)}
                  placeholder="Enter your memory tip..."
                  className="w-full px-3 py-2 input-warm rounded-lg text-sm resize-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleSaveCustomMnemonic(coworker.id)}
                    disabled={saving || !customMnemonicText.trim()}
                    className="px-3 py-1.5 bg-sage text-cream text-sm rounded-lg btn-lift disabled:bg-cream-dark disabled:text-warm-gray cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEditingMnemonic}
                    className="px-3 py-1.5 text-sm text-warm-gray hover:text-charcoal cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : coworker.mnemonic ? (
              <div>
                <p className="text-sm text-charcoal-light leading-relaxed flex items-start gap-2">
                  <svg className="w-4 h-4 text-dusty-rose flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {coworker.mnemonic}
                </p>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => startEditingMnemonic(coworker)}
                    className="text-xs text-warm-gray hover:text-coral transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleGenerateMnemonic(coworker.id)}
                    disabled={generatingMnemonicId === coworker.id}
                    className="text-xs text-warm-gray hover:text-coral transition-colors cursor-pointer"
                  >
                    {generatingMnemonicId === coworker.id ? 'Generating...' : 'Regenerate'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 mt-1">
                <button
                  onClick={() => handleGenerateMnemonic(coworker.id)}
                  disabled={generatingMnemonicId === coworker.id || !coworker.photo_url}
                  className="text-sm text-coral hover:text-coral-dark disabled:text-warm-gray flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  {generatingMnemonicId === coworker.id ? 'Generating...' : 'Generate with AI'}
                </button>
                <button
                  onClick={() => startEditingMnemonic(coworker)}
                  className="text-sm text-sage hover:text-sage-light flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Write your own
                </button>
              </div>
            )}
          </div>

          {/* Actions - only for owners */}
          {!readOnly && (
            <div className="flex flex-col justify-center gap-2">
              <button
                onClick={() => handleRemoveCoworker(coworker.id)}
                className="text-xs text-warm-gray hover:text-coral transition-colors cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Clear All - only for owners */}
      {!readOnly && (
        <div className="pt-8 mt-4 border-t border-cream-dark">
          <button
            onClick={handleClearAll}
            className="w-full py-3 text-sm text-warm-gray hover:text-coral transition-colors cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  )
}
