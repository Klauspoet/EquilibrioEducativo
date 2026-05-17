import { supabase } from './supabase.js'

async function cargarPanel() {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        window.location.href = 'login.html'
        return
    }

    // Verificar que sea admin
    const { data: usuario } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

    if (!usuario || usuario.rol !== 'admin') {
        window.location.href = 'index.html'
        return
    }

    cargarPsicoorientadores()
    cargarEstudiantes()
}

async function cargarPsicoorientadores() {
    const { data: psicos } = await supabase
        .from('psicoorientadores')
        .select('*, usuarios(nombre, correo)')

    const pendientes = document.getElementById('lista-pendientes')
    const aprobados = document.getElementById('lista-aprobados')

    pendientes.innerHTML = ''
    aprobados.innerHTML = ''

    if (!psicos || psicos.length === 0) {
        pendientes.innerHTML = '<p style="color:#8a8aaa;">No hay psicoorientadores pendientes.</p>'
        return
    }

    psicos.forEach(psico => {
        const card = document.createElement('div')
        card.className = 'card-psico'

        if (psico.estado === 'pendiente') {
            card.innerHTML = `
                <h3>${psico.usuarios.nombre}</h3>
                <p>${psico.usuarios.correo}</p>
                <p>${psico.especialidad || 'Sin especialidad'}</p>
                <div style="display:flex; gap:8px; margin-top:12px;">
                    <button class="btn-principal" onclick="aprobar('${psico.usuario_id}')">✅ Aprobar</button>
                    <button class="btn-secundario" onclick="rechazar('${psico.usuario_id}')">❌ Rechazar</button>
                </div>
            `
            pendientes.appendChild(card)
        } else if (psico.estado === 'aprobado') {
            card.innerHTML = `
                <h3>${psico.usuarios.nombre}</h3>
                <p>${psico.usuarios.correo}</p>
                <p>${psico.especialidad || 'Sin especialidad'}</p>
                <p style="color:#B7E4C7; font-weight:600;">✅ Aprobado</p>
            `
            aprobados.appendChild(card)
        }
    })

    if (pendientes.innerHTML === '') {
        pendientes.innerHTML = '<p style="color:#8a8aaa;">No hay psicoorientadores pendientes.</p>'
    }
}

async function cargarEstudiantes() {
    const { data: estudiantes } = await supabase
        .from('usuarios')
        .select('nombre, correo, creado_en')
        .eq('rol', 'estudiante')

    const lista = document.getElementById('lista-estudiantes')
    lista.innerHTML = ''

    if (!estudiantes || estudiantes.length === 0) {
        lista.innerHTML = '<p style="color:#8a8aaa;">No hay estudiantes registrados.</p>'
        return
    }

    estudiantes.forEach(est => {
        const card = document.createElement('div')
        card.className = 'card-psico'
        card.innerHTML = `
            <h3>${est.nombre}</h3>
            <p>${est.correo}</p>
            <p style="font-size:0.8rem; color:#8a8aaa;">Registrado: ${new Date(est.creado_en).toLocaleDateString('es-CO')}</p>
        `
        lista.appendChild(card)
    })
}

window.aprobar = async (id) => {
    await supabase
        .from('psicoorientadores')
        .update({ estado: 'aprobado', disponible: true })
        .eq('usuario_id', id)
    cargarPsicoorientadores()
}

window.rechazar = async (id) => {
    await supabase
        .from('psicoorientadores')
        .update({ estado: 'rechazado', disponible: false })
        .eq('usuario_id', id)
    cargarPsicoorientadores()
}

// Cerrar sesión
const btnLogout = document.getElementById('btn-logout')
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'index.html'
    })
}

cargarPanel()