import { supabase } from './supabase.js'
import { obtenerUsuarioActual, escapeHtml } from './utilidades.js'

let usuarioActual = null
let suscripcion = null
let chatIdActual = null

const chatLateralContainer = document.getElementById('chat-lateral')

export async function inicializarChatPanel() {
  if (!chatLateralContainer) return

  // Obtener el usuario actual
  usuarioActual = await obtenerUsuarioActual()
  if (!usuarioActual) return

  // Comprobar si hay un chat guardado en localStorage
  const chatGuardado = localStorage.getItem('chat_id_actual')
  if (chatGuardado) {
    await cargarChatLateral(chatGuardado)
  } else {
    mostrarEstadoVacio()
  }
}

function mostrarEstadoVacio() {
  chatIdActual = null
  if (suscripcion) {
    supabase.removeChannel(suscripcion)
    suscripcion = null
  }
  chatLateralContainer.classList.remove('activo')
  chatLateralContainer.innerHTML = `
    <div class="chat-lateral-vacio">
      <div class="vacio-icono">💬</div>
      <h3>Tus conversaciones</h3>
      <p>Selecciona un psicoorientador o estudiante para abrir el chat aquí mismo en la parte derecha.</p>
    </div>
  `
}

export async function cargarChatLateral(chatId) {
  if (!chatId) return
  chatIdActual = chatId
  localStorage.setItem('chat_id_actual', chatId)

  if (suscripcion) {
    supabase.removeChannel(suscripcion)
    suscripcion = null
  }

  // Activar la clase de visualización del chat
  chatLateralContainer.classList.add('activo')

  // Renderizar esqueleto de carga
  chatLateralContainer.innerHTML = `
    <div class="chat-lateral-header">
      <div class="chat-lateral-receptor-info">
        <div class="chat-lateral-avatar">👤</div>
        <div>
          <h4 id="chat-lateral-nombre">Cargando...</h4>
          <span class="chat-lateral-estado">En línea</span>
        </div>
      </div>
      <button id="btn-cerrar-chat-lateral" class="btn-cerrar-chat">✕</button>
    </div>
    <div id="chat-lateral-mensajes" class="chat-lateral-mensajes">
      <div class="skeleton" style="height: 35px; width: 60%; margin-bottom: 8px;"></div>
      <div class="skeleton" style="height: 35px; width: 45%; margin-bottom: 8px; align-self: flex-end;"></div>
      <div class="skeleton" style="height: 35px; width: 55%; margin-bottom: 8px;"></div>
    </div>
    <div class="chat-lateral-input">
      <input type="text" id="chat-lateral-texto" placeholder="Escribe tu mensaje...">
      <button id="btn-chat-lateral-enviar">➤</button>
    </div>
  `

  document.getElementById('btn-cerrar-chat-lateral').addEventListener('click', () => {
    localStorage.removeItem('chat_id_actual')
    mostrarEstadoVacio()
  })

  const inputMensaje = document.getElementById('chat-lateral-texto')
  const btnEnviar = document.getElementById('btn-chat-lateral-enviar')

  btnEnviar.addEventListener('click', enviarMensaje)
  inputMensaje.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarMensaje()
  })

  try {
    // Cargar información del chat
    const { data: chat, error: errorChat } = await supabase
      .from('chats')
      .select('*, estudiante:usuarios!chats_estudiante_id_fkey(nombre), psicoorientador:usuarios!chats_psicoorientador_id_fkey(nombre)')
      .eq('id', chatId)
      .maybeSingle()

    if (errorChat || !chat) {
      mostrarEstadoVacio()
      return
    }

    const nombreReceptor = usuarioActual.id === chat.estudiante_id
      ? chat.psicoorientador?.nombre
      : chat.estudiante?.nombre

    document.getElementById('chat-lateral-nombre').textContent = nombreReceptor || 'Usuario'

    // Cargar mensajes iniciales
    await cargarMensajes()

    // Suscribirse a nuevos mensajes
    iniciarSuscripcionRealtime(chatId)
  } catch (err) {
    console.error('Error al cargar chat lateral:', err)
  }
}

