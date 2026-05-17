import { supabase } from './supabase.js'

async function cargarChats() {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        window.location.href = 'login.html'
        return
    }

    const { data: usuario } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('id', user.id)
        .single()

    document.getElementById('nombre-usuario').textContent = usuario.nombre

    // Buscar el id del psicoorientador en la tabla psicoorientadores
    const { data: psico } = await supabase
        .from('psicoorientadores')
        .select('usuario_id')
        .eq('usuario_id', user.id)
        .single()

    if (!psico) {
        document.getElementById('lista-chats').innerHTML = '<p>No se encontró tu perfil de psicoorientador.</p>'
        return
    }

    const { data: chats } = await supabase
        .from('chats')
        .select('*, usuarios!chats_estudiante_id_fkey(nombre)')
        .eq('psicoorientador_id', user.id)

    const lista = document.getElementById('lista-chats')

    if (!chats || chats.length === 0) {
        lista.innerHTML = '<p style="color:#8a8aaa;">No tienes conversaciones activas aún.</p>'
        return
    }

    chats.forEach(chat => {
        const card = document.createElement('div')
        card.className = 'card-psico'
        card.innerHTML = `
            <h3>${chat.usuarios.nombre}</h3>
            <p>Conversación activa</p>
            <button class="btn-principal" onclick="window.location.href='chat.html?chat_id=${chat.id}'">
                Abrir chat
            </button>
        `
        lista.appendChild(card)
    })
}

cargarChats()