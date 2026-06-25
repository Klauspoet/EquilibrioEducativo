import { supabase } from './supabase.js'

async function cargarPanel() {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        window.location.href = 'login.html'
        return
    }

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

    if (!psicos?.length) {
        pendientes.innerHTML = '<p style="color:#8a8aaa;">No hay psicoorientadores pendientes.</p>'
        return
    }

    // Obtener extensiones reales de todos los archivos de una sola vez
    const { data: archivos } = await supabase.storage
        .from('titulos')
        .list('', { limit: 100 })

    const mapaExtension = {}
    if (archivos) {
        archivos.forEach(f => {
            const [id] = f.name.split('.')
            const ext = f.name.split('.').pop()
            mapaExtension[id] = ext
        })
    }

    for (const psico of psicos) {
        const card = document.createElement('div')
        card.className = 'card-psico'

        // Obtener URL del título
        const ext = mapaExtension[psico.usuario_id]
        let urlTitulo = null

        if (ext) {
            const { data } = await supabase.storage
                .from('titulos')
                .createSignedUrl(`${psico.usuario_id}.${ext}`, 3600)
            if (data) urlTitulo = data.signedUrl
        }

        const botonTitulo = urlTitulo
            ? `<a href="${urlTitulo}" target="_blank" style="
                display:inline-block;
                background: #f8f5ff;
                color: #3a3a5c;
                padding: 8px 16px;
                border-radius: 10px;
                text-decoration: none;
                font-size: 0.85rem;
                margin-bottom: 10px;
                border: 1.5px solid #CDB4DB;
              ">📄 Ver título</a>`
            : '<p style="color:#8a8aaa; font-size:0.85rem;">Sin título subido</p>'

        if (psico.estado === 'pendiente') {
            card.innerHTML = `
                <h3>${psico.usuarios.nombre}</h3>
                <p>${psico.usuarios.correo}</p>
                <p>${psico.especialidad || 'Sin especialidad'}</p>
                ${botonTitulo}
                <div style="display:flex; gap:8px; margin-top:8px;">
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
                ${botonTitulo}
                <p style="color:#B7E4C7; font-weight:600; margin-top:8px;">✅ Aprobado</p>
            `
            aprobados.appendChild(card)
        }
    }

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

    if (!estudiantes?.length) {
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

const btnLogout = document.getElementById('btn-logout')
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'index.html'
    })
}

cargarPanel()