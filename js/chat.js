import { supabase } from './supabase.js'

const params = new URLSearchParams(window.location.search)
const chatId = params.get('chat_id')
const mensajesDiv = document.getElementById('mensajes')
const inputMensaje = document.getElementById('texto-mensaje')
const btnEnviar = document.getElementById('btn-enviar')

async function cargarInfoChat() {
    const { data: chat } = await supabase
        .from('chats')
        .select('*, usuarios!chats_psicoorientador_id_fkey(nombre)')
        .eq('id', chatId)
        .single()

    if (chat) {
        document.getElementById('nombre-receptor').textContent = chat.usuarios.nombre
        document.getElementById('avatar-receptor').textContent = chat.usuarios.nombre.charAt(0)
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

    await supabase.from('mensajes').insert({
        chat_id: chatId,
        enviado_por: user.id,
        texto: texto
    })

    inputMensaje.value = ''
})

inputMensaje.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnEnviar.click()
})

supabase
    .channel('mensajes-' + chatId)
    .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: `chat_id=eq.${chatId}`
    }, () => {
        cargarMensajes()
    })
    .subscribe()

cargarInfoChat()
cargarMensajes()