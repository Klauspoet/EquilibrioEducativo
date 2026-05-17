// Cargar tema guardado
const temaGuardado = localStorage.getItem('tema')
if (temaGuardado === 'dark') {
    document.body.classList.add('dark')
}

// Botón de cambio de tema
window.addEventListener('load', () => {
    const btnTema = document.getElementById('btn-tema')
    if (!btnTema) return

    // Actualizar ícono según tema actual
    btnTema.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙'

    btnTema.addEventListener('click', () => {
        document.body.classList.toggle('dark')
        const esDark = document.body.classList.contains('dark')
        localStorage.setItem('tema', esDark ? 'dark' : 'light')
        btnTema.textContent = esDark ? '☀️' : '🌙'
    })
})