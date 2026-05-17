import { supabase } from './supabase.js'

const emojis = {
    'Triste': '😔',
    'Regular': '😐',
    'Bien': '🙂',
    'Genial': '😄',
    'Ansioso': '😰'
}

const colores = {
    'Triste': '#A7C7E7',
    'Regular': '#CDB4DB',
    'Bien': '#B7E4C7',
    'Genial': '#FFD6A5',
    'Ansioso': '#FFC8C8'
}

async function cargarHistorial() {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        window.location.href = 'login.html'
        return
    }

    const { data: registros } = await supabase
        .from('registros_emocionales')
        .select('*')
        .eq('estudiante_id', user.id)
        .order('registrado_en', { ascending: false })

    if (!registros || registros.length === 0) {
        document.getElementById('lista-registros').innerHTML = '<p style="color:#8a8aaa;">No tienes registros emocionales aún. Selecciona cómo te sientes en el panel principal.</p>'
        return
    }

    // Contar emociones para la gráfica
    const conteo = { 'Triste': 0, 'Regular': 0, 'Bien': 0, 'Genial': 0, 'Ansioso': 0 }
    registros.forEach(r => {
        if (conteo[r.emocion] !== undefined) conteo[r.emocion]++
    })

    // Crear gráfica
    const ctx = document.getElementById('graficaEmociones').getContext('2d')
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(conteo).map(e => `${emojis[e]} ${e}`),
            datasets: [{
                label: 'Veces registrado',
                data: Object.values(conteo),
                backgroundColor: Object.keys(conteo).map(e => colores[e]),
                borderRadius: 10,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: { color: '#f0f0f0' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    })

    // Lista de registros recientes
    const lista = document.getElementById('lista-registros')
    registros.slice(0, 10).forEach(r => {
        const card = document.createElement('div')
        card.className = 'card-psico'
        card.innerHTML = `
            <h3 style="font-size:1.5rem;">${emojis[r.emocion] || '😐'}</h3>
            <h3>${r.emocion}</h3>
            <p style="font-size:0.8rem; color:#8a8aaa;">${new Date(r.registrado_en).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        `
        lista.appendChild(card)
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

cargarHistorial()