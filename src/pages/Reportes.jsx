import React, { useState, useEffect, useCallback } from 'react'

const COLOR_BASE = '#1B3A6B'
const S = {
  page:    { padding: 0 },
  card:    { background: '#fff', borderRadius: 12, border: '1px solid #DDE3ED', padding: '20px 24px', marginBottom: 16 },
  label:   { fontSize: 11, fontWeight: 700, color: '#AAB4C4', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6, display: 'block' },
  sel:     { border: '1.5px solid #DDE3ED', borderRadius: 8, padding: '7px 12px', fontSize: 13, color: '#1B3A6B', background: '#fff', cursor: 'pointer', outline: 'none' },
  badge:   (bg, col) => ({ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: bg, color: col, whiteSpace: 'nowrap' }),
  tab:     (active, color) => ({
    padding: '9px 20px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 400,
    cursor: 'pointer', background: active ? color : 'transparent',
    color: active ? '#fff' : '#666', transition: 'all .15s',
  }),
  metricCard: (accent) => ({
    flex: 1, background: '#F7F9FC', borderRadius: 10, padding: '14px 16px',
    borderLeft: `3px solid ${accent}`,
  }),
}

function semaforo(val, v1 = 80, v2 = 60) {
  if (val === null || val === undefined) return { bg: '#F1F5F9', col: '#888', label: 'Sin datos' }
  if (val >= v1) return { bg: '#EAF3DE', col: '#3B6D11', label: 'Bueno' }
  if (val >= v2) return { bg: '#FAEEDA', col: '#854F0B', label: 'Regular' }
  return { bg: '#FCEBEB', col: '#A32D2D', label: 'Bajo' }
}

function indicadores(est, cfg = { minimo: 70, semVerde: 80, semAmarillo: 60 }) {
  const items = []
  if (est.sin_calificar) items.push({ bg: '#F1F5F9', col: '#888', label: 'Sin calificar' })
  else if (est.promedio !== null) {
    const s = semaforo(est.promedio, cfg.semVerde, cfg.semAmarillo)
    if (est.promedio < cfg.minimo) items.push({ ...s, label: 'Promedio bajo' })
    else if (est.promedio < cfg.semVerde) items.push({ ...s, label: 'Promedio límite' })
  }
  if (est.asist_pct !== null) {
    if (est.asist_pct < cfg.semAmarillo)  items.push({ bg: '#FCEBEB', col: '#A32D2D', label: 'Asistencia baja' })
    else if (est.asist_pct < cfg.semVerde) items.push({ bg: '#FAEEDA', col: '#854F0B', label: 'Asistencia irregular' })
  }
  if (items.length === 0) items.push({ bg: '#EAF3DE', col: '#3B6D11', label: 'Satisfactorio' })
  return items
}

