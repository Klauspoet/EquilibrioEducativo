import { supabase } from './supabase.js'
import { obtenerUsuarioActual, configurarCierreSesion, showLoader, hideLoader, renderEmptyState } from './utilidades.js'

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
      .select('id, usuario_id, especialidad, estado, disponible, usuarios(nombre, correo)')

    const pendientes = document.getElementById('lista-pendientes')
    const aprobados = document.getElementById('lista-aprobados')
    pendientes.innerHTML = ''
    aprobados.innerHTML = ''

    if (!psicos?.length) {
      renderEmptyState(pendientes, '📋', 'Sin datos disponibles', 'No hay información para mostrar en este momento.')
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

    const urlsFirmadas = {}
    await Promise.all(
      Object.entries(mapaExtension).map(async ([id, ext]) => {
        const { data } = await supabase.storage
          .from('titulos')
          .createSignedUrl(`${id}.${ext}`, 3600)
        if (data) urlsFirmadas[id] = data.signedUrl
      })
    )

    psicos.forEach(psico => {
      const card = document.createElement('div')
      card.className = 'card-psico'

      const url = urlsFirmadas[psico.usuario_id]
      const htmlBotonTitulo = url
        ? `<a href="${url}" target="_blank" class="btn-titulo">📄 Ver título</a>`
        : '<p class="texto-muted" style="font-size:0.85rem;">Sin título subido</p>'

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
    })

    if (pendientes.innerHTML === '') {
      renderEmptyState(pendientes, '📋', 'Sin datos disponibles', 'No hay psicoorientadores pendientes.')
    }

    if (aprobados.innerHTML === '') {
      renderEmptyState(aprobados, '📋', 'Sin datos disponibles', 'No hay psicoorientadores aprobados aún.')
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
      .order('creado_en', { ascending: false })
      .limit(100)

    const lista = document.getElementById('lista-estudiantes')
    lista.innerHTML = ''

    if (!estudiantes?.length) {
      renderEmptyState(lista, '🎓', 'Sin estudiantes registrados', 'Aún no hay estudiantes registrados en el sistema.')
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
