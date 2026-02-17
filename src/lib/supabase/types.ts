/**
 * Re-exports auto-generated Database types from Supabase schema.
 * Run `npm run gen:types` to regenerate after schema changes.
 */
export type { Database } from '@/lib/supabase.types'

import type { Database } from '@/lib/supabase.types'

// Convenience table row type aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Spot = Database['public']['Tables']['spots']['Row']
export type TrainingSession = Database['public']['Tables']['training_sessions']['Row']
export type SessionEntry = Database['public']['Tables']['session_entries']['Row']
export type DailyStat = Database['public']['Tables']['daily_stats']['Row']
export type SpotStat = Database['public']['Tables']['spot_stats']['Row']

// Insert types
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type SpotInsert = Database['public']['Tables']['spots']['Insert']
export type TrainingSessionInsert = Database['public']['Tables']['training_sessions']['Insert']
export type SessionEntryInsert = Database['public']['Tables']['session_entries']['Insert']
export type DailyStatInsert = Database['public']['Tables']['daily_stats']['Insert']
export type SpotStatInsert = Database['public']['Tables']['spot_stats']['Insert']

// Update types
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type SpotUpdate = Database['public']['Tables']['spots']['Update']
export type TrainingSessionUpdate = Database['public']['Tables']['training_sessions']['Update']
export type SessionEntryUpdate = Database['public']['Tables']['session_entries']['Update']
export type DailyStatUpdate = Database['public']['Tables']['daily_stats']['Update']
export type SpotStatUpdate = Database['public']['Tables']['spot_stats']['Update']
