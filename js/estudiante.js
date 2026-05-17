import { supabase } from './supabase.js'

const mensajesEmocionales = {
    'Triste': { texto: '💙 Está bien no estar bien. Hablar con alguien puede ayudarte mucho.', urgente: true },
    'Regular': { texto: '🌿 A veces un poco de apoyo hace la diferencia. ¿Quieres conversar?', urgente: false },
    'Bien': { texto: '😊 ¡Qué bueno! Si alguna vez necesitas hablar, aquí estamos.', urgente: false },
    'Genial': { texto: '✨ ¡Excelente! Recuerda que siempre puedes contar con nosotros.', urgente: false },
    'Ansioso': { texto: '💜 Entendemos cómo te sientes. Un psicoorientador puede ayudarte ahora.', urgente: true }
}

async function cargarPsicoorientadores() {
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

    const { data: psicos } = await supabase
        .from('psicoorientadores')
        .select('*, usuarios(nombre)')
        .eq('disponible', true)

    const lista = document.getElementById('lista-psicoorientadores')

    psicos.forEach(psico => {
        const card = document.createElement('div')
        card.className = 'card-psico'
        card.innerHTML = `
            <h3>${psico.usuarios.nombre}</h3>
            <p>${psico.especialidad || 'Psicoorientador'}</p>
            <p>${psico.descripcion || ''}</p>
            <button class="btn-principal" onclick="iniciarChat('${psico.usuario_id}')">
                Iniciar chat
            </button>
        `
        lista.appendChild(card)
    })
}

window.iniciarChat = async (psicoorientadorId) => {
    const { data: { user } } = await supabase.auth.getUser()

    const { data: chatExistente } = await supabase
        .from('chats')
        .select('id')
        .eq('estudiante_id', user.id)
        .eq('psicoorientador_id', psicoorientadorId)
        .single()

    if (chatExistente) {
        window.location.href = `chat.html?chat_id=${chatExistente.id}`
        return
    }

    const { data: nuevoChat } = await supabase
        .from('chats')
        .insert({
            estudiante_id: user.id,
            psicoorientador_id: psicoorientadorId
        })
        .select()
        .single()

    window.location.href = `chat.html?chat_id=${nuevoChat.id}`
}

window.addEventListener('load', () => {
    document.querySelectorAll('.emo-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.emo-card').forEach(c => c.classList.remove('selected'))
            card.classList.add('selected')

            const spans = card.querySelectorAll('span')
            const emocion = spans[spans.length - 1].textContent.trim()
            const info = mensajesEmocionales[emocion]

            if (!info) return

            let sugerencia = document.getElementById('sugerencia-emocional')
            if (!sugerencia) {
                sugerencia = document.createElement('div')
                sugerencia.id = 'sugerencia-emocional'
                sugerencia.style.cssText = `
                    background: white;
                    border-radius: 16px;
                    padding: 20px 24px;
                    margin-bottom: 28px;
                    box-shadow: 0 4px 20px rgba(160,140,200,0.1);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    flex-wrap: wrap;
                    border-left: 4px solid #CDB4DB;
                `
                document.querySelector('.emotion-row').after(sugerencia)
            }

            sugerencia.style.borderLeftColor = info.urgente ? '#CDB4DB' : '#B7E4C7'
            sugerencia.innerHTML = `
                <p style="color: #3a3a5c; font-size: 0.95rem; margin: 0;">${info.texto}</p>
                <a href="#lista-psicoorientadores" style="
                    background: linear-gradient(135deg, #A7C7E7, #CDB4DB);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 12px;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 0.85rem;
                    white-space: nowrap;
                ">${info.urgente ? 'Hablar ahora 💬' : 'Ver psicoorientadores'}</a>
            `
        })
    })
})

cargarPsicoorientadores()
// Cerrar sesión
const btnLogout = document.getElementById('btn-logout')
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'index.html'
    })
}