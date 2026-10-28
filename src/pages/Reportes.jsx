import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useModalTransition } from '../hooks/useModalTransition'
import { useCursoActivo, usePeriodoActivo } from '../hooks/useSeleccionActiva'
import { slug, construirHTMLGrupal, construirHTMLIndividual, construirHTMLLote } from '../reportes/plantillasHTML'

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
  const pend = est.evidencias_pendientes || []
  if (pend.length > 0) items.push({ bg: '#FDECD7', col: '#C84B00', label: `${pend.length} evidencia${pend.length > 1 ? 's' : ''} pendiente${pend.length > 1 ? 's' : ''}` })
  return items
}

// "S2-2 Exposición de la profesión…" para listas cortas de pendientes.
const textoPendiente = p => `${p.sesion} ${p.nombre}`

function abrirVentanaImpresion(html) {
  const win = window.open('', '_blank')
  if (!win) {
    alert('No se pudo abrir la ventana de impresión. Verifica que el navegador no esté bloqueando ventanas emergentes.')
    return
  }
  win.document.write(html)
  win.document.close()
}

function exportarPDFGrupal(datos, cursoSel, periodoSel, materia) {
  abrirVentanaImpresion(construirHTMLGrupal(datos, cursoSel, periodoSel, materia))
}

function exportarPDFIndividual(datos, cursoSel, periodoSel, materia, cfg) {
  abrirVentanaImpresion(construirHTMLIndividual(datos, cursoSel, periodoSel, materia, cfg))
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

      {/* EVIDENCIAS PENDIENTES (registro por evidencias) */}
      {(() => {
        const conPend = estudiantes.filter(e => (e.evidencias_pendientes || []).length > 0)
        if (!datos.evidencias?.hay || conPend.length === 0) return null
        return (
          <div style={{ ...S.card, padding: '14px 18px', borderLeft: '3px solid #C84B00' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#C84B00', fontSize: 14 }}>📋 Evidencias pendientes</span>
              <span style={{ fontSize: 12, color: '#888' }}>
                {conPend.length} estudiante{conPend.length > 1 ? 's' : ''} · semanas en curso: {datos.evidencias.semanas_iniciadas.join(', ')} · esas semanas no cuentan en su promedio hasta completarlas
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
              {conPend.map(e => (
                <div key={e.id} onClick={() => onVerEstudiante(e.id)} style={{ display: 'flex', gap: 10, fontSize: 12, cursor: 'pointer', padding: '3px 0', borderBottom: '1px solid #F4F6FA' }}>
                  <span style={{ color: '#AAB4C4', fontWeight: 600, minWidth: 22 }}>{e.numero_lista}</span>
                  <span style={{ fontWeight: 600, color: COLOR_BASE, minWidth: 220 }}>{e.nombre_completo}</span>
                  <span style={{ color: '#555' }}>{e.evidencias_pendientes.map(textoPendiente).join(' · ')}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

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

      {/* EVIDENCIAS POR SEMANA */}
      {datos.evidencias?.semanas?.length > 0 && (
        <div style={{ ...S.card, marginBottom: 14 }}>
          <div style={S.label}>Evidencias por semana</div>
          {datos.evidencias.pendientes.length > 0 && (
            <div style={{ background: '#FFF8E1', border: '1px solid #FAC775', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#854F0B' }}>
              ⚠️ Le falta entregar: {datos.evidencias.pendientes.map(textoPendiente).join(' · ')}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>
            {datos.evidencias.semanas.map(s => {
              const est = s.nota !== null ? { bg: '#F7F9FC', txt: semaforo(s.nota, cfgLocal.semVerde, cfgLocal.semAmarillo).col, label: s.nota }
                : s.estado === 'pendiente' || (s.iniciada && s.estado === 'vacia') ? { bg: '#FFF8E1', txt: '#C84B00', label: 'pendiente' }
                : { bg: '#F7F9FC', txt: '#AAB4C4', label: 'sin evaluar' }
              return (
                <div key={s.actividad} style={{ background: est.bg, borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: COLOR_BASE, flex: 1 }}>{s.actividad}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: est.txt }}>{est.label}</span>
                  </div>
                  {s.items.map((it, j) => (
                    <div key={j} style={{ display: 'flex', gap: 6, fontSize: 11, color: it.puntos === null && s.iniciada ? '#C84B00' : '#555' }}>
                      <span style={{ color: '#AAB4C4', minWidth: 30 }}>{it.sesion}</span>
                      <span style={{ flex: 1 }}>{it.nombre}</span>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{it.puntos === null ? '—' : it.puntos} / {it.max}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

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
export default function Reportes({ anio, materia, cursoActivoId, onCambiarCurso, periodoActivoId, onCambiarPeriodo }) {
  const [periodos,    setPeriodos]    = useState([])
  const [cursos,      setCursos]      = useState([])
  const [cursoSel,    setCursoSel]    = useCursoActivo(cursos, cursoActivoId, onCambiarCurso)
  const [periodoSel,  setPeriodoSel]  = usePeriodoActivo(periodos, periodoActivoId, onCambiarPeriodo)
  const [vista,       setVista]       = useState('grupal')   // 'grupal' | 'individual'
  const [datosGrupal, setDatosGrupal] = useState(null)
  const [estSel,      setEstSel]      = useState(null)
  const [datosInd,    setDatosInd]    = useState(null)
  const [cargando,    setCargando]    = useState(false)

  // ── Generación por lote ──────────────────────────────────────────────────
  const [modalLote,     setModalLote]     = useState(false)
  const [loteGrado,     setLoteGrado]     = useState('')
  const [loteSecciones, setLoteSecciones] = useState([]) // ids de curso elegidos
  const [lotePeriodoId, setLotePeriodoId] = useState(null)
  const [loteGenerando, setLoteGenerando] = useState(false)
  const [loteProgreso,  setLoteProgreso]  = useState({ done: 0, total: 0 })
  const [loteIncluirObs, setLoteIncluirObs] = useState(false)
  const [loteToast,     setLoteToast]     = useState(null) // { msg, ruta, boton, leaving }
  const modalLoteT   = useModalTransition(modalLote)
  const loteToastGen = useRef(0)

  // ── Exportar para Portal-Ars ─────────────────────────────────────────────
  const [modalArs,          setModalArs]          = useState(false)
  const [arsGrado,          setArsGrado]          = useState('')
  const [arsSecciones,      setArsSecciones]      = useState([]) // ids de curso elegidos
  const [arsPeriodoId,      setArsPeriodoId]      = useState(null)
  const [arsActPlaneadas,   setArsActPlaneadas]   = useState('')
  const [arsGenerando,      setArsGenerando]      = useState(false)
  const modalArsT = useModalTransition(modalArs)

  // Cargar cursos y períodos al montar
  useEffect(() => {
    if (!anio) return
    Promise.all([
      window.api.invoke('get-cursos',   anio.id),
      window.api.invoke('get-periodos', anio.id),
    ]).then(([c, p]) => {
      setCursos(c)
      setPeriodos(p)
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

  const grados = [...new Set(cursos.map(c => c.grado).filter(Boolean))].sort()
  const seccionesDisponibles = cursos.filter(c => c.grado === loteGrado)

  function toggleSeccion(cursoId) {
    setLoteSecciones(prev => prev.includes(cursoId) ? prev.filter(id => id !== cursoId) : [...prev, cursoId])
  }

  function toggleSeccionArs(cursoId) {
    setArsSecciones(prev => prev.includes(cursoId) ? prev.filter(id => id !== cursoId) : [...prev, cursoId])
  }

  function abrirModalArs() {
    setArsGrado('')
    setArsSecciones([])
    setArsPeriodoId(periodoSel?.id || null)
    setArsActPlaneadas('')
    setModalArs(true)
  }

  function csvEscape(v) {
    const s = v === null || v === undefined ? '' : String(v)
    return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s
  }

  async function generarExportArs() {
    const periodoObj = periodos.find(p => p.id === arsPeriodoId)
    const cursosSel  = cursos.filter(c => arsSecciones.includes(c.id))
    const actPlan    = parseInt(arsActPlaneadas, 10)
    if (!periodoObj || cursosSel.length === 0 || !actPlan || actPlan < 1) return

    setArsGenerando(true)
    const materiaNombre = materia?.nombre || 'General'
    const headers = ['grado','seccion','numero_orden','materia','periodo',
      'promedio_general','promedio_comunicativa','promedio_pensamiento_logico','promedio_civica','promedio_tecnologica',
      'actividades_calificadas','actividades_planeadas','asist_presentes','asist_ausentes','asist_tardanzas','asist_excusados']
    const filas = [headers.join(',')]

    for (const curso of cursosSel) {
      const datos = await window.api.invoke('get-export-portal-ars', curso.id, periodoObj.id, materia?.id || null)
      datos.estudiantes.forEach(e => {
        filas.push([
          datos.grado, datos.seccion, e.numero_orden, materiaNombre, periodoObj.numero_orden,
          e.promedio_general, e.promedio_comunicativa, e.promedio_pensamiento_logico, e.promedio_civica, e.promedio_tecnologica,
          datos.actividades_calificadas, actPlan,
          e.asist_presentes, e.asist_ausentes, e.asist_tardanzas, e.asist_excusados,
        ].map(csvEscape).join(','))
      })
    }

    const fechaISO = new Date().toISOString().slice(0, 10)
    const nombreSugerido = `PortalArs_${arsGrado}_P${periodoObj.numero_orden}_${slug(materiaNombre)}_${fechaISO}.csv`

    try {
      const res = await window.api.invoke('guardar-csv-portal-ars', filas.join('\n'), nombreSugerido)
      setArsGenerando(false)
      if (res.cancelado) return
      if (res.ok) {
        setModalArs(false)
        const carpeta = res.ruta.substring(0, Math.max(res.ruta.lastIndexOf('\\'), res.ruta.lastIndexOf('/')))
        mostrarLoteToast(`✅ Archivo generado — ${filas.length - 1} fila(s)`, carpeta)
      } else {
        alert('Error generando el archivo: ' + (res.error || 'desconocido'))
      }
    } catch (e) {
      setArsGenerando(false)
      alert('Error generando el archivo: ' + e.message)
    }
  }

  function abrirModalLote() {
    setLoteGrado('')
    setLoteSecciones([])
    setLotePeriodoId(periodoSel?.id || null)
    setLoteIncluirObs(false)
    setModalLote(true)
  }

  function mostrarLoteToast(msg, ruta, boton = '📂 Abrir carpeta') {
    const gen = ++loteToastGen.current
    setLoteToast({ msg, ruta, boton, leaving: false })
    setTimeout(() => { if (loteToastGen.current === gen) setLoteToast(t => t && ({ ...t, leaving: true })) }, 5000)
    setTimeout(() => { if (loteToastGen.current === gen) setLoteToast(null) }, 5200)
  }

  async function generarLote() {
    if (!loteGrado || loteSecciones.length === 0 || !lotePeriodoId) return
    const periodoObj = periodos.find(p => p.id === lotePeriodoId)
    const cursosSel   = cursos.filter(c => loteSecciones.includes(c.id))
    if (!periodoObj || cursosSel.length === 0) return

    setLoteGenerando(true)
    setLoteProgreso({ done: 0, total: 0 })

    try {
      const secciones = []
      for (const curso of cursosSel) {
        const grupal = await window.api.invoke('get-reporte-grupal', curso.id, periodoObj.id, materia?.id || null)
        secciones.push({ curso, grupal, individuales: [] })
      }
      const total = secciones.reduce((n, s) => n + s.grupal.estudiantes.length, 0)
      let done = 0
      setLoteProgreso({ done, total })
      for (const s of secciones) {
        for (const est of s.grupal.estudiantes) {
          s.individuales.push(await window.api.invoke('get-reporte-individual', est.id, s.curso.id, periodoObj.id, materia?.id || null))
          setLoteProgreso({ done: ++done, total })
        }
      }

      const html = construirHTMLLote({ secciones, periodo: periodoObj, materia, grado: loteGrado, incluirObs: loteIncluirObs })
      const seccionesLetras = cursosSel.map(c => c.seccion || c.nombre).join('-')
      const fechaISO        = new Date().toISOString().slice(0, 10)
      const nombreSugerido  = `Reportes_${slug(loteGrado)}${slug(seccionesLetras)}_${slug(periodoObj.nombre)}_${fechaISO}.html`

      const res = await window.api.invoke('guardar-reporte-html', html, nombreSugerido)
      setLoteGenerando(false)
      if (res.cancelado) return
      if (res.ok) {
        setModalLote(false)
        mostrarLoteToast(`✅ Reporte generado — ${total} estudiante(s) en ${cursosSel.length} sección(es)`, res.ruta, '🌐 Abrir reporte')
      } else {
        alert('Error generando el reporte: ' + (res.error || 'desconocido'))
      }
    } catch (e) {
      setLoteGenerando(false)
      alert('Error generando el reporte: ' + e.message)
    }
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
          {/* Generar reporte por lote */}
          <button onClick={abrirModalLote} style={{ padding: '7px 14px', background: '#fff', border: '1.5px solid #DDE3ED', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: COLOR_BASE }}>
            📦 Generar reporte por lote
          </button>
          {/* Exportar para Portal-Ars */}
          <button onClick={abrirModalArs} style={{ padding: '7px 14px', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#166534' }}>
            📤 Exportar para Portal-Ars
          </button>
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
            <div className="spinner" style={{ margin: '0 auto 10px' }} />
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

      {/* MODAL GENERAR REPORTE POR LOTE */}
      {modalLoteT && (
        <div className="modal-backdrop" data-closing={modalLoteT.closing} style={{ position: 'fixed', inset: 0, background: '#0005', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={e => { if (e.target === e.currentTarget && !loteGenerando) setModalLote(false) }}>
          <div className="modal-content" data-closing={modalLoteT.closing} style={{ background: '#fff', borderRadius: 14, padding: 28, width: 480, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 16px 48px #0004' }}>
            <h2 style={{ color: COLOR_BASE, marginBottom: 6, fontSize: 17 }}>📦 Generar reporte por lote</h2>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
              Genera un solo archivo HTML con el resumen grupal y el reporte de cada estudiante. Se abre en cualquier navegador, permite buscar y filtrar (van bien, límite, en riesgo) y desde ahí se imprime o guarda en PDF el reporte que se necesite.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Grado</label>
              <select
                value={loteGrado}
                onChange={e => { setLoteGrado(e.target.value); setLoteSecciones([]) }}
                style={{ ...S.sel, width: '100%' }}
                disabled={loteGenerando}
              >
                <option value="">— Selecciona un grado —</option>
                {grados.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {loteGrado && (
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Secciones</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {seccionesDisponibles.map(c => (
                    <label key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                      border: '1.5px solid ' + (loteSecciones.includes(c.id) ? COLOR_BASE : '#DDE3ED'),
                      background: loteSecciones.includes(c.id) ? COLOR_BASE + '10' : '#fff',
                      cursor: 'pointer', fontSize: 13,
                    }}>
                      <input type="checkbox" checked={loteSecciones.includes(c.id)} onChange={() => toggleSeccion(c.id)} disabled={loteGenerando} />
                      {c.seccion || c.nombre}
                    </label>
                  ))}
                  {seccionesDisponibles.length === 0 && <span style={{ color: '#AAA', fontSize: 12 }}>No hay secciones para este grado.</span>}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Período</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {periodos.map(p => (
                  <label key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                    border: '1.5px solid ' + (lotePeriodoId === p.id ? COLOR_BASE : '#DDE3ED'),
                    background: lotePeriodoId === p.id ? COLOR_BASE + '10' : '#fff',
                    cursor: 'pointer', fontSize: 13,
                  }}>
                    <input type="radio" name="lote-periodo" checked={lotePeriodoId === p.id} onChange={() => setLotePeriodoId(p.id)} disabled={loteGenerando} />
                    {p.nombre}
                  </label>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 20, cursor: 'pointer', fontSize: 13, color: '#333' }}>
              <input type="checkbox" checked={loteIncluirObs} onChange={e => setLoteIncluirObs(e.target.checked)} disabled={loteGenerando} style={{ marginTop: 2 }} />
              <span>
                Incluir cuaderno anecdótico
                <span style={{ display: 'block', color: '#AAB4C4', fontSize: 11.5, marginTop: 2 }}>
                  Quien reciba el archivo puede ver las observaciones de todos los estudiantes y pasarlas a los PDF que imprima.
                </span>
              </span>
            </label>

            {loteGenerando ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, color: '#555' }}>
                  {loteProgreso.total > 0 ? `Preparando ${loteProgreso.done}/${loteProgreso.total} estudiantes...` : 'Preparando...'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setModalLote(false)} style={{ padding: '9px 20px', background: '#EEF2F7', border: '1px solid #DDE3ED', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#555' }}>
                  Cancelar
                </button>
                <button
                  onClick={generarLote}
                  disabled={!loteGrado || loteSecciones.length === 0 || !lotePeriodoId}
                  style={{
                    padding: '9px 24px', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: (!loteGrado || loteSecciones.length === 0 || !lotePeriodoId) ? '#CCC' : COLOR_BASE,
                    cursor: (!loteGrado || loteSecciones.length === 0 || !lotePeriodoId) ? 'default' : 'pointer',
                  }}
                >
                  📦 Generar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL EXPORTAR PARA PORTAL-ARS */}
      {modalArsT && (
        <div className="modal-backdrop" data-closing={modalArsT.closing} style={{ position: 'fixed', inset: 0, background: '#0005', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={e => { if (e.target === e.currentTarget && !arsGenerando) setModalArs(false) }}>
          <div className="modal-content" data-closing={modalArsT.closing} style={{ background: '#fff', borderRadius: 14, padding: 28, width: 480, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 16px 48px #0004' }}>
            <h2 style={{ color: '#166534', marginBottom: 6, fontSize: 17 }}>📤 Exportar para Portal-Ars</h2>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
              Genera un archivo con el promedio del período (general y por competencia) y la asistencia de cada estudiante de las secciones elegidas, para subirlo a Portal-Ars.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Grado</label>
              <select
                value={arsGrado}
                onChange={e => { setArsGrado(e.target.value); setArsSecciones([]) }}
                style={{ ...S.sel, width: '100%' }}
                disabled={arsGenerando}
              >
                <option value="">— Selecciona un grado —</option>
                {grados.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {arsGrado && (
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Secciones</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {cursos.filter(c => c.grado === arsGrado).map(c => (
                    <label key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                      border: '1.5px solid ' + (arsSecciones.includes(c.id) ? '#166534' : '#DDE3ED'),
                      background: arsSecciones.includes(c.id) ? '#F0FDF4' : '#fff',
                      cursor: 'pointer', fontSize: 13,
                    }}>
                      <input type="checkbox" checked={arsSecciones.includes(c.id)} onChange={() => toggleSeccionArs(c.id)} disabled={arsGenerando} />
                      {c.seccion || c.nombre}
                    </label>
                  ))}
                  {cursos.filter(c => c.grado === arsGrado).length === 0 && <span style={{ color: '#AAA', fontSize: 12 }}>No hay secciones para este grado.</span>}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Período</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {periodos.map(p => (
                  <label key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                    border: '1.5px solid ' + (arsPeriodoId === p.id ? '#166534' : '#DDE3ED'),
                    background: arsPeriodoId === p.id ? '#F0FDF4' : '#fff',
                    cursor: 'pointer', fontSize: 13,
                  }}>
                    <input type="radio" name="ars-periodo" checked={arsPeriodoId === p.id} onChange={() => setArsPeriodoId(p.id)} disabled={arsGenerando} />
                    {p.nombre}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>¿Cuántas actividades en total vas a calificar este período?</label>
              <input
                type="number" min="1" value={arsActPlaneadas}
                onChange={e => setArsActPlaneadas(e.target.value)}
                placeholder="Ej: 6"
                disabled={arsGenerando}
                style={{ ...S.sel, width: '100%' }}
              />
              <p style={{ color: '#AAB4C4', fontSize: 11.5, marginTop: 4 }}>
                Portal-Ars usa este número junto con las que ya calificaste para mostrarle al estudiante un avance real del período, no solo el promedio de lo hecho hasta ahora.
              </p>
            </div>

            {arsGenerando ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, color: '#555' }}>Generando archivo...</div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setModalArs(false)} style={{ padding: '9px 20px', background: '#EEF2F7', border: '1px solid #DDE3ED', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#555' }}>
                  Cancelar
                </button>
                <button
                  onClick={generarExportArs}
                  disabled={!arsGrado || arsSecciones.length === 0 || !arsPeriodoId || !arsActPlaneadas || Number(arsActPlaneadas) < 1}
                  style={{
                    padding: '9px 24px', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: (!arsGrado || arsSecciones.length === 0 || !arsPeriodoId || !arsActPlaneadas || Number(arsActPlaneadas) < 1) ? '#CCC' : '#166534',
                    cursor: (!arsGrado || arsSecciones.length === 0 || !arsPeriodoId || !arsActPlaneadas || Number(arsActPlaneadas) < 1) ? 'default' : 'pointer',
                  }}
                >
                  📤 Generar archivo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOAST LOTE */}
      {loteToast && (
        <div className="toast" data-leaving={loteToast.leaving} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, maxWidth: 360 }}>
          <span>{loteToast.msg}</span>
          <button
            onClick={() => window.api.invoke('abrir-carpeta', loteToast.ruta)}
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
          >
            {loteToast.boton}
          </button>
        </div>
      )}
    </div>
  )
}