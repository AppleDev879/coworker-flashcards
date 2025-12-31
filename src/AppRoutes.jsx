import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import DeckListPage from './pages/DeckListPage'
import DeckDetailPage from './pages/DeckDetailPage'
import SharedDeckPage from './pages/SharedDeckPage'
import LoginPage from './components/LoginPage'

export default function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen grain-bg flex items-center justify-center">
        <div className="text-charcoal/60">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes - shared decks accessible without login */}
      <Route path="/shared/:shareToken" element={<SharedDeckPage />} />
      <Route path="/shared/:shareToken/*" element={<SharedDeckPage />} />

      {/* Login page */}
      <Route path="/login" element={
        user ? <Navigate to="/" replace /> : <LoginPage />
      } />

      {/* Protected routes - require authentication */}
      <Route element={<Layout />}>
        <Route path="/" element={
          user ? <DeckListPage /> : <Navigate to="/login" replace />
        } />
        <Route path="/deck/:deckId" element={
          user ? <DeckDetailPage /> : <Navigate to="/login" replace />
        } />
        <Route path="/deck/:deckId/*" element={
          user ? <DeckDetailPage /> : <Navigate to="/login" replace />
        } />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
