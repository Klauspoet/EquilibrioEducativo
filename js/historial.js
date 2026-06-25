import { supabase } from './supabase.js'
import { obtenerUsuarioActual, configurarCierreSesion, showLoader, hideLoader } from './utilidades.js'

const emojis = {
  'Triste': '😔', 'Regular': '😐', 'Bien': '🙂', 'Genial': '😄', 'Ansioso': '😰'
}

const colores = {
  'Triste': '#3B82F6', 'Regular': '#0EA5E9', 'Bien': '#10B981', 'Genial': '#F59E0B', 'Ansioso': '#EF4444'
}

async function cargarHistorial() {
  showLoader()
  try {
    const user = await obtenerUsuarioActual()
    if (!user) return

    const { data: registros } = await supabase
      .from('registros_emocionales')
      .select('*')
      .eq('estudiante_id', user.id)
      .order('registrado_en', { ascending: false })

    const lista = document.getElementById('lista-registros')

    if (!registros || registros.length === 0) {
      lista.innerHTML = '<p class="vacio">No tienes registros emocionales aún. Selecciona cómo te sientes en el panel principal.</p>'
      return
    }

    const conteo = { 'Triste': 0, 'Regular': 0, 'Bien': 0, 'Genial': 0, 'Ansioso': 0 }
    registros.forEach(r => {
      if (conteo[r.emocion] !== undefined) conteo[r.emocion]++
    })

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
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
            grid: { color: '#f0f0f0' }
          },
          x: { grid: { display: false } }
        }
      }
    })

    registros.slice(0, 10).forEach(r => {
      const card = document.createElement('div')
      card.className = 'card-psico'
      card.innerHTML = `
        <h3 style="font-size:1.5rem;">${emojis[r.emocion] || '😐'}</h3>
        <h3>${r.emocion}</h3>
        <p class="texto-chico-muted">${new Date(r.registrado_en).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      `
      lista.appendChild(card)
    })
  } catch (err) {
    console.error('Error al cargar historial:', err)
  } finally {
    hideLoader()
  }
}

configurarCierreSesion()
cargarHistorial()
