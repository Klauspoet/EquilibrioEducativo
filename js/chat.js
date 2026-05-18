import { supabase } from './supabase.js'

const params = new URLSearchParams(window.location.search)
const chatId = params.get('chat_id')
const mensajesDiv = document.getElementById('mensajes')
const inputMensaje = document.getElementById('texto-mensaje')
const btnEnviar = document.getElementById('btn-enviar')
// Pedir permiso para notificaciones
if (Notification.permission === 'default') {
    Notification.requestPermission()
}

// Función para mostrar notificación
function mostrarNotificacion(nombre, mensaje) {
    if (Notification.permission === 'granted') {
        new Notification(`Mensaje de ${nombre}`, {
            body: mensaje,
            icon: 'img/logo.png'
        })
    }
}

async function cargarInfoChat() {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data: chat } = await supabase
        .from('chats')
        .select('*, estudiante:usuarios!chats_estudiante_id_fkey(nombre), psicoorientador:usuarios!chats_psicoorientador_id_fkey(nombre)')
        .eq('id', chatId)
        .single()

    if (chat) {
        // Mostrar el nombre del otro usuario
        const esEstudiante = chat.estudiante_id === user.id
        const nombreReceptor = esEstudiante ? chat.psicoorientador.nombre : chat.estudiante.nombre
        document.getElementById('nombre-receptor').textContent = nombreReceptor
        document.getElementById('avatar-receptor').textContent = nombreReceptor.charAt(0)
    }
}

async function cargarMensajes() {
    const { data, error } = await supabase
        .from('mensajes')
        .select('*, usuarios(nombre)')
        .eq('chat_id', chatId)
        .order('enviado_en', { ascending: true })

    if (error) return

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

btnEnviar.addEventListener('click', async () => {
    const texto = inputMensaje.value.trim()
    if (!texto) return

    const { data: { user } } = await supabase.auth.getUser()
    const { data: usuarioData } = await supabase.from('usuarios').select('nombre').eq('id', user.id).single()

    // Mostrar mensaje instantáneamente
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

    // Guardar en base de datos
    await supabase.from('mensajes').insert({
        chat_id: chatId,
        enviado_por: user.id,
        texto: texto
    })
})

    inputMensaje.value = ''


inputMensaje.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnEnviar.click()
})

supabase
    supabase
    .channel('mensajes-' + chatId)
    .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: `chat_id=eq.${chatId}`
    }, async (payload) => {
        cargarMensajes()

        // Notificar solo si el mensaje es de otro usuario
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
// Cerrar sesión
const btnLogout = document.getElementById('btn-logout')
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'index.html'
    })
}