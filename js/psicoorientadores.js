import { supabase } from './supabase.js'
import { obtenerUsuarioActual, configurarCierreSesion, showLoader, hideLoader, renderEmptyState, escapeHtml } from './utilidades.js'

async function cargarConversaciones(userId) {
  const { data: chats } = await supabase
    .from('chats')
    .select(`
      id,
      estudiante:usuarios!chats_estudiante_id_fkey(id, nombre),
      mensajes(texto, enviado_en)
    `)
    .eq('psicoorientador_id', userId)
    .order('creado_en', { ascending: false })

  const lista = document.getElementById('lista-conversaciones')
  if (!lista) return
  lista.innerHTML = ''

  if (!chats || chats.length === 0) {
    lista.innerHTML = '<p class="conv-empty">Sin conversaciones aún</p>'
    return
  }

  chats.forEach((chat, i) => {
    const nombre = chat.estudiante?.nombre || 'Estudiante'
    const iniciales = nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    const mensajes = chat.mensajes || []
    const ultimoMensaje = mensajes.length > 0 ? mensajes[mensajes.length - 1] : null
    const preview = ultimoMensaje?.texto || 'Sin mensajes aún'
    const hora = ultimoMensaje
      ? new Date(ultimoMensaje.enviado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      : ''

    const card = document.createElement('div')
    card.className = 'conv-card' + (i === 0 ? ' active' : '')
    card.innerHTML = `
      <div class="conv-avatar">${escapeHtml(iniciales)}</div>
      <div class="conv-info">
        <div class="conv-name">${escapeHtml(nombre)}</div>
        <div class="conv-preview">${escapeHtml(preview)}</div>
      </div>
      <div class="conv-time">${hora}</div>
    `
    card.addEventListener('click', () => {
      localStorage.setItem('chat_id_actual', chat.id)
      window.location.href = `chat.html?chat_id=${chat.id}`
    })
    lista.appendChild(card)
  })
}

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

    await cargarConversaciones(user.id)

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
        <button class="btn-principal" onclick="localStorage.setItem('chat_id_actual', '${chat.id}'); window.location.href='chat.html'">
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

configurarCierreSesion()
cargarChats()
