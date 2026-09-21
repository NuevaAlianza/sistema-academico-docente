import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useModalTransition } from '../hooks/useModalTransition'

// ── Semáforo ──────────────────────────────────────────────────
const SEM = {
  verde:    { bg:'#D6EEE0', color:'#1A6B3A', border:'#A8D4B8' },
  amarillo: { bg:'#FFF8D6', color:'#7A5C00', border:'#D4B820' },
  rojo:     { bg:'#FDECD7', color:'#C84B00', border:'#E8A878' },
  sin_nota: { bg:'#F4F4F4', color:'#999',    border:'#DDD'    },
  sin_dato: { bg:'#F4F4F4', color:'#999',    border:'#DDD'    },
}
function Pill({ estado, label }) {
  const s = SEM[estado] || SEM.sin_nota
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:10,
      background:s.bg, color:s.color, border:`1px solid ${s.border}`, whiteSpace:'nowrap' }}>
      {label}
    </span>
  )
}

// ── Estados de asistencia ─────────────────────────────────────
const ASIST = {
  presente:  { label:'P', bg:'#D1FAE5', color:'#065F46', title:'Presente'  },
  ausente:   { label:'A', bg:'#FEE2E2', color:'#9B1C1C', title:'Ausente'   },
  tardanza:  { label:'T', bg:'#FEF3C7', color:'#92400E', title:'Tardanza'  },
  excusado:  { label:'E', bg:'#DBEAFE', color:'#1E40AF', title:'Excusado'  },
}

// ── Estados de tema ───────────────────────────────────────────
const TEMA_EST = {
  pendiente:  { icon:'⬜', label:'Pendiente', color:'#888'    },
  realizado:  { icon:'✅', label:'Realizado', color:'#065F46' },
  tarea:      { icon:'📌', label:'Tarea',     color:'#92400E' },
  aplazado:   { icon:'🔄', label:'Aplazado',  color:'#1E40AF' },
}

