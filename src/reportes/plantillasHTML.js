// Plantillas HTML de reportes: impresión desde el programa y archivo HTML del lote.

const CFG_DEFECTO = { minimo: 70, semVerde: 80, semAmarillo: 60 }

// Nombres, temas y observaciones son texto libre del maestro: sin escapar,
// un "<" rompe el reporte y en el archivo del lote incluso el visor completo.
export function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ──────────────────────────────────────────────────────────────────────────
//  slug: nombre de archivo seguro a partir de un texto libre
// ──────────────────────────────────────────────────────────────────────────
export function slug(s) {
  const diacriticos = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')
  return (s || '')
    .normalize('NFD').replace(diacriticos, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function fechaHoy() {
  return new Date().toLocaleDateString('es-DO', { day:'2-digit', month:'long', year:'numeric' })
}

// autoprint: abre el diálogo de impresión al cargar (exportar desde el programa).
// embebido: el reporte vive dentro del visor del lote, que le pide imprimir por mensaje.
function scriptPie({ autoprint, embebido }) {
  if (embebido) return '<script>addEventListener("message",function(e){if(e.data==="sd-imprimir")window.print()})</script>'
  if (autoprint) return '<script>window.onload=()=>window.print()</script>'
  return ''
}

function indicadoresTexto(est, cfg) {
  const inds = []
  if (est.sin_calificar) inds.push('Sin calificar')
  else if (est.promedio < cfg.minimo) inds.push('Promedio bajo')
  else if (est.promedio < cfg.semVerde) inds.push('Promedio límite')
  if (est.asist_pct !== null && est.asist_pct < cfg.semAmarillo) inds.push('Asistencia baja')
  else if (est.asist_pct !== null && est.asist_pct < cfg.semVerde) inds.push('Asistencia irregular')
  if (inds.length === 0) inds.push('Satisfactorio')
  return inds.join(' · ')
}

// También la usa la lista filtrada del visor del lote, para que se vea igual que el grupal
const CSS_GRUPAL = `
    body { font-family:'Segoe UI',sans-serif; margin:24px; color:#333; font-size:13px; background:#fff }
    h1   { color:#1B3A6B; font-size:17px; margin:0 0 2px }
    .sub { color:#888; font-size:12px; margin:0 0 16px }
    .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:18px }
    .mc { border-radius:8px; padding:10px 14px; border-left:3px solid }
    .mc .lbl { font-size:10px; color:#888; text-transform:uppercase; letter-spacing:.05em; margin-bottom:3px }
    .mc .val { font-size:22px; font-weight:800 }
    table { border-collapse:collapse; width:100% }
    thead th { background:#1B3A6B; color:#9BBFED; padding:8px 10px; font-size:11px; text-align:left }
    tbody tr { border-bottom:1px solid #F0F4FA }
    .footer { margin-top:16px; font-size:11px; color:#AAA; border-top:1px solid #EEE; padding-top:8px; display:flex; justify-content:space-between }
    @media print { @page { margin:12mm } }
`

// ──────────────────────────────────────────────────────────────────────────
//  CONSTRUIR HTML — REPORTE GRUPAL (reutilizable: impresión manual o lote)
// ──────────────────────────────────────────────────────────────────────────
export function construirHTMLGrupal(datos, cursoSel, periodoSel, materia, { autoprint = true, embebido = false, incluirObs = true } = {}) {
  const { temas_total, temas_realizados, estudiantes } = datos
  const cfg       = datos.config || CFG_DEFECTO
  const conProm   = estudiantes.filter(e => !e.sin_calificar)
  const promGrupo = conProm.length > 0 ? Math.round(conProm.reduce((s, e) => s + e.promedio, 0) / conProm.length) : null
  const temaPct   = temas_total > 0 ? Math.round(temas_realizados / temas_total * 100) : 0
  const enRiesgo  = estudiantes.filter(e => e.en_riesgo).length
  const fecha     = fechaHoy()
  const curso     = escapeHtml(cursoSel.nombre)
  const periodo   = escapeHtml(periodoSel.nombre)

  const filas = estudiantes.map((est, i) => {
    const promColor  = est.sin_calificar ? '#888' : est.promedio >= cfg.semVerde ? '#1A6B3A' : est.promedio >= cfg.semAmarillo ? '#C84B00' : '#B71C1C'
    const asistColor = est.asist_pct === null ? '#888' : est.asist_pct >= cfg.semVerde ? '#1A6B3A' : est.asist_pct >= cfg.semAmarillo ? '#C84B00' : '#B71C1C'
    const filaRiesgo = est.en_riesgo && !est.sin_calificar

    return `<tr style="background:${filaRiesgo ? '#FFF8F8' : i%2===0?'#fff':'#FAFBFD'}">
      <td style="padding:7px 10px;color:#999;font-weight:700;font-size:11px">${String(est.numero_lista).padStart(2,'0')}</td>
      <td style="padding:7px 10px;font-weight:600;color:#1B3A6B;font-size:12px">${escapeHtml(est.nombre_completo)}${incluirObs && est.obs_count>0?' ●':''}</td>
      <td style="padding:7px 10px;text-align:center;font-weight:800;color:${promColor};font-size:13px">${est.sin_calificar ? '—' : est.promedio}</td>
      <td style="padding:7px 10px;text-align:center;font-weight:700;color:${asistColor};font-size:12px">${est.asist_pct !== null ? est.asist_pct+'%' : '—'}</td>
      <td style="padding:7px 10px;text-align:center;color:#B71C1C;font-weight:700;font-size:12px">${est.asist_ausentes}</td>
      <td style="padding:7px 10px;font-size:11px;color:#555">${indicadoresTexto(est, cfg)}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Reporte ${curso} — ${periodo}</title>
  <style>${CSS_GRUPAL}</style></head><body>
  <h1>📊 Reporte Grupal — ${curso}</h1>
  <p class="sub">${periodo}${periodoSel.titulo?' — '+escapeHtml(periodoSel.titulo):''} · Materia: ${escapeHtml(materia?.nombre || 'General')} · Generado el ${fecha}</p>

  <div class="metrics">
    <div class="mc" style="border-color:#2563A8;background:#EEF5FF">
      <div class="lbl">Estudiantes</div>
      <div class="val" style="color:#2563A8">${estudiantes.length}</div>
    </div>
    <div class="mc" style="border-color:${enRiesgo>0?'#A32D2D':'#3B6D11'};background:${enRiesgo>0?'#FFF0F0':'#F0FFF4'}">
      <div class="lbl">En riesgo</div>
      <div class="val" style="color:${enRiesgo>0?'#A32D2D':'#3B6D11'}">${enRiesgo}</div>
    </div>
    <div class="mc" style="border-color:${promGrupo>=80?'#3B6D11':promGrupo>=60?'#854F0B':'#A32D2D'};background:#F9F9F9">
      <div class="lbl">Promedio grupo</div>
      <div class="val" style="color:${promGrupo>=80?'#3B6D11':promGrupo>=60?'#854F0B':'#A32D2D'}">${promGrupo ?? '—'}</div>
    </div>
    <div class="mc" style="border-color:#854F0B;background:#FFFBF0">
      <div class="lbl">Avance temario</div>
      <div class="val" style="color:#854F0B">${temas_realizados}/${temas_total} (${temaPct}%)</div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th style="width:36px">#</th>
      <th>Estudiante</th>
      <th style="text-align:center;width:70px">Promedio</th>
      <th style="text-align:center;width:80px">Asistencia</th>
      <th style="text-align:center;width:70px">Ausencias</th>
      <th>Indicador</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>

  <div class="footer">
    <span>${incluirObs ? '● = tiene observaciones en cuaderno anecdótico' : ''}</span>
    <span>${curso} · ${periodo} · ${fecha}</span>
  </div>
  ${scriptPie({ autoprint, embebido })}
  </body></html>`

  return html
}

// ──────────────────────────────────────────────────────────────────────────
//  CONSTRUIR HTML — REPORTE INDIVIDUAL (reutilizable: impresión manual o lote)
// ──────────────────────────────────────────────────────────────────────────
export function construirHTMLIndividual(datos, cursoSel, periodoSel, materia, cfg = CFG_DEFECTO, { autoprint = true, embebido = false, incluirObs = true } = {}) {
  const { estudiante, promedio, competencias, asistencia, temas } = datos
  const observaciones = incluirObs ? datos.observaciones : []
  const fecha      = fechaHoy()
  const nombre     = escapeHtml(estudiante.nombre_completo)
  const curso      = escapeHtml(cursoSel?.nombre)
  const periodo    = escapeHtml(periodoSel?.nombre)
  const promColor  = promedio === null ? '#888' : promedio >= cfg.semVerde ? '#1A6B3A' : promedio >= cfg.semAmarillo ? '#C84B00' : '#B71C1C'
  const asistColor = asistencia.pct === null ? '#888' : asistencia.pct >= cfg.semVerde ? '#1A6B3A' : asistencia.pct >= cfg.semAmarillo ? '#C84B00' : '#B71C1C'

  const compRows = competencias.map(c => {
    const cc = c.promedio >= cfg.semVerde ? '#1A6B3A' : c.promedio >= cfg.semAmarillo ? '#C84B00' : '#B71C1C'
    return `<tr>
      <td style="padding:6px 10px;color:#555;font-size:12px">${escapeHtml(c.nombre)}</td>
      <td style="padding:6px 10px;text-align:center;font-weight:800;color:${cc};font-size:13px">${c.promedio ?? '—'}</td>
    </tr>`
  }).join('')

  const temaRows = temas.map((t, i) => {
    const col = t.estado==='realizado' ? '#1A6B3A' : t.estado==='aplazado' ? '#C84B00' : '#AAA'
    const lbl = t.estado==='realizado' ? 'Realizado' : t.estado==='aplazado' ? 'Aplazado' : 'Pendiente'
    return `<tr style="background:${i%2===0?'#fff':'#FAFBFD'}">
      <td style="padding:5px 10px;color:#888;font-size:11px">Sem. ${i+1}</td>
      <td style="padding:5px 10px;color:#333;font-size:12px">${escapeHtml(t.titulo)}</td>
      <td style="padding:5px 10px;color:${col};font-weight:700;font-size:11px">${lbl}</td>
    </tr>`
  }).join('')

  const tipoLabel = { academico:'Académico', positivo:'Positivo', negativo:'Negativo', citacion:'Citación', conductual:'Conductual' }
  const obsRows = observaciones.map(o => `
    <div style="border-bottom:1px solid #EEE;padding:8px 0;margin-bottom:4px">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
        <span style="font-size:11px;font-weight:700;color:#555;background:#F0F0F0;padding:2px 8px;border-radius:10px">${escapeHtml(tipoLabel[o.tipo]||o.tipo)}</span>
        <span style="font-size:11px;color:#AAA">${escapeHtml(o.fecha)}</span>
      </div>
      <div style="font-size:13px;color:#333;line-height:1.5">${escapeHtml(o.texto)}</div>
    </div>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Reporte ${nombre}</title>
  <style>
    body { font-family:'Segoe UI',sans-serif; margin:24px; color:#333; font-size:13px; background:#fff }
    h1   { color:#1B3A6B; font-size:17px; margin:0 0 2px }
    .sub { color:#888; font-size:12px; margin:0 0 18px }
    .header-card { display:flex; align-items:center; gap:16px; background:#F7F9FC; border-radius:10px; padding:14px 18px; margin-bottom:16px; border:1px solid #DDE3ED }
    .avatar { width:50px;height:50px;border-radius:50%;background:#EEEDFE;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#3C3489;flex-shrink:0 }
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px }
    .card  { border:1px solid #DDE3ED; border-radius:8px; padding:14px 16px }
    .card-title { font-size:10px;font-weight:700;color:#AAA;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px }
    .asist-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px }
    .asist-item { background:#F7F9FC;border-radius:6px;padding:6px 10px }
    .asist-item .lbl { font-size:10px;color:#888 }
    .asist-item .val { font-size:16px;font-weight:800 }
    table { border-collapse:collapse;width:100% }
    thead th { background:#1B3A6B;color:#9BBFED;padding:7px 10px;font-size:11px;text-align:left }
    tbody tr { border-bottom:1px solid #F0F4FA }
    .footer { margin-top:16px;font-size:11px;color:#AAA;border-top:1px solid #EEE;padding-top:8px;text-align:right }
    @media print { @page { margin:12mm } }
  </style></head><body>
  <h1>📋 Reporte Individual</h1>
  <p class="sub">${curso} · ${periodo}${periodoSel?.titulo?' — '+escapeHtml(periodoSel.titulo):''} · Materia: ${escapeHtml(materia?.nombre||'General')} · ${fecha}</p>

  <div class="header-card">
    <div class="avatar">${escapeHtml(estudiante.nombre_completo.split(' ').slice(0,2).map(w=>w[0]).join(''))}</div>
    <div style="flex:1">
      <div style="font-size:16px;font-weight:700;color:#1B3A6B">${nombre}</div>
      <div style="font-size:12px;color:#888;margin-top:2px">No. lista: ${estudiante.numero_lista}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:30px;font-weight:800;color:${promColor}">${promedio ?? '—'}</div>
      <div style="font-size:11px;color:#888">promedio general</div>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">Asistencia</div>
      <div style="font-size:28px;font-weight:800;color:${asistColor}">${asistencia.pct !== null ? asistencia.pct+'%' : '—'}</div>
      <div style="font-size:11px;color:#888;margin-bottom:8px">${asistencia.presentes} de ${asistencia.total} clases</div>
      <div class="asist-grid">
        <div class="asist-item"><div class="lbl">Presente</div><div class="val" style="color:#1A6B3A">${asistencia.presentes}</div></div>
        <div class="asist-item"><div class="lbl">Ausente</div><div class="val" style="color:#B71C1C">${asistencia.ausentes}</div></div>
        <div class="asist-item"><div class="lbl">Tardanza</div><div class="val" style="color:#C84B00">${asistencia.tardanzas}</div></div>
        <div class="asist-item"><div class="lbl">Excusado</div><div class="val" style="color:#555">${asistencia.excusados}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Calificaciones por competencia</div>
      ${competencias.length===0
        ? '<p style="color:#AAA;font-size:12px">Sin calificaciones registradas.</p>'
        : `<table><tbody>${compRows}</tbody></table>`}
    </div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-title">Temas del período</div>
    ${temas.length===0
      ? '<p style="color:#AAA;font-size:12px">Sin temas registrados.</p>'
      : `<table><thead><tr><th style="width:60px">Semana</th><th>Tema</th><th style="width:80px">Estado</th></tr></thead><tbody>${temaRows}</tbody></table>`}
  </div>

  ${observaciones.length > 0 ? `
  <div class="card">
    <div class="card-title">Cuaderno anecdótico (${observaciones.length} observaciones)</div>
    ${obsRows}
  </div>` : ''}

  <div class="footer">${nombre} · ${curso} · ${periodo} · ${fecha}</div>
  ${scriptPie({ autoprint, embebido })}
  </body></html>`

  return html
}

// ──────────────────────────────────────────────────────────────────────────
//  CONSTRUIR HTML — LOTE (un solo archivo con visor, búsqueda y filtros)
// ──────────────────────────────────────────────────────────────────────────

// Mismo criterio que en_riesgo de getReporteGrupal; "límite" es el tramo
// entre el mínimo aprobatorio y el semáforo verde.
function estadoEstudiante(est, cfg) {
  if (est.en_riesgo) return 'riesgo'
  if (est.sin_calificar) return 'sin'
  if (est.promedio !== null && est.promedio < cfg.semVerde) return 'limite'
  return 'bien'
}

// secciones: [{ curso, grupal: datos de get-reporte-grupal, individuales: [datos de get-reporte-individual] }]
export function construirHTMLLote({ secciones, periodo, materia, grado, incluirObs = false }) {
  const opts  = { autoprint: false, embebido: true, incluirObs }
  const cfg   = secciones[0]?.grupal.config || CFG_DEFECTO
  const nombresSec = secciones.map(s => s.curso.seccion || s.curso.nombre).join(', ')
  const titulo = `Reporte de seguimiento — ${grado} ${nombresSec} — ${periodo.nombre}`

  const encabezado = `${periodo.nombre}${periodo.titulo ? ' — ' + periodo.titulo : ''} · Materia: ${materia?.nombre || 'General'} · Generado el ${fechaHoy()}`
  const datos = {
    titulo,
    encabezado,
    grado,
    cfg,
    cssLista: CSS_GRUPAL,
    secciones: secciones.map(s => ({
      id:     s.curso.id,
      nombre: s.curso.nombre,
      corto:  s.curso.seccion || s.curso.nombre,
      doc:    construirHTMLGrupal(s.grupal, s.curso, periodo, materia, opts),
    })),
    estudiantes: secciones.flatMap(s => s.grupal.estudiantes.map((est, i) => ({
      id:     est.id,
      sec:    s.curso.id,
      n:      est.numero_lista,
      nombre: est.nombre_completo,
      prom:   est.sin_calificar ? null : est.promedio,
      asist:  est.asist_pct,
      aus:    est.asist_ausentes,
      riesgoFila: est.en_riesgo && !est.sin_calificar,
      inds:   indicadoresTexto(est, s.grupal.config || cfg),
      estado: estadoEstudiante(est, cfg),
      doc:    construirHTMLIndividual(s.individuales[i], s.curso, periodo, materia, s.grupal.config || cfg, opts),
    }))),
  }

  // Dentro de <script type="application/json"> solo "</script" rompe el bloque.
  const json = JSON.stringify(datos).replace(/</g, '\\u003c')
  const color = /^#[0-9a-fA-F]{6}$/.test(materia?.color || '') ? materia.color : '#1B3A6B'

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titulo)}</title>
<style>${CSS_VISOR.replace('__COLOR__', color)}</style></head><body>
<header class="top">
  <div class="marca">📊</div>
  <div class="top-txt">
    <h1>Reporte de seguimiento — ${escapeHtml(grado)} ${escapeHtml(nombresSec)}</h1>
    <p>${escapeHtml(encabezado)}</p>
  </div>
</header>

<section class="metricas" id="metricas"></section>

<section class="barra">
  <div class="buscar"><span>🔍</span><input id="buscar" type="search" placeholder="Buscar por nombre o número de lista…" autocomplete="off"></div>
  <div class="chips" id="chipsSec"></div>
  <label class="orden">Ordenar
    <select id="orden">
      <option value="lista">Por número de lista</option>
      <option value="nombre">Por nombre</option>
      <option value="prom-asc">Promedio: menor a mayor</option>
      <option value="prom-desc">Promedio: mayor a menor</option>
    </select>
  </label>
</section>

<main class="cuerpo">
  <aside class="card lista" id="lista" aria-label="Estudiantes"></aside>
  <section class="card visor">
    <div class="visor-barra">
      <div class="visor-titulo" id="visorTitulo"></div>
      <div class="acciones">
        <button id="ant" class="nav" title="Anterior (↑)">‹</button>
        <button id="sig" class="nav" title="Siguiente (↓)">›</button>
        <button id="imprimirTodos" hidden>🖨️ Reportes individuales</button>
        <button id="imprimir" class="primario">🖨️ Imprimir / Guardar PDF</button>
      </div>
    </div>
    <iframe id="marco" title="Reporte seleccionado"></iframe>
  </section>
</main>

<footer class="leyenda">
  <span><i class="dot bien"></i>Van bien: promedio ≥ ${cfg.semVerde} y asistencia ≥ ${cfg.semVerde}%</span>
  <span><i class="dot limite"></i>Límite: promedio entre ${cfg.minimo} y ${cfg.semVerde - 1}</span>
  <span><i class="dot riesgo"></i>En riesgo: promedio &lt; ${cfg.minimo} o asistencia &lt; ${cfg.semVerde}%</span>
  <span><i class="dot sin"></i>Sin calificar: sin notas en el período</span>
</footer>

<script type="application/json" id="sd-datos">${json}</script>
<script>(${visorLote.toString()})()</script>
</body></html>`
}

const CSS_VISOR = `
  :root { --base:__COLOR__; --borde:#DDE3ED; --suave:#F7F9FC; --texto:#1B3A6B; --gris:#888; --tenue:#AAB4C4 }
  * { box-sizing:border-box }
  body { margin:0; padding:20px 24px 16px; font-family:'Segoe UI',system-ui,sans-serif; background:#EEF2F7; color:#1A1A1A; font-size:13px }
  button, input, select { font-family:inherit }
  ::-webkit-scrollbar { width:8px; height:8px } ::-webkit-scrollbar-thumb { background:#C0CBDB; border-radius:4px }
  .top { display:flex; align-items:center; gap:14px; margin-bottom:16px }
  .marca { width:42px; height:42px; border-radius:10px; background:var(--base); color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0 }
  .top h1 { margin:0; font-size:19px; color:var(--texto) }
  .top p { margin:2px 0 0; color:var(--gris); font-size:12px }
  .card { background:#fff; border:1px solid var(--borde); border-radius:12px }
  .metricas { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; margin-bottom:12px }
  .mc { text-align:left; background:#fff; border:1px solid var(--borde); border-left:3px solid var(--acento); border-radius:10px; padding:11px 14px; cursor:pointer; transition:transform .12s ease, box-shadow .12s ease }
  .mc:hover { box-shadow:0 2px 10px #1B3A6B14 }
  .mc:active { transform:scale(.98) }
  .mc.activo { background:var(--fondo); box-shadow:0 0 0 2px var(--acento) inset }
  .mc.fijo { cursor:default } .mc.fijo:hover { box-shadow:none } .mc.fijo:active { transform:none }
  .mc .lbl { font-size:10.5px; font-weight:700; color:var(--tenue); letter-spacing:.06em; text-transform:uppercase }
  .mc .val { font-size:24px; font-weight:800; color:var(--acento); margin-top:2px; font-variant-numeric:tabular-nums }
  .barra { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px }
  .buscar { flex:1; min-width:220px; display:flex; align-items:center; gap:8px; background:#fff; border:1.5px solid var(--borde); border-radius:8px; padding:0 12px }
  .buscar:focus-within { border-color:var(--base) }
  .buscar input { flex:1; border:none; outline:none; padding:8px 0; font-size:13px; color:var(--texto); background:transparent }
  .chips { display:flex; gap:4px; background:#E3E9F1; border-radius:9px; padding:3px }
  .chip { border:none; background:transparent; border-radius:7px; padding:6px 13px; font-size:12px; color:#555; cursor:pointer }
  .chip.activo { background:var(--base); color:#fff; font-weight:700 }
  .orden { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--gris) }
  .orden select { border:1.5px solid var(--borde); border-radius:8px; padding:7px 10px; font-size:12.5px; color:var(--texto); background:#fff; outline:none; cursor:pointer }
  .cuerpo { display:grid; grid-template-columns:340px 1fr; gap:14px; align-items:start }
  .lista { position:sticky; top:12px; max-height:calc(100vh - 24px); overflow-y:auto; padding:6px }
  .grupo { font-size:10.5px; font-weight:700; color:var(--tenue); letter-spacing:.08em; text-transform:uppercase; padding:12px 10px 6px }
  .item { width:100%; display:flex; align-items:center; gap:10px; border:none; background:transparent; text-align:left; padding:8px 10px; border-radius:8px; cursor:pointer; color:inherit }
  .item:hover { background:var(--suave) }
  .item.sel { background:color-mix(in srgb, var(--base) 10%, #fff); box-shadow:inset 3px 0 0 var(--base) }
  .item .num { width:22px; font-size:11px; font-weight:700; color:#999; font-variant-numeric:tabular-nums; flex-shrink:0 }
  .item .nom { flex:1; min-width:0; font-weight:600; color:var(--texto); white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  .item .asi { font-size:11px; font-weight:600; color:var(--gris); font-variant-numeric:tabular-nums; width:36px; text-align:right }
  .item .asi.limite, .item .asi.riesgo { color:var(--c) }
  .item .prom { min-width:36px; text-align:center; font-size:12px; font-weight:800; padding:2px 7px; border-radius:20px; font-variant-numeric:tabular-nums }
  .item.resumen .nom { color:var(--base) }
  .vacio { padding:30px 16px; text-align:center; color:var(--tenue) }
  .bien   { --c:#3B6D11; --b:#EAF3DE } .limite { --c:#854F0B; --b:#FAEEDA }
  .riesgo { --c:#A32D2D; --b:#FCEBEB } .sin    { --c:#888;    --b:#F1F5F9 }
  .prom.bien, .prom.limite, .prom.riesgo, .prom.sin { color:var(--c); background:var(--b) }
  .visor { position:sticky; top:12px; height:calc(100vh - 24px); display:flex; flex-direction:column; overflow:hidden }
  .visor-barra { display:flex; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid var(--borde) }
  .visor-titulo { flex:1; min-width:0; font-weight:700; color:var(--texto); white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  .visor-titulo small { font-weight:400; color:var(--gris); margin-left:6px }
  .acciones { display:flex; gap:6px }
  .acciones button { border:1.5px solid var(--borde); background:#fff; color:var(--texto); border-radius:8px; padding:5px 12px; font-size:13px; font-weight:700; cursor:pointer; transition:transform .12s ease }
  .acciones .nav { font-size:18px; line-height:1; padding:4px 12px 6px }
  .acciones button:active { transform:scale(.97) }
  .acciones button:disabled { opacity:.4; cursor:default; transform:none }
  .acciones .primario { background:var(--base); border-color:var(--base); color:#fff }
  .acciones button[hidden] { display:none }
  .item.lista-f { margin-bottom:4px; background:color-mix(in srgb, var(--base) 5%, #fff) }
  .item.lista-f .nom { color:var(--base) }
  .item.lista-f .cuenta { font-size:11px; font-weight:700; color:var(--base); background:#fff; border:1px solid var(--borde); border-radius:20px; padding:1px 8px }
  iframe { flex:1; width:100%; border:0; background:#fff }
  .leyenda { display:flex; flex-wrap:wrap; gap:6px 18px; margin-top:12px; font-size:11.5px; color:var(--gris) }
  .dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--c); margin-right:6px; vertical-align:1px }
  @media (max-width:1100px) { .metricas { grid-template-columns:repeat(3,1fr) } }
  @media (max-width:860px) {
    body { padding:14px 16px }
    .cuerpo { grid-template-columns:1fr }
    .lista { position:static; max-height:42vh }
    .visor { position:static; height:80vh }
    .metricas { grid-template-columns:repeat(2,1fr) }
    .acciones .primario { font-size:12px; padding:6px 10px }
  }
  @media (prefers-reduced-motion:reduce) { .mc, .acciones button { transition:none } }
`

// Corre dentro del archivo HTML generado (se serializa con toString):
// no puede usar nada de este módulo.
function visorLote() {
  var D = JSON.parse(document.getElementById('sd-datos').textContent)
  var ESTADOS = [
    { id: 'todos',  lbl: 'Estudiantes',   acento: '#2563A8', fondo: '#EEF5FF' },
    { id: 'bien',   lbl: 'Van bien',      acento: '#3B6D11', fondo: '#F0FFF4' },
    { id: 'limite', lbl: 'Límite',        acento: '#854F0B', fondo: '#FFFBF0' },
    { id: 'riesgo', lbl: 'En riesgo',     acento: '#A32D2D', fondo: '#FFF0F0' },
    { id: 'sin',    lbl: 'Sin calificar', acento: '#888888', fondo: '#F7F9FC' },
  ]
  var st = { sec: 'todas', estado: 'todos', q: '', orden: 'lista', sel: null }
  var visibles = []
  var $ = function (id) { return document.getElementById(id) }
  var marco = $('marco')

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  // Mismos cortes de color que los reportes; el estado (filtro) es aparte
  function tono(v) {
    if (v === null) return 'sin'
    return v >= D.cfg.semVerde ? 'bien' : v >= D.cfg.semAmarillo ? 'limite' : 'riesgo'
  }
  function normal(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }
  function seccion(id) { return D.secciones.find(function (s) { return s.id === id }) }

  function enSeccion(e) { return st.sec === 'todas' || e.sec === st.sec }
  function coincide(e) {
    if (!st.q) return true
    var q = normal(st.q.trim())
    return normal(e.nombre).indexOf(q) !== -1 || String(e.n) === q
  }

  function pintarMetricas() {
    var base = D.estudiantes.filter(enSeccion)
    var conProm = base.filter(function (e) { return e.prom !== null })
    var prom = conProm.length ? Math.round(conProm.reduce(function (s, e) { return s + e.prom }, 0) / conProm.length) : null
    var html = ESTADOS.map(function (x) {
      var n = x.id === 'todos' ? base.length : base.filter(function (e) { return e.estado === x.id }).length
      return '<button class="mc' + (st.estado === x.id ? ' activo' : '') + '" data-estado="' + x.id + '" style="--acento:' + x.acento + ';--fondo:' + x.fondo + '">' +
        '<div class="lbl">' + x.lbl + '</div><div class="val">' + n + '</div></button>'
    }).join('')
    var colProm = prom === null ? '#888' : prom >= D.cfg.semVerde ? '#3B6D11' : prom >= D.cfg.minimo ? '#854F0B' : '#A32D2D'
    html += '<div class="mc fijo" style="--acento:' + colProm + '"><div class="lbl">Promedio general</div><div class="val">' + (prom === null ? '—' : prom) + '</div></div>'
    $('metricas').innerHTML = html
  }

  function pintarChips() {
    if (D.secciones.length < 2) { $('chipsSec').style.display = 'none'; return }
    var ops = [{ id: 'todas', corto: 'Todas' }].concat(D.secciones)
    $('chipsSec').innerHTML = ops.map(function (s) {
      return '<button class="chip' + (st.sec === s.id ? ' activo' : '') + '" data-sec="' + s.id + '">' + esc(s.corto) + '</button>'
    }).join('')
  }

  function ordenar(lista) {
    var f = {
      lista:      function (a, b) { return a.n - b.n },
      nombre:     function (a, b) { return a.nombre.localeCompare(b.nombre, 'es') },
      'prom-asc': function (a, b) { return (a.prom === null ? 999 : a.prom) - (b.prom === null ? 999 : b.prom) },
      'prom-desc':function (a, b) { return (b.prom === null ? -1 : b.prom) - (a.prom === null ? -1 : a.prom) },
    }[st.orden]
    return lista.slice().sort(f)
  }

  // Estudiantes visibles con los filtros actuales, en el orden de la lista
  var filtrados = []
  function filtrando() { return !!st.q.trim() || st.estado !== 'todos' }

  function pintarLista() {
    visibles = []
    filtrados = []
    var html = ''
    D.secciones.forEach(function (s) {
      if (st.sec !== 'todas' && st.sec !== s.id) return
      var ests = ordenar(D.estudiantes.filter(function (e) {
        return e.sec === s.id && coincide(e) && (st.estado === 'todos' || e.estado === st.estado)
      }))
      if (filtrando() && ests.length === 0) return
      html += '<div class="grupo">' + esc(s.nombre) + '</div>'
      var kG = 'g' + s.id
      visibles.push(kG)
      html += '<button class="item resumen' + (st.sel === kG ? ' sel' : '') + '" data-k="' + kG + '">' +
        '<span class="num">📊</span><span class="nom">Resumen grupal</span></button>'
      ests.forEach(function (e) {
        var k = 'e' + e.id
        visibles.push(k)
        filtrados.push(e)
        html += '<button class="item' + (st.sel === k ? ' sel' : '') + '" data-k="' + k + '">' +
          '<span class="num">' + String(e.n).padStart(2, '0') + '</span>' +
          '<span class="nom" title="' + esc(e.nombre) + '">' + esc(e.nombre) + '</span>' +
          '<span class="asi ' + tono(e.asist) + '">' + (e.asist === null ? '—' : e.asist + '%') + '</span>' +
          '<span class="prom ' + tono(e.prom) + '">' + (e.prom === null ? '—' : e.prom) + '</span></button>'
      })
    })
    if (filtrando() && filtrados.length > 0) {
      visibles.unshift('L')
      html = '<button class="item lista-f' + (st.sel === 'L' ? ' sel' : '') + '" data-k="L">' +
        '<span class="num">📋</span><span class="nom">Lista filtrada</span><span class="cuenta">' + filtrados.length + '</span></button>' + html
    }
    $('lista').innerHTML = html || '<div class="vacio">Ningún estudiante coincide con la búsqueda.</div>'
    var sel = $('lista').querySelector('.sel')
    if (sel) sel.scrollIntoView({ block: 'nearest' })
    pintarBotones()
  }

  function seccionesTexto() {
    var secs = st.sec === 'todas' ? D.secciones : [seccion(st.sec)]
    return D.grado + ' ' + secs.map(function (s) { return s.corto }).join(', ')
  }
  function descFiltro() {
    var partes = []
    if (st.estado !== 'todos') partes.push(ESTADOS.find(function (x) { return x.id === st.estado }).lbl)
    if (st.q.trim()) partes.push('búsqueda “' + st.q.trim() + '”')
    return partes.join(' · ')
  }

  // Partido en dos para no cerrar el <script> del visor que contiene esta función
  var CIERRE = '</' + 'script>'
  var SCRIPT_IMPRIMIR = '<script>addEventListener("message",function(e){if(e.data==="sd-imprimir")window.print()})' + CIERRE

  // Lista de los estudiantes filtrados con el mismo diseño del reporte grupal
  function docLista() {
    var cfg = D.cfg
    var color = function (v) { return v === null ? '#888' : v >= cfg.semVerde ? '#1A6B3A' : v >= cfg.semAmarillo ? '#C84B00' : '#B71C1C' }
    var media = function (arr) { return arr.length ? Math.round(arr.reduce(function (s, v) { return s + v }, 0) / arr.length) : null }
    var prom  = media(filtrados.filter(function (e) { return e.prom !== null }).map(function (e) { return e.prom }))
    var asist = media(filtrados.filter(function (e) { return e.asist !== null }).map(function (e) { return e.asist }))
    var total = D.estudiantes.filter(enSeccion).length
    var varias = D.secciones.length > 1 && st.sec === 'todas'
    var td = 'padding:7px 10px;'
    var filas = filtrados.map(function (e, i) {
      return '<tr style="background:' + (e.riesgoFila ? '#FFF8F8' : i % 2 === 0 ? '#fff' : '#FAFBFD') + '">' +
        '<td style="' + td + 'color:#999;font-weight:700;font-size:11px">' + String(e.n).padStart(2, '0') + '</td>' +
        (varias ? '<td style="' + td + 'color:#555;font-size:12px">' + esc(seccion(e.sec).corto) + '</td>' : '') +
        '<td style="' + td + 'font-weight:600;color:#1B3A6B;font-size:12px">' + esc(e.nombre) + '</td>' +
        '<td style="' + td + 'text-align:center;font-weight:800;color:' + color(e.prom) + ';font-size:13px">' + (e.prom === null ? '—' : e.prom) + '</td>' +
        '<td style="' + td + 'text-align:center;font-weight:700;color:' + color(e.asist) + ';font-size:12px">' + (e.asist === null ? '—' : e.asist + '%') + '</td>' +
        '<td style="' + td + 'text-align:center;color:#B71C1C;font-weight:700;font-size:12px">' + e.aus + '</td>' +
        '<td style="' + td + 'font-size:11px;color:#555">' + esc(e.inds) + '</td></tr>'
    }).join('')
    var mc = function (lbl, val, col, bg) {
      return '<div class="mc" style="border-color:' + col + ';background:' + bg + '"><div class="lbl">' + lbl + '</div><div class="val" style="color:' + col + '">' + val + '</div></div>'
    }
    var titulo = 'Lista — ' + descFiltro() + ' — ' + seccionesTexto()
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(titulo) + '</title><style>' + D.cssLista + '</style></head><body>' +
      '<h1>📋 ' + esc(descFiltro()) + ' — ' + esc(seccionesTexto()) + '</h1>' +
      '<p class="sub">' + esc(D.encabezado) + '</p>' +
      '<div class="metrics">' +
        mc('En la lista', filtrados.length + ' de ' + total, '#2563A8', '#EEF5FF') +
        mc('Promedio de la lista', prom === null ? '—' : prom, color(prom), '#F9F9F9') +
        mc('Asistencia promedio', asist === null ? '—' : asist + '%', color(asist), '#F9F9F9') +
        mc('Ausencias', filtrados.reduce(function (s, e) { return s + e.aus }, 0), '#A32D2D', '#FFF0F0') +
      '</div>' +
      '<table><thead><tr><th style="width:36px">#</th>' + (varias ? '<th style="width:60px">Sección</th>' : '') +
      '<th>Estudiante</th><th style="text-align:center;width:70px">Promedio</th><th style="text-align:center;width:80px">Asistencia</th>' +
      '<th style="text-align:center;width:70px">Ausencias</th><th>Indicador</th></tr></thead><tbody>' + filas + '</tbody></table>' +
      '<div class="footer"><span>Filtro: ' + esc(descFiltro()) + '</span><span>' + esc(seccionesTexto()) + '</span></div>' +
      SCRIPT_IMPRIMIR + '</body></html>'
  }

  // Reportes individuales de la lista en un solo documento, uno por página
  function docReportes() {
    var parser = new DOMParser(), estilo = '', cuerpos = []
    filtrados.forEach(function (e) {
      var d = parser.parseFromString(e.doc, 'text/html')
      if (!estilo) estilo = d.querySelector('style').textContent
      Array.prototype.forEach.call(d.querySelectorAll('script'), function (sc) { sc.remove() })
      cuerpos.push('<section class="pag">' + d.body.innerHTML + '</section>')
    })
    var titulo = 'Reportes — ' + descFiltro() + ' — ' + seccionesTexto()
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(titulo) + '</title><style>' + estilo +
      ' body{margin:0} .pag{padding:24px} @media print{ .pag{padding:0; break-after:page} .pag:last-child{break-after:auto} }</style></head><body>' +
      cuerpos.join('') + SCRIPT_IMPRIMIR + '</body></html>'
  }

  function buscar(k) {
    if (k === 'L') return { doc: docLista(), titulo: 'Lista filtrada — ' + descFiltro(), sub: filtrados.length + ' estudiante(s)' }
    if (k.charAt(0) === 'g') {
      var s = seccion(Number(k.slice(1)))
      return { doc: s.doc, titulo: 'Resumen grupal — ' + s.nombre, sub: '' }
    }
    var e = D.estudiantes.find(function (x) { return x.id === Number(k.slice(1)) })
    return { doc: e.doc, titulo: e.nombre, sub: seccion(e.sec).nombre + ' · No. ' + e.n }
  }

  function seleccionar(k) {
    if (!k) return
    st.sel = k
    var r = buscar(k)
    marco.srcdoc = r.doc
    $('visorTitulo').innerHTML = esc(r.titulo) + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '')
    document.title = r.titulo + ' — ' + D.titulo
    Array.prototype.forEach.call($('lista').querySelectorAll('.item'), function (b) {
      b.classList.toggle('sel', b.getAttribute('data-k') === k)
    })
    var sel = $('lista').querySelector('.sel')
    if (sel) sel.scrollIntoView({ block: 'nearest' })
    pintarBotones()
  }

  function pintarBotones() {
    var i = visibles.indexOf(st.sel)
    $('ant').disabled = i <= 0
    $('sig').disabled = i === -1 || i >= visibles.length - 1
    $('imprimir').disabled = !st.sel
    var enLista = st.sel === 'L'
    $('imprimirTodos').hidden = !enLista
    if (enLista) $('imprimirTodos').textContent = '🖨️ Reportes individuales (' + filtrados.length + ')'
  }

  function mover(d) {
    var i = visibles.indexOf(st.sel)
    if (i === -1) return
    var k = visibles[i + d]
    if (k) seleccionar(k)
  }

  function imprimir() {
    if (st.sel && marco.contentWindow) marco.contentWindow.postMessage('sd-imprimir', '*')
  }

  var marcoLote = null
  function imprimirTodos() {
    if (filtrados.length === 0) return
    if (marcoLote) marcoLote.remove()
    marcoLote = document.createElement('iframe')
    marcoLote.setAttribute('aria-hidden', 'true')
    marcoLote.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    marcoLote.onload = function () { marcoLote.contentWindow.postMessage('sd-imprimir', '*') }
    marcoLote.srcdoc = docReportes()
    document.body.appendChild(marcoLote)
  }

  // irALista: al cambiar filtro o búsqueda, el visor muestra la lista filtrada
  function refrescar(irALista) {
    pintarMetricas(); pintarChips(); pintarLista()
    var hayLista = visibles.indexOf('L') !== -1
    if (hayLista && (irALista || st.sel === 'L')) seleccionar('L')
    else if (visibles.indexOf(st.sel) === -1) seleccionar(visibles[0])
  }

  $('metricas').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-estado]')
    if (!b) return
    var est = b.getAttribute('data-estado')
    st.estado = st.estado === est ? 'todos' : est
    refrescar(true)
  })
  $('chipsSec').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-sec]')
    if (!b) return
    var v = b.getAttribute('data-sec')
    st.sec = v === 'todas' ? 'todas' : Number(v)
    refrescar()
  })
  $('lista').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-k]')
    if (!b) return
    seleccionar(b.getAttribute('data-k'))
    // En pantallas angostas el visor queda debajo de la lista
    if (window.matchMedia('(max-width:860px)').matches) document.querySelector('.visor').scrollIntoView({ behavior: 'smooth' })
  })
  $('buscar').addEventListener('input', function (ev) { st.q = ev.target.value; refrescar(true) })
  $('orden').addEventListener('change', function (ev) { st.orden = ev.target.value; refrescar() })
  $('ant').addEventListener('click', function () { mover(-1) })
  $('sig').addEventListener('click', function () { mover(1) })
  $('imprimir').addEventListener('click', imprimir)
  $('imprimirTodos').addEventListener('click', imprimirTodos)

  document.addEventListener('keydown', function (ev) {
    // Ctrl+P imprime el reporte abierto, no la página del visor completa
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'p' || ev.key === 'P')) { ev.preventDefault(); imprimir(); return }
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT') return
    if (ev.key === 'ArrowDown') { ev.preventDefault(); mover(1) }
    if (ev.key === 'ArrowUp')   { ev.preventDefault(); mover(-1) }
  })

  refrescar()
}
