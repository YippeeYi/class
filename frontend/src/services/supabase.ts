import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const FALLBACK_URL = 'https://xyeftofxlxbpqctuuqup.supabase.co'
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5ZWZ0b2Z4bHhicHFjdHV1cXVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTM2NTMsImV4cCI6MjA5Nzk2OTY1M30.ympDVX6Hqbscc9BWzWLU8Ur-FUNgD3kGaLsrt9o0Gkg'

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY,
  bucket: 'classrecord-private',
  tables: {
    records: 'class_records',
    people: 'class_people',
    recordPages: 'class_record_pages',
    pageMessages: 'class_page_messages',
    pageSupplements: 'class_page_supplements',
    materials: 'class_materials',
    quizQuestions: 'class_quiz_questions',
    creditsPage: 'class_credits_page',
    privateAssets: 'class_private_assets',
  },
} as const

const clients = new Map<string, SupabaseClient>()

export function getSupabase(accessToken = '') {
  const key = accessToken || 'anonymous'
  const cached = clients.get(key)
  if (cached) return cached
  const client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-class-record-access': accessToken } },
  })
  clients.set(key, client)
  return client
}

export function clearSupabaseClients() {
  clients.clear()
}
