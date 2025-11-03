/**
 * Supabase Configuration
 *
 * Production configuration for ScribeCat's cloud backend.
 * All users share this Supabase backend, with data isolation
 * provided by Row Level Security (RLS) policies.
 *
 * Security Notes:
 * - The anon key is safe to include in client code
 * - It has limited permissions (anon role)
 * - RLS policies ensure users can only access their own data
 * - Never commit the service_role key to version control
 */

export const SUPABASE_CONFIG = {
  url: 'https://djlvwxmakxaffdqbuwkv.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqbHZ3eG1ha3hhZmZkcWJ1d2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxOTU4ODAsImV4cCI6MjA3Nzc3MTg4MH0.c8cenL2GqIIkPuauUOjdv43vq5RTQit0oKulwVbpG04'
} as const;
