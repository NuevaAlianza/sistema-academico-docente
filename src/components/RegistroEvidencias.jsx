import React, { useState, useEffect, useRef } from 'react'

const fmt = n => (n == null || n === '') ? '' : String(Math.round(Number(n) * 10) / 10)

// Entrada de notas por evidencia: el docente escribe los puntos del plan (20 de 25) y la
// app guarda la nota de la actividad igual que si la escribiera a mano.
// competencias: la constante COMPETENCIAS de Calificaciones (orden fijo de las 4 columnas).
export default function RegistroEvidencias({ actividad, estudiantes, competencias, colPer, onVolver, onVerDirectas, onImprimir, onToast }) {
  const [datos,     setDatos]     = useState(null)   // { evidencias, porEstudiante }
  const [valores,   setValores]   = useState({})     // `${estId}-${evId}` → texto en el input
  const [errores,   setErrores]   = useState({})
  const [grupo,     setGrupo]     = useState(null)   // null = todos | número | 'sin'
  const [cerrando,  setCerrando]  = useState(false)
  const tablaRef = useRef(null)

  useEffect(() => { cargar() }, [actividad.id])

  async function cargar() {
    const d = await window.api.invoke('get-evidencias-actividad', actividad.id)
    if (d.error) { onToast('⚠️ ' + d.error); return }
    const v = {}
    for (const [estId, info] of Object.entries(d.porEstudiante))
      for (const [evId, pts] of Object.entries(info.puntos)) v[`${estId}-${evId}`] = fmt(pts)
    setDatos(d); setValores(v); setErrores({})
  }

  if (!datos) return <div style={{ padding:40, textAlign:'center', color:'#888' }}>Cargando evidencias…</div>

  const compsAct = actividad.modo === 'multi' && actividad.competencias_multi ? JSON.parse(actividad.competencias_multi) : [actividad.competencia]
  compsAct.forEach(k => { if (!competencias.some(c => c.key === k)) console.warn('[evidencias] competencia desconocida:', k, 'act', actividad.id) })
  const grupos = competencias.filter(c => compsAct.includes(c.key))
    .map(c => ({ ...c, evidencias: datos.evidencias.filter(e => e.competencia === c.key) }))
  const evidenciasOrden = grupos.flatMap(g => g.evidencias)
  const techo = actividad.modo === 'multi' ? 100 / compsAct.length : 100

  const gruposDisp  = [...new Set(estudiantes.map(e => e.grupo_trabajo).filter(g => g != null))].sort((a, b) => a - b)
  const haySinGrupo = gruposDisp.length > 0 && estudiantes.some(e => e.grupo_trabajo == null)
  const visibles = grupo === null ? estudiantes
    : grupo === 'sin' ? estudiantes.filter(e => e.grupo_trabajo == null)
    : estudiantes.filter(e => e.grupo_trabajo === grupo)

  const estadoDe = id => datos.porEstudiante[id]?.estado || 'vacia'
  const nPend  = estudiantes.filter(e => estadoDe(e.id) === 'pendiente').length
  const nVacio = estudiantes.filter(e => estadoDe(e.id) === 'vacia').length
  const nDirecta = estudiantes.filter(e => estadoDe(e.id) === 'directa').length
  const nListos = estudiantes.filter(e => estadoDe(e.id) === 'completa').length

  async function guardar(est, ev) {
    const key = `${est.id}-${ev.id}`
    const texto = (valores[key] ?? '').trim().replace(',', '.')
    const anterior = datos.porEstudiante[est.id]?.puntos?.[ev.id]
    if (texto === '' && anterior == null) return
    if (texto !== '' && Number(texto) === anterior) return
    if (texto !== '' && !Number.isFinite(Number(texto))) { setErrores(p => ({ ...p, [key]: 'Escribe un número' })); return }
    if (estadoDe(est.id) === 'directa' && texto !== '' &&
        !window.confirm(`${est.nombre_completo} ya tiene una nota escrita a mano en esta actividad. Al anotar evidencias, la nota se calculará desde ellas. ¿Continuar?`)) {
      setValores(p => ({ ...p, [key]: '' })); return
    }
    const r = await window.api.invoke('set-puntos-evidencia', { evidenciaId: ev.id, estudianteId: est.id, puntos: texto === '' ? null : Number(texto) })
    if (r.error) { setErrores(p => ({ ...p, [key]: r.error })); onToast(`⚠️ ${est.nombre_completo}: ${r.error}`); return }
    setErrores(p => { const n = { ...p }; delete n[key]; return n })
    setDatos(prev => {
      const info = prev.porEstudiante[est.id] || { puntos: {} }
      const puntos = { ...info.puntos }
      if (texto === '') delete puntos[ev.id]; else puntos[ev.id] = Number(texto)
      return { ...prev, porEstudiante: { ...prev.porEstudiante, [est.id]: { ...info, puntos, nota: r.nota, distribucion: r.distribucion, estado: r.estado } } }
    })
    if (r.estado === 'completa') onToast(`✓ ${est.nombre_completo} · ${actividad.nombre.split(' — ')[0]} → nota ${fmt(r.nota)}`)
  }

  // Enter baja a la misma evidencia del siguiente estudiante, como al pasar del cuaderno.
  function teclado(e, fila, col) {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const dest = e.key === 'ArrowUp' ? fila - 1 : fila + 1
    const sig = tablaRef.current?.querySelector(`input[data-f="${dest}"][data-c="${col}"]`)
    if (sig) sig.focus(); else e.currentTarget.blur()
  }

  async function cerrarPendientes() {
    const afectados = nPend + nVacio
    if (afectados === 0) { onToast('No hay pendientes'); return }
    if (!window.confirm(`Se pondrá 0 en las evidencias que faltan a ${afectados} estudiante(s) de ${actividad.nombre}.\n\nLos que tienen todo anotado y los que tienen nota escrita a mano no cambian. ¿Continuar?`)) return
    setCerrando(true)
    const r = await window.api.invoke('cerrar-pendientes-evidencias', actividad.id)
    setCerrando(false)
    if (r.error) { onToast('⚠️ ' + r.error); return }
    onToast(`✓ ${r.completados} estudiante(s) completados con 0`)
    cargar()
  }

  const chip = (key, label, lista) => {
    const on = grupo === key
    const listos = lista.filter(e => estadoDe(e.id) === 'completa' || estadoDe(e.id) === 'directa').length
    return (
      <button key={String(key)} onClick={() => setGrupo(key)} style={{ padding:'5px 12px', borderRadius:16, fontSize:12, fontWeight:700, cursor:'pointer',
        border:'1.5px solid '+(on ? colPer : '#DDE3ED'), background: on ? colPer : '#fff', color: on ? '#fff' : '#1B3A6B' }}>
        {label} <span style={{ opacity:.75, fontWeight:600 }}>{listos}/{lista.length}</span>
      </button>
    )
  }

  const btn = (color) => ({ padding:'7px 14px', borderRadius:8, border:'1px solid '+color, fontSize:12, fontWeight:700, background:'transparent', color, cursor:'pointer' })
  const th = { padding:'6px 8px', fontSize:11, fontWeight:700, textAlign:'center', borderBottom:'1px solid #DDE3ED' }

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, flexWrap:'wrap' }}>
        <button onClick={onVolver} style={{ padding:'7px 14px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:12, cursor:'pointer', color:'#1B3A6B', fontWeight:600 }}>← Volver</button>
        <div>
          <div style={{ fontWeight:700, fontSize:15, color:'#1B3A6B' }}>📋 {actividad.nombre}</div>
          <div style={{ fontSize:12, color:'#888' }}>Por evidencias · Peso {actividad.peso} · escribe los puntos del plan; la nota se calcula sola</div>
        </div>
        <div style={{ flex:1 }} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={() => onImprimir(false)} style={btn('#1B3A6B')}>🖨️ Planilla en blanco</button>
          <button onClick={() => onImprimir(true)}  style={btn('#1B3A6B')}>🖨️ Planilla llena</button>
          <button onClick={cerrarPendientes} disabled={cerrando} style={btn('#C84B00')}>{cerrando ? '⏳' : '0️⃣'} Pendientes → 0</button>
          <button onClick={onVerDirectas} title="Ver o escribir la nota final sin evidencias" style={btn('#888')}>✏️ Notas directas</button>
        </div>
      </div>

      {/* Estado */}
      <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap', fontSize:12, fontWeight:700 }}>
        <span style={{ background:'#D6EEE0', color:'#1A6B3A', padding:'4px 10px', borderRadius:12 }}>✓ {nListos} con nota</span>
        {nPend > 0   && <span style={{ background:'#FDECD7', color:'#C84B00', padding:'4px 10px', borderRadius:12 }}>⚠️ {nPend} pendientes (no cuentan)</span>}
        {nVacio > 0  && <span style={{ background:'#F4F4F4', color:'#888', padding:'4px 10px', borderRadius:12 }}>{nVacio} sin anotar</span>}
        {nDirecta > 0 && <span style={{ background:'#EDE0F7', color:'#5C2D91', padding:'4px 10px', borderRadius:12 }}>✏️ {nDirecta} con nota escrita a mano</span>}
      </div>

      {gruposDisp.length > 0 && (
        <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
          {chip(null, 'Todos', estudiantes)}
          {gruposDisp.map(g => chip(g, 'G' + g, estudiantes.filter(e => e.grupo_trabajo === g)))}
          {haySinGrupo && chip('sin', 'Sin grupo', estudiantes.filter(e => e.grupo_trabajo == null))}
        </div>
      )}

      <div ref={tablaRef} style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', width:'100%', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#F8FAFD' }}>
              <th rowSpan={2} style={{ ...th, width:34 }}>#</th>
              <th rowSpan={2} style={{ ...th, textAlign:'left' }}>Estudiante</th>
              {grupos.map(g => (
                <th key={g.key} colSpan={g.evidencias.length} style={{ ...th, color:g.color, background:g.color+'14', borderLeft:'2px solid #fff' }}>{g.icono} {g.label}</th>
              ))}
              {competencias.map(c => (
                <th key={'r'+c.key} rowSpan={2} style={{ ...th, color:c.color, minWidth:52, borderLeft: c === competencias[0] ? '2px solid #DDE3ED' : undefined }}
                  title={compsAct.includes(c.key) ? `Nota en la app (máx. ${fmt(techo)})` : 'Esta actividad no califica esta competencia'}>
                  {c.icono}<br/>{c.label.slice(0,3)}{compsAct.includes(c.key) && <div style={{ fontWeight:400, color:'#AAB4C4' }}>/{fmt(techo)}</div>}
                </th>
              ))}
              <th rowSpan={2} style={{ ...th, minWidth:56 }}>Nota</th>
            </tr>
            <tr style={{ background:'#F8FAFD' }}>
              {evidenciasOrden.map(ev => (
                <th key={ev.id} title={`${ev.nombre}\n${ev.instrumento}`} style={{ ...th, fontWeight:600, color:'#1B3A6B', maxWidth:130 }}>
                  <div>{ev.sesion}</div>
                  <div style={{ fontWeight:400, color:'#666', fontSize:10, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:130 }}>{ev.nombre}</div>
                  <div style={{ color:'#AAB4C4' }}>/{fmt(ev.puntos)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((est, fila) => {
              const info = datos.porEstudiante[est.id] || { puntos:{}, estado:'vacia' }
              const est_ = info.estado
              return (
                <tr key={est.id} style={{ borderBottom:'1px solid #F0F4FA', background: est_ === 'pendiente' ? '#FFFBF3' : 'transparent' }}>
                  <td style={{ textAlign:'center', color:'#AAB4C4', fontSize:12 }}>{est.numero_lista || ''}</td>
                  <td style={{ padding:'4px 8px', fontWeight:600, color:'#1B3A6B', whiteSpace:'nowrap' }}>{est.nombre_completo}</td>
                  {evidenciasOrden.map((ev, col) => {
                    const key = `${est.id}-${ev.id}`
                    const err = errores[key]
                    return (
                      <td key={ev.id} style={{ padding:'3px 4px', textAlign:'center' }}>
                        <input value={valores[key] ?? ''} inputMode="decimal" data-f={fila} data-c={col}
                          title={err || `${ev.nombre} — máximo ${fmt(ev.puntos)}`}
                          onChange={e => { const v = e.target.value; setValores(p => ({ ...p, [key]: v })); if (err) setErrores(p => { const n = { ...p }; delete n[key]; return n }) }}
                          onBlur={() => guardar(est, ev)} onKeyDown={e => teclado(e, fila, col)}
                          style={{ width:52, padding:'5px 4px', textAlign:'center', fontSize:13, fontWeight:700, borderRadius:6, outline:'none',
                            border:'1.5px solid '+(err ? '#B71C1C' : '#DDE3ED'), background: err ? '#FDDFDF' : '#fff', color:'#1B3A6B' }} />
                      </td>
                    )
                  })}
                  {competencias.map(c => {
                    const activa = compsAct.includes(c.key)
                    let val = '—'
                    if (activa && info.nota != null) val = actividad.modo === 'multi' ? fmt(info.distribucion?.[c.key]) : fmt(info.nota)
                    else if (activa) val = ''
                    return <td key={c.key} style={{ textAlign:'center', color: activa ? c.color : '#CCC', fontWeight:700, borderLeft: c === competencias[0] ? '2px solid #EEF2F7' : undefined }}>{val}</td>
                  })}
                  <td style={{ textAlign:'center', fontWeight:900, fontSize:14 }}>
                    {info.nota != null ? <span style={{ color:'#1B3A6B' }}>{fmt(info.nota)}</span>
                      : est_ === 'pendiente' ? <span style={{ fontSize:11, fontWeight:700, color:'#C84B00' }}>pendiente</span>
                      : <span style={{ color:'#CCC' }}>—</span>}
                    {est_ === 'directa' && <span title="Nota escrita a mano" style={{ fontSize:10, marginLeft:4 }}>✏️</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize:11, color:'#888', marginTop:8 }}>
        Enter o ↓ baja al siguiente estudiante. Si falta una evidencia, la semana queda <b>pendiente</b> y no cuenta en el promedio hasta completarla (o usar "Pendientes → 0").
      </p>
    </div>
  )
}