async function cargarMensajes() {
  const mensajesDiv = document.getElementById('chat-lateral-mensajes')
  if (!mensajesDiv || !chatIdActual) return

  try {
    const { data, error } = await supabase
      .from('mensajes')
      .select('*, usuarios(nombre)')
      .eq('chat_id', chatIdActual)
      .order('enviado_en', { ascending: true })

    if (error || !data) {
      mensajesDiv.innerHTML = '<p class="chat-lateral-error">No se pudieron cargar los mensajes.</p>'
      return
    }

    mensajesDiv.innerHTML = ''

    if (data.length === 0) {
      mensajesDiv.innerHTML = `
        <div class="chat-lateral-sin-mensajes">
          <p>Sin mensajes aún. ¡Inicia la conversación!</p>
        </div>
      `
      return
    }

    data.forEach(msg => {
      const div = document.createElement('div')
      div.className = msg.enviado_por === usuarioActual.id ? 'msg-lat propio' : 'msg-lat otro'
      div.innerHTML = `
        <span class="nombre">${escapeHtml(msg.usuarios.nombre)}</span>
        <p>${escapeHtml(msg.texto)}</p>
        <span class="hora">${new Date(msg.enviado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
      `
      mensajesDiv.appendChild(div)
    })

    mensajesDiv.scrollTop = mensajesDiv.scrollHeight
  } catch (err) {
    console.error('Error al cargar mensajes del chat lateral:', err)
  }
}

async function enviarMensaje() {
  const inputMensaje = document.getElementById('chat-lateral-texto')
  if (!inputMensaje || !chatIdActual) return

  const texto = inputMensaje.value.trim()
  if (!texto) return

  try {
    const { data: usuarioData, error: errorUsuario } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('id', usuarioActual.id)
      .maybeSingle()

    if (errorUsuario || !usuarioData) return

    // Agregar mensaje al DOM localmente de forma inmediata para agilidad
    agregarMensajeDOM(texto, usuarioData.nombre)
    inputMensaje.value = ''

    await supabase.from('mensajes').insert({
      chat_id: chatIdActual,
      enviado_por: usuarioActual.id,
      texto
    })
  } catch (err) {
    console.error('Error al enviar mensaje desde el chat lateral:', err)
  }
}

function agregarMensajeDOM(texto, nombre) {
  const mensajesDiv = document.getElementById('chat-lateral-mensajes')
  if (!mensajesDiv) return

  // Remover mensaje de "Sin mensajes aún" si existe
  const sinMensajes = mensajesDiv.querySelector('.chat-lateral-sin-mensajes')
  if (sinMensajes) {
    mensajesDiv.innerHTML = ''
  }

  const div = document.createElement('div')
  div.className = 'msg-lat propio'
  div.innerHTML = `
    <span class="nombre">${escapeHtml(nombre)}</span>
    <p>${escapeHtml(texto)}</p>
    <span class="hora">${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
  `
  mensajesDiv.appendChild(div)
  mensajesDiv.scrollTop = mensajesDiv.scrollHeight
}

function iniciarSuscripcionRealtime(chatId) {
  suscripcion = supabase
    .channel('mensajes-lateral-' + chatId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'mensajes',
      filter: `chat_id=eq.${chatId}`
    }, async (payload) => {
      // Recargar mensajes para asegurar sincronización y nombres de usuario correctos
      await cargarMensajes()
    })
    .subscribe()
}

// Configurar ventana global para poder abrir el chat desde fuera
window.iniciarChatLateral = cargarChatLateral

// Autoinicializar si se importa directamente
document.addEventListener('DOMContentLoaded', () => {
  inicializarChatPanel()
})
// También ejecutamos por si el script se carga diferido/módulo
inicializarChatPanel()
