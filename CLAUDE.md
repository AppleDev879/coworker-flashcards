# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Production build to dist/
npm run lint     # ESLint check
npm run preview  # Preview production build
```

## Architecture

**Face Cards** - A flashcard app for learning coworker names with AI-generated memory tips.

### Stack
- React 19 + Vite + Tailwind CSS 4
- Supabase (Auth, PostgreSQL, Storage, Edge Functions)
- Google OAuth authentication

### Key Files

| Path | Purpose |
|------|---------|
| `src/App.jsx` | Main app with Practice/Manage/Add modes |
| `src/context/AuthContext.jsx` | Auth state + Google OAuth flow |
| `src/hooks/useFlashcards.js` | CRUD operations for flashcards |
| `src/lib/supabase.js` | Supabase client init |
| `src/index.css` | Design system (colors, fonts, animations) |

### Supabase Resources

- **Tables**: `profiles`, `flashcards` (both have RLS enabled)
- **Storage**: `flashcard-photos` bucket (user-scoped access)
- **Edge Function**: `generate-mnemonic` - Uses OpenAI GPT-4o Vision to create memory tips from photos

### Environment Variables

Required in `.env.local`:
```
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<publishable-key>
```

Edge function requires `OPENAI_API_KEY` secret set in Supabase dashboard.

## Design System

Uses a "Warm Polaroid Studio" aesthetic with custom CSS classes:
- Colors: `cream`, `charcoal`, `coral`, `sage`, `dusty-rose`, `warm-gray`
- Fonts: Fraunces (display), DM Sans (body)
- Classes: `polaroid`, `grain-bg`, `btn-lift`, `input-warm`, `animate-in`, `shimmer`
