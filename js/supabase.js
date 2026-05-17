import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ghuaqggmgaupkgnyghvl.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodWFxZ2dtZ2F1cGtnbnlnaHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.3ZK-YI_AOovLyCEBJjdOwhdCKbknuW63Gjxi8L5Tb7k'
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)