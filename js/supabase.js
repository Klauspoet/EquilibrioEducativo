const SUPABASE_URL = 'https://ghuaqggmgaupkgnyghvl.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodWFxZ2dtZ2F1cGtnbnlnaHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.3ZK-YI_AOovLyCEBJjdOwhdCKbknuW63Gjxi8L5Tb7k'

if (!window.__supabaseLoaded) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = new URL('./lib/supabase.umd.js', import.meta.url).href
    script.onload = resolve
    script.onerror = () => reject(new Error('No se pudo cargar Supabase localmente'))
    document.head.appendChild(script)
  })
  window.__supabaseLoaded = true
}

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
