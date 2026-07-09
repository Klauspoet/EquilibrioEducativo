import { supabase } from './supabase.js'
import { obtenerUsuarioActual, configurarCierreSesion, showLoader, hideLoader } from './utilidades.js'

const mensajesEmocionales = {
  'Triste': { texto: '💙 Está bien no estar bien. Hablar con alguien puede ayudarte mucho.', urgente: true },
  'Regular': { texto: '🌿 A veces un poco de apoyo hace la diferencia. ¿Quieres conversar?', urgente: false },
  'Bien': { texto: '😊 ¡Qué bueno! Si alguna vez necesitas hablar, aquí estamos.', urgente: false },
  'Genial': { texto: '✨ ¡Excelente! Recuerda que siempre puedes contar con nosotros.', urgente: false },
  'Ansioso': { texto: '💜 Entendemos cómo te sientes. Un psicoorientador puede ayudarte ahora.', urgente: true }
}

let usuarioActual = null

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

    const { data: psicos } = await supabase
      .from('psicoorientadores')
      .select('*, usuarios(nombre)')
      .eq('disponible', true)

    const lista = document.getElementById('lista-psicoorientadores')
    lista.innerHTML = ''

    ;(psicos ?? []).forEach(psico => {
      const card = document.createElement('div')
      card.className = 'card-psico'
      const nombre = psico.usuarios.nombre
      const iniciales = nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      card.innerHTML = `
        <div class="card-header-row">
          <div class="card-avatar">${iniciales}</div>
          <div>
            <h3>${nombre}</h3>
            <span class="specialty-tag">${psico.especialidad || 'Psicoorientador'}</span>
          </div>
        </div>
        <p>${psico.descripcion || ''}</p>
        <button class="btn-principal" onclick="window.iniciarChat('${psico.usuario_id}')">
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

window.iniciarChat = async (psicoorientadorId) => {
  try {
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
      window.location.href = 'chat.html'
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

    if (errorChat || !nuevoChat) return
    localStorage.setItem('chat_id_actual', nuevoChat.id)
    window.location.href = 'chat.html'
  } catch (err) {
    console.error('Error al iniciar chat:', err)
  }
}

function crearSugerencia() {
  const sugerencia = document.createElement('div')
  sugerencia.id = 'sugerencia-emocional'
  sugerencia.className = 'sugerencia-emocional'
  document.querySelector('.emotion-row').after(sugerencia)
  return sugerencia
}

function obtenerSugerencia() {
  return document.getElementById('sugerencia-emocional') || crearSugerencia()
}

document.querySelectorAll('.emo-card').forEach(card => {
  card.addEventListener('click', async () => {
    try {
      document.querySelectorAll('.emo-card').forEach(c => c.classList.remove('selected'))
      card.classList.add('selected')

      const spans = card.querySelectorAll('span')
      const emocion = spans[spans.length - 1].textContent.trim()

      if (!usuarioActual) {
        usuarioActual = await obtenerUsuarioActual()
        if (!usuarioActual) return
      }

      await supabase.from('registros_emocionales').insert({
        estudiante_id: usuarioActual.id,
        emocion
      })

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
cargarPsicoorientadores()
