import { supabase } from './supabase.js'

// Detectar en qué página estamos
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

        // Validar correo institucional
        if (!correo.endsWith('.edu.co')) {
            mensaje.textContent = 'Debes usar tu correo institucional del colegio.'
            return
        }

        // Crear usuario en Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email: correo,
            password: contrasena
        })

        if (error) {
            mensaje.textContent = 'Error: ' + error.message
            return
        }

        // Guardar en tabla usuarios
        const { error: errorDB } = await supabase.from('usuarios').insert({
            id: data.user.id,
            nombre: nombre,
            correo: correo,
            rol: rol
        })

        if (errorDB) {
            mensaje.textContent = 'Error al guardar usuario: ' + errorDB.message
            return
        }

        // Si es psicoorientador, guardar en tabla psicoorientadores
        if (rol === 'psicoorientador') {
            await supabase.from('psicoorientadores').insert({
                usuario_id: data.user.id,
                especialidad: '',
                descripcion: ''
            })
        }

        mensaje.style.color = 'green'
        mensaje.textContent = '¡Cuenta creada! Revisa tu correo para confirmar.'
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

        if (error) {
            mensaje.textContent = 'Error: ' + error.message
            return
        }

        // Obtener rol del usuario
        const { data: usuario } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', data.user.id)
            .single()

        // Redirigir según rol
        if (usuario.rol === 'estudiante') {
            window.location.href = 'estudiante.html'
        } else {
            window.location.href = 'psicoorientador.html'
        }
    })
}