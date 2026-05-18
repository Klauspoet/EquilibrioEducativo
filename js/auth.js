import { supabase } from './supabase.js'

const esRegistro = document.getElementById('btn-registro')
const esLogin = document.getElementById('btn-login')

// REGISTRO
if (esRegistro) {
    document.getElementById('btn-registro').addEventListener('click', async () => {
        const nombre = document.getElementById('nombre').value
        const correo = document.getElementById('correo').value
        const contrasena = document.getElementById('contrasena').value
        const rol = document.getElementById('rol').value
        const mensaje = document.getElementById('mensaje')

        if (!correo.endsWith('.edu.co')) {
            mensaje.textContent = 'Debes usar tu correo institucional del colegio.'
            return
        }

        if (!nombre || !correo || !contrasena) {
            mensaje.textContent = 'Por favor completa todos los campos.'
            return
        }

        // Si es psicoorientador verificar que subió título
        if (rol === 'psicoorientador') {
            const titulo = document.getElementById('titulo').files[0]
            if (!titulo) {
                mensaje.textContent = 'Debes subir tu título profesional.'
                return
            }
        }

        mensaje.style.color = 'gray'
        mensaje.textContent = 'Creando cuenta...'

        const { data, error } = await supabase.auth.signUp({
            email: correo,
            password: contrasena
        })

        if (error) {
            mensaje.style.color = 'red'
            mensaje.textContent = 'Error: ' + error.message
            return
        }

        const { error: errorDB } = await supabase.from('usuarios').insert({
            id: data.user.id,
            nombre: nombre,
            correo: correo,
            rol: rol
        })

        if (errorDB) {
            mensaje.style.color = 'red'
            mensaje.textContent = 'Error al guardar usuario: ' + errorDB.message
            return
        }

        if (rol === 'psicoorientador') {
            const especialidad = document.getElementById('especialidad').value
            const titulo = document.getElementById('titulo').files[0]

            // Subir título al storage
            const extension = titulo.name.split('.').pop()
            const nombreArchivo = `${data.user.id}.${extension}`

            const { error: errorStorage } = await supabase.storage
                .from('titulos')
                .upload(nombreArchivo, titulo)

            if (errorStorage) {
                mensaje.style.color = 'red'
                mensaje.textContent = 'Error al subir título: ' + errorStorage.message
                return
            }

            await supabase.from('psicoorientadores').insert({
                usuario_id: data.user.id,
                especialidad: especialidad,
                descripcion: '',
                disponible: false,
                estado: 'pendiente'
            })

            mensaje.style.color = 'green'
            mensaje.textContent = '¡Cuenta creada! Tu título será revisado por el administrador.'
        } else {
            mensaje.style.color = 'green'
            mensaje.textContent = '¡Cuenta creada! Ya puedes iniciar sesión.'
            setTimeout(() => {
                window.location.href = 'login.html'
            }, 2000)
        }
    })
}

// LOGIN
if (esLogin) {
    document.getElementById('btn-login').addEventListener('click', async () => {
        const correo = document.getElementById('correo').value
        const contrasena = document.getElementById('contrasena').value
        const mensaje = document.getElementById('mensaje')

       const { data, error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena
})

console.log('sesion:', data.session)
console.log('token:', data.session?.access_token)

        if (error) {
            mensaje.textContent = 'Error: ' + error.message
            return
        }

        const { data: usuario } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', data.user.id)
            .single()

        if (usuario.rol === 'estudiante') {
            window.location.href = 'estudiante.html'
        } else if (usuario.rol === 'psicoorientador') {
            // Verificar si está aprobado
            const { data: psico } = await supabase
                .from('psicoorientadores')
                .select('estado')
                .eq('usuario_id', data.user.id)
                .single()

            if (psico.estado === 'pendiente') {
                await supabase.auth.signOut()
                mensaje.textContent = 'Tu cuenta está pendiente de aprobación por el administrador.'
                return
            } else if (psico.estado === 'rechazado') {
                await supabase.auth.signOut()
                mensaje.textContent = 'Tu cuenta fue rechazada. Contacta al administrador.'
                return
            }

            window.location.href = 'psicoorientador.html'
        } else if (usuario.rol === 'admin') {
            window.location.href = 'admin.html'
        }
    })
}

// Cerrar sesión
const btnLogout = document.getElementById('btn-logout')
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'index.html'
    })
}