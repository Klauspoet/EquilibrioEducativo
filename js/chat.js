import { supabase } from './supabase.js'

const params = new URLSearchParams(window.location.search)
const chatId = params.get('chat_id') || localStorage.getItem('chat_id_actual')
const mensajesDiv = document.getElementById('mensajes')
const inputMensaje = document.getElementById('texto-mensaje')
const btnEnviar = document.getElementById('btn-enviar')

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
    const { data: chat } = await supabase
        .from('chats')
        .select('*, estudiante:usuarios!chats_estudiante_id_fkey(nombre), psicoorientador:usuarios!chats_psicoorientador_id_fkey(nombre)')
        .eq('id', chatId)
        .single()

    if (!chat) return

    const { data: { user } } = await supabase.auth.getUser()
    const nombreReceptor = user.id === chat.estudiante_id
        ? chat.psicoorientador?.nombre
        : chat.estudiante?.nombre

    document.getElementById('nombre-receptor').textContent = nombreReceptor || 'Usuario'
}

async function cargarMensajes() {
    const { data, error } = await supabase
        .from('mensajes')
        .select('*, usuarios(nombre)')
        .eq('chat_id', chatId)
        .order('enviado_en', { ascending: true })

    if (error || !data) return

    mensajesDiv.innerHTML = ''
    const { data: { user } } = await supabase.auth.getUser()

    data.forEach(msg => {
        const div = document.createElement('div')
        const esMio = msg.enviado_por === user.id
        div.className = esMio ? 'mensaje propio' : 'mensaje otro'
        div.innerHTML = `
            <span class="nombre">${msg.usuarios.nombre}</span>
            <p>${msg.texto}</p>
            <span class="hora">${new Date(msg.enviado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
        `
        mensajesDiv.appendChild(div)
    })

    mensajesDiv.scrollTop = mensajesDiv.scrollHeight
}

if (!btnEnviar || !inputMensaje) {
    throw new Error('Elementos del chat no encontrados')
}

btnEnviar.addEventListener('click', async () => {
    const texto = inputMensaje.value.trim()
    if (!texto) return

    const { data: { user } } = await supabase.auth.getUser()
    const { data: usuarioData } = await supabase.from('usuarios').select('nombre').eq('id', user.id).single()

    const div = document.createElement('div')
    div.className = 'mensaje propio'
    div.innerHTML = `
        <span class="nombre">${usuarioData.nombre}</span>
        <p>${texto}</p>
        <span class="hora">${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
    `
    mensajesDiv.appendChild(div)
    mensajesDiv.scrollTop = mensajesDiv.scrollHeight

    inputMensaje.value = ''

    await supabase.from('mensajes').insert({
        chat_id: chatId,
        enviado_por: user.id,
        texto: texto
    })
})

inputMensaje.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnEnviar.click()
})

if (chatId) {
supabase
    .channel('mensajes-' + chatId)
    .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: `chat_id=eq.${chatId}`
    }, async (payload) => {
        cargarMensajes()

        const { data: { user } } = await supabase.auth.getUser()
        if (payload.new.enviado_por !== user.id) {
            const { data: remitente } = await supabase
                .from('usuarios')
                .select('nombre')
                .eq('id', payload.new.enviado_por)
                .single()
            mostrarNotificacion(remitente.nombre, payload.new.texto)
        }
    })
    .subscribe()
}

const btnLogout = document.getElementById('btn-logout')
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'index.html'
    })
}

cargarInfoChat()
cargarMensajes()