// ──────────────────────────────────────────────────────────────────────────
//  EXPORTAR PDF GRUPAL
// ──────────────────────────────────────────────────────────────────────────
function exportarPDFGrupal(datos, cursoSel, periodoSel, materia) {
  const { temas_total, temas_realizados, estudiantes } = datos
  const cfg       = datos.config || { semVerde: 80, semAmarillo: 60, minimo: 70 }
  const conProm   = estudiantes.filter(e => !e.sin_calificar)
  const promGrupo = conProm.length > 0 ? Math.round(conProm.reduce((s, e) => s + e.promedio, 0) / conProm.length) : null
  const temaPct   = temas_total > 0 ? Math.round(temas_realizados / temas_total * 100) : 0
  const enRiesgo  = estudiantes.filter(e => e.en_riesgo).length
  const fecha     = new Date().toLocaleDateString('es-DO', { day:'2-digit', month:'long', year:'numeric' })

  const filas = estudiantes.map((est, i) => {
    const promColor  = est.sin_calificar ? '#888' : est.promedio >= cfg.semVerde ? '#1A6B3A' : est.promedio >= cfg.semAmarillo ? '#C84B00' : '#B71C1C'
    const asistColor = est.asist_pct === null ? '#888' : est.asist_pct >= cfg.semVerde ? '#1A6B3A' : est.asist_pct >= cfg.semAmarillo ? '#C84B00' : '#B71C1C'
    const filaRiesgo = est.en_riesgo && !est.sin_calificar

    const inds = []
    if (est.sin_calificar) inds.push('Sin calificar')
    else if (est.promedio < cfg.minimo) inds.push('Promedio bajo')
    else if (est.promedio < cfg.semVerde) inds.push('Promedio límite')
    if (est.asist_pct !== null && est.asist_pct < cfg.semAmarillo) inds.push('Asistencia baja')
    else if (est.asist_pct !== null && est.asist_pct < cfg.semVerde) inds.push('Asistencia irregular')
    if (inds.length === 0) inds.push('Satisfactorio')

    return `<tr style="background:${filaRiesgo ? '#FFF8F8' : i%2===0?'#fff':'#FAFBFD'}">
      <td style="padding:7px 10px;color:#999;font-weight:700;font-size:11px">${String(est.numero_lista).padStart(2,'0')}</td>
      <td style="padding:7px 10px;font-weight:600;color:#1B3A6B;font-size:12px">${est.nombre_completo}${est.obs_count>0?' ●':''}</td>
      <td style="padding:7px 10px;text-align:center;font-weight:800;color:${promColor};font-size:13px">${est.sin_calificar ? '—' : est.promedio}</td>
      <td style="padding:7px 10px;text-align:center;font-weight:700;color:${asistColor};font-size:12px">${est.asist_pct !== null ? est.asist_pct+'%' : '—'}</td>
      <td style="padding:7px 10px;text-align:center;color:#B71C1C;font-weight:700;font-size:12px">${est.asist_ausentes}</td>
      <td style="padding:7px 10px;font-size:11px;color:#555">${inds.join(' · ')}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Reporte ${cursoSel.nombre} — ${periodoSel.nombre}</title>
  <style>
    body { font-family:'Segoe UI',sans-serif; margin:24px; color:#333; font-size:13px }
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
  </style></head><body>
  <h1>📊 Reporte Grupal — ${cursoSel.nombre}</h1>
  <p class="sub">${periodoSel.nombre}${periodoSel.titulo?' — '+periodoSel.titulo:''} · Materia: ${materia?.nombre || 'General'} · Generado el ${fecha}</p>

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
    <span>● = tiene observaciones en cuaderno anecdótico</span>
    <span>${cursoSel.nombre} · ${periodoSel.nombre} · ${fecha}</span>
  </div>
  <script>window.onload=()=>window.print()</script>
  </body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

// ──────────────────────────────────────────────────────────────────────────
//  EXPORTAR PDF INDIVIDUAL
// ──────────────────────────────────────────────────────────────────────────
function exportarPDFIndividual(datos, cursoSel, periodoSel, materia, cfg = { semVerde: 80, semAmarillo: 60, minimo: 70 }) {
  const { estudiante, promedio, competencias, asistencia, temas, observaciones } = datos
  const fecha      = new Date().toLocaleDateString('es-DO', { day:'2-digit', month:'long', year:'numeric' })
  const promColor  = promedio === null ? '#888' : promedio >= cfg.semVerde ? '#1A6B3A' : promedio >= cfg.semAmarillo ? '#C84B00' : '#B71C1C'
  const asistColor = asistencia.pct === null ? '#888' : asistencia.pct >= cfg.semVerde ? '#1A6B3A' : asistencia.pct >= cfg.semAmarillo ? '#C84B00' : '#B71C1C'

  const compRows = competencias.map(c => {
    const cc = c.promedio >= cfg.semVerde ? '#1A6B3A' : c.promedio >= cfg.semAmarillo ? '#C84B00' : '#B71C1C'
    return `<tr>
      <td style="padding:6px 10px;color:#555;font-size:12px">${c.nombre}</td>
      <td style="padding:6px 10px;text-align:center;font-weight:800;color:${cc};font-size:13px">${c.promedio ?? '—'}</td>
    </tr>`
  }).join('')

  const temaRows = temas.map((t, i) => {
    const col = t.estado==='realizado' ? '#1A6B3A' : t.estado==='aplazado' ? '#C84B00' : '#AAA'
    const lbl = t.estado==='realizado' ? 'Realizado' : t.estado==='aplazado' ? 'Aplazado' : 'Pendiente'
    return `<tr style="background:${i%2===0?'#fff':'#FAFBFD'}">
      <td style="padding:5px 10px;color:#888;font-size:11px">Sem. ${i+1}</td>
      <td style="padding:5px 10px;color:#333;font-size:12px">${t.titulo}</td>
      <td style="padding:5px 10px;color:${col};font-weight:700;font-size:11px">${lbl}</td>
    </tr>`
  }).join('')

  const tipoLabel = { academico:'Académico', positivo:'Positivo', negativo:'Negativo', citacion:'Citación', conductual:'Conductual' }
  const obsRows = observaciones.map(o => `
    <div style="border-bottom:1px solid #EEE;padding:8px 0;margin-bottom:4px">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
        <span style="font-size:11px;font-weight:700;color:#555;background:#F0F0F0;padding:2px 8px;border-radius:10px">${tipoLabel[o.tipo]||o.tipo}</span>
        <span style="font-size:11px;color:#AAA">${o.fecha}</span>
      </div>
      <div style="font-size:13px;color:#333;line-height:1.5">${o.texto}</div>
    </div>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Reporte ${estudiante.nombre_completo}</title>
  <style>
    body { font-family:'Segoe UI',sans-serif; margin:24px; color:#333; font-size:13px }
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
  <p class="sub">${cursoSel?.nombre} · ${periodoSel?.nombre}${periodoSel?.titulo?' — '+periodoSel.titulo:''} · Materia: ${materia?.nombre||'General'} · ${fecha}</p>

  <div class="header-card">
    <div class="avatar">${estudiante.nombre_completo.split(' ').slice(0,2).map(w=>w[0]).join('')}</div>
    <div style="flex:1">
      <div style="font-size:16px;font-weight:700;color:#1B3A6B">${estudiante.nombre_completo}</div>
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

  <div class="footer">${estudiante.nombre_completo} · ${cursoSel?.nombre} · ${periodoSel?.nombre} · ${fecha}</div>
  <script>window.onload=()=>window.print()</script>
  </body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

// ──────────────────────────────────────────────────────────────────────────
//  VISTA GRUPAL
// ──────────────────────────────────────────────────────────────────────────
function VistaGrupal({ datos, cursoSel, periodoSel, materia, onVerEstudiante, onExportar, cfg }) {
  if (!datos) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#AAB4C4' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 14 }}>Selecciona un curso y período para ver el reporte</div>
    </div>
  )

  const cfgLocal = cfg || { semVerde: 80, semAmarillo: 60, minimo: 70 }
  const { temas_total, temas_realizados, estudiantes } = datos
  const conProm    = estudiantes.filter(e => !e.sin_calificar)
  const enRiesgo   = estudiantes.filter(e => e.en_riesgo)
  const sinCalif   = estudiantes.filter(e => e.sin_calificar)
  const promGrupo  = conProm.length > 0 ? Math.round(conProm.reduce((s, e) => s + e.promedio, 0) / conProm.length) : null
  const temaPct    = temas_total > 0 ? Math.round(temas_realizados / temas_total * 100) : 0
  const sTemaPct   = semaforo(temaPct, 80, 50)

  return (
    <div>
      {/* MÉTRICAS */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={S.metricCard('#2563A8')}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>ESTUDIANTES</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: COLOR_BASE }}>{estudiantes.length}</div>
          <div style={{ fontSize: 11, color: '#888' }}>activos en el curso</div>
        </div>
        <div style={S.metricCard(enRiesgo.length > 0 ? '#A32D2D' : '#3B6D11')}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>EN RIESGO</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: enRiesgo.length > 0 ? '#A32D2D' : '#3B6D11' }}>{enRiesgo.length}</div>
          <div style={{ fontSize: 11, color: '#888' }}>promedio &lt;60 o asistencia &lt;70%</div>
        </div>
        <div style={S.metricCard(promGrupo !== null ? semaforo(promGrupo, cfgLocal.semVerde, cfgLocal.semAmarillo).col : '#888')}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>PROMEDIO GRUPO</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: promGrupo !== null ? semaforo(promGrupo, cfgLocal.semVerde, cfgLocal.semAmarillo).col : '#888' }}>
            {promGrupo ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>{sinCalif.length > 0 ? `${sinCalif.length} sin calificar` : 'todos calificados'}</div>
        </div>
        <div style={S.metricCard(sTemaPct.col)}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>AVANCE TEMARIO</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: sTemaPct.col }}>{temaPct}%</div>
          <div style={{ fontSize: 11, color: '#888' }}>{temas_realizados} de {temas_total} temas realizados</div>
        </div>
      </div>

      {/* BOTÓN EXPORTAR */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: 12 }}>
        <button onClick={onExportar} style={{ padding:'8px 18px', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
          🖨️ Exportar PDF
        </button>
      </div>

      {/* ALERTA sin calificar */}
      {sinCalif.length > 0 && (
        <div style={{ background: '#FFF8E1', border: '1px solid #FAC775', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#854F0B', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠️</span>
          <span>{sinCalif.length} estudiante{sinCalif.length > 1 ? 's' : ''} sin calificaciones registradas en este período. Ingresa las notas para que el reporte refleje el estado real.</span>
        </div>
      )}

      {/* TABLA */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F7F9FC', borderBottom: '1.5px solid #DDE3ED' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1 }}>#</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1 }}>ESTUDIANTE</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1 }}>PROMEDIO</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1 }}>ASISTENCIA</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1 }}>AUSENCIAS</th>
              <th style={{ padding: '10px 16px', textAlign: 'left',   fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1 }}>INDICADOR</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1 }}></th>
            </tr>
          </thead>
          <tbody>
            {estudiantes.map((est, i) => {
              const sp  = semaforo(est.promedio, cfgLocal.semVerde, cfgLocal.semAmarillo)
              const sa  = semaforo(est.asist_pct, cfgLocal.semVerde, cfgLocal.semAmarillo)
              const ind = indicadores(est, cfgLocal)
              const filaRiesgo = est.en_riesgo && !est.sin_calificar
              return (
                <tr key={est.id}
                  style={{ borderBottom: '1px solid #EEF2F7', background: filaRiesgo ? '#FFF8F8' : i % 2 === 0 ? '#fff' : '#FAFBFC', cursor: 'pointer', transition: 'background .1s' }}
                  onClick={() => onVerEstudiante(est.id)}
                  onMouseEnter={e => e.currentTarget.style.background = '#EEF2F7'}
                  onMouseLeave={e => e.currentTarget.style.background = filaRiesgo ? '#FFF8F8' : i % 2 === 0 ? '#fff' : '#FAFBFC'}
                >
                  <td style={{ padding: '10px 16px', color: '#AAB4C4', fontWeight: 600 }}>{est.numero_lista}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontWeight: 600, color: COLOR_BASE }}>{est.nombre_completo}</span>
                    {est.obs_count > 0 && <span title="Tiene observaciones en cuaderno" style={{ marginLeft: 6, fontSize: 10, background: '#E6F1FB', color: '#185FA5', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>{est.obs_count} obs.</span>}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    {est.sin_calificar
                      ? <span style={S.badge('#F1F5F9', '#888')}>Sin calificar</span>
                      : <span style={{ fontWeight: 700, color: sp.col, fontSize: 15 }}>{est.promedio}</span>
                    }
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    {est.asist_pct !== null
                      ? <span style={{ fontWeight: 700, color: sa.col }}>{est.asist_pct}%</span>
                      : <span style={{ color: '#AAB4C4' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', color: est.asist_ausentes > 0 ? '#A32D2D' : '#3B6D11', fontWeight: 600 }}>
                    {est.asist_ausentes}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {ind.map((it, j) => <span key={j} style={S.badge(it.bg, it.col)}>{it.label}</span>)}
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: 16, color: '#AAB4C4' }}>›</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#AAB4C4', marginTop: 8 }}>
        Clic en un estudiante para ver su reporte individual completo.
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//  VISTA INDIVIDUAL
// ──────────────────────────────────────────────────────────────────────────
function VistaIndividual({ datos, materia, onExportar, cfg }) {
  if (!datos) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#AAB4C4' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
      <div style={{ fontSize: 14 }}>Selecciona un estudiante para ver su reporte</div>
    </div>
  )

  const { estudiante, promedio, competencias, asistencia, temas, observaciones } = datos
  const cfgLocal  = cfg || { semVerde: 80, semAmarillo: 60, minimo: 70 }
  const sp        = semaforo(promedio, cfgLocal.semVerde, cfgLocal.semAmarillo)
  const sa        = semaforo(asistencia.pct, cfgLocal.semVerde, cfgLocal.semAmarillo)
  const initials  = estudiante.nombre_completo.split(' ').slice(0, 2).map(w => w[0]).join('')
  const color     = materia?.color || COLOR_BASE
  const estadoLabel = promedio === null ? 'Sin calificar' : promedio >= cfgLocal.semVerde ? 'Satisfactorio' : promedio >= cfgLocal.minimo ? 'En proceso' : promedio >= cfgLocal.semAmarillo ? 'En proceso' : 'En riesgo'
  const estadoStyle = promedio === null
    ? S.badge('#F1F5F9', '#888')
    : promedio >= cfgLocal.semVerde ? S.badge('#EAF3DE', '#3B6D11')
    : promedio >= cfgLocal.semAmarillo ? S.badge('#FAEEDA', '#854F0B')
    : S.badge('#FCEBEB', '#A32D2D')

  const tipoLabel = { academico: 'Académico', positivo: 'Positivo', negativo: 'Negativo', citacion: 'Citación', conductual: 'Conductual' }
  const tipoStyle = {
    academico:  S.badge('#F1F5F9', '#555'),
    positivo:   S.badge('#EAF3DE', '#3B6D11'),
    negativo:   S.badge('#FCEBEB', '#A32D2D'),
    citacion:   S.badge('#E6F1FB', '#185FA5'),
    conductual: S.badge('#FAEEDA', '#854F0B'),
  }

  return (
    <div>
      {/* CABECERA */}
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: color + '20', border: '2px solid ' + color + '40', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLOR_BASE }}>{estudiante.nombre_completo}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>No. lista: {estudiante.numero_lista}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <span style={estadoStyle}>{estadoLabel}</span>
            {observaciones.length > 0 && <span style={S.badge('#E6F1FB', '#185FA5')}>{observaciones.length} obs. en cuaderno</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: sp.col }}>{promedio ?? '—'}</div>
          <div style={{ fontSize: 11, color: '#888' }}>promedio general</div>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: 12 }}>
        <button onClick={onExportar} style={{ padding:'8px 18px', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
          🖨️ Exportar PDF
        </button>
      </div>

      {/* GRID: ASISTENCIA + COMPETENCIAS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Asistencia */}
        <div style={S.card}>
          <div style={S.label}>Asistencia</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: sa.col }}>
            {asistencia.pct !== null ? asistencia.pct + '%' : '—'}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            {asistencia.presentes} de {asistencia.total} clases
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Presente',  val: asistencia.presentes, col: '#3B6D11' },
              { label: 'Ausente',   val: asistencia.ausentes,  col: '#A32D2D' },
              { label: 'Tardanza',  val: asistencia.tardanzas, col: '#854F0B' },
              { label: 'Excusado', val: asistencia.excusados, col: '#555' },
            ].map(it => (
              <div key={it.label} style={{ background: '#F7F9FC', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: '#888' }}>{it.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: it.col }}>{it.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Competencias */}
        <div style={S.card}>
          <div style={S.label}>Calificaciones por competencia</div>
          {competencias.length === 0
            ? <div style={{ color: '#AAB4C4', fontSize: 13, marginTop: 8 }}>Sin calificaciones registradas.</div>
            : competencias.map(c => {
                const cc = c.promedio >= cfgLocal.semVerde ? '#639922' : c.promedio >= cfgLocal.semAmarillo ? '#EF9F27' : '#E24B4A'
                return (
                  <div key={c.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                    <div style={{ width: 90, height: 6, background: '#EEF2F7', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ height: '100%', width: c.promedio + '%', background: cc, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: cc, minWidth: 28, textAlign: 'right' }}>{c.promedio}</span>
                  </div>
                )
              })
          }
        </div>
      </div>

      {/* TEMAS */}
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.label}>Temas del período</div>
        {temas.length === 0
          ? <div style={{ color: '#AAB4C4', fontSize: 13 }}>No hay temas registrados en este período.</div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {temas.map((t, i) => {
                const estiloTema = t.estado === 'realizado'
                  ? { bg: '#EAF3DE', dot: '#639922', txt: '#3B6D11', label: 'Realizado' }
                  : t.estado === 'aplazado'
                  ? { bg: '#FFF8E1', dot: '#EF9F27', txt: '#854F0B', label: 'Aplazado' }
                  : { bg: '#F1F5F9', dot: '#D3D1C7', txt: '#888',    label: 'Pendiente' }
                return (
                  <div key={t.id} style={{ background: estiloTema.bg, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: estiloTema.dot, flexShrink: 0, marginTop: 4 }} />
                    <div>
                      <div style={{ fontSize: 11, color: estiloTema.txt, fontWeight: 700 }}>Sem. {i + 1} — {estiloTema.label}</div>
                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.4 }}>{t.titulo}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>

      {/* CUADERNO ANECDÓTICO */}
      <div style={S.card}>
        <div style={S.label}>Cuaderno anecdótico</div>
        {observaciones.length === 0
          ? <div style={{ color: '#AAB4C4', fontSize: 13, fontStyle: 'italic' }}>Sin observaciones registradas.</div>
          : observaciones.map(o => (
            <div key={o.id} style={{ borderBottom: '1px solid #EEF2F7', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={(tipoStyle[o.tipo] || tipoStyle.academico)}>{tipoLabel[o.tipo] || o.tipo}</span>
                <span style={{ fontSize: 11, color: '#AAB4C4', marginLeft: 'auto' }}>{o.fecha}</span>
              </div>
              <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>{o.texto}</div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ──────────────────────────────────────────────────────────────────────────
export default function Reportes({ anio, materia }) {
  const [periodos,    setPeriodos]    = useState([])
  const [cursos,      setCursos]      = useState([])
  const [cursoSel,    setCursoSel]    = useState(null)
  const [periodoSel,  setPeriodoSel]  = useState(null)
  const [vista,       setVista]       = useState('grupal')   // 'grupal' | 'individual'
  const [datosGrupal, setDatosGrupal] = useState(null)
  const [estSel,      setEstSel]      = useState(null)
  const [datosInd,    setDatosInd]    = useState(null)
  const [cargando,    setCargando]    = useState(false)

  // Cargar cursos y períodos al montar
  useEffect(() => {
    if (!anio) return
    Promise.all([
      window.api.invoke('get-cursos',   anio.id),
      window.api.invoke('get-periodos', anio.id),
    ]).then(([c, p]) => {
      setCursos(c)
      setPeriodos(p)
      if (c.length > 0) setCursoSel(c[0])
      if (p.length > 0) {
        // Seleccionar el período más reciente con estado 'abierto', o el último
        const abierto = p.filter(x => x.estado === 'abierto').pop() || p[p.length - 1]
        setPeriodoSel(abierto)
      }
    })
  }, [anio])

  // Cargar datos grupal cuando cambia curso o período
  useEffect(() => {
    if (!cursoSel || !periodoSel) return
    setCargando(true)
    setDatosGrupal(null)
    setEstSel(null)
    setDatosInd(null)
    window.api.invoke('get-reporte-grupal', cursoSel.id, periodoSel.id, materia?.id || null)
      .then(d => { setDatosGrupal(d); setCargando(false) })
      .catch(() => setCargando(false))
  }, [cursoSel, periodoSel, materia])

  // Cargar datos individual cuando cambia el estudiante seleccionado
  useEffect(() => {
    if (!estSel || !cursoSel || !periodoSel) return
    window.api.invoke('get-reporte-individual', estSel, cursoSel.id, periodoSel.id, materia?.id || null)
      .then(d => setDatosInd(d))
  }, [estSel, cursoSel, periodoSel, materia])

  function irAEstudiante(estudianteId) {
    setEstSel(estudianteId)
    setVista('individual')
  }

  const color = materia?.color || COLOR_BASE

  return (
    <div style={S.page}>

      {/* ENCABEZADO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: COLOR_BASE, margin: 0 }}>Reportes</h1>
          <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>Seguimiento de progreso para supervisor y psicología</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Selector curso */}
          <div>
            <select
              value={cursoSel?.id || ''}
              onChange={e => {
                const c = cursos.find(x => x.id === Number(e.target.value))
                setCursoSel(c || null)
              }}
              style={S.sel}
            >
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          {/* Selector período */}
          <div>
            <select
              value={periodoSel?.id || ''}
              onChange={e => {
                const p = periodos.find(x => x.id === Number(e.target.value))
                setPeriodoSel(p || null)
              }}
              style={S.sel}
            >
              {periodos.map(p => <option key={p.id} value={p.id}>{p.nombre} — {p.titulo}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 4, background: '#EEF2F7', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        <button style={S.tab(vista === 'grupal', color)} onClick={() => setVista('grupal')}>
          Reporte grupal
        </button>
        <button
          style={S.tab(vista === 'individual', color)}
          onClick={() => setVista('individual')}
        >
          Reporte individual{estSel && datosInd ? ` — ${datosInd.estudiante.nombre_completo.split(' ').slice(0,2).join(' ')}` : ''}
        </button>
      </div>

      {/* CONTENIDO */}
      {cargando
        ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#AAB4C4' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
            <div>Cargando datos...</div>
          </div>
        )
        : vista === 'grupal'
          ? <VistaGrupal
              datos={datosGrupal}
              cursoSel={cursoSel}
              periodoSel={periodoSel}
              materia={materia}
              onVerEstudiante={irAEstudiante}
              cfg={datosGrupal?.config}
              onExportar={() => exportarPDFGrupal(datosGrupal, cursoSel, periodoSel, materia)}
            />
          : (
            <div>
              {/* Selector de estudiante en vista individual */}
              {datosGrupal && datosGrupal.estudiantes.length > 0 && (
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#888' }}>Estudiante:</span>
                  <select
                    value={estSel || ''}
                    onChange={e => setEstSel(Number(e.target.value))}
                    style={S.sel}
                  >
                    <option value="">— Selecciona un estudiante —</option>
                    {datosGrupal.estudiantes.map(e => (
                      <option key={e.id} value={e.id}>{e.numero_lista}. {e.nombre_completo}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setVista('grupal')}
                    style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    ← Ver todos
                  </button>
                </div>
              )}
              <VistaIndividual
                datos={datosInd}
                materia={materia}
                cfg={datosGrupal?.config}
                onExportar={() => exportarPDFIndividual(datosInd, cursoSel, periodoSel, materia, datosGrupal?.config)}
              />
            </div>
          )
      }
    </div>
  )
}