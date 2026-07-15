import { supabase } from './supabase.js'
import { obtenerUsuarioActual, configurarCierreSesion, showLoader, hideLoader, renderEmptyState, escapeHtml } from './utilidades.js'

const mensajesEmocionales = {
  'Triste': { texto: '💙 Está bien no estar bien. Hablar con alguien puede ayudarte mucho.', urgente: true },
  'Regular': { texto: '🌿 A veces un poco de apoyo hace la diferencia. ¿Quieres conversar?', urgente: false },
  'Bien': { texto: '😊 ¡Qué bueno! Si alguna vez necesitas hablar, aquí estamos.', urgente: false },
  'Genial': { texto: '✨ ¡Excelente! Recuerda que siempre puedes contar con nosotros.', urgente: false },
  'Ansioso': { texto: '💜 Entendemos cómo te sientes. Un psicoorientador puede ayudarte ahora.', urgente: true }
}

const emocionDesdeDataAttr = {
  triste: 'Triste',
  regular: 'Regular',
  bien: 'Bien',
  genial: 'Genial',
  ansioso: 'Ansioso'
}

const dataAttrDesdeEmocion = {
  Triste: 'triste',
  Regular: 'regular',
  Bien: 'bien',
  Genial: 'genial',
  Ansioso: 'ansioso'
}

