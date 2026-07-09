import { supabase } from './supabase.js'

let usuarioCache = null

export async function obtenerUsuarioActual(forzar = false) {
  if (usuarioCache && !forzar) return usuarioCache
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    window.location.href = 'login.html'
    return null
  }
  usuarioCache = user
  return user
}

export function limpiarCacheUsuario() {
  usuarioCache = null
}

export function configurarCierreSesion() {
  const btn = document.getElementById('btn-logout')
  if (!btn) return
  btn.addEventListener('click', async () => {
    limpiarCacheUsuario()
    await supabase.auth.signOut()
    window.location.href = 'index.html'
  })
}

export function mostrarMensaje(elemento, texto, tipo) {
  if (!elemento) return
  elemento.textContent = texto
  elemento.style.color = tipo === 'error' ? '#e74c3c'
    : tipo === 'exito' ? '#27ae60'
    : '#8a8aaa'
}

export function showLoader() {
  const loader = document.getElementById('loader-overlay')
  if (loader) {
    loader.style.display = 'flex'
    loader.offsetHeight
    loader.classList.add('active')
  }
}

export function renderEmptyState(container, emoji, title, desc) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${emoji}</div>
      <h4>${title}</h4>
      <p>${desc}</p>
    </div>
  `
}

export function hideLoader() {
  const loader = document.getElementById('loader-overlay')
  if (loader) {
    loader.classList.remove('active')
    setTimeout(() => {
      loader.style.display = 'none'
    }, 250)
  }
}
