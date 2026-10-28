// Planilla de registro por evidencias: reemplaza el cuaderno cuadriculado.
// En blanco para anotar en el aula, o llena con lo registrado en la app.
import { escapeHtml } from './plantillasHTML'

const fmt = n => (n == null || n === '') ? '' : String(Math.round(Number(n) * 10) / 10).replace('.', ',')

// competencias: la constante COMPETENCIAS de Calificaciones (orden fijo de la app).
export function construirHTMLPlanilla({ datos, curso, periodo, materia, cfg = {}, competencias, llena, titulo }) {
  const ordenComp = k => competencias.findIndex(c => c.key === k)
  const info = k => competencias.find(c => c.key === k) || { key: k, label: k, color: '#555', icono: '' }
  const acts = datos.actividades.map(a => {
    const comps = [...a.competencias].sort((x, y) => ordenComp(x) - ordenComp(y))
    const grupos = comps.map(c => ({ comp: c, evidencias: a.evidencias.filter(e => e.competencia === c) }))
    const techo = a.modo === 'multi' ? 100 / comps.length : 100
    return { ...a, grupos, techo }
  })
  const unaSemana = acts.length === 1

  // ── Guía: qué se califica en cada semana ──
  const guia = `
    <table class="guia">
      <thead><tr><th>Actividad</th><th>Peso</th><th>Competencia (máx. en la app)</th><th>Evidencia</th><th>Sesión</th><th>Instrumento</th><th>Puntos</th></tr></thead>
      <tbody>${acts.map(a => a.grupos.map((g, gi) => g.evidencias.map((e, ei) => `
        <tr>
          ${gi === 0 && ei === 0 ? `<td rowspan="${a.evidencias.length}" class="act">${escapeHtml(a.nombre)}</td><td rowspan="${a.evidencias.length}" class="c"><b>${fmt(a.peso)}</b></td>` : ''}
          ${ei === 0 ? `<td rowspan="${g.evidencias.length}" style="color:${info(g.comp).color};font-weight:700">${escapeHtml(info(g.comp).label)} (${fmt(a.techo)})</td>` : ''}
          <td>${escapeHtml(e.nombre)}</td><td class="c">${escapeHtml(e.sesion)}</td><td>${escapeHtml(e.instrumento)}</td><td class="c"><b>${fmt(e.puntos)}</b></td>
        </tr>`).join('')).join('')).join('')}
      </tbody>
    </table>
    <p class="nota">Cómo pasar la nota: (puntos obtenidos ÷ puntos de la evidencia) × máximo en la app. Si una competencia tiene varias evidencias, se suman. La app lo calcula sola al anotar los puntos.</p>`

  // ── Registro: una columna por evidencia + nota de la semana ──
  const filaSemana = acts.map(a => `<th colspan="${a.evidencias.length + 1}" class="sem">${escapeHtml(a.nombre)} <span>· peso ${fmt(a.peso)}</span></th>`).join('')
  const filaComp = acts.map(a => a.grupos.map(g => `<th colspan="${g.evidencias.length}" style="background:${info(g.comp).color}1F;color:${info(g.comp).color}">${escapeHtml(info(g.comp).label)}</th>`).join('') + '<th rowspan="2" class="nota-col">Nota</th>').join('')
  // Una sola semana: el nombre de la evidencia va en el encabezado y no hace falta la guía.
  const filaEv = acts.map(a => a.grupos.map(g => g.evidencias.map(e => `<th class="ev" title="${escapeHtml(e.nombre)}">${escapeHtml(e.sesion)}${unaSemana ? `<div class="evn">${escapeHtml(e.nombre)}</div><div class="evn">${escapeHtml(e.instrumento)}</div>` : '<br>'}<small>/${fmt(e.puntos)}</small></th>`).join('')).join('')).join('')

  const filas = datos.estudiantes.map((est, i) => {
    const celdas = acts.map(a => {
      const d = a.porEstudiante[est.id] || { puntos: {}, nota: null, estado: 'vacia' }
      const evs = a.grupos.map(g => g.evidencias.map(e => `<td class="c">${llena ? fmt(d.puntos[e.id]) : ''}</td>`).join('')).join('')
      let nota = ''
      if (llena) nota = d.nota != null ? fmt(d.nota) : (d.estado === 'pendiente' ? '<span class="pend">pend.</span>' : '')
      return evs + `<td class="c nota-col"><b>${nota}</b></td>`
    }).join('')
    return `<tr class="${i % 2 ? 'par' : ''}"><td class="c num">${est.numero_lista || ''}</td><td class="nom">${escapeHtml(est.nombre_completo)}</td>${celdas}</tr>`
  }).join('')

  const sub = [cfg.centro_educativo, materia?.nombre, curso?.nombre, periodo?.nombre].filter(Boolean).map(escapeHtml).join(' · ')
  const nCols = acts.reduce((s, a) => s + a.evidencias.length + 1, 0)
  const fuente = nCols > 16 ? 9 : nCols > 10 ? 10 : 11

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
  <title>${escapeHtml(titulo)}</title>
  <style>
    body { font-family:'Segoe UI',sans-serif; margin:16px; color:#333; font-size:${fuente}px; background:#fff }
    h1 { color:#1B3A6B; font-size:16px; margin:0 0 2px }
    .sub { color:#666; font-size:12px; margin:0 0 12px }
    table { border-collapse:collapse; width:100% }
    th, td { border:1px solid #B8C4D6; padding:3px 5px }
    .guia { margin-bottom:6px; font-size:${fuente}px }
    .guia thead th { background:#1B3A6B; color:#fff; text-align:left }
    .guia .act { font-weight:700; color:#1B3A6B }
    .nota { font-size:10px; color:#777; margin:0 0 14px }
    .reg thead th { text-align:center; font-weight:700 }
    .reg .sem { background:#1B3A6B; color:#fff } .reg .sem span { font-weight:400; opacity:.8 }
    .reg .ev { background:#F4F7FB; font-weight:600; min-width:34px }
    .reg .nota-col { background:#EEF2F7; min-width:38px }
    .reg tbody td { height:${llena ? 15 : 19}px; padding:1px 5px }
    .reg .evn { font-weight:400; color:#555; font-size:${fuente - 1}px; max-width:170px; margin:0 auto }
    .reg .nom { white-space:nowrap; min-width:150px }
    .reg .num { width:22px; color:#888 }
    .reg tr.par td { background:#FAFBFD } .reg tr.par td.nota-col { background:#EEF2F7 }
    .c { text-align:center }
    .pend { color:#C84B00; font-weight:600; font-size:9px }
    .firma { margin-top:22px; display:flex; justify-content:space-between; font-size:11px; color:#666 }
    .firma div { border-top:1px solid #999; padding-top:4px; width:220px; text-align:center }
    .salto { page-break-before:always }
    @media print { @page { size:A4 landscape; margin:10mm } body { margin:0 } thead { display:table-header-group } tr { page-break-inside:avoid } }
  </style></head><body>
  <h1>${escapeHtml(titulo)}</h1>
  <p class="sub">${sub}${cfg.nombre_maestro ? ' · ' + escapeHtml(cfg.nombre_maestro) : ''}${llena ? ' · Registrado al ' + new Date().toLocaleDateString('es-DO') : ''}</p>
  ${unaSemana ? '' : guia}
  <div class="${unaSemana ? '' : 'salto'}">
    ${unaSemana ? '' : `<h1>${escapeHtml(titulo)}</h1><p class="sub">${sub}</p>`}
    <table class="reg">
      <thead>
        <tr><th rowspan="3">#</th><th rowspan="3">Estudiante</th>${filaSemana}</tr>
        <tr>${filaComp}</tr>
        <tr>${filaEv}</tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    ${unaSemana ? '<p class="nota" style="margin-top:6px">Nota de la app = (puntos obtenidos ÷ puntos de la evidencia) × máximo de la competencia; varias evidencias de una competencia se suman. La app lo calcula sola.</p>' : ''}
  </div>
  <div class="firma"><div>Firma del docente</div><div>Fecha</div></div>
  <script>window.onload=()=>window.print()</script>
  </body></html>`
}