let usuarioActual = null

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d`
}

const emojiEmocion = {
  Triste: '😔', Regular: '😐', Bien: '🙂', Genial: '😄', Ansioso: '😰'
}

function actualizarEmotionDisplay(emocion) {
  const display = document.getElementById('est-emotion-display')
  const box = document.getElementById('est-emotion-box')
  if (!display || !box || !emocion) return

  const emoji = emojiEmocion[emocion] || ''
  display.innerHTML = `
    <span class="est-emotion-display-emoji">${emoji}</span>
    <span class="est-emotion-display-text">${escapeHtml(emocion)}</span>
    <span class="est-emotion-display-check">Registrado ✓</span>
  `
  display.classList.add('active')
  box.classList.add('est-emotion-box--registered')
}

async function cargarConversaciones() {
  if (!usuarioActual) return

  try {
    const { data: chats } = await supabase
      .from('chats')
      .select(`
        id,
        psicoorientador:usuarios!chats_psicoorientador_id_fkey(id, nombre),
        mensajes(texto, enviado_en)
      `)
      .eq('estudiante_id', usuarioActual.id)
      .order('creado_en', { ascending: false })

    const lista = document.getElementById('lista-conversaciones')
    if (!lista) return
    lista.innerHTML = ''

    if (!chats || chats.length === 0) {
      lista.innerHTML = '<p class="conv-empty">Sin conversaciones aún</p>'
      return
    }

    chats.forEach((chat, i) => {
      const nombre = chat.psicoorientador?.nombre || 'Orientador'
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
  } catch (err) {
    console.error('Error al cargar conversaciones:', err)
  }
}

function configurarSidebarMobile() {
  const btn = document.getElementById('btn-toggle-sidebar')
  const panel = document.getElementById('conversations-panel')
  const overlay = document.getElementById('est-sidebar-overlay')
  if (!btn || !panel) return

  function openSidebar() {
    panel.classList.add('open')
    if (overlay) overlay.classList.add('active')
  }

  function closeSidebar() {
    panel.classList.remove('open')
    if (overlay) overlay.classList.remove('active')
  }

  btn.addEventListener('click', openSidebar)
  if (overlay) {
    overlay.addEventListener('click', closeSidebar)
  }
}

async function cargarPsicoorientadores() {
  showLoader()
  try {
    usuarioActual = await obtenerUsuarioActual()
    if (!usuarioActual) return

    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('id', usuarioActual.id)
      .maybeSingle()

    if (errorUsuario || !usuario) return
    document.getElementById('nombre-usuario').textContent = usuario.nombre

    const sidebarName = document.getElementById('sidebar-username')
    const sidebarAvatar = document.getElementById('sidebar-avatar')
    if (sidebarName) sidebarName.textContent = usuario.nombre
    if (sidebarAvatar) {
      sidebarAvatar.textContent = usuario.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    await Promise.all([
      checkTodayEmotion(usuarioActual.id),
      cargarConversaciones()
    ])

    const { data: psicos } = await supabase
      .from('psicoorientadores')
      .select('*, usuarios(nombre)')
      .eq('disponible', true)
      .eq('estado', 'aprobado')

    const lista = document.getElementById('lista-psicoorientadores')
    lista.innerHTML = ''

    if (!psicos || psicos.length === 0) {
      renderEmptyState(lista, '👥', 'Sin orientadores disponibles', 'No hay psicoorientadores asignados por el momento.')
      return
    }

    ;(psicos ?? []).forEach(psico => {
      const card = document.createElement('div')
      card.className = 'card-psico'
      const nombre = psico.usuarios.nombre
      const iniciales = nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      card.innerHTML = `
        <div class="card-header-row">
          <div class="card-avatar">${escapeHtml(iniciales)}</div>
          <div>
            <h3>${escapeHtml(nombre)}</h3>
            <span class="specialty-tag">${escapeHtml(psico.especialidad) || 'Psicoorientador'}</span>
          </div>
        </div>
        <p>${escapeHtml(psico.descripcion) || ''}</p>
        <button class="btn-principal btn-iniciar-chat" onclick="window.iniciarChat('${psico.usuario_id}', this)">
          Iniciar chat
        </button>
      `
      lista.appendChild(card)
    })
  } catch (err) {
    console.error('Error al cargar psicoorientadores:', err)
  } finally {
    hideLoader()
  }
}

window.iniciarChat = async (psicoorientadorId, btn) => {
  try {
    if (btn) {
      btn.disabled = true
      btn.textContent = 'Abriendo...'
    }

    if (!usuarioActual) {
      usuarioActual = await obtenerUsuarioActual()
      if (!usuarioActual) return
    }

    const { data: chatExistente } = await supabase
      .from('chats')
      .select('id')
      .eq('estudiante_id', usuarioActual.id)
      .eq('psicoorientador_id', psicoorientadorId)
      .maybeSingle()

    if (chatExistente) {
      localStorage.setItem('chat_id_actual', chatExistente.id)
      window.location.href = 'chat.html?chat_id=' + chatExistente.id
      return
    }

    const { data: nuevoChat, error: errorChat } = await supabase
      .from('chats')
      .insert({
        estudiante_id: usuarioActual.id,
        psicoorientador_id: psicoorientadorId
      })
      .select()
      .maybeSingle()

    if (errorChat || !nuevoChat) {
      const lista = document.getElementById('lista-psicoorientadores')
      renderEmptyState(lista, '⚠️', 'No se pudo crear el chat', 'Ocurrió un error al iniciar la conversación. Intenta de nuevo.')
      return
    }

    localStorage.setItem('chat_id_actual', nuevoChat.id)
    window.location.href = 'chat.html?chat_id=' + nuevoChat.id
  } catch (err) {
    console.error('Error al iniciar chat:', err)
  }
}

function crearSugerencia() {
  const sugerencia = document.createElement('div')
  sugerencia.id = 'sugerencia-emocional'
  sugerencia.className = 'sugerencia-emocional'
  const anchor = document.querySelector('.est-emotion-box') || document.querySelector('.emotion-row')
  anchor.after(sugerencia)
  return sugerencia
}

function obtenerSugerencia() {
  return document.getElementById('sugerencia-emocional') || crearSugerencia()
}

function disableEmotionCards() {
  document.querySelectorAll('.emo-card').forEach(c => {
    c.classList.add('disabled')
  })
}

function highlightTodayEmotion(emocion) {
  const attr = dataAttrDesdeEmocion[emocion]
  if (!attr) return
  const card = document.querySelector(`.emo-card[data-emotion="${attr}"]`)
  if (card) {
    card.classList.add('registered-today')
  }
}

async function checkTodayEmotion(userId) {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('registros_emocionales')
    .select('id, emocion')
    .eq('estudiante_id', userId)
    .gte('registrado_en', today + 'T00:00:00')
    .lte('registrado_en', today + 'T23:59:59')
    .maybeSingle()

  if (data) {
    highlightTodayEmotion(data.emocion)
    disableEmotionCards()
    actualizarEmotionDisplay(data.emocion)
    const msgEl = document.getElementById('emocion-status-msg')
    if (msgEl) {
      msgEl.innerHTML = `<strong>Ya registraste cómo te sientes hoy ✓</strong> Vuelve mañana para un nuevo registro.<br><span style="font-size:0.8rem;opacity:0.7;">Próximo registro disponible: mañana</span>`
      msgEl.style.display = 'block'
    }
    return data.emocion
  }
  return null
}

document.querySelectorAll('.emo-card').forEach(card => {
  card.addEventListener('click', async () => {
    try {
      if (card.classList.contains('disabled') || card.classList.contains('registered-today')) return

      document.querySelectorAll('.emo-card').forEach(c => c.classList.remove('selected'))
      card.classList.add('selected')

      const spans = card.querySelectorAll('span')
      const emocion = spans[spans.length - 1].textContent.trim()

      if (!usuarioActual) {
        usuarioActual = await obtenerUsuarioActual()
        if (!usuarioActual) return
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('registros_emocionales')
        .select('id')
        .eq('estudiante_id', usuarioActual.id)
        .gte('registrado_en', today + 'T00:00:00')
        .lte('registrado_en', today + 'T23:59:59')
        .maybeSingle()

      if (existing) {
        document.querySelectorAll('.emo-card').forEach(c => c.classList.remove('selected'))
        await checkTodayEmotion(usuarioActual.id)
        return
      }

      const { error: errorEmocion } = await supabase.from('registros_emocionales').insert({
        estudiante_id: usuarioActual.id,
        emocion
      })

      if (errorEmocion) {
        document.querySelectorAll('.emo-card').forEach(c => c.classList.remove('selected'))
        const msgEl = document.getElementById('emocion-status-msg')
        if (msgEl) {
          msgEl.innerHTML = `<strong>No se pudo registrar tu emoción</strong> Verifica tus permisos e intenta de nuevo.`
          msgEl.style.display = 'block'
        }
        return
      }

      highlightTodayEmotion(emocion)
      disableEmotionCards()
      actualizarEmotionDisplay(emocion)

      const msgEl = document.getElementById('emocion-status-msg')
      if (msgEl) {
        msgEl.innerHTML = `<strong>Ya registraste cómo te sientes hoy ✓</strong> Vuelve mañana para un nuevo registro.<br><span style="font-size:0.8rem;opacity:0.7;">Próximo registro disponible: mañana</span>`
        msgEl.style.display = 'block'
      }

      const info = mensajesEmocionales[emocion]
      if (!info) return

      const sugerencia = obtenerSugerencia()
      sugerencia.style.borderLeftColor = info.urgente ? 'var(--color-lila)' : 'var(--color-exito)'
      sugerencia.innerHTML = `
        <p>${info.texto}</p>
        <a href="#lista-psicoorientadores" class="btn-principal" style="white-space:nowrap;">
          ${info.urgente ? 'Hablar ahora 💬' : 'Ver psicoorientadores'}
        </a>
      `
    } catch (err) {
      console.error('Error al registrar emoción:', err)
    }
  })
})

configurarCierreSesion()
configurarSidebarMobile()
cargarPsicoorientadores()
