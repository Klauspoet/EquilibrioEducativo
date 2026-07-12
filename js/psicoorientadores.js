import { supabase } from './supabase.js'
import { obtenerUsuarioActual, configurarCierreSesion, showLoader, hideLoader, renderEmptyState, escapeHtml } from './utilidades.js'

async function cargarChats() {
  showLoader()
  try {
    const user = await obtenerUsuarioActual()
    if (!user) return

    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('id', user.id)
      .maybeSingle()

    if (errorUsuario || !usuario) return
    document.getElementById('nombre-usuario').textContent = usuario.nombre

    const { data: psico, error: errorPsico } = await supabase
      .from('psicoorientadores')
      .select('usuario_id')
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (errorPsico) return

    if (!psico) {
      renderEmptyState(document.getElementById('lista-chats'), '🎓', 'Sin estudiantes asignados', 'Aún no tienes estudiantes asignados a tu perfil.')
      return
    }

    const { data: chats } = await supabase
      .from('chats')
      .select('*, usuarios!chats_estudiante_id_fkey(nombre)')
      .eq('psicoorientador_id', user.id)

    const lista = document.getElementById('lista-chats')
    lista.innerHTML = ''

    if (!chats?.length) {
      renderEmptyState(lista, '💬', 'Sin mensajes aún', 'No tienes conversaciones activas aún.')
      return
    }

    chats.forEach(chat => {
      const card = document.createElement('div')
      card.className = 'card-psico'
      card.innerHTML = `
        <h3>${escapeHtml(chat.usuarios.nombre)}</h3>
        <p>Conversación activa</p>
        <button class="btn-principal" onclick="localStorage.setItem('chat_id_actual', '${chat.id}'); if (typeof window.iniciarChatLateral === 'function') { window.iniciarChatLateral('${chat.id}'); }">
          Abrir chat
        </button>
      `
      lista.appendChild(card)
    })
  } catch (err) {
    console.error('Error al cargar chats:', err)
  } finally {
    hideLoader()
  }
}

// Configurar botón del menú lateral de Chat
document.addEventListener('DOMContentLoaded', () => {
  const btnAbrirChatMenu = document.getElementById('btn-abrir-chat-menu')
  if (btnAbrirChatMenu) {
    btnAbrirChatMenu.addEventListener('click', (e) => {
      e.preventDefault()
      const chatGuardado = localStorage.getItem('chat_id_actual')
      const panel = document.getElementById('chat-lateral')
      if (panel) {
        if (panel.classList.contains('activo')) {
          panel.classList.remove('activo')
        } else {
          panel.classList.add('activo')
          if (chatGuardado && typeof window.iniciarChatLateral === 'function') {
            window.iniciarChatLateral(chatGuardado)
          }
        }
      }
    })
  }
})

configurarCierreSesion()
cargarChats()
