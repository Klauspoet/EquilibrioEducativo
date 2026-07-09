import { supabase } from './supabase.js'
import { obtenerUsuarioActual, configurarCierreSesion, showLoader, hideLoader, renderEmptyState } from './utilidades.js'

const params = new URLSearchParams(window.location.search)
const chatId = params.get('chat_id') || localStorage.getItem('chat_id_actual')
const mensajesDiv = document.getElementById('mensajes')
const inputMensaje = document.getElementById('texto-mensaje')
const btnEnviar = document.getElementById('btn-enviar')

let usuarioActual = null
let suscripcion = null

if (!chatId) {
  window.location.href = 'estudiante.html'
}

if (Notification.permission === 'default') {
  Notification.requestPermission()
}

function mostrarNotificacion(nombre, mensaje) {
  if (Notification.permission === 'granted') {
    new Notification(`Mensaje de ${nombre}`, {
      body: mensaje,
      icon: 'img/logo.png'
    })
  }
}

async function cargarInfoChat() {
  try {
    const { data: chat, error: errorChat } = await supabase
      .from('chats')
      .select('*, estudiante:usuarios!chats_estudiante_id_fkey(nombre), psicoorientador:usuarios!chats_psicoorientador_id_fkey(nombre)')
      .eq('id', chatId)
      .maybeSingle()

    if (errorChat || !chat) return

    usuarioActual = await obtenerUsuarioActual()
    if (!usuarioActual) return

    const nombreReceptor = usuarioActual.id === chat.estudiante_id
      ? chat.psicoorientador?.nombre
      : chat.estudiante?.nombre

    document.getElementById('nombre-receptor').textContent = nombreReceptor || 'Usuario'
  } catch (err) {
    console.error('Error al cargar info del chat:', err)
  }
}

async function cargarMensajes() {
  try {
    const { data, error } = await supabase
      .from('mensajes')
      .select('*, usuarios(nombre)')
      .eq('chat_id', chatId)
      .order('enviado_en', { ascending: true })

    if (error || !data) return

    mensajesDiv.innerHTML = ''

    if (!data || data.length === 0) {
      renderEmptyState(mensajesDiv, '💬', 'Sin mensajes aún', 'Inicia la conversación escribiendo tu primer mensaje.')
      return
    }

    if (!usuarioActual) {
      usuarioActual = await obtenerUsuarioActual()
      if (!usuarioActual) return
    }

    data.forEach(msg => {
      const div = document.createElement('div')
      div.className = msg.enviado_por === usuarioActual.id ? 'mensaje propio' : 'mensaje otro'
      div.innerHTML = `
        <span class="nombre">${msg.usuarios.nombre}</span>
        <p>${msg.texto}</p>
        <span class="hora">${new Date(msg.enviado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
      `
      mensajesDiv.appendChild(div)
    })

    mensajesDiv.scrollTop = mensajesDiv.scrollHeight
  } catch (err) {
    console.error('Error al cargar mensajes:', err)
  }
}

function agregarMensajeDOM(texto, nombre) {
  const div = document.createElement('div')
  div.className = 'mensaje propio'
  div.innerHTML = `
    <span class="nombre">${nombre}</span>
    <p>${texto}</p>
    <span class="hora">${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
  `
  mensajesDiv.appendChild(div)
  mensajesDiv.scrollTop = mensajesDiv.scrollHeight
}

if (btnEnviar && inputMensaje) {
  btnEnviar.addEventListener('click', async () => {
    const texto = inputMensaje.value.trim()
    if (!texto) return

    try {
      if (!usuarioActual) {
        usuarioActual = await obtenerUsuarioActual()
        if (!usuarioActual) return
      }

      const { data: usuarioData, error: errorUsuario } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('id', usuarioActual.id)
        .maybeSingle()

      if (errorUsuario || !usuarioData) return

      agregarMensajeDOM(texto, usuarioData.nombre)
      inputMensaje.value = ''

      await supabase.from('mensajes').insert({
        chat_id: chatId,
        enviado_por: usuarioActual.id,
        texto
      })
    } catch (err) {
      console.error('Error al enviar mensaje:', err)
    }
  })

  inputMensaje.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnEnviar.click()
  })
}

async function iniciarSuscripcion() {
  suscripcion = supabase
    .channel('mensajes-' + chatId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'mensajes',
      filter: `chat_id=eq.${chatId}`
    }, async (payload) => {
      await cargarMensajes()
      if (!usuarioActual) {
        usuarioActual = await obtenerUsuarioActual()
      }
      if (usuarioActual && payload.new.enviado_por !== usuarioActual.id) {
        const { data: remitente } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('id', payload.new.enviado_por)
          .single()
        if (remitente) {
          mostrarNotificacion(remitente.nombre, payload.new.texto)
        }
      }
    })
    .subscribe()
}

window.addEventListener('beforeunload', () => {
  if (suscripcion) {
    supabase.removeChannel(suscripcion)
    suscripcion = null
  }
})

if (chatId) {
  configurarCierreSesion()
  showLoader()
  try {
    await cargarInfoChat()
    await cargarMensajes()
  } catch (err) {
    console.error('Error al iniciar chat:', err)
  } finally {
    hideLoader()
  }
  iniciarSuscripcion()
}
