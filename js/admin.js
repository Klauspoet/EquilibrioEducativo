import { supabase } from './supabase.js'
import { obtenerUsuarioActual, configurarCierreSesion, showLoader, hideLoader } from './utilidades.js'

async function cargarPanel() {
  showLoader()
  try {
    const user = await obtenerUsuarioActual()
    if (!user) return

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'admin') {
      window.location.href = 'index.html'
      return
    }

    await Promise.all([cargarPsicoorientadores(), cargarEstudiantes()])
  } catch (err) {
    console.error('Error al cargar panel:', err)
  } finally {
    hideLoader()
  }
}

async function cargarPsicoorientadores() {
  try {
    const { data: psicos } = await supabase
      .from('psicoorientadores')
      .select('*, usuarios(nombre, correo)')

    const pendientes = document.getElementById('lista-pendientes')
    const aprobados = document.getElementById('lista-aprobados')
    pendientes.innerHTML = ''
    aprobados.innerHTML = ''

    if (!psicos?.length) {
      pendientes.innerHTML = '<p class="vacio">No hay psicoorientadores registrados.</p>'
      return
    }

    const { data: archivos } = await supabase.storage
      .from('titulos')
      .list('', { limit: 100 })

    const mapaExtension = {}
    if (archivos) {
      archivos.forEach(f => {
        const id = f.name.split('.')[0]
        mapaExtension[id] = f.name.split('.').pop()
      })
    }

    for (const psico of psicos) {
      const card = document.createElement('div')
      card.className = 'card-psico'

      let htmlBotonTitulo = '<p class="texto-muted" style="font-size:0.85rem;">Sin título subido</p>'
      const ext = mapaExtension[psico.usuario_id]
      if (ext) {
        const { data } = await supabase.storage
          .from('titulos')
          .createSignedUrl(`${psico.usuario_id}.${ext}`, 3600)
        if (data) {
          htmlBotonTitulo = `<a href="${data.signedUrl}" target="_blank" class="btn-titulo">📄 Ver título</a>`
        }
      }

      const infoBasica = `
        <h3>${psico.usuarios.nombre}</h3>
        <p>${psico.usuarios.correo}</p>
        <p>${psico.especialidad || 'Sin especialidad'}</p>
        ${htmlBotonTitulo}
      `

      if (psico.estado === 'pendiente') {
        card.innerHTML = infoBasica + `
          <div class="flex-row">
            <button class="btn-principal" onclick="window.aprobar('${psico.usuario_id}')">✅ Aprobar</button>
            <button class="btn-secundario" onclick="window.rechazar('${psico.usuario_id}')">❌ Rechazar</button>
          </div>
        `
        pendientes.appendChild(card)
      } else if (psico.estado === 'aprobado') {
        card.innerHTML = infoBasica + `
          <p class="texto-exito" style="margin-top:8px;">✅ Aprobado</p>
        `
        aprobados.appendChild(card)
      }
    }

    if (pendientes.innerHTML === '') {
      pendientes.innerHTML = '<p class="vacio">No hay psicoorientadores pendientes.</p>'
    }
  } catch (err) {
    console.error('Error al cargar psicoorientadores:', err)
  }
}

async function cargarEstudiantes() {
  try {
    const { data: estudiantes } = await supabase
      .from('usuarios')
      .select('nombre, correo, creado_en')
      .eq('rol', 'estudiante')

    const lista = document.getElementById('lista-estudiantes')
    lista.innerHTML = ''

    if (!estudiantes?.length) {
      lista.innerHTML = '<p class="vacio">No hay estudiantes registrados.</p>'
      return
    }

    estudiantes.forEach(est => {
      const card = document.createElement('div')
      card.className = 'card-psico'
      card.innerHTML = `
        <h3>${est.nombre}</h3>
        <p>${est.correo}</p>
        <p class="texto-chico-muted">Registrado: ${new Date(est.creado_en).toLocaleDateString('es-CO')}</p>
      `
      lista.appendChild(card)
    })
  } catch (err) {
    console.error('Error al cargar estudiantes:', err)
  }
}

window.aprobar = async (id) => {
  try {
    await supabase
      .from('psicoorientadores')
      .update({ estado: 'aprobado', disponible: true })
      .eq('usuario_id', id)
    cargarPsicoorientadores()
  } catch (err) {
    console.error('Error al aprobar:', err)
  }
}

window.rechazar = async (id) => {
  try {
    await supabase
      .from('psicoorientadores')
      .update({ estado: 'rechazado', disponible: false })
      .eq('usuario_id', id)
    cargarPsicoorientadores()
  } catch (err) {
    console.error('Error al rechazar:', err)
  }
}

configurarCierreSesion()
cargarPanel()