export default function CursoEspacio({ anio, materia }) {
  const { cursoId }  = useParams()
  const location     = useLocation()
  const nav          = useNavigate()
  const materiaId    = materia?.id || null
  const id           = parseInt(cursoId)
  const color        = materia?.color || '#1B3A6B'

  // ── Estado general ────────────────────────────────────────
  const [curso,        setCurso]        = useState(location.state?.curso || null)
  const [periodos,     setPeriodos]     = useState([])
  const [perSel,       setPerSel]       = useState(null)
  const [toast,        setToast]        = useState(null)
  const [tabActivo,    setTabActivo]    = useState('clase')
  const autoSaveTimer = useRef(null)

  // ── Bloque: Asistencia ────────────────────────────────────
  const hoy = new Date().toISOString().slice(0, 10)
  const [estudiantes,  setEstudiantes]  = useState([])
  const [asistencia,   setAsistencia]   = useState({})   // { estId: 'P'|'A'|'T'|'E' }
  const [marcandoTodos,setMarcandoTodos]= useState(false)

  // ── Bloque: Tema del día ──────────────────────────────────
  const [temaDia,      setTemaDia]      = useState(null)
  const [cambiandoEst, setCambiandoEst] = useState(false)


  // ── Bloque: Nota rápida estudiante ────────────────────────
  const [popupNota,    setPopupNota]    = useState(null) // { est }
  const popupNotaT = useModalTransition(popupNota)
  const [notaTxt,      setNotaTxt]      = useState('')
  const [guardandoNota,setGuardandoNota]= useState(false)

  // ── Bloque: Nota rápida curso ─────────────────────────────
  const [notaRapida,   setNotaRapida]   = useState('')
  const [notaGuardada, setNotaGuardada] = useState('')

  // ── Bloque: Participación ─────────────────────────────────
  const [grupoSel,     setGrupoSel]     = useState('todos')  // 'todos' | 'sin' | número
  const [partic,       setPartic]       = useState({})       // { estId: { hoy, periodo } }
  const [popupPunt,    setPopupPunt]    = useState(null)     // { ids, titulo }
  const [puntosTxt,    setPuntosTxt]    = useState('')
  const [motivoTxt,    setMotivoTxt]    = useState('')
  const [histPunt,     setHistPunt]     = useState(null)     // { est, items }

  // ── Bloque: Semáforo ──────────────────────────────────────
  const [semaforo,    setSemaforo]     = useState([])
  const [sinNota,      setSinNota]      = useState(null)
  const [cargandoSem,  setCargandoSem]  = useState(false)
  const [tabSem,       setTabSem]       = useState('semaforo')

  // ── Bloque: Cuaderno ──────────────────────────────────────
  const [anotaciones,  setAnotaciones]  = useState([])
  const [nuevaAnot,    setNuevaAnot]    = useState('')
  const [guardando,    setGuardando]    = useState(false)

  // ─────────────────────────────────────────────────────────
  // CARGA INICIAL
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !anio) return

    // Curso
    if (!curso) {
      window.api.invoke('get-cursos', anio.id).then(cs => {
        const c = cs.find(x => x.id === id); if (c) setCurso(c)
      })
    }

    // Estudiantes
    window.api.invoke('get-estudiantes', id).then(ests => {
      setEstudiantes(ests.filter(e => e.estado !== 'inactivo'))
    })

    // Asistencia hoy
    window.api.invoke('get-asistencia-dia', id, hoy, materiaId).then(data => {
      const map = {}
      if (Array.isArray(data)) data.forEach(r => { map[r.id] = r.asistencia })
      setAsistencia(map)
    })

    // Nota rápida curso
    window.api.invoke('get-curso-nota', id, materiaId).then(txt => {
      setNotaRapida(txt); setNotaGuardada(txt)
    })

    // Cuaderno
    window.api.invoke('get-curso-anotaciones', id, materiaId).then(setAnotaciones)

    // Períodos
    window.api.invoke('get-periodos', anio.id).then(ps => {
      setPeriodos(ps)
      const abierto = ps.find(p => p.estado === 'abierto') || ps[ps.length - 1]
      if (abierto) setPerSel(abierto)
    })
  }, [id, materiaId, anio])

  // ── Tema del día y participación cuando cambia período ────
  useEffect(() => {
    if (!id || !perSel?.id || !materiaId) return
    cargarTemaDia()
    cargarSemaforo()
    cargarParticipacion()
  }, [id, perSel?.id, materiaId])

  async function cargarParticipacion() {
    const r = await window.api.invoke('get-participacion-resumen', id, perSel.id, materiaId, hoy)
    setPartic(r || {})
  }

  async function sumarPuntos(ids, puntos, motivo = '') {
    if (!perSel?.id || !materiaId) { showToast('Selecciona una materia y período'); return }
    const r = await window.api.invoke('add-participaciones', {
      cursoId: id, periodoId: perSel.id, materiaId, temaId: temaDia?.id || null,
      fecha: hoy, puntos, motivo, estudianteIds: ids,
    })
    if (r?.error) { showToast('⚠️ ' + r.error); return }
    await cargarParticipacion()
    cargarSemaforo()
  }

  async function deshacerPuntos(estId) {
    await window.api.invoke('deshacer-participacion', estId, id, perSel.id, materiaId, hoy)
    await cargarParticipacion()
    cargarSemaforo()
  }

  async function confirmarPuntos() {
    const n = parseInt(puntosTxt, 10)
    if (!Number.isInteger(n) || n === 0 || !popupPunt) return
    await sumarPuntos(popupPunt.ids, n, motivoTxt)
    showToast(`${n > 0 ? '+' : ''}${n} → ${popupPunt.titulo}`)
    setPopupPunt(null)
  }

  async function verHistorialPuntos(est) {
    const items = await window.api.invoke('get-historial-participacion', est.id, id, perSel.id, materiaId)
    setHistPunt({ est, items: Array.isArray(items) ? items : [] })
  }

  function abrirPuntos(ids, titulo) { setPopupPunt({ ids, titulo }); setPuntosTxt(''); setMotivoTxt('') }

  async function cargarTemaDia() {
    if (!perSel?.id || !materiaId) return
    const temas = await window.api.invoke('get-temas', id, perSel.id, materiaId)
    const pendiente = temas.find(t => t.estado === 'pendiente' || t.estado === 'aplazado')
    setTemaDia(pendiente || null)
  }

  async function cargarSemaforo() {
    setCargandoSem(true)
    const [sem, sn] = await Promise.all([
      window.api.invoke('get-semaforo-estudiantes', id, perSel.id, materiaId),
      window.api.invoke('get-estudiantes-sin-nota', id, perSel.id, materiaId),
    ])
    setSemaforo(Array.isArray(sem) ? sem : [])
    setSinNota(sn || null)
    setCargandoSem(false)
  }

  // ── Auto-guardar nota rápida ──────────────────────────────
  useEffect(() => {
    if (notaRapida === notaGuardada) return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      await window.api.invoke('set-curso-nota', id, notaRapida, materiaId)
      setNotaGuardada(notaRapida)
    }, 800)
    return () => clearTimeout(autoSaveTimer.current)
  }, [notaRapida])

  // ─────────────────────────────────────────────────────────
  // ACCIONES
  // ─────────────────────────────────────────────────────────

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2200) }

  // Asistencia
  async function marcarAsistencia(estId, estado) {
    await window.api.invoke('set-asistencia', {
      estudianteId: estId, cursoId: id,
      fecha: hoy, estado, materiaId,
    })
    setAsistencia(prev => ({ ...prev, [estId]: estado }))
  }

  async function marcarTodosPresente() {
    // Si ya hay ausentes o tardanzas, pedir confirmación
    const conMarca = Object.values(asistencia).filter(v => v === 'ausente' || v === 'tardanza' || v === 'excusado').length
    if (conMarca > 0) {
      const ok = window.confirm(
        `⚠️ Ya tienes ${conMarca} estudiante(s) marcado(s) como ausente/tardanza/excusado.\n\n` +
        `¿Marcar a TODOS como presentes? Esto sobreescribirá esas marcas y no se puede deshacer.`
      )
      if (!ok) return
    } else if (Object.keys(asistencia).length > 0) {
      // Ya están todos marcados como presentes
      showToast('✅ Todos ya están marcados como presentes')
      return
    }

    setMarcandoTodos(true)
    for (const est of estudiantes) {
      await window.api.invoke('set-asistencia', {
        estudianteId: est.id, cursoId: id,
        fecha: hoy, estado: 'presente', materiaId,
      })
    }
    // Recargar desde la BD para sincronizar
    const data = await window.api.invoke('get-asistencia-dia', id, hoy, materiaId)
    const map = {}; data.forEach(r => { map[r.id] = r.asistencia })
    setAsistencia(map)
    setMarcandoTodos(false)
    showToast('✅ Todos marcados como presentes')
  }

  // Tema del día
  async function cambiarEstadoTema(nuevoEstado) {
    if (!temaDia) return
    setCambiandoEst(true)
    await window.api.invoke('update-tema', temaDia.id, {
      titulo:          temaDia.titulo,
      estado:          nuevoEstado,
      contenido_texto: temaDia.contenido_texto || '',
      fecha_realizado: nuevoEstado === 'realizado' ? new Date().toISOString().slice(0,10) : temaDia.fecha_realizado || null,
      fecha_aplazado:  nuevoEstado === 'aplazado'  ? new Date().toISOString().slice(0,10) : temaDia.fecha_aplazado  || null,
    })
    showToast(`Tema marcado como ${TEMA_EST[nuevoEstado]?.label}`)
    await cargarTemaDia()
    setCambiandoEst(false)
  }

  // Nota de estudiante
  function abrirNotaEst(est) {
    setPopupNota(est); setNotaTxt('')
  }
  async function guardarNotaEst() {
    if (!notaTxt.trim() || !popupNota) return
    setGuardandoNota(true)
    await window.api.invoke('create-observacion', {
      estudianteId: popupNota.id, fecha: hoy, texto: notaTxt.trim(), tipo: 'general',
    })
    setGuardandoNota(false)
    setPopupNota(null)
    showToast(`📝 Nota guardada para ${popupNota.nombre_completo.split(' ')[0]}`)
  }

  // Cuaderno
  async function agregarAnotacion() {
    const txt = nuevaAnot.trim(); if (!txt) return
    setGuardando(true)
    await window.api.invoke('add-curso-anotacion', id, txt, materiaId)
    setAnotaciones(await window.api.invoke('get-curso-anotaciones', id, materiaId))
    setNuevaAnot(''); setGuardando(false); showToast('📝 Anotación guardada')
  }
  async function eliminarAnotacion(anotId) {
    await window.api.invoke('del-curso-anotacion', anotId)
    setAnotaciones(prev => prev.filter(a => a.id !== anotId))
  }

  // Navegación
  function irA(path) {
    nav(`${path}?cursoId=${id}`, { state: { cursoId: id, curso } })
  }

  // Stats rápidos
  const presentes   = Object.values(asistencia).filter(v => v === 'presente').length
  const ausentes    = Object.values(asistencia).filter(v => v === 'ausente').length
  const sinMarcar   = estudiantes.length - Object.keys(asistencia).length
  const enRiesgo    = semaforo.filter(e => e.en_riesgo).length
  const sinNotaCnt  = sinNota?.sin_nota?.length ?? 0
  const gruposDisp  = [...new Set(estudiantes.map(e => e.grupo_trabajo).filter(g => g != null))].sort((a, b) => a - b)
  const hayGrupos   = gruposDisp.length > 0
  const haySinGrupo= estudiantes.some(e => e.grupo_trabajo == null)
  const visibles    = estudiantes.filter(e =>
    grupoSel === 'todos' ? true : grupoSel === 'sin' ? e.grupo_trabajo == null : e.grupo_trabajo === grupoSel)
  const fmtPts = n => (n > 0 ? '+' : '') + n
  const colorPts = n => n > 0 ? '#065F46' : n < 0 ? '#9B1C1C' : '#AAB4C4'

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth:980 }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <button onClick={() => nav('/cursos')}
          style={{ padding:'7px 14px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:12, cursor:'pointer', color:'#1B3A6B', fontWeight:600 }}>
          ← Volver
        </button>
        {curso && (
          <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
            <div style={{ width:12, height:12, borderRadius:'50%', background:color }} />
            <h1 style={{ fontSize:20, color:'#1B3A6B', margin:0 }}>{curso.nombre}</h1>
            {curso.grado && <span style={{ fontSize:13, color:'#888' }}>{curso.grado}{curso.seccion ? ' · '+curso.seccion : ''}</span>}
            {materia && (
              <span style={{ background:color+'20', color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, border:`1px solid ${color}40` }}>
                {materia.nombre}
              </span>
            )}
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:'#888' }}>Período:</span>
          <select value={perSel?.id||''} onChange={e => { const p=periodos.find(x=>x.id===parseInt(e.target.value)); if(p) setPerSel(p) }}
            style={{ fontSize:12, padding:'5px 8px', border:'1px solid #DDE3ED', borderRadius:6, color:'#1B3A6B' }}>
            {periodos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* ── TABS ───────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderRadius:10, overflow:'hidden', border:'1.5px solid #DDE3ED', width:'fit-content' }}>
        {[
          { key:'clase',    icon:'🎯', label:'Clase de hoy' },
          { key:'espacio',  icon:'📌', label:'Espacio'      },
          { key:'semaforo', icon:'🚦', label:'Estado'       },
          { key:'cuaderno', icon:'📓', label:'Cuaderno'     },
        ].map(t => (
          <button key={t.key} onClick={() => setTabActivo(t.key)} style={{
            padding:'8px 18px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
            background: tabActivo===t.key ? color : '#fff',
            color:      tabActivo===t.key ? '#fff' : '#555',
            borderRight: '1px solid #DDE3ED',
            transition: 'all .12s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* TAB: CLASE DE HOY                                   */}
      {/* ════════════════════════════════════════════════════ */}
      {tabActivo === 'clase' && (
        <div>
          {/* Fecha */}
          <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>
            📅 {new Date().toLocaleDateString('es-DO', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </div>

          {/* TEMA DEL DÍA */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', marginBottom:16, overflow:'hidden' }}>
            <div style={{ background:color, padding:'10px 16px', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:16 }}>📋</span>
              <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>Tema del día</span>
            </div>
            <div style={{ padding:16 }}>
              {!temaDia ? (
                <div style={{ color:'#AAA', fontSize:13, fontStyle:'italic', textAlign:'center', padding:'12px 0' }}>
                  ✅ No hay temas pendientes en este período
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#1B3A6B', marginBottom:10 }}>
                    {TEMA_EST[temaDia.estado]?.icon} {temaDia.titulo}
                  </div>
                  {temaDia.contenido_texto && (
                    <div style={{ fontSize:12, color:'#666', marginBottom:12, lineHeight:1.5 }}>
                      {temaDia.contenido_texto.slice(0, 120)}{temaDia.contenido_texto.length > 120 ? '...' : ''}
                    </div>
                  )}
                  {/* Plan de clase inline */}
                  {temaDia.meta_json && (() => {
                    let plan = null
                    try { plan = typeof temaDia.meta_json === 'string' ? JSON.parse(temaDia.meta_json) : temaDia.meta_json } catch {}
                    if (!plan) return null
                    const TBG2 = {I:'#E0F7FA', D:'#E8F5E9', C:'#FFF3E0'}
                    const TFG2 = {I:'#006064', D:'#1B5E20', C:'#E65100'}
                    const TLB2 = {I:'Inicio', D:'Desarrollo', C:'Cierre'}
                    return (
                      <div style={{ marginTop:14, borderTop:'1px solid #E8EDF5', paddingTop:14 }}>
                        {/* Competencia e indicadores */}
                        {(plan.competencia || plan.indicadores?.length > 0) && (
                          <div style={{ marginBottom:10, fontSize:12, color:'#555', lineHeight:1.6 }}>
                            {plan.competencia && <div><strong>Competencia:</strong> {plan.competencia}</div>}
                            {plan.indicadores?.length > 0 && <div><strong>Indicadores:</strong> {plan.indicadores.join(' · ')}</div>}
                          </div>
                        )}
                        {/* Secuencia */}
                        {plan.actividades?.some(a => a.pasos?.some(p => p)) && (
                          <div style={{ marginBottom:10 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:color, letterSpacing:.8, textTransform:'uppercase', marginBottom:8 }}>Secuencia de clase</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                              {plan.actividades.map((a, i) => a.pasos?.some(p => p) && (
                                <div key={i} style={{ background:TBG2[a.tipo]||'#F5F5F5', borderRadius:8, padding:'8px 12px' }}>
                                  <div style={{ fontSize:11, fontWeight:700, color:TFG2[a.tipo], marginBottom:5 }}>
                                    {TLB2[a.tipo]||a.tipo} — {a.titulo}
                                  </div>
                                  <ul style={{ paddingLeft:16, margin:0 }}>
                                    {a.pasos.filter(p => p).map((p, j) => (
                                      <li key={j} style={{ fontSize:12, lineHeight:1.7 }}>{p}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Actividades cuaderno */}
                        {plan.actividades_cuaderno?.some(c => c.instruccion) && (
                          <div style={{ marginBottom:10 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#1B3A6B', letterSpacing:.8, textTransform:'uppercase', marginBottom:6 }}>Cuaderno</div>
                            {plan.actividades_cuaderno.filter(c => c.instruccion).map((c, i) => (
                              <div key={i} style={{ background:'#F8F9FA', borderLeft:'4px solid #1B3A6B', padding:'8px 12px', borderRadius:'0 6px 6px 0', marginBottom:5, fontSize:12, lineHeight:1.6 }}>
                                <strong style={{ color:'#1B3A6B' }}>{i+1}.</strong> {c.instruccion}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Metacognición */}
                        {plan.metacognicion && (
                          <div style={{ background:'#FFF8DC', borderLeft:'4px solid #7B5800', padding:'8px 12px', borderRadius:'0 6px 6px 0', fontSize:12, lineHeight:1.6 }}>
                            <strong style={{ color:'#7B5800' }}>Reflexión: </strong>{plan.metacognicion}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {Object.entries(TEMA_EST).map(([k, v]) => (
                      <button key={k} disabled={cambiandoEst || temaDia.estado===k}
                        onClick={() => cambiarEstadoTema(k)}
                        style={{
                          padding:'6px 14px', borderRadius:20, border:'1.5px solid',
                          fontSize:12, fontWeight:600, cursor: temaDia.estado===k ? 'default' : 'pointer',
                          background: temaDia.estado===k ? color : '#fff',
                          color:      temaDia.estado===k ? '#fff' : '#555',
                          borderColor: temaDia.estado===k ? color : '#DDE3ED',
                          opacity: cambiandoEst ? .6 : 1,
                        }}>
                        {v.icon} {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* LISTA DE ESTUDIANTES */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', overflow:'hidden' }}>
            {/* Header lista */}
            <div style={{ padding:'10px 16px', borderBottom:'1px solid #E8EDF5', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div>
                <span style={{ fontWeight:700, color:'#1B3A6B', fontSize:14 }}>
                  👥 Estudiantes — {estudiantes.length}
                </span>
                <span style={{ marginLeft:12, fontSize:12, color:'#888' }}>
                  Presentes: <strong style={{ color:'#065F46' }}>{presentes}</strong>
                  {ausentes > 0 && <> · Ausentes: <strong style={{ color:'#9B1C1C' }}>{ausentes}</strong></>}
                  {sinMarcar > 0 && <> · <strong style={{ color:'#92400E' }}>{sinMarcar} sin marcar</strong></>}
                </span>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>

                <button onClick={marcarTodosPresente} disabled={marcandoTodos}
                  style={{ padding:'6px 14px', background:color+'15', color, border:`1.5px solid ${color}40`, borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  {marcandoTodos ? 'Marcando...' : '✓ Todos presentes'}
                </button>
              </div>
            </div>

            {/* Filtro por grupo + acciones de grupo */}
            {hayGrupos && (
              <div style={{ padding:'8px 16px', borderBottom:'1px solid #E8EDF5', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:11, color:'#888', marginRight:2 }}>Grupo:</span>
                {[['todos','Todos'], ...gruposDisp.map(g => [g, 'G'+g]), ...(haySinGrupo ? [['sin','Sin grupo']] : [])].map(([k,l]) => (
                  <button key={k} onClick={() => setGrupoSel(k)} style={{
                    padding:'4px 12px', borderRadius:14, fontSize:12, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                    background: grupoSel===k ? color : '#fff', color: grupoSel===k ? '#fff' : '#555', borderColor: grupoSel===k ? color : '#DDE3ED',
                  }}>{l}</button>
                ))}
                {typeof grupoSel === 'number' && (
                  <span style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                    <button onClick={async () => { await sumarPuntos(visibles.map(e=>e.id), 1); showToast(`+1 → G${grupoSel} (${visibles.length})`) }}
                      style={{ padding:'4px 12px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', background:'#D1FAE5', color:'#065F46', border:'1.5px solid #6EE7B7' }}>+1 al grupo</button>
                    <button onClick={() => abrirPuntos(visibles.map(e=>e.id), `G${grupoSel} (${visibles.length})`)}
                      style={{ padding:'4px 12px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', background:'#F8FAFD', color:'#555', border:'1.5px solid #DDE3ED' }}>± grupo…</button>
                  </span>
                )}
              </div>
            )}

            {/* Columnas header */}
            <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 160px 200px 40px', gap:6, padding:'7px 16px', background:'#F8FAFD', borderBottom:'1px solid #E8EDF5' }}>
              {['#','Estudiante','Asistencia','Participación hoy / período',''].map((h,i) => (
                <div key={i} style={{ fontSize:10, fontWeight:700, color:'#AAB4C4', textAlign: i >= 2 ? 'center' : 'left' }}>{h}</div>
              ))}
            </div>

            {/* Filas */}
            <div style={{ maxHeight:420, overflowY:'auto' }}>
              {visibles.length === 0 && <div style={{ padding:24, textAlign:'center', color:'#AAA', fontStyle:'italic', fontSize:13 }}>Sin estudiantes en este grupo.</div>}
              {visibles.map((est, idx) => {
                const est_asist = asistencia[est.id] || null
                const p = partic[est.id] || { hoy:0, periodo:0 }
                return (
                  <div key={est.id} style={{
                    display:'grid', gridTemplateColumns:'36px 1fr 160px 200px 40px',
                    gap:6, padding:'9px 16px', alignItems:'center',
                    borderBottom: idx < visibles.length-1 ? '1px solid #F0F4FA' : 'none',
                    background: idx%2===0 ? '#fff' : '#FAFBFD',
                  }}>
                    {/* Número */}
                    <span style={{ fontSize:12, color:'#AAA', fontWeight:600 }}>{est.numero_lista || idx+1}</span>

                    {/* Nombre */}
                    <span style={{ fontSize:13, color:'#1B3A6B', fontWeight:500 }}>
                      {est.nombre_completo}
                    </span>

                    {/* Asistencia */}
                    <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                      {Object.entries(ASIST).map(([k, v]) => (
                        <button key={k} title={v.title}
                          onClick={() => marcarAsistencia(est.id, k)}
                          style={{
                            width:28, height:28, borderRadius:6, border:'1.5px solid',
                            fontSize:11, fontWeight:700, cursor:'pointer',
                            background: est_asist===k ? v.bg     : '#F8FAFD',
                            color:      est_asist===k ? v.color  : '#CCC',
                            borderColor:est_asist===k ? v.color  : '#E2E8F0',
                            transition: 'all .1s',
                          }}>
                          {v.label}
                        </button>
                      ))}
                    </div>

                    {/* Participación */}
                    <div style={{ display:'flex', gap:4, alignItems:'center', justifyContent:'center' }}>
                      <button title="Restar 1" onClick={() => sumarPuntos([est.id], -1)}
                        style={{ width:26, height:26, borderRadius:6, border:'1.5px solid #FCA5A5', background:'#FEE2E2', color:'#9B1C1C', fontSize:14, fontWeight:700, cursor:'pointer', lineHeight:1 }}>−</button>
                      <button title="Sumar 1" onClick={() => sumarPuntos([est.id], 1)}
                        style={{ width:26, height:26, borderRadius:6, border:'1.5px solid #6EE7B7', background:'#D1FAE5', color:'#065F46', fontSize:14, fontWeight:700, cursor:'pointer', lineHeight:1 }}>+</button>
                      <button title="Otra cantidad / motivo" onClick={() => abrirPuntos([est.id], est.nombre_completo.split(' ').slice(0,2).join(' '))}
                        style={{ width:26, height:26, borderRadius:6, border:'1px solid #E2E8F0', background:'#F8FAFD', color:'#888', fontSize:11, fontWeight:700, cursor:'pointer' }}>±</button>
                      <span style={{ minWidth:64, textAlign:'center', fontSize:12, fontWeight:700, color:colorPts(p.hoy) }} title="Hoy / acumulado del período">
                        {fmtPts(p.hoy)} <span style={{ color:'#CCC', fontWeight:400 }}>/</span> <span style={{ color:colorPts(p.periodo) }}>{fmtPts(p.periodo)}</span>
                      </span>
                      {p.hoy !== 0 && (
                        <button title="Deshacer el último de hoy" onClick={() => deshacerPuntos(est.id)}
                          style={{ width:22, height:22, border:'none', background:'transparent', color:'#AAB4C4', fontSize:13, cursor:'pointer' }}>↶</button>
                      )}
                    </div>

                    {/* Nota estudiante */}
                    <button title="Agregar nota" onClick={() => abrirNotaEst(est)}
                      style={{ width:28, height:28, borderRadius:6, border:'1px solid #E2E8F0', background:'#F8FAFD', color:'#AAA', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                      onMouseEnter={e => { e.currentTarget.style.background=color+'15'; e.currentTarget.style.color=color }}
                      onMouseLeave={e => { e.currentTarget.style.background='#F8FAFD'; e.currentTarget.style.color='#AAA' }}>
                      ✏
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* TAB: ESPACIO (nota rápida del curso)                */}
      {/* ════════════════════════════════════════════════════ */}
      {tabActivo === 'espacio' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16 }}>
          {/* Nota rápida */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', overflow:'hidden' }}>
            <div style={{ background:color, padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>📌 Nota rápida</div>
                <div style={{ color:'rgba(255,255,255,0.7)', fontSize:11, marginTop:2 }}>¿Dónde quedé la clase anterior?</div>
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)' }}>
                {notaRapida !== notaGuardada ? '● guardando...' : '✓ guardado'}
              </div>
            </div>
            <div style={{ padding:16 }}>
              <textarea value={notaRapida} onChange={e => setNotaRapida(e.target.value)}
                placeholder="Ej: Quedamos en el tema 3 — Familia y valores..."
                rows={8}
                style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'10px 12px', fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', lineHeight:1.6 }}
                onFocus={e => e.target.style.borderColor=color}
                onBlur={e  => e.target.style.borderColor='#DDE3ED'} />
              <div style={{ fontSize:11, color:'#AAA', marginTop:6 }}>Se guarda automáticamente</div>
            </div>
          </div>

          {/* Accesos rápidos */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', padding:'12px 16px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#AAB4C4', letterSpacing:1.2, marginBottom:10 }}>ACCESOS RÁPIDOS</div>
              {[
                { label:'✅ Asistencia completa', path:'/asistencia'    },
                { label:'📝 Calificaciones',      path:'/calificaciones' },
                { label:'📋 Temario completo',    path:'/temario'        },
                { label:'👥 Estudiantes',         path:'/estudiantes'    },
              ].map(a => (
                <button key={a.path} onClick={() => irA(a.path)} style={{
                  width:'100%', padding:'9px 12px', background:'#F8FAFD', border:'1.5px solid #DDE3ED',
                  borderRadius:8, fontSize:12, fontWeight:600, color:'#1B3A6B', cursor:'pointer',
                  textAlign:'left', display:'flex', justifyContent:'space-between', marginBottom:7,
                }}
                  onMouseEnter={e => { e.currentTarget.style.background=color+'15'; e.currentTarget.style.borderColor=color+'60' }}
                  onMouseLeave={e => { e.currentTarget.style.background='#F8FAFD'; e.currentTarget.style.borderColor='#DDE3ED' }}>
                  <span>{a.label}</span><span style={{ color:'#AAA' }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* TAB: SEMÁFORO                                       */}
      {/* ════════════════════════════════════════════════════ */}
      {tabActivo === 'semaforo' && (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', borderBottom:'1px solid #E8EDF5', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:0, borderRadius:8, overflow:'hidden', border:'1px solid #DDE3ED' }}>
              {[['semaforo','🚦 Estado'],['sinnota','📭 Sin nota']].map(([k,l]) => (
                <button key={k} onClick={() => setTabSem(k)} style={{ padding:'6px 14px', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', background:tabSem===k?color:'transparent', color:tabSem===k?'#fff':'#555' }}>
                  {l}{k==='sinnota' && sinNotaCnt>0 && <span style={{ marginLeft:5, background:'#C84B00', color:'#fff', borderRadius:10, fontSize:10, padding:'1px 6px' }}>{sinNotaCnt}</span>}
                </button>
              ))}
            </div>
          </div>

          {tabSem === 'semaforo' && (
            cargandoSem ? <div style={{ padding:32, textAlign:'center', color:'#AAA' }}><div className="spinner" style={{ margin:'0 auto 8px' }} />Cargando...</div>
            : semaforo.length === 0 ? <div className="content-fade-in" style={{ padding:32, textAlign:'center', color:'#AAA', fontStyle:'italic' }}>Sin datos para este período.</div>
            : <div className="content-fade-in">
                {hayGrupos && (
                  <div style={{ padding:'8px 18px', borderBottom:'1px solid #E8EDF5', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, color:'#888', marginRight:2 }}>Grupo:</span>
                    {[['todos','Todos'], ...gruposDisp.map(g => [g, 'G'+g]), ...(haySinGrupo ? [['sin','Sin grupo']] : [])].map(([k,l]) => (
                      <button key={k} onClick={() => setGrupoSel(k)} style={{
                        padding:'4px 12px', borderRadius:14, fontSize:12, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                        background: grupoSel===k ? color : '#fff', color: grupoSel===k ? '#fff' : '#555', borderColor: grupoSel===k ? color : '#DDE3ED',
                      }}>{l}</button>
                    ))}
                  </div>
                )}
                <div style={{ maxHeight:400, overflowY:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 54px 100px 110px 120px', gap:8, padding:'7px 18px', background:'#F8FAFD', borderBottom:'1px solid #E8EDF5' }}>
                  {['#','Estudiante','Grupo','Participación','Promedio','Asistencia'].map(h => <div key={h} style={{ fontSize:10, fontWeight:700, color:'#AAB4C4' }}>{h}</div>)}
                </div>
                {semaforo.filter(e => grupoSel === 'todos' ? true : grupoSel === 'sin' ? e.grupo_trabajo == null : e.grupo_trabajo === grupoSel).map((est, idx, arr) => (
                  <div key={est.id} style={{ display:'grid', gridTemplateColumns:'36px 1fr 54px 100px 110px 120px', gap:8, padding:'9px 18px', alignItems:'center', borderBottom:idx<arr.length-1?'1px solid #F0F4FA':'none', background:est.en_riesgo?'#FFF8F6':idx%2===0?'#fff':'#FAFBFD' }}>
                    <span style={{ fontSize:12, color:'#AAA', fontWeight:600 }}>{est.numero_lista||idx+1}</span>
                    <span style={{ fontSize:13, color:'#1B3A6B', fontWeight:est.en_riesgo?600:400 }}>{est.nombre_completo}{est.en_riesgo&&<span style={{ marginLeft:6 }}>⚠️</span>}</span>
                    <span style={{ fontSize:12, color:'#888', fontWeight:600 }}>{est.grupo_trabajo!=null?'G'+est.grupo_trabajo:'—'}</span>
                    <button title="Ver historial" onClick={() => verHistorialPuntos(est)}
                      style={{ background:'none', border:'none', padding:0, textAlign:'left', fontSize:13, fontWeight:700, color:colorPts(est.participacion), cursor:'pointer', textDecoration:'underline dotted' }}>
                      {est.participacion!==0?fmtPts(est.participacion):'—'}
                    </button>
                    <div><Pill estado={est.color_nota}  label={est.promedio!==null?String(est.promedio):'—'} /></div>
                    <div><Pill estado={est.color_asist} label={est.pct_asistencia!==null?`${est.pct_asistencia}%`:'—'} /></div>
                  </div>
                ))}
                </div>
              </div>
          )}

          {tabSem === 'sinnota' && (
            cargandoSem ? <div style={{ padding:32, textAlign:'center', color:'#AAA' }}><div className="spinner" style={{ margin:'0 auto 8px' }} />Cargando...</div>
            : !sinNota?.actividad ? <div className="content-fade-in" style={{ padding:32, textAlign:'center', color:'#AAA', fontStyle:'italic' }}>No hay actividades en este período.</div>
            : sinNota.sin_nota.length === 0
              ? <div className="content-fade-in" style={{ padding:24, textAlign:'center', color:'#1A6B3A', fontSize:13 }}>✅ Todos tienen nota.</div>
              : <div className="content-fade-in" style={{ maxHeight:320, overflowY:'auto' }}>
                  {sinNota.sin_nota.map((est, idx) => (
                    <div key={est.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 18px', borderBottom:idx<sinNota.sin_nota.length-1?'1px solid #F0F4FA':'none', background:idx%2===0?'#fff':'#FAFBFD' }}>
                      <span style={{ fontSize:12, color:'#AAA', fontWeight:600, minWidth:24 }}>{est.numero_lista||idx+1}</span>
                      <span style={{ flex:1, fontSize:13, color:'#1B3A6B' }}>{est.nombre_completo}</span>
                      <span style={{ fontSize:10, background:'#FFF8D6', color:'#7A5C00', border:'1px solid #D4B820', padding:'2px 8px', borderRadius:10, fontWeight:700 }}>Sin nota</span>
                    </div>
                  ))}
                </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* TAB: CUADERNO                                       */}
      {/* ════════════════════════════════════════════════════ */}
      {tabActivo === 'cuaderno' && (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', overflow:'hidden' }}>
          <div style={{ background:color+'15', borderBottom:`1px solid ${color}30`, padding:'12px 18px', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>📓</span>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color }}>Cuaderno del curso</div>
              <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{materia ? materia.nombre+' · ' : ''}Anotaciones acumulativas — {anotaciones.length} registros</div>
            </div>
          </div>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #F0F4FA', background:'#FAFBFD' }}>
            <textarea value={nuevaAnot} onChange={e => setNuevaAnot(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter' && e.ctrlKey) agregarAnotacion() }}
              placeholder="Escribe una anotación del curso... (Ctrl+Enter para guardar)"
              rows={3}
              style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'10px 12px', fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', lineHeight:1.6 }}
              onFocus={e => e.target.style.borderColor=color} onBlur={e => e.target.style.borderColor='#DDE3ED'}/>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
              <button onClick={agregarAnotacion} disabled={!nuevaAnot.trim()||guardando}
                style={{ padding:'8px 20px', background:nuevaAnot.trim()?color:'#C0C8D8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:nuevaAnot.trim()?'pointer':'not-allowed' }}>
                {guardando ? '⏳ Guardando...' : '+ Agregar'}
              </button>
            </div>
          </div>
          <div style={{ maxHeight:360, overflowY:'auto' }}>
            {anotaciones.length === 0
              ? <div style={{ padding:30, textAlign:'center', color:'#AAA', fontSize:13, fontStyle:'italic' }}>Sin anotaciones todavía.</div>
              : anotaciones.map((a, idx) => (
                <div key={a.id} style={{ padding:'12px 18px', borderBottom:idx<anotaciones.length-1?'1px solid #F0F4FA':'none', background:idx%2===0?'#fff':'#FAFBFD', display:'flex', gap:12, alignItems:'flex-start' }}>
                  <div style={{ flexShrink:0, marginTop:6, width:8, height:8, borderRadius:'50%', background:color+'80' }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:'#333', lineHeight:1.6 }}>{a.texto}</div>
                    <div style={{ fontSize:11, color:'#AAA', marginTop:4 }}>{a.fecha}</div>
                  </div>
                  <button onClick={() => eliminarAnotacion(a.id)} style={{ background:'none', border:'none', color:'#DDE3ED', fontSize:14, cursor:'pointer', padding:'2px 4px' }}
                    onMouseEnter={e => e.currentTarget.style.color='#B71C1C'}
                    onMouseLeave={e => e.currentTarget.style.color='#DDE3ED'}>🗑️</button>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── POPUP NOTA ESTUDIANTE ──────────────────────────── */}
      {popupNotaT && (
        <div className="modal-backdrop" data-closing={popupNotaT.closing} style={{ position:'fixed', inset:0, background:'#0004', display:'flex', alignItems:'center', justifyContent:'center', zIndex:900 }}
          onClick={e => { if (e.target===e.currentTarget) setPopupNota(null) }}>
          <div className="modal-content" data-closing={popupNotaT.closing} style={{ background:'#fff', borderRadius:14, padding:24, width:380, boxShadow:'0 16px 48px #0004' }}>
            <div style={{ fontWeight:700, color:'#1B3A6B', fontSize:15, marginBottom:4 }}>
              ✏ Nota para {popupNotaT.value.nombre_completo.split(' ').slice(0,2).join(' ')}
            </div>
            <div style={{ fontSize:12, color:'#888', marginBottom:14 }}>{hoy}</div>
            <textarea value={notaTxt} onChange={e => setNotaTxt(e.target.value)}
              placeholder="Observación, comportamiento, logro destacado..."
              rows={4} autoFocus
              style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'10px 12px', fontSize:13, outline:'none', resize:'none', fontFamily:'inherit', boxSizing:'border-box' }}
              onFocus={e => e.target.style.borderColor=color}
              onBlur={e => e.target.style.borderColor='#DDE3ED'}
              onKeyDown={e => { if (e.key==='Enter' && e.ctrlKey) guardarNotaEst() }} />
            <div style={{ fontSize:11, color:'#AAA', marginBottom:14 }}>Ctrl+Enter para guardar</div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setPopupNota(null)} style={{ padding:'8px 18px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>Cancelar</button>
              <button onClick={guardarNotaEst} disabled={!notaTxt.trim()||guardandoNota}
                style={{ padding:'8px 20px', background:notaTxt.trim()?color:'#CCC', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:notaTxt.trim()?'pointer':'default' }}>
                {guardandoNota ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP PUNTOS DE PARTICIPACIÓN ─────────────────── */}
      {popupPunt && (
        <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'#0004', display:'flex', alignItems:'center', justifyContent:'center', zIndex:900 }}
          onClick={e => { if (e.target===e.currentTarget) setPopupPunt(null) }}>
          <div className="modal-content" style={{ background:'#fff', borderRadius:14, padding:24, width:380, boxShadow:'0 16px 48px #0004' }}>
            <div style={{ fontWeight:700, color:'#1B3A6B', fontSize:15, marginBottom:4 }}>± Puntos: {popupPunt.titulo}</div>
            <div style={{ fontSize:12, color:'#888', marginBottom:14 }}>{hoy} · solo indicador, no cambia la nota</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
              {[-5,-3,-2,-1,1,2,3,5].map(n => (
                <button key={n} onClick={() => setPuntosTxt(String(n))} style={{
                  padding:'6px 12px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', border:'1.5px solid',
                  background: puntosTxt===String(n) ? (n>0?'#065F46':'#9B1C1C') : (n>0?'#D1FAE5':'#FEE2E2'),
                  color:      puntosTxt===String(n) ? '#fff' : (n>0?'#065F46':'#9B1C1C'),
                  borderColor: n>0?'#6EE7B7':'#FCA5A5',
                }}>{fmtPts(n)}</button>
              ))}
              <input type="number" value={puntosTxt} onChange={e => setPuntosTxt(e.target.value)} placeholder="otro"
                style={{ width:70, border:'1.5px solid #DDE3ED', borderRadius:8, padding:'6px 8px', fontSize:13, outline:'none' }} />
            </div>
            <input value={motivoTxt} onChange={e => setMotivoTxt(e.target.value)} placeholder="Motivo (opcional): ej. celular en clase, conversó..." maxLength={200}
              onKeyDown={e => { if (e.key==='Enter') confirmarPuntos() }}
              style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'10px 12px', fontSize:13, outline:'none', boxSizing:'border-box', marginBottom:14 }} />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setPopupPunt(null)} style={{ padding:'8px 18px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>Cancelar</button>
              <button onClick={confirmarPuntos} disabled={!(parseInt(puntosTxt,10))}
                style={{ padding:'8px 20px', background:parseInt(puntosTxt,10)?color:'#CCC', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:parseInt(puntosTxt,10)?'pointer':'default' }}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP HISTORIAL DE PARTICIPACIÓN ──────────────── */}
      {histPunt && (
        <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'#0004', display:'flex', alignItems:'center', justifyContent:'center', zIndex:900 }}
          onClick={e => { if (e.target===e.currentTarget) setHistPunt(null) }}>
          <div className="modal-content" style={{ background:'#fff', borderRadius:14, padding:24, width:460, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 16px 48px #0004' }}>
            <div style={{ fontWeight:700, color:'#1B3A6B', fontSize:15, marginBottom:2 }}>Participación: {histPunt.est.nombre_completo}</div>
            <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>
              {perSel?.nombre} · {histPunt.items.length} movimiento(s) · total <strong style={{ color:colorPts(histPunt.est.participacion) }}>{fmtPts(histPunt.est.participacion)}</strong>
            </div>
            <div style={{ overflowY:'auto', border:'1px solid #E8EDF5', borderRadius:8 }}>
              {histPunt.items.length === 0
                ? <div style={{ padding:20, textAlign:'center', color:'#AAA', fontStyle:'italic', fontSize:13 }}>Sin movimientos en este período.</div>
                : histPunt.items.map((h, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'84px 44px 1fr', gap:8, padding:'8px 12px', alignItems:'baseline', borderBottom:i<histPunt.items.length-1?'1px solid #F0F4FA':'none', background:i%2===0?'#fff':'#FAFBFD' }}>
                    <span style={{ fontSize:12, color:'#888' }}>{h.fecha}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:colorPts(h.puntos) }}>{fmtPts(h.puntos)}</span>
                    <span style={{ fontSize:12, color:'#555' }}>
                      {h.motivo || <span style={{ color:'#CCC' }}>sin motivo</span>}
                      {h.tema && <span style={{ display:'block', fontSize:11, color:'#AAB4C4' }}>Tema: {h.tema}</span>}
                    </span>
                  </div>
                ))}
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14 }}>
              <button onClick={() => setHistPunt(null)} style={{ padding:'8px 18px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ─────────────────────────────────────────── */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'#1A6B3A', color:'#fff', padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:600, boxShadow:'0 4px 16px #0003', zIndex:999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}