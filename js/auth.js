import { supabase } from './supabase.js'
import { mostrarMensaje, configurarCierreSesion, showLoader, hideLoader } from './utilidades.js'

const mensaje = document.getElementById('mensaje')

function alternarCamposPsico() {
  const rol = document.getElementById('rol')
  if (!rol) return
  const visible = rol.value === 'psicoorientador'
  const campos = ['campo-titulo', 'campo-especialidad']
  campos.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.display = visible ? 'block' : 'none'
  })
}

document.addEventListener('DOMContentLoaded', () => {
  const selectRol = document.getElementById('rol')
  if (selectRol) {
    selectRol.addEventListener('change', alternarCamposPsico)
    alternarCamposPsico()
  }
})

// REGISTRO
const esRegistro = document.getElementById('btn-registro')
if (esRegistro) {
  esRegistro.addEventListener('click', async () => {
    const nombre = document.getElementById('nombre').value.trim()
    const correo = document.getElementById('correo').value.trim()
    const contrasena = document.getElementById('contrasena').value
    const rol = document.getElementById('rol').value

    if (!nombre || !correo || !contrasena) {
      mostrarMensaje(mensaje, 'Por favor completa todos los campos.', 'error')
      return
    }

    if (!correo.endsWith('.edu.co')) {
      mostrarMensaje(mensaje, 'Debes usar tu correo institucional del colegio.', 'error')
      return
    }

    if (contrasena.length < 6) {
      mostrarMensaje(mensaje, 'La contraseña debe tener al menos 6 caracteres.', 'error')
      return
    }

    const confirmarContrasena = document.getElementById('confirmar-contrasena')
    if (confirmarContrasena && contrasena !== confirmarContrasena.value) {
      mostrarMensaje(mensaje, 'Las contraseñas no coinciden.', 'error')
      return
    }

    if (rol === 'psicoorientador') {
      const titulo = document.getElementById('titulo').files[0]
      if (!titulo) {
        mostrarMensaje(mensaje, 'Debes subir tu título profesional.', 'error')
        return
      }
    }

    const btn = document.getElementById('btn-registro')
    btn.disabled = true

    mostrarMensaje(mensaje, 'Creando cuenta...', 'info')
    showLoader()

    try {
      const { data, error } = await supabase.auth.signUp({
        email: correo,
        password: contrasena,
        options: {
          data: { nombre, rol }
        }
      })

      if (error) {
        btn.disabled = false
        if (error.message?.toLowerCase().includes('already registered')) {
          mostrarMensaje(mensaje, 'Este correo ya está registrado. Por favor inicia sesión.', 'error')
          setTimeout(() => { window.location.href = 'login.html' }, 2000)
        } else {
          mostrarMensaje(mensaje, 'Error: ' + error.message, 'error')
        }
        return
      }

      if (!data.user) {
        mostrarMensaje(mensaje, 'Revisa tu correo para confirmar la cuenta antes de iniciar sesión.', 'exito')
        setTimeout(() => { window.location.href = 'login.html' }, 2000)
        return
      }

      const usuarioId = data.user.id

      const { error: errorDB } = await supabase.from('usuarios').upsert(
        {
          id: usuarioId,
          nombre,
          correo,
          rol
        },
        { onConflict: 'id' }
      )

      if (errorDB) {
        console.error('Error al guardar perfil:', errorDB)
      }

      if (rol === 'psicoorientador') {
        const especialidad = document.getElementById('especialidad').value
        const titulo = document.getElementById('titulo').files[0]

        const extension = titulo.name.split('.').pop()
        const nombreArchivo = `${usuarioId}.${extension}`

        const { error: errorStorage } = await supabase.storage
          .from('titulos')
          .upload(nombreArchivo, titulo)

        if (errorStorage) {
          btn.disabled = false
          mostrarMensaje(mensaje, 'Error al subir título: ' + errorStorage.message, 'error')
          return
        }

        await supabase.from('psicoorientadores').insert({
          usuario_id: usuarioId,
          especialidad,
          descripcion: '',
          disponible: false,
          estado: 'pendiente'
        })
      }

      const { data: usuario, error: errorUsuario } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', usuarioId)
        .maybeSingle()

      if (errorUsuario || !usuario) {
        mostrarMensaje(mensaje, 'Cuenta creada. Ahora puedes iniciar sesión.', 'exito')
        setTimeout(() => { window.location.href = 'login.html' }, 2000)
        return
      }

      if (usuario.rol === 'estudiante') {
        window.location.href = 'estudiante.html'
      } else if (usuario.rol === 'psicoorientador') {
        const { data: psico, error: errorPsico } = await supabase
          .from('psicoorientadores')
          .select('estado')
          .eq('usuario_id', usuarioId)
          .maybeSingle()

        if (errorPsico || !psico) {
          mostrarMensaje(mensaje, 'Cuenta creada. Ahora puedes iniciar sesión.', 'exito')
          setTimeout(() => { window.location.href = 'login.html' }, 2000)
          return
        }

        if (psico.estado === 'pendiente') {
          await supabase.auth.signOut()
          btn.disabled = false
          mostrarMensaje(mensaje, '¡Cuenta creada! Tu título será revisado por el administrador.', 'exito')
          setTimeout(() => { window.location.href = 'login.html' }, 2000)
        } else {
          window.location.href = 'psicoorientador.html'
        }
      }
    } catch (err) {
      btn.disabled = false
      mostrarMensaje(mensaje, 'Error inesperado: ' + err.message, 'error')
    } finally {
      hideLoader()
    }
  })
}

// LOGIN
const esLogin = document.getElementById('btn-login')
if (esLogin) {
  esLogin.addEventListener('click', async () => {
    const correo = document.getElementById('correo').value.trim()
    const contrasena = document.getElementById('contrasena').value

    if (!correo || !contrasena) {
      mostrarMensaje(mensaje, 'Por favor completa todos los campos.', 'error')
      return
    }

    showLoader()
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: correo,
        password: contrasena
      })

      if (error) {
        mostrarMensaje(mensaje, 'Error: ' + error.message, 'error')
        return
      }

      const { data: usuario, error: errorUsuario } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', data.user.id)
        .maybeSingle()

      if (errorUsuario || !usuario) {
        await supabase.auth.signOut()
        mostrarMensaje(mensaje, 'No se encontró tu perfil de usuario. Contacta al administrador.', 'error')
        return
      }

      if (usuario.rol === 'estudiante') {
        window.location.href = 'estudiante.html'
      } else if (usuario.rol === 'psicoorientador') {
        const { data: psico, error: errorPsico } = await supabase
          .from('psicoorientadores')
          .select('estado')
          .eq('usuario_id', data.user.id)
          .maybeSingle()

        if (errorPsico || !psico) {
          await supabase.auth.signOut()
          mostrarMensaje(mensaje, 'No se encontró tu perfil de psicoorientador. Contacta al administrador.', 'error')
          return
        }

        if (psico.estado === 'pendiente') {
          await supabase.auth.signOut()
          mostrarMensaje(mensaje, 'Tu cuenta está pendiente de aprobación por el administrador.', 'error')
          return
        } else if (psico.estado === 'rechazado') {
          await supabase.auth.signOut()
          mostrarMensaje(mensaje, 'Tu cuenta fue rechazada. Contacta al administrador.', 'error')
          return
        }

        window.location.href = 'psicoorientador.html'
      } else if (usuario.rol === 'admin') {
        window.location.href = 'admin.html'
      }
    } catch (err) {
      mostrarMensaje(mensaje, 'Error inesperado: ' + err.message, 'error')
    } finally {
      hideLoader()
    }
  })
}

configurarCierreSesion()
