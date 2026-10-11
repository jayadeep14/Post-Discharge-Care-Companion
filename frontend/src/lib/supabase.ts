import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oajkbjzhrtlicoxlmofg.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hamtianpocnRsaWNveGxtb2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczODY0OTgsImV4cCI6MjEwMjk2MjQ5OH0.qR4E8ANV3oO8pM_j2LXhz2T7sMSiV12tMgFVYWUE2b0'

// This client is used for application data queries; demo sign-in is handled locally.
export const supabase = createClient(supabaseUrl, supabaseKey)
