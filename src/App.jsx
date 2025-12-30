import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { useFlashcards } from './hooks/useFlashcards'
import LoginPage from './components/LoginPage'
import Header from './components/Header'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const {
    flashcards,
    loading: dataLoading,
    addFlashcard,
    updatePhoto,
    deleteFlashcard,
    generateMnemonic
  } = useFlashcards()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [mode, setMode] = useState('practice')
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const [newCoworker, setNewCoworker] = useState({ name: '', photoFile: null, photoPreview: null })
  const [generatingMnemonic, setGeneratingMnemonic] = useState(false)
  const [saving, setSaving] = useState(false)

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage />
  }

  const currentCoworker = flashcards[currentIndex]

  const handleFileUpload = (e, isEditing = false, editId = null) => {
    const file = e.target.files[0]
    if (!file) return

    if (isEditing && editId) {
      // Update existing flashcard photo
      handleUpdatePhoto(editId, file)
    } else {
      // Preview for new flashcard
      const reader = new FileReader()
      reader.onload = (event) => {
        setNewCoworker(prev => ({
          ...prev,
          photoFile: file,
          photoPreview: event.target.result
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUpdatePhoto = async (id, file) => {
    setSaving(true)
    try {
      await updatePhoto(id, file)
    } catch (err) {
      console.error('Failed to update photo:', err)
      alert('Failed to update photo. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCoworker = async () => {
    if (!newCoworker.name.trim()) return

    setSaving(true)
    try {
      await addFlashcard(newCoworker.name.trim(), newCoworker.photoFile)
      setNewCoworker({ name: '', photoFile: null, photoPreview: null })
      setMode('manage')
    } catch (err) {
      console.error('Failed to add coworker:', err)
      alert('Failed to add coworker. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveCoworker = async (id) => {
    try {
      await deleteFlashcard(id)
      if (currentIndex >= flashcards.length - 1) {
        setCurrentIndex(Math.max(0, flashcards.length - 2))
      }
    } catch (err) {
      console.error('Failed to remove coworker:', err)
      alert('Failed to remove coworker. Please try again.')
    }
  }

  const handleGenerateMnemonic = async (id) => {
    setGeneratingMnemonic(true)
    try {
      await generateMnemonic(id)
    } catch (err) {
      console.error('Failed to generate mnemonic:', err)
      alert(err.message || 'Failed to generate mnemonic. Please try again.')
    } finally {
      setGeneratingMnemonic(false)
    }
  }

  const checkGuess = () => {
    const isCorrect = guess.toLowerCase().trim() === currentCoworker.name.toLowerCase().trim()
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    setShowAnswer(true)
    setStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }))
  }

  const nextCard = () => {
    setGuess('')
    setFeedback(null)
    setShowAnswer(false)
    setCurrentIndex((currentIndex + 1) % flashcards.length)
  }

  const shuffleCards = () => {
    setCurrentIndex(0)
    setGuess('')
    setFeedback(null)
    setShowAnswer(false)
  }

  // Practice Mode
  if (mode === 'practice') {
    if (dataLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
          <Header />
          <div className="flex items-center justify-center p-4 pt-20">
            <div className="text-gray-500">Loading flashcards...</div>
          </div>
        </div>
      )
    }

    if (flashcards.length === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
          <Header />
          <div className="flex items-center justify-center p-4 pt-20">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
              <div className="text-6xl mb-4">👥</div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Coworker Flashcards</h1>
              <p className="text-gray-600 mb-6">Add your coworkers to start practicing their names!</p>
              <button
                onClick={() => setMode('add')}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition"
              >
                Add Your First Coworker
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
        <Header />
        <div className="p-4">
          <div className="max-w-lg mx-auto">
            {/* Stats Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="text-sm text-gray-600">
                {stats.total > 0 && (
                  <span className="bg-white px-3 py-1 rounded-full shadow">
                    {stats.correct}/{stats.total} correct ({Math.round(stats.correct/stats.total*100)}%)
                  </span>
                )}
              </div>
              <button
                onClick={() => setMode('manage')}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Manage Cards
              </button>
            </div>

            {/* Flashcard */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {/* Photo */}
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {currentCoworker?.photo_url ? (
                  <img
                    src={currentCoworker.photo_url}
                    alt="Coworker"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-8xl text-gray-300">👤</div>
                )}
              </div>

              {/* Card Number */}
              <div className="text-center text-sm text-gray-400 pt-3">
                Card {currentIndex + 1} of {flashcards.length}
              </div>

              {/* Input Area */}
              <div className="p-6">
                {!showAnswer ? (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && guess && checkGuess()}
                      placeholder="Type their name..."
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-lg focus:border-indigo-500 focus:outline-none"
                      autoFocus
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={checkGuess}
                        disabled={!guess}
                        className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                      >
                        Check
                      </button>
                      <button
                        onClick={() => setShowAnswer(true)}
                        className="px-4 py-3 border-2 border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                      >
                        Reveal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Result */}
                    <div className={`text-center p-4 rounded-lg ${
                      feedback === 'correct'
                        ? 'bg-green-50 border-2 border-green-200'
                        : feedback === 'incorrect'
                        ? 'bg-red-50 border-2 border-red-200'
                        : 'bg-gray-50 border-2 border-gray-200'
                    }`}>
                      {feedback === 'correct' && <div className="text-green-600 text-lg mb-1">✓ Correct!</div>}
                      {feedback === 'incorrect' && <div className="text-red-600 text-lg mb-1">✗ Not quite</div>}
                      <div className="text-2xl font-bold text-gray-800">{currentCoworker.name}</div>
                    </div>

                    {/* Mnemonic */}
                    {currentCoworker.mnemonic && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="text-xs font-medium text-amber-700 mb-1">💡 Memory Tip</div>
                        <div className="text-amber-900">{currentCoworker.mnemonic}</div>
                      </div>
                    )}

                    <button
                      onClick={nextCard}
                      className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition"
                    >
                      Next Card →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Shuffle Button */}
            <button
              onClick={shuffleCards}
              className="w-full mt-4 py-3 text-indigo-600 font-medium hover:bg-white rounded-lg transition"
            >
              🔀 Shuffle Cards
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Manage Mode
  if (mode === 'manage') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
        <Header />
        <div className="p-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Manage Coworkers</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('add')}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
                >
                  + Add New
                </button>
                {flashcards.length > 0 && (
                  <button
                    onClick={() => { setMode('practice'); setStats({ correct: 0, total: 0 }); }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition"
                  >
                    Practice →
                  </button>
                )}
              </div>
            </div>

            {dataLoading ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                Loading...
              </div>
            ) : flashcards.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                No coworkers added yet. Click "Add New" to get started!
              </div>
            ) : (
              <div className="space-y-4">
                {flashcards.map((coworker) => (
                  <div key={coworker.id} className="bg-white rounded-xl shadow p-4 flex gap-4">
                    {/* Photo */}
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden relative group">
                      {coworker.photo_url ? (
                        <img src={coworker.photo_url} alt={coworker.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">👤</div>
                      )}
                      <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition">
                        <span className="text-white text-sm">{saving ? 'Uploading...' : 'Change'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={saving}
                          onChange={(e) => handleFileUpload(e, true, coworker.id)}
                        />
                      </label>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-gray-800">{coworker.name}</h3>

                      {coworker.mnemonic ? (
                        <p className="text-sm text-gray-600 mt-1">💡 {coworker.mnemonic}</p>
                      ) : (
                        <button
                          onClick={() => handleGenerateMnemonic(coworker.id)}
                          disabled={generatingMnemonic}
                          className="text-sm text-indigo-600 hover:text-indigo-800 mt-1 disabled:text-gray-400"
                        >
                          {generatingMnemonic ? '✨ Generating...' : '✨ Generate memory tip'}
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      {coworker.mnemonic && (
                        <button
                          onClick={() => handleGenerateMnemonic(coworker.id)}
                          disabled={generatingMnemonic}
                          className="text-xs text-gray-500 hover:text-indigo-600"
                        >
                          Regenerate tip
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveCoworker(coworker.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Add Mode
  if (mode === 'add') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
        <Header />
        <div className="p-4">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setMode('manage')}
              className="text-indigo-600 hover:text-indigo-800 mb-4"
            >
              ← Back
            </button>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Add Coworker</h2>

              {/* Photo Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative group cursor-pointer">
                  {newCoworker.photoPreview ? (
                    <img src={newCoworker.photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <div className="text-6xl mb-2">📷</div>
                      <div>Click to upload photo</div>
                    </div>
                  )}
                  <label className="absolute inset-0 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e)}
                    />
                  </label>
                </div>
              </div>

              {/* Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={newCoworker.name}
                  onChange={(e) => setNewCoworker(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter their full name"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <button
                onClick={handleAddCoworker}
                disabled={!newCoworker.name.trim() || saving}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {saving ? 'Adding...' : 'Add Coworker'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
