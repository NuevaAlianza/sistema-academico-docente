import React, { useState, useEffect, useRef } from 'react'
import { useModalTransition } from '../hooks/useModalTransition'
import { useCursoActivo, usePeriodoActivo } from '../hooks/useSeleccionActiva'
import HistorialParticipacion, { fmtPts, colorPts } from '../components/HistorialParticipacion'

const COMPETENCIAS = [
  { key:'Comunicativa',       label:'Comunicativa',       color:'#2563A8', bg:'#D6E4F7', icono:'💬' },
  { key:'Pensamiento Logico', label:'Pensamiento Lógico', color:'#00695C', bg:'#D0EDE8', icono:'🧠' },
  { key:'Civica',             label:'Cívica',             color:'#5C2D91', bg:'#EDE0F7', icono:'🏛️' },
  { key:'Tecnologica',        label:'Tecnológica',        color:'#C84B00', bg:'#FDECD7', icono:'💻' },
]

// Tab Multi usa la misma lista de competencias que Tab Simple
const COMPETENCIAS_MULTI = COMPETENCIAS
const COMP_INFO = Object.fromEntries(COMPETENCIAS.map(c => [c.key, c]))

const TIPOS = ['Tarea','Exposicion','Proyecto','Examen','Participacion','Cuaderno']
const TIPO_ICONO = { Tarea:'📝', Exposicion:'🎤', Proyecto:'🔬', Examen:'📄', Participacion:'✋', Cuaderno:'📓' }
const COLORES_PER = ['#2563A8','#00695C','#5C2D91','#1A6B3A']
const VACIO = { nombre:'', tipo:'Tarea', competencia:'Comunicativa', fecha:'', peso:'10', modo:'simple', competencias_multi:[], temaIds:[] }

export default function Calificaciones({ anio, materia, cursoActivoId, onCambiarCurso, periodoActivoId, onCambiarPeriodo }) {
  const materiaId = materia?.id || null
  const [cursos,      setCursos]      = useState([])
  const [periodos,    setPeriodos]    = useState([])
  const [cursoSel,    setCursoSel]    = useCursoActivo(cursos, cursoActivoId, onCambiarCurso)
  const [perSel,      setPerSel]      = usePeriodoActivo(periodos, periodoActivoId, onCambiarPeriodo)
  const [actividades, setActividades] = useState([])
  const [actSel,      setActSel]      = useState(null)
  const [califs,      setCalifs]      = useState([])
  const [estudiantes, setEstudiantes] = useState([])
  const [grupoFiltro, setGrupoFiltro] = useState(null) // null = todos | número de grupo | 'sin'
  const [modalAct,    setModalAct]    = useState(false)
  const [form,        setForm]        = useState(VACIO)
  const [editandoId,    setEditandoId]    = useState(null)
  const [modalDuplicar, setModalDuplicar] = useState(false)
  const [cursosDestino, setCursosDestino] = useState([])
  const [vista,         setVista]         = useState('resumen')
  const [toast,       setToast]       = useState(null) // { msg, leaving }
  const toastGen = useRef(0)
  const [confirm,     setConfirm]     = useState(null)
  const [historial,       setHistorial]       = useState([])
  const [cargandoHist,    setCargandoHist]    = useState(false)
  const [titulosPer,      setTitulosPer]      = useState({})
  const [distribuciones,  setDistribuciones]  = useState({})
  const [formError,       setFormError]       = useState('')
  const [tabResumen,      setTabResumen]      = useState('simple')
  const [resumenMultiData,setResumenMultiData]= useState({})
  const [cargandoMultiTab,setCargandoMultiTab]= useState(false)
  const [temasPer,        setTemasPer]        = useState([])
  const [partAct,         setPartAct]         = useState(null) // { vinculada, temas, porEstudiante }
  const [histPart,        setHistPart]        = useState(null) // { est, items }
  const modalActT       = useModalTransition(modalAct)
  const modalDuplicarT  = useModalTransition(modalDuplicar)
  const confirmT        = useModalTransition(confirm)

  useEffect(() => {
    window.api.invoke('get-config').then(c => { if (c) setCfg(c) }).catch(() => {})
  }, [])

  useEffect(() => {
  if (!anio) return
  Promise.all([
    window.api.invoke('get-cursos',   anio.id),
    window.api.invoke('get-periodos', anio.id),
  ]).then(([c, p]) => {
    setCursos(c); setPeriodos(p)
  })
}, [anio])

  

  useEffect(() => {
    if (!cursoSel) return
    setGrupoFiltro(null)
    window.api.invoke('get-estudiantes', cursoSel.id).then(ests => {
      setEstudiantes(ests)
      setCalifs([])
    })
  }, [cursoSel])

  useEffect(() => {
    if (!cursoSel || !perSel) { setActividades([]); return }
    window.api.invoke('get-actividades', cursoSel.id, perSel.id, materiaId).then(acts => {
      setActividades(acts)
      setActSel(null)
      setTabResumen('simple')
      setResumenMultiData({})
      if (vista !== 'historial') setVista('resumen')
    })
  }, [cursoSel, perSel])


  useEffect(() => {
    async function cargarTitulosGrado() {
      if (!cursoSel?.grado || !materiaId || !anio?.id) { setTitulosPer({}); return }
      try {
        const titulos = await window.api.invoke('get-periodo-titulos', materiaId)
        const delGrado = titulos.filter(t => t.grado === cursoSel.grado)
        const mapa = {}
        delGrado.forEach(t => { mapa[t.numero_periodo] = t.titulo })
        setTitulosPer(mapa)
      } catch(e) { console.error(e) }
    }
    cargarTitulosGrado()
  }, [cursoSel, materia])

  // Cargar historial cuando se cambia a esa vista o cambia el curso
  useEffect(() => {
    if (vista === 'historial' && cursoSel && anio) {
      cargarHistorial()
    }
  }, [vista, cursoSel, anio])

  useEffect(() => {
    if (tabResumen !== 'multi' || vista !== 'resumen' || !cursoSel || !perSel || estudiantes.length === 0) return
    let activo = true
    setCargandoMultiTab(true)
    Promise.all(
      estudiantes.map(est =>
        window.api.invoke('get-resumen-competencias-multi-por-estudiante', est.id, cursoSel.id, perSel.id, materiaId)
          .then(data => ({ id: est.id, data }))
      )
    ).then(resultados => {
      if (!activo) return
      const obj = {}
      resultados.forEach(r => { obj[r.id] = r.data })
      setResumenMultiData(obj)
      setCargandoMultiTab(false)
    }).catch(() => { if (activo) setCargandoMultiTab(false) })
    return () => { activo = false }
  }, [tabResumen, vista, actividades, estudiantes])

  useEffect(() => {
    if (!modalAct || !cursoSel || !perSel) return
    window.api.invoke('get-temas', cursoSel.id, perSel.id, materiaId).then(t => setTemasPer(Array.isArray(t) ? t : []))
  }, [modalAct, cursoSel, perSel])

  async function verHistorialPart(est) {
    const items = await window.api.invoke('get-historial-participacion', est.id, cursoSel.id, perSel.id, materiaId)
    setHistPart({ est, items: Array.isArray(items) ? items : [] })
  }

  async function cargarHistorial() {
    setCargandoHist(true)
    try {
      const data = await window.api.invoke('get-historial-curso', cursoSel.id, anio.id, materiaId)
      setHistorial(data)
    } catch(e) { console.error(e) }
    setCargandoHist(false)
  }

  async function cargarTodo() {
    if (!cursoSel) return
    const ests = await window.api.invoke('get-estudiantes', cursoSel.id)
    setEstudiantes(ests)
    setCalifs([])
    if (cursoSel && perSel) {
      const acts = await window.api.invoke('get-actividades', cursoSel.id, perSel.id, materiaId)
      setActividades(acts)
    }
    setActSel(null)
    setVista('resumen')
  }

  async function abrirNotas(act) {
    setActSel(act)
    setDistribuciones({})
    setPartAct(null)
    window.api.invoke('get-participacion-actividad', act.id).then(setPartAct).catch(() => {})
    const c = await window.api.invoke('get-calificaciones', act.id)
    const mapa = {}
    c.forEach(x => { mapa[x.estudiante_id] = x.nota })
    // mapa[e.id] puede ser null (nota borrada) o undefined (sin fila) — ambos → ''
    const listaCalifs = estudiantes.map(e => ({ ...e, nota: mapa[e.id] != null ? String(mapa[e.id]) : '' }))
    setCalifs(listaCalifs)
    setVista('notas')

    if (act.modo === 'multi') {
      const comps   = act.competencias_multi ? JSON.parse(act.competencias_multi) : []
      const distObj = {}
      for (const est of estudiantes) {
        const existente = await window.api.invoke('get-distribucion-multi', act.id, est.id)
        distObj[est.id] = existente || defaultDist(comps)
      }
      setDistribuciones(distObj)
    }
  }

  // Distribución por defecto: todas las comps al techo (100 / n_comps).
  // El maestro baja desde ahí los puntos donde el alumno no llegó.
  function defaultDist(comps) {
    const nc = comps.length
    if (nc === 0) return {}
    const techo = Math.round(100 / nc * 10) / 10
    const dist = {}
    comps.forEach(c => { dist[c] = techo })
    return dist
  }

  async function guardarNota(estudianteId, nota) {
    const n = nota === '' ? null : Number(nota)
    if (n !== null && (isNaN(n) || n < 0 || n > 100)) return
    await window.api.invoke('set-calificacion', { actividadId: actSel.id, estudianteId, nota: n, observacion: '' })
    setCalifs(prev => prev.map(e => e.id === estudianteId ? { ...e, nota } : e))
  }

  function cambiarDistComp(estudianteId, comp, valor) {
    setDistribuciones(prev => ({
      ...prev,
      [estudianteId]: { ...(prev[estudianteId] || {}), [comp]: Number(valor) || 0 },
    }))
  }

  async function guardarDistComp(estudianteId) {
    let comps = []
    try { comps = actSel.competencias_multi ? JSON.parse(actSel.competencias_multi) : [] }
    catch (e) { return }
    const nc = comps.length
    if (nc === 0) return
    const techo = Math.round(100 / nc * 10) / 10

    const parcial = distribuciones[estudianteId] || {}
    const dist = {}
    comps.forEach(c => { dist[c] = parcial[c] !== undefined ? Number(parcial[c]) : techo })

    // No guardar si algún valor supera el techo
    if (comps.some(c => dist[c] > techo + 0.01)) return

    await window.api.invoke('set-calificacion-multi', { actividad_id: actSel.id, estudiante_id: estudianteId, distribucion: dist })
    const notaGlobal = Math.round(Object.values(dist).reduce((a, b) => a + b, 0) * 10) / 10
    setCalifs(prev => prev.map(e => e.id === estudianteId ? { ...e, nota: String(notaGlobal) } : e))
    setDistribuciones(prev => ({ ...prev, [estudianteId]: dist }))
    const resumenDist = comps.map(k => `${COMP_INFO[k]?.icono}${COMP_INFO[k]?.label.slice(0,3)}=${dist[k]}`).join('  ')
    toast2(`✓ Guardado: ${resumenDist}  →  nota ${notaGlobal}`)
  }

  async function abrirEditar(act, e) {
    e.stopPropagation()
    const temaIds = await window.api.invoke('get-actividad-temas', act.id)
    setEditandoId(act.id)
    setForm({
      nombre: act.nombre, tipo: act.tipo, competencia: act.competencia,
      fecha: act.fecha || '', peso: String(act.peso),
      modo: act.modo || 'simple',
      competencias_multi: act.competencias_multi ? JSON.parse(act.competencias_multi) : [],
      temaIds: Array.isArray(temaIds) ? temaIds : [],
    })
    setModalAct(true)
  }

  async function crearActividad() {
    if (!cursoSel) { alert('Selecciona un curso primero'); return }
    if (!perSel) { alert('No hay períodos disponibles.'); return }
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return }
    if (form.modo === 'multi' && form.competencias_multi.length === 0) {
      alert('Selecciona al menos una competencia para el modo multi'); return
    }
    const pesoNum = Number(form.peso) || 10
    const pesoUsado = actividades
      .filter(a => !editandoId || a.id !== editandoId)
      .reduce((s, a) => s + a.peso, 0)
    if (pesoUsado + pesoNum > 100.01) {
      alert(`El peso total excedería 100. Disponible: ${Math.max(0, 100 - pesoUsado)} pts`); return
    }
    const data = {
      nombre: form.nombre.trim(), tipo: form.tipo, competencia: form.competencia,
      fecha: form.fecha || null, peso: pesoNum,
      modo: form.modo,
      competencias_multi: form.modo === 'multi' ? form.competencias_multi : null,
      temaIds: form.temaIds,
    }
    if (editandoId) {
      // Aviso si cambian competencias de actividad multi que ya tiene notas
      if (form.modo === 'multi') {
        const actOrig    = actividades.find(a => a.id === editandoId)
        const compsOrig  = actOrig?.competencias_multi ? JSON.parse(actOrig.competencias_multi) : []
        const cambiaron  = JSON.stringify([...compsOrig].sort()) !== JSON.stringify([...form.competencias_multi].sort())
        const tieneNotas = Object.values(todasCalifs[editandoId] || {}).some(n => n !== null)
        if (cambiaron && tieneNotas) {
          const ok = window.confirm(
            'Esta actividad tiene calificaciones guardadas. Cambiar las competencias re-distribuirá las notas equitativamente. ¿Continuar?'
          )
          if (!ok) return
        }
      }
      await window.api.invoke('update-actividad', editandoId, data)
      toast2('Actividad actualizada ✓')
    } else {
      await window.api.invoke('create-actividad', { cursoId: cursoSel.id, periodoId: perSel.id, materiaId, descripcion: '', ...data })
      toast2('Actividad creada ✓')
    }
    setModalAct(false); setForm(VACIO); setEditandoId(null); setFormError('')
    cargarTodo()
  }

  function eliminarActividad(act, e) {
    e.stopPropagation()
    setConfirm({ id: act.id, nombre: act.nombre })
  }

  async function confirmarEliminar() {
    await window.api.invoke('delete-actividad', confirm.id)
    setConfirm(null)
    toast2('🗑️ Actividad eliminada')
    cargarTodo()
  }


  async function exportarPDF() {
    if (!cursoSel || !perSel || estudiantes.length === 0) return
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const cfg     = await window.api.invoke('get-config')
    const centro  = cfg.centro_educativo || ''
    const maestro = cfg.nombre_maestro   || ''
    const tituloP = titulosPer[perSel.numero_orden] || perSel.titulo || ''
    const datosEst = estudiantes.map(est => {
      const comps = calcularCompetencias(est.id, todasCalifs)
      const notas = Object.values(comps).filter(n => n !== null)
      const prom  = notas.length > 0 ? Math.round(notas.reduce((a,b)=>a+b,0)/notas.length) : null
      const notasActs = actividades.map(act => { const n = todasCalifs[act.id]?.[est.id]; return n !== null && n !== undefined ? n : '—' })
      return { est, comps, prom, notasActs }
    })
    const doc   = new jsPDF({ orientation: actividades.length > 6 ? 'landscape' : 'portrait', unit:'mm', format:'letter' })
    const pageW = doc.internal.pageSize.getWidth()
    doc.setFillColor(27,58,107); doc.rect(0,0,pageW,22,'F')
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(13)
    doc.text('Registro de Calificaciones', pageW/2, 9, { align:'center' })
    doc.setFontSize(9); doc.setFont('helvetica','normal')
    if (centro)  doc.text(centro,  pageW/2, 15, { align:'center' })
    if (maestro) doc.text(maestro, pageW/2, 19, { align:'center' })
    doc.setTextColor(30,30,30); doc.setFontSize(10); doc.setFont('helvetica','bold')
    const mLabel = materia ? materia.nombre + '  ·  ' : ''
    doc.text(`${mLabel}${cursoSel.nombre}  ·  ${perSel.nombre} — ${tituloP}`, 14, 29)
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(120,120,120)
    const fecha = new Date().toLocaleDateString('es-DO', { year:'numeric', month:'long', day:'numeric' })
    doc.text(`Generado: ${fecha}  ·  ${estudiantes.length} estudiantes  ·  ${actividades.length} actividades`, 14, 34)
    const semColor = n => { if (n===null||n==='—') return [200,200,200]; if (n>=85) return [26,107,58]; if (n>=70) return [200,75,0]; return [183,28,28] }
    const semBg    = n => { if (n===null||n==='—') return [244,244,244]; if (n>=85) return [214,238,224]; if (n>=70) return [253,236,215]; return [253,223,223] }
    const headers = [
      { content:'#', styles:{ halign:'center', cellWidth:8 } },
      { content:'Estudiante', styles:{ halign:'left', cellWidth:50 } },
      ...actividades.map(a => ({ content: a.nombre.length>12?a.nombre.slice(0,12)+'…':a.nombre, styles:{ halign:'center', cellWidth:16 } })),
      { content:'Promedio', styles:{ halign:'center', cellWidth:20, fontStyle:'bold' } },
    ]
    const rows = datosEst.map(({ est, prom, notasActs }) => [
      { content: String(est.numero_lista).padStart(2,'0'), styles:{ halign:'center', fontSize:8 } },
      { content: est.nombre_completo, styles:{ halign:'left', fontSize:8, fontStyle: prom!==null&&prom<70?'bold':'normal', textColor: prom!==null&&prom<70?[183,28,28]:[30,30,30] } },
      ...notasActs.map(n => ({ content:String(n), styles:{ halign:'center', fontSize:9, fontStyle:'bold', textColor:semColor(n==='—'?null:n), fillColor:semBg(n==='—'?null:n) } })),
      { content: prom!==null?String(prom):'—', styles:{ halign:'center', fontSize:11, fontStyle:'bold', textColor:semColor(prom), fillColor:semBg(prom) } },
    ])
    const promsActs = actividades.map(act => { const ns = estudiantes.map(e => todasCalifs[act.id]?.[e.id]).filter(n => n!==null&&n!==undefined); return ns.length>0 ? Math.round(ns.reduce((a,b)=>a+b,0)/ns.length) : null })
    const promGrupoArr = datosEst.map(d=>d.prom).filter(n=>n!==null)
    const promGrupoVal = promGrupoArr.length>0 ? Math.round(promGrupoArr.reduce((a,b)=>a+b,0)/promGrupoArr.length) : null
    rows.push([
      { content:'', styles:{ fillColor:[237,242,250] } },
      { content:'Promedio del grupo', styles:{ halign:'left', fontSize:8, fontStyle:'bold', fillColor:[237,242,250], textColor:[27,58,107] } },
      ...promsActs.map(n => ({ content:n!==null?String(n):'—', styles:{ halign:'center', fontSize:9, fontStyle:'bold', textColor:semColor(n), fillColor:[237,242,250] } })),
      { content:promGrupoVal!==null?String(promGrupoVal):'—', styles:{ halign:'center', fontSize:11, fontStyle:'bold', textColor:semColor(promGrupoVal), fillColor:[237,242,250] } },
    ])
    autoTable(doc, { startY:38, head:[headers], body:rows, theme:'grid', headStyles:{ fillColor:[27,58,107], textColor:255, fontSize:8, fontStyle:'bold', halign:'center' }, styles:{ cellPadding:2, lineColor:[220,220,220], lineWidth:0.3 }, alternateRowStyles:{ fillColor:[250,251,253] }, margin:{ left:14, right:14 } })
    const finalY = doc.lastAutoTable.finalY + 6
    const conProm = datosEst.filter(d=>d.prom!==null)
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,30)
    doc.text('Resumen:', 14, finalY); doc.setFont('helvetica','normal')
    doc.setTextColor(26,107,58);  doc.text(`  Aprobados (>=85): ${conProm.filter(d=>d.prom>=85).length}`,       30,  finalY)
    doc.setTextColor(200,75,0);   doc.text(`  En riesgo (70-84): ${conProm.filter(d=>d.prom>=70&&d.prom<85).length}`, 72,  finalY)
    doc.setTextColor(183,28,28);  doc.text(`  Reprobados (<70): ${conProm.filter(d=>d.prom<70).length}`,        118, finalY)
    doc.setTextColor(120,120,120);doc.text(`  Sin nota: ${estudiantes.length-conProm.length}`,                  160, finalY)
    doc.save(`Calificaciones_${cursoSel.nombre}_${perSel.nombre}_${new Date().toISOString().slice(0,10)}.pdf`)
    toast2('📄 PDF generado')
  }

  async function exportarPDFMulti() {
    const actsMulti = actividades.filter(a => a.modo === 'multi')
    if (!cursoSel || !perSel || actsMulti.length === 0) return
    const cfg     = await window.api.invoke('get-config')
    const centro  = cfg.centro_educativo || ''
    const maestro = cfg.nombre_maestro   || ''
    const tituloP = titulosPer[perSel.numero_orden] || perSel.titulo || ''
    const fecha   = new Date().toLocaleDateString('es-DO', { day:'2-digit', month:'long', year:'numeric' })
    const COL_M   = Object.fromEntries(COMPETENCIAS.map(c => [c.key, c.color]))

    // Resumen de competencias (notas del grupo)
    const resumen = await window.api.invoke('get-resumen-competencias-multi', cursoSel.id, perSel.id, materiaId)

    // Para cada actividad multi, construir tabla de distribuciones
    const seccionesHTML = await Promise.all(actsMulti.map(async act => {
      const compsRaw = act.competencias_multi ? JSON.parse(act.competencias_multi) : []
      compsRaw.forEach(k => { if (!COMPETENCIAS.some(c => c.key === k)) console.warn('[PDF] competencia desconocida ignorada:', k, 'act', act.id) })
      const comps = COMPETENCIAS.filter(c => compsRaw.includes(c.key)).map(c => c.key)
      const califs = await window.api.invoke('get-calificaciones', act.id)
      const mapaCalif = {}
      califs.forEach(c => { mapaCalif[c.estudiante_id] = c })

      const encabezados = `<th style="width:32px">#</th><th>Estudiante</th><th style="text-align:center;width:60px">Nota</th>${COMPETENCIAS.map(c=>{const a=comps.includes(c.key);return`<th style="text-align:center;width:65px;color:${a?(COL_M[c.key]||'#333'):'#BBBBBB'};opacity:${a?1:.5}">${a?`${c.icono} ${c.label.slice(0,4)}`:'—'}</th>`}).join('')}<th style="text-align:center;width:60px">Suma</th>`

      const filas = estudiantes.map((est, i) => {
        const c = mapaCalif[est.id]
        const nota = c ? c.nota : null
        const dist = (c && c.distribucion_multi) ? JSON.parse(c.distribucion_multi) : {}
        const nc = comps.length
        const distRow = COMPETENCIAS.map(ci => {
          const activa = comps.includes(ci.key)
          if (!activa) return `<td style="text-align:center;color:#CCCCCC">—</td>`
          const v = dist[ci.key] !== undefined ? dist[ci.key] : (nota !== null ? Math.round(nota/nc*10)/10 : null)
          return `<td style="text-align:center;font-weight:600;color:${COL_M[ci.key]||'#333'}">${v!==null?v:'—'}</td>`
        }).join('')
        const suma = comps.reduce((s, comp) => s + (dist[comp]||0), 0)
        const sumaOk = nota === null || suma <= nota + 0.01
        return `<tr style="background:${i%2===0?'#fff':'#FAFBFD'}">
          <td style="color:#AAA;font-size:11px">${String(est.numero_lista).padStart(2,'0')}</td>
          <td style="font-weight:600;color:#1B3A6B">${est.nombre_completo}</td>
          <td style="text-align:center;font-weight:800;color:${nota!==null?(nota>=semVerde?'#1A6B3A':nota>=minAprobatorio?'#C84B00':'#B71C1C'):'#AAA'}">${nota!==null?nota:'—'}</td>
          ${distRow}
          <td style="text-align:center;font-weight:700;color:${sumaOk?'#1A6B3A':'#B71C1C'}">${nota!==null?Math.round(suma*10)/10:'—'}</td>
        </tr>`
      }).join('')

      // Fila promedio grupo
      const grupoNota = califs.filter(c=>c.nota!==null)
      const promsNotas = grupoNota.map(c=>c.nota)
      const promGrupo  = promsNotas.length>0 ? Math.round(promsNotas.reduce((a,b)=>a+b,0)/promsNotas.length) : null
      const grupoComps = COMPETENCIAS.map(ci => {
        if (!comps.includes(ci.key)) return null
        const vals = grupoNota.map(c => {
          const d = c.distribucion_multi ? JSON.parse(c.distribucion_multi) : {}
          return d[ci.key] !== undefined ? d[ci.key] : (c.nota !== null ? Math.round(c.nota/comps.length*10)/10 : 0)
        })
        return vals.length>0 ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10 : null
      })
      const pieFila = `<tr style="background:#EDF2FA;border-top:2px solid #1B3A6B;font-weight:700">
        <td></td><td style="color:#1B3A6B">Promedio grupo</td>
        <td style="text-align:center;color:${promGrupo!==null?(promGrupo>=semVerde?'#1A6B3A':promGrupo>=minAprobatorio?'#C84B00':'#B71C1C'):'#AAA'}">${promGrupo??'—'}</td>
        ${grupoComps.map((v,i)=>v===null?`<td style="text-align:center;color:#CCCCCC">—</td>`:`<td style="text-align:center;color:${COL_M[COMPETENCIAS[i].key]||'#333'}">${v??'—'}</td>`).join('')}
        <td></td>
      </tr>`

      return `<div class="act-section">
        <div class="act-title">${TIPO_ICONO[act.tipo]||'📝'} ${act.nombre}
          <span class="act-meta">Peso: ${act.peso} · Competencias: ${comps.join(', ')}${act.fecha?' · '+act.fecha:''}</span>
        </div>
        <table><thead><tr>${encabezados}</tr></thead><tbody>${filas}${pieFila}</tbody></table>
      </div>`
    }))

    // Sección resumen de competencias
    const resumenHTML = resumen.length > 0 ? `
      <div class="act-section">
        <div class="act-title">Resumen por competencia</div>
        <table><thead><tr><th>Competencia</th><th style="text-align:center">Actividades multi</th><th style="text-align:center">Peso evaluado</th><th style="text-align:center">Nota actual</th></tr></thead>
        <tbody>${resumen.map(r=>`
          <tr>
            <td style="font-weight:700;color:${COL_M[r.competencia]||'#333'}">${COMP_INFO[r.competencia]?.icono??''} ${COMP_INFO[r.competencia]?.label??r.competencia}</td>
            <td style="text-align:center">${actsMulti.filter(a=>JSON.parse(a.competencias_multi||'[]').includes(r.competencia)).length}</td>
            <td style="text-align:center">${r.peso_evaluado} pts</td>
            <td style="text-align:center;font-weight:800;color:${r.nota!==null?(r.nota>=semVerde?'#1A6B3A':r.nota>=minAprobatorio?'#C84B00':'#B71C1C'):'#AAA'}">${r.nota??'—'}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>` : ''

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Registro Multi-competencia — ${cursoSel.nombre}</title>
    <style>
      body { font-family:'Segoe UI',sans-serif; margin:20px; color:#333; font-size:12px }
      h1   { color:#1B3A6B; font-size:16px; margin:0 0 2px }
      .sub { color:#888; font-size:11px; margin:0 0 16px }
      .act-section { margin-bottom:22px }
      .act-title { font-size:14px; font-weight:800; color:#1B3A6B; margin-bottom:6px; padding-bottom:4px; border-bottom:2px solid #1B3A6B; display:flex; align-items:center; gap:10px }
      .act-meta   { font-size:11px; color:#888; font-weight:400 }
      table { border-collapse:collapse; width:100%; font-size:12px }
      thead th { background:#1B3A6B; color:#9BBFED; padding:6px 8px; font-size:11px; text-align:left }
      tbody td  { padding:6px 8px; border-bottom:1px solid #F0F4FA }
      .footer { margin-top:14px; font-size:10px; color:#AAA; border-top:1px solid #EEE; padding-top:6px; display:flex; justify-content:space-between }
      @media print { @page { margin:10mm } .act-section { page-break-inside:avoid } }
    </style></head><body>
    <h1>🔀 Registro Multi-competencia — ${cursoSel.nombre}</h1>
    <p class="sub">${perSel.nombre}${tituloP?' — '+tituloP:''} · ${materia?.nombre||'General'} · ${fecha}${centro?' · '+centro:''}</p>
    ${seccionesHTML.join('')}
    ${resumenHTML}
    <div class="footer">
      <span>${maestro||'Docente'}</span>
      <span>${cursoSel.nombre} · ${perSel.nombre} · ${fecha}</span>
    </div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`

    const win = window.open('', '_blank')
    if (!win) { alert('No se pudo abrir la ventana de impresión.'); return }
    win.document.write(html)
    win.document.close()
    toast2('📄 PDF Multi generado')
  }

  function toast2(msg) {
    const gen = ++toastGen.current
    setToast({ msg, leaving:false })
    setTimeout(() => { if (toastGen.current===gen) setToast(t => t && ({ ...t, leaving:true })) }, 2300)
    setTimeout(() => { if (toastGen.current===gen) setToast(null) }, 2500)
  }

  function abrirDuplicar() { setCursosDestino([]); setModalDuplicar(true) }

  async function ejecutarDuplicar() {
    if (cursosDestino.length === 0) { alert('Selecciona al menos un curso destino'); return }
    let totalCopiadas = 0
    for (const cid of cursosDestino) {
      const res = await window.api.invoke('duplicar-actividades', cursoSel.id, perSel.id, cid, perSel.id, materiaId)
      totalCopiadas += res.copiadas
    }
    setModalDuplicar(false); setCursosDestino([])
    toast2(`✅ ${totalCopiadas} actividades duplicadas en ${cursosDestino.length} curso(s)`)
  }

  function toggleCursoDestino(id) {
    setCursosDestino(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function calcularCompetencias(estudianteId, todasCalifs) {
    // Solo actividades modo='simple': las modo='multi' se califican por
    // distribucion_multi y se resumen aparte (tab "Multi" / getResumenCompetenciasMultiPorEstudiante).
    const resultado = {}
    COMPETENCIAS.forEach(comp => {
      const actsComp = actividades.filter(a => a.modo !== 'multi' && a.competencia === comp.key)
      if (actsComp.length === 0) { resultado[comp.key] = null; return }
      let pesoTotal = 0, sumaXPeso = 0, tieneNota = false
      actsComp.forEach(act => {
        const nota = todasCalifs[act.id]?.[estudianteId]
        if (nota !== undefined && nota !== null) {
          sumaXPeso += nota * act.peso; pesoTotal += act.peso; tieneNota = true
        }
      })
      resultado[comp.key] = tieneNota && pesoTotal > 0 ? Math.round(sumaXPeso / pesoTotal) : null
    })
    return resultado
  }

  const [cfg,         setCfg]         = useState({ semaforo_verde: '80', semaforo_amarillo: '60', minimo_aprobatorio: '70' })
  const [todasCalifs, setTodasCalifs] = useState({})
  useEffect(() => {
    async function cargarCalifs() {
      if (actividades.length === 0) { setTodasCalifs({}); return }
      const obj = {}
      for (const act of actividades) {
        const c = await window.api.invoke('get-calificaciones', act.id)
        obj[act.id] = {}
        c.forEach(x => { obj[act.id][x.estudiante_id] = x.nota })
      }
      setTodasCalifs(obj)
    }
    cargarCalifs()
  }, [actividades])

  const semVerde       = Number(cfg.semaforo_verde      || 80)
  const semAmarillo    = Number(cfg.semaforo_amarillo   || 60)
  const minAprobatorio = Number(cfg.minimo_aprobatorio  || 70)

  const hayActsMulti = actividades.some(a => a.modo === 'multi')
  const colPer = COLORES_PER[periodos.findIndex(p => p.id === perSel?.id)] || '#2563A8'
  const conNota = califs.filter(e => e.nota !== '')
  const prom = conNota.length > 0 ? Math.round(conNota.reduce((a, e) => a + Number(e.nota), 0) / conNota.length) : null
  const colorProm = prom === null ? '#888' : prom >= semVerde ? '#1A6B3A' : prom >= minAprobatorio ? '#C84B00' : '#B71C1C'
  // Igual que calcularCompetencias(): las modo='multi' se resumen aparte vía distribucion_multi.
  const actsPorComp = {}
  COMPETENCIAS.forEach(c => { actsPorComp[c.key] = actividades.filter(a => a.modo !== 'multi' && a.competencia === c.key) })

  function colorNota(n) {
    if (n === null) return '#CCC'
    if (n >= semVerde)    return '#1A6B3A'
    if (n >= minAprobatorio) return '#C84B00'
    return '#B71C1C'
  }
  function bgNota(n) {
    if (n === null) return '#F4F4F4'
    if (n >= semVerde)    return '#D6EEE0'
    if (n >= minAprobatorio) return '#FDECD7'
    return '#FDDFDF'
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20 }}>

      {/* PANEL IZQUIERDO */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:14, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#AAB4C4', marginBottom:10, letterSpacing:1.5 }}>CURSO</div>
          {cursos.length === 0 && <div style={{ fontSize:12, color:'#999', fontStyle:'italic' }}>Sin cursos</div>}
          {cursos.map(c => (
            <div key={c.id} onClick={() => setCursoSel(c)} style={{
              padding:'8px 10px', borderRadius:8, cursor:'pointer', marginBottom:4,
              background: cursoSel?.id === c.id ? c.color : 'transparent',
              color: cursoSel?.id === c.id ? '#fff' : c.color,
              fontWeight:600, fontSize:13, display:'flex', alignItems:'center', gap:8,
            }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: cursoSel?.id === c.id ? '#fff' : c.color }} />
              {c.nombre}
            </div>
          ))}
        </div>

        <div style={{ background:'#fff', borderRadius:12, padding:14, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#AAB4C4', marginBottom:10, letterSpacing:1.5 }}>PERIODO</div>
          {periodos.map((per, i) => {
            const col = COLORES_PER[i] || '#2563A8'
            const active = perSel?.id === per.id
            return (
              <div key={per.id} onClick={() => { setPerSel(per); if (vista === 'historial') setVista('resumen') }} style={{
                padding:'8px 10px', borderRadius:8, cursor:'pointer', marginBottom:4,
                background: active ? col+'15' : 'transparent',
                border: active ? '1.5px solid '+col+'50' : '1.5px solid transparent',
              }}>
                <div style={{ fontWeight:700, fontSize:13, color: active ? col : '#444' }}>{per.nombre}</div>
                <div style={{ fontSize:11, color:'#888' }}>{titulosPer[per.numero_orden] || per.titulo}</div>
              </div>
            )
          })}
        </div>

        <div style={{ background:'#fff', borderRadius:12, padding:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#AAB4C4', marginBottom:8, letterSpacing:1.5 }}>COMPETENCIAS</div>
          {COMPETENCIAS.map(c => (
            <div key={c.key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{ fontSize:14 }}>{c.icono}</span>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:c.color }}>{c.key}</div>
                <div style={{ fontSize:10, color:'#AAA' }}>{actsPorComp[c.key]?.length || 0} actividades</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PANEL PRINCIPAL */}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {perSel && cursoSel && (
          <div style={{ background:'linear-gradient(135deg, '+colPer+', '+colPer+'CC)', borderRadius:12, padding:'14px 24px', color:'#fff', display:'flex', alignItems:'center', gap:16, boxShadow:'0 4px 16px '+colPer+'40' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, opacity:0.8, fontWeight:600 }}>{materia ? materia.nombre+' · ' : ''}{cursoSel.nombre}  ·  {perSel.nombre}</div>
              <div style={{ fontSize:17, fontWeight:800 }}>{titulosPer[perSel?.numero_orden] || perSel.titulo || 'Sin titulo'}</div>
            </div>
            <div style={{ display:'flex', gap:16 }}>
              {[
                { label:'Actividades', val: actividades.length },
                { label:'Estudiantes', val: estudiantes.length },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:900 }}>{s.val}</div>
                  <div style={{ fontSize:11, opacity:0.8 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABS */}
        {vista !== 'notas' && (
          <div style={{ display:'flex', gap:4, background:'#fff', borderRadius:10, padding:4, border:'1px solid #DDE3ED', flexWrap:'wrap' }}>
            {[
              { k:'resumen',     label:'📊 Resumen' },
              { k:'actividades', label:'📝 Actividades' },
              { k:'historial',   label:'📈 Historial' },
            ].map(t => (
              <button key={t.k} onClick={() => setVista(t.k)} style={{
                padding:'7px 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:700,
                background: vista === t.k ? '#1B3A6B' : 'transparent',
                color: vista === t.k ? '#fff' : '#888',
                cursor:'pointer', transition:'all .12s',
              }}>{t.label}</button>
            ))}
            {vista !== 'historial' && <>
              <button onClick={() => { setForm(VACIO); setModalAct(true) }} style={{
                padding:'7px 16px', borderRadius:8, border:'1px solid #DDE3ED', fontSize:12, fontWeight:700,
                background:'transparent', color:'#1B3A6B', cursor:'pointer', marginLeft:4,
              }}>+ Nueva Actividad</button>
              {actividades.length > 0 && (
                <button onClick={abrirDuplicar} style={{
                  padding:'7px 16px', borderRadius:8, border:'1px solid #00695C', fontSize:12, fontWeight:700,
                  background:'transparent', color:'#00695C', cursor:'pointer', marginLeft:4,
                }}>📋 Duplicar a otros cursos</button>
              )}
              {estudiantes.length > 0 && actividades.length > 0 && (
                <button onClick={exportarPDF} style={{ padding:'7px 16px', borderRadius:8, border:'1px solid #B71C1C', fontSize:12, fontWeight:700, background:'transparent', color:'#B71C1C', cursor:'pointer', marginLeft:4 }}>📄 Exportar PDF</button>
              )}
              {actividades.some(a => a.modo === 'multi') && (
                <button onClick={exportarPDFMulti} style={{ padding:'7px 16px', borderRadius:8, border:'1px solid #2563A8', fontSize:12, fontWeight:700, background:'transparent', color:'#2563A8', cursor:'pointer', marginLeft:4 }}>🔀 PDF Multi</button>
              )}
            </>}
          </div>
        )}

        {/* ── VISTA HISTORIAL ── */}
        {vista === 'historial' && (
          <div>
            {cargandoHist ? (
              <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', border:'1px solid #DDE3ED' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>⏳</div>
                <p style={{ color:'#888', fontSize:13 }}>Calculando historial...</p>
              </div>
            ) : historial.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', border:'1px solid #DDE3ED' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>📈</div>
                <p style={{ color:'#888', fontSize:13 }}>No hay datos de calificaciones aún para este curso.</p>
              </div>
            ) : (() => {
              // historial = [{ estudiante, periodos: [{periodoId, nombre, promedio}] }]
              const nombresPeríodos = historial[0]?.periodos?.map(p => p.nombre) || []
              const coloresPer = COLORES_PER

              return (
                <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', overflow:'auto' }}>
                  {/* Cabecera info */}
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid #EEF2F7', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:15, color:'#1B3A6B' }}>📈 Historial del año — {cursoSel?.nombre}</div>
                      <div style={{ fontSize:12, color:'#888', marginTop:2 }}>Promedio por período · color según semáforo</div>
                    </div>
                    <div style={{ display:'flex', gap:12 }}>
                      {[
                        { color:'#1A6B3A', label:'≥ 85 Excelente' },
                        { color:'#C84B00', label:'70–84 Regular' },
                        { color:'#B71C1C', label:'< 70 Riesgo' },
                      ].map(s => (
                        <div key={s.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <div style={{ width:10, height:10, borderRadius:'50%', background:s.color }} />
                          <span style={{ fontSize:11, color:'#888' }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <table style={{ borderCollapse:'collapse', width:'100%', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#F8FAFD' }}>
                        <th style={{ padding:'10px 16px', color:'#1B3A6B', textAlign:'left', fontWeight:700, borderBottom:'2px solid #E8EDF5', position:'sticky', left:0, background:'#F8FAFD', zIndex:5, whiteSpace:'nowrap', minWidth:200 }}>
                          Estudiante
                        </th>
                        {nombresPeríodos.map((nombre, i) => (
                          <th key={nombre} style={{ padding:'10px 16px', textAlign:'center', fontWeight:700, borderBottom:'2px solid #E8EDF5', minWidth:90, color: coloresPer[i] || '#1B3A6B' }}>
                            {nombre}
                          </th>
                        ))}
                        <th style={{ padding:'10px 16px', textAlign:'center', fontWeight:800, borderBottom:'2px solid #E8EDF5', minWidth:110, color:'#1B3A6B', borderLeft:'2px solid #E8EDF5' }}>
                          PROMEDIO AÑO
                        </th>
                        <th style={{ padding:'10px 16px', textAlign:'center', fontWeight:700, borderBottom:'2px solid #E8EDF5', minWidth:90, color:'#555', fontSize:11 }}>
                          TENDENCIA
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map(({ estudiante, periodos: pers }, idx) => {
                        const notasValidas = pers.map(p => p.promedio).filter(n => n !== null)
                        const promAnio = notasValidas.length > 0 ? Math.round(notasValidas.reduce((a,b) => a+b, 0) / notasValidas.length) : null

                        // Tendencia: comparar primer y último período con nota
                        let tendencia = '—'
                        if (notasValidas.length >= 2) {
                          const primera = notasValidas[0]
                          const ultima  = notasValidas[notasValidas.length - 1]
                          const diff    = ultima - primera
                          tendencia = diff > 5 ? '📈 Mejora' : diff < -5 ? '📉 Baja' : '➡️ Estable'
                        } else if (notasValidas.length === 1) {
                          tendencia = '📊 Un período'
                        }

                        return (
                          <tr key={estudiante.id} style={{ background: idx%2===0 ? '#fff' : '#FAFBFD', transition:'background .1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#EEF6FF'}
                            onMouseLeave={e => e.currentTarget.style.background = idx%2===0 ? '#fff' : '#FAFBFD'}>
                            <td style={{ padding:'10px 16px', fontWeight:600, color:'#1B3A6B', position:'sticky', left:0, background:'inherit', borderRight:'1px solid #E8EDF5', whiteSpace:'nowrap' }}>
                              <span style={{ color:'#AAB4C4', marginRight:8, fontSize:11 }}>{String(estudiante.numero_lista).padStart(2,'0')}</span>
                              {estudiante.nombre_completo}
                            </td>
                            {pers.map((p, i) => {
                              const n = p.promedio
                              return (
                                <td key={p.periodoId} style={{ textAlign:'center', padding:'10px 8px' }}>
                                  {n !== null ? (
                                    <div style={{ display:'inline-block', background:bgNota(n), color:colorNota(n), padding:'5px 12px', borderRadius:20, fontWeight:800, fontSize:14, minWidth:44 }}>
                                      {n}
                                    </div>
                                  ) : (
                                    <span style={{ color:'#DDE3ED', fontSize:13, fontWeight:600 }}>—</span>
                                  )}
                                </td>
                              )
                            })}
                            <td style={{ textAlign:'center', padding:'10px 12px', borderLeft:'2px solid #EEF2F7' }}>
                              {promAnio !== null ? (
                                <div style={{ display:'inline-block', background:bgNota(promAnio), color:colorNota(promAnio), padding:'5px 14px', borderRadius:20, fontWeight:900, fontSize:15 }}>
                                  {promAnio}
                                </div>
                              ) : <span style={{ color:'#DDE3ED' }}>—</span>}
                            </td>
                            <td style={{ textAlign:'center', padding:'10px 8px', fontSize:12, color:'#555', fontWeight:600 }}>
                              {tendencia}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {/* FILA PROMEDIOS DEL GRUPO */}
                    <tfoot>
                      <tr style={{ background:'#EDF2FA', borderTop:'2px solid #1B3A6B' }}>
                        <td style={{ padding:'10px 16px', fontWeight:800, color:'#1B3A6B', position:'sticky', left:0, background:'#EDF2FA', fontSize:12 }}>
                          📊 Promedio del grupo
                        </td>
                        {(historial[0]?.periodos || []).map((p, i) => {
                          const ns = historial.map(h => h.periodos[i]?.promedio).filter(n => n !== null)
                          const grupoP = ns.length > 0 ? Math.round(ns.reduce((a,b) => a+b,0)/ns.length) : null
                          return (
                            <td key={p.periodoId} style={{ textAlign:'center', padding:'10px 8px' }}>
                              {grupoP !== null ? (
                                <span style={{ fontWeight:800, color:colorNota(grupoP), fontSize:14 }}>{grupoP}</span>
                              ) : <span style={{ color:'#CCC' }}>—</span>}
                            </td>
                          )
                        })}
                        <td style={{ textAlign:'center', padding:'10px 12px', borderLeft:'2px solid #D6E4F7' }}>
                          {(() => {
                            const todos = historial.flatMap(h => h.periodos.map(p => p.promedio)).filter(n => n !== null)
                            const g = todos.length > 0 ? Math.round(todos.reduce((a,b) => a+b,0)/todos.length) : null
                            return g !== null ? <span style={{ fontWeight:900, color:colorNota(g), fontSize:16 }}>{g}</span> : <span style={{ color:'#CCC' }}>—</span>
                          })()}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── VISTA RESUMEN POR COMPETENCIA ── */}
        {vista === 'resumen' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Sub-tabs Simple / Multi */}
            {hayActsMulti && (
              <div style={{ display:'flex', gap:4, background:'#fff', borderRadius:10, padding:4, border:'1px solid #DDE3ED', width:'fit-content' }}>
                {[
                  { k:'simple', label:'📊 Simple' },
                  { k:'multi',  label:'🔀 Multi-competencia' },
                ].map(t => (
                  <button key={t.k} onClick={() => setTabResumen(t.k)} style={{
                    padding:'6px 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:700,
                    background: tabResumen === t.k ? '#1B3A6B' : 'transparent',
                    color:      tabResumen === t.k ? '#fff'    : '#888',
                    cursor:'pointer', transition:'all .12s',
                  }}>{t.label}</button>
                ))}
              </div>
            )}

            {/* ── SUB-TAB MULTI ── */}
            {tabResumen === 'multi' && (() => {
              if (cargandoMultiTab) return (
                <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', border:'1px solid #DDE3ED' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>⏳</div>
                  <p style={{ color:'#888', fontSize:13 }}>Calculando notas multi-competencia...</p>
                </div>
              )

              const actsMulti = actividades.filter(a => a.modo === 'multi')
              if (actsMulti.length === 0) return (
                <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', border:'1px solid #DDE3ED' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>🔀</div>
                  <p style={{ color:'#888', fontSize:13, marginBottom:8 }}>No hay actividades multi-competencia en este período.</p>
                  <button onClick={() => { setForm({ ...VACIO, modo:'multi' }); setModalAct(true) }} style={{ padding:'8px 20px', background:'#2563A8', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    + Crear actividad multi
                  </button>
                </div>
              )

              // Determinar qué competencias tienen al menos una actividad multi en el período
              const compsPresentes = COMPETENCIAS_MULTI.filter(c =>
                actsMulti.some(a => {
                  const cs = a.competencias_multi ? JSON.parse(a.competencias_multi) : []
                  return cs.includes(c.key)
                })
              )

              const datosEst = estudiantes.map(est => {
                const mapa = resumenMultiData[est.id]?.competencias || {}
                const prom = resumenMultiData[est.id]?.promedio ?? null
                return { est, mapa, prom }
              })

              const conProm   = datosEst.filter(d => d.prom !== null)
              const verdes    = conProm.filter(d => d.prom >= semVerde).length
              const amarillos = conProm.filter(d => d.prom >= minAprobatorio && d.prom < semVerde).length
              const rojos     = conProm.filter(d => d.prom < minAprobatorio).length
              // Promedio del grupo: promedio simple de las notas finales (ya ponderadas) de cada estudiante.
              const promGrupo = conProm.length > 0 ? Math.round(conProm.reduce((a, d) => a + d.prom, 0) / conProm.length) : null
              const colGrupo  = promGrupo === null ? '#888' : promGrupo >= semVerde ? '#1A6B3A' : promGrupo >= minAprobatorio ? '#C84B00' : '#B71C1C'
              const promsComp = {}
              compsPresentes.forEach(c => {
                const ns = datosEst.map(d => d.mapa[c.key]?.nota ?? null).filter(n => n !== null)
                promsComp[c.key] = ns.length > 0 ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : null
              })

              return <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
                  {[
                    { label:'Promedio del grupo', val: promGrupo ?? '—', color: colGrupo, big:true },
                    { label:'🟢 Aprobados', val: verdes,    color:'#1A6B3A', sub:`≥ ${semVerde}` },
                    { label:'🟡 En riesgo',  val: amarillos, color:'#C84B00', sub:`${minAprobatorio}–${semVerde-1}` },
                    { label:'🔴 Reprobados', val: rojos,     color:'#B71C1C', sub:`< ${minAprobatorio}` },
                    { label:'Sin notas aún', val: estudiantes.length - conProm.length, color:'#888', sub:'estudiantes' },
                  ].map(s => (
                    <div key={s.label} style={{ background:'#fff', borderRadius:12, padding:'14px 16px', border:'1px solid #DDE3ED', textAlign:'center', boxShadow:'0 2px 8px #0001' }}>
                      <div style={{ fontSize: s.big ? 32 : 26, fontWeight:900, color:s.color }}>{s.val}</div>
                      <div style={{ fontSize:11, color:'#888', marginTop:4 }}>{s.label}</div>
                      {s.sub && <div style={{ fontSize:10, color:'#BBB', marginTop:2 }}>{s.sub}</div>}
                    </div>
                  ))}
                </div>

                <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', overflow:'auto' }}>
                  <table style={{ borderCollapse:'collapse', width:'100%', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#1B3A6B' }}>
                        <th style={{ padding:'10px 16px', color:'#9BBFED', textAlign:'left', fontWeight:700, position:'sticky', left:0, background:'#1B3A6B', zIndex:10, whiteSpace:'nowrap' }}>Estudiante</th>
                        {compsPresentes.map(c => (
                          <th key={c.key} style={{ padding:'10px 12px', color:'#9BBFED', textAlign:'center', fontWeight:700, minWidth:110 }}>
                            <div>{c.icono}</div><div style={{ fontSize:10, marginTop:2 }}>{c.key}</div>
                          </th>
                        ))}
                        <th style={{ padding:'10px 16px', color:'#FFD700', textAlign:'center', fontWeight:700, minWidth:120, borderLeft:'2px solid #2E5090' }}>PROMEDIO FINAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosEst.map(({ est, mapa, prom }, idx) => {
                        const colP = prom === null ? '#888' : prom >= semVerde ? '#1A6B3A' : prom >= minAprobatorio ? '#C84B00' : '#B71C1C'
                        const sem  = prom === null ? '⬜' : prom >= semVerde ? '🟢' : prom >= minAprobatorio ? '🟡' : '🔴'
                        return (
                          <tr key={est.id} style={{ background: idx%2===0 ? '#fff' : '#FAFBFD' }}>
                            <td style={{ padding:'10px 16px', fontWeight:600, color:'#1B3A6B', position:'sticky', left:0, background:'inherit', borderRight:'1px solid #E8EDF5', whiteSpace:'nowrap' }}>
                              <span style={{ color:'#999', marginRight:6, fontSize:11 }}>{String(est.numero_lista).padStart(2,'0')}</span>{est.nombre_completo}
                            </td>
                            {compsPresentes.map(c => {
                              const nota = mapa[c.key]?.nota ?? null
                              const col  = nota === null ? '#CCC' : nota >= semVerde ? '#1A6B3A' : nota >= minAprobatorio ? '#C84B00' : '#B71C1C'
                              return (
                                <td key={c.key} style={{ textAlign:'center', padding:'10px 8px' }}>
                                  {nota !== null ? (
                                    <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                                      <div style={{ fontSize:16, fontWeight:800, color:col }}>{nota}</div>
                                      <div style={{ width:28, height:4, borderRadius:2, background: nota>=semVerde?'#D6EEE0':nota>=minAprobatorio?'#FDECD7':'#FDDFDF' }}>
                                        <div style={{ height:'100%', borderRadius:2, background:col, width:Math.min(nota,100)+'%' }} />
                                      </div>
                                    </div>
                                  ) : <span style={{ color:'#CCC', fontSize:13 }}>—</span>}
                                </td>
                              )
                            })}
                            <td style={{ textAlign:'center', padding:'10px 12px', borderLeft:'2px solid #EEF2F7' }}>
                              {prom !== null ? (
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                                  <span style={{ fontSize:16 }}>{sem}</span>
                                  <div style={{ background:colP+'20', color:colP, padding:'5px 14px', borderRadius:20, fontWeight:900, fontSize:15 }}>{prom}</div>
                                </div>
                              ) : <span style={{ color:'#CCC' }}>—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:'#EDF2FA', borderTop:'2px solid #1B3A6B' }}>
                        <td style={{ padding:'10px 16px', fontWeight:800, color:'#1B3A6B', position:'sticky', left:0, background:'#EDF2FA', fontSize:12 }}>📊 Promedio del grupo</td>
                        {compsPresentes.map(c => {
                          const n   = promsComp[c.key]
                          const col = n === null ? '#CCC' : n >= semVerde ? '#1A6B3A' : n >= minAprobatorio ? '#C84B00' : '#B71C1C'
                          return (
                            <td key={c.key} style={{ textAlign:'center', padding:'10px 8px' }}>
                              {n !== null ? <span style={{ fontWeight:800, color:col, fontSize:14 }}>{n}</span> : <span style={{ color:'#CCC' }}>—</span>}
                            </td>
                          )
                        })}
                        <td style={{ textAlign:'center', padding:'10px 12px', borderLeft:'2px solid #D6E4F7' }}>
                          {promGrupo !== null ? (
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                              <span style={{ fontSize:16 }}>{promGrupo>=semVerde?'🟢':promGrupo>=minAprobatorio?'🟡':'🔴'}</span>
                              <span style={{ fontWeight:900, color:colGrupo, fontSize:16 }}>{promGrupo}</span>
                            </div>
                          ) : <span style={{ color:'#CCC' }}>—</span>}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            })()}

            {/* ── SUB-TAB SIMPLE ── */}
            {tabResumen === 'simple' && (estudiantes.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', border:'1px solid #DDE3ED' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>👨‍🎓</div>
                <p style={{ color:'#888', fontSize:13 }}>Agrega estudiantes al curso primero</p>
              </div>
            ) : (() => {
              const datosEst = estudiantes.map(est => {
                const comps = calcularCompetencias(est.id, todasCalifs)
                const notas = Object.values(comps).filter(n => n !== null)
                const prom  = notas.length > 0 ? Math.round(notas.reduce((a,b) => a+b, 0) / notas.length) : null
                return { est, comps, prom }
              })
              const conProm   = datosEst.filter(d => d.prom !== null)
              const verdes    = conProm.filter(d => d.prom >= semVerde).length
              const amarillos = conProm.filter(d => d.prom >= minAprobatorio && d.prom < semVerde).length
              const rojos     = conProm.filter(d => d.prom < minAprobatorio).length
              const promGrupo = conProm.length > 0 ? Math.round(conProm.reduce((a,d) => a + d.prom, 0) / conProm.length) : null
              const colGrupo  = promGrupo === null ? '#888' : promGrupo >= semVerde ? '#1A6B3A' : promGrupo >= minAprobatorio ? '#C84B00' : '#B71C1C'
              const promsComp = {}
              COMPETENCIAS.forEach(c => {
                const ns = datosEst.map(d => d.comps[c.key]).filter(n => n !== null)
                promsComp[c.key] = ns.length > 0 ? Math.round(ns.reduce((a,b) => a+b,0)/ns.length) : null
              })

              return <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
                  {[
                    { label:'Promedio del grupo', val: promGrupo ?? '—', color: colGrupo, big:true },
                    { label:'🟢 Aprobados', val: verdes,    color:'#1A6B3A', sub:`≥ ${semVerde}` },
                    { label:'🟡 En riesgo',  val: amarillos, color:'#C84B00', sub:`${minAprobatorio}–${semVerde - 1}` },
                    { label:'🔴 Reprobados', val: rojos,     color:'#B71C1C', sub:`< ${minAprobatorio}` },
                    { label:'Sin notas aún', val: estudiantes.length - conProm.length, color:'#888', sub:'estudiantes' },
                  ].map(s => (
                    <div key={s.label} style={{ background:'#fff', borderRadius:12, padding:'14px 16px', border:'1px solid #DDE3ED', textAlign:'center', boxShadow:'0 2px 8px #0001' }}>
                      <div style={{ fontSize: s.big ? 32 : 26, fontWeight:900, color:s.color }}>{s.val}</div>
                      <div style={{ fontSize:11, color:'#888', marginTop:4 }}>{s.label}</div>
                      {s.sub && <div style={{ fontSize:10, color:'#BBB', marginTop:2 }}>{s.sub}</div>}
                    </div>
                  ))}
                </div>

                <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', overflow:'auto' }}>
                  <table style={{ borderCollapse:'collapse', width:'100%', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#1B3A6B' }}>
                        <th style={{ padding:'10px 16px', color:'#9BBFED', textAlign:'left', fontWeight:700, position:'sticky', left:0, background:'#1B3A6B', zIndex:10, whiteSpace:'nowrap' }}>Estudiante</th>
                        {COMPETENCIAS.map(c => (
                          <th key={c.key} style={{ padding:'10px 12px', color:'#9BBFED', textAlign:'center', fontWeight:700, minWidth:100 }}>
                            <div>{c.icono}</div><div style={{ fontSize:10, marginTop:2 }}>{c.key}</div>
                          </th>
                        ))}
                        <th style={{ padding:'10px 16px', color:'#FFD700', textAlign:'center', fontWeight:700, minWidth:120, borderLeft:'2px solid #2E5090' }}>PROMEDIO FINAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosEst.map(({ est, comps, prom }, idx) => {
                        const colP = prom === null ? '#888' : prom >= semVerde ? '#1A6B3A' : prom >= minAprobatorio ? '#C84B00' : '#B71C1C'
                        const sem  = prom === null ? '⬜' : prom >= semVerde ? '🟢' : prom >= minAprobatorio ? '🟡' : '🔴'
                        return (
                          <tr key={est.id} style={{ background: idx%2===0 ? '#fff' : '#FAFBFD' }}>
                            <td style={{ padding:'10px 16px', fontWeight:600, color:'#1B3A6B', position:'sticky', left:0, background:'inherit', borderRight:'1px solid #E8EDF5', whiteSpace:'nowrap' }}>
                              <span style={{ color:'#999', marginRight:6, fontSize:11 }}>{String(est.numero_lista).padStart(2,'0')}</span>{est.nombre_completo}
                            </td>
                            {COMPETENCIAS.map(c => {
                              const nota = comps[c.key]
                              const col = nota === null ? '#CCC' : nota >= 85 ? '#1A6B3A' : nota >= 70 ? '#C84B00' : '#B71C1C'
                              return (
                                <td key={c.key} style={{ textAlign:'center', padding:'10px 8px' }}>
                                  {nota !== null ? (
                                    <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                                      <div style={{ fontSize:16, fontWeight:800, color:col }}>{nota}</div>
                                      <div style={{ width:28, height:4, borderRadius:2, background: nota>=85?'#D6EEE0':nota>=70?'#FDECD7':'#FDDFDF' }}>
                                        <div style={{ height:'100%', borderRadius:2, background:col, width:Math.min(nota,100)+'%' }} />
                                      </div>
                                    </div>
                                  ) : <span style={{ color:'#CCC', fontSize:13 }}>—</span>}
                                </td>
                              )
                            })}
                            <td style={{ textAlign:'center', padding:'10px 12px', borderLeft:'2px solid #EEF2F7' }}>
                              {prom !== null ? (
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                                  <span style={{ fontSize:16 }}>{sem}</span>
                                  <div style={{ background:colP+'20', color:colP, padding:'5px 14px', borderRadius:20, fontWeight:900, fontSize:15 }}>{prom}</div>
                                </div>
                              ) : <span style={{ color:'#CCC' }}>—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:'#EDF2FA', borderTop:'2px solid #1B3A6B' }}>
                        <td style={{ padding:'10px 16px', fontWeight:800, color:'#1B3A6B', position:'sticky', left:0, background:'#EDF2FA', fontSize:12 }}>📊 Promedio del grupo</td>
                        {COMPETENCIAS.map(c => {
                          const n = promsComp[c.key]
                          const col = n===null?'#CCC':n>=85?'#1A6B3A':n>=70?'#C84B00':'#B71C1C'
                          return (
                            <td key={c.key} style={{ textAlign:'center', padding:'10px 8px' }}>
                              {n!==null?<span style={{ fontWeight:800, color:col, fontSize:14 }}>{n}</span>:<span style={{ color:'#CCC' }}>—</span>}
                            </td>
                          )
                        })}
                        <td style={{ textAlign:'center', padding:'10px 12px', borderLeft:'2px solid #D6E4F7' }}>
                          {promGrupo!==null?(
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                              <span style={{ fontSize:16 }}>{promGrupo>=semVerde?'🟢':promGrupo>=minAprobatorio?'🟡':'🔴'}</span>
                              <span style={{ fontWeight:900, color:colGrupo, fontSize:16 }}>{promGrupo}</span>
                            </div>
                          ):<span style={{ color:'#CCC' }}>—</span>}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            })())}
          </div>
        )}

        {/* ── VISTA ACTIVIDADES ── */}
        {vista === 'actividades' && (() => {
          const actsSimple = actividades.filter(a => (a.modo || 'simple') === 'simple')
          const actsMulti  = actividades.filter(a => a.modo === 'multi')

          // Franja: peso acumulado por competencia en el período
          const COL_MULTI = Object.fromEntries(COMPETENCIAS.map(c => [c.key, c.color]))
          const franjaComps = COMPETENCIAS.map(comp => {
            const pesoS = actsSimple.filter(a => a.competencia === comp.key).reduce((s, a) => s + a.peso, 0)
            const pesoM = actsMulti.reduce((s, a) => {
              const cs = a.competencias_multi ? JSON.parse(a.competencias_multi) : []
              return cs.includes(comp.key) ? s + a.peso / cs.length : s
            }, 0)
            return { ...comp, peso: Math.round((pesoS + pesoM) * 10) / 10 }
          }).filter(c => c.peso > 0)
          const pesoTotal = Math.round(franjaComps.reduce((s, c) => s + c.peso, 0) * 10) / 10
          const colTotal  = pesoTotal > 100.01 ? '#B71C1C' : pesoTotal >= 99.9 ? '#1A6B3A' : '#C84B00'
          const actsSimplePorComp = {}
          COMPETENCIAS.forEach(c => { actsSimplePorComp[c.key] = actsSimple.filter(a => a.competencia === c.key) })

          return (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* ── Franja de peso ── */}
              {actividades.length > 0 && (
                <div style={{ background:'#fff', borderRadius:12, padding:'12px 16px', border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    {franjaComps.map(c => (
                      <span key={c.key} style={{ display:'inline-flex', alignItems:'center', gap:4, background:COL_MULTI[c.key]+'18', color:COL_MULTI[c.key], border:'1px solid '+COL_MULTI[c.key]+'40', borderRadius:20, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
                        {c.icono} {c.key.slice(0,3)} <span style={{ opacity:.7 }}>{c.peso} pts</span>
                      </span>
                    ))}
                    <div style={{ flex:1, minWidth:80, height:10, background:'#EEF2F7', borderRadius:6, overflow:'hidden', display:'flex' }}>
                      {franjaComps.map(c => (
                        <div key={c.key} style={{ height:'100%', width:Math.min(c.peso, 100)+'%', background:COL_MULTI[c.key], transition:'width .3s' }} />
                      ))}
                    </div>
                    <span style={{ fontSize:13, fontWeight:800, color:colTotal, whiteSpace:'nowrap' }}>
                      {pesoTotal}/100 {pesoTotal >= 99.9 && pesoTotal <= 100.01 ? '✓' : ''}
                    </span>
                  </div>
                </div>
              )}

              {actividades.length === 0 ? (
                <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', border:'1px solid #DDE3ED' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>📝</div>
                  <p style={{ color:'#888', fontSize:13, marginBottom:16 }}>No hay actividades todavía</p>
                  <button onClick={() => { setForm(VACIO); setModalAct(true) }} style={{ padding:'9px 24px', background:'#2563A8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    + Crear primera actividad
                  </button>
                </div>
              ) : (
                <>
                  {/* Actividades modo multi */}
                  {actsMulti.length > 0 && (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <span style={{ fontSize:16 }}>🔀</span>
                        <span style={{ fontWeight:700, fontSize:14, color:'#2563A8' }}>Multi-competencia</span>
                        <span style={{ background:'#D6E4F7', color:'#2563A8', padding:'1px 8px', borderRadius:10, fontSize:11, fontWeight:600 }}>{actsMulti.length} actividades</span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:10 }}>
                        {actsMulti.map(act => {
                          const compsRaw = act.competencias_multi ? JSON.parse(act.competencias_multi) : []
                          compsRaw.forEach(k => { if (!COMPETENCIAS.some(c => c.key === k)) console.warn('[badges] competencia desconocida ignorada:', k, 'act', act.id) })
                          const comps = COMPETENCIAS.filter(c => compsRaw.includes(c.key)).map(c => c.key)
                          return (
                            <div key={act.id} onClick={() => abrirNotas(act)} style={{
                              background:'#fff', borderRadius:10, padding:14, border:'1px solid #DDE3ED',
                              boxShadow:'0 2px 8px #0001', cursor:'pointer', transition:'all .15s',
                              borderLeft:'3px solid #2563A8',
                            }}
                              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 20px #0002' }}
                              onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 2px 8px #0001' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                                <span style={{ fontSize:16 }}>{TIPO_ICONO[act.tipo]||'📝'}</span>
                                <div style={{ fontWeight:700, fontSize:13, color:'#1B3A6B', flex:1 }}>{act.nombre}</div>
                                <button onClick={e => abrirEditar(act, e)} style={{ background:'#EEF2F7', border:'none', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer', color:'#555', fontWeight:600 }}>✏️</button>
                                <button onClick={e => eliminarActividad(act, e)} style={{ background:'#FEE2E2', border:'none', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer', color:'#B91C1C', fontWeight:600 }}>🗑️</button>
                              </div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
                                <span style={{ background:'#D6E4F7', color:'#2563A8', padding:'2px 8px', borderRadius:8, fontSize:10, fontWeight:700 }}>Multi</span>
                                {comps.map(c => (
                                  <span key={c} style={{ background:(COL_MULTI[c]||'#888')+'18', color:COL_MULTI[c]||'#888', padding:'2px 7px', borderRadius:8, fontSize:10, fontWeight:600 }}>{c.slice(0,3)}</span>
                                ))}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                <span style={{ background:'#D6E4F7', color:'#2563A8', padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:600 }}>Peso: {act.peso} ({comps.length > 0 ? (act.peso/comps.length).toFixed(1)+' c/u' : '—'})</span>
                                <span style={{ fontSize:11, color:'#888' }}>{act.fecha||''}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actividades modo simple agrupadas por competencia */}
                  {COMPETENCIAS.map(comp => {
                    const acts = actsSimplePorComp[comp.key]
                    if (!acts || acts.length === 0) return null
                    return (
                      <div key={comp.key}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                          <span style={{ fontSize:16 }}>{comp.icono}</span>
                          <span style={{ fontWeight:700, fontSize:14, color:comp.color }}>{comp.key}</span>
                          <span style={{ background:comp.bg, color:comp.color, padding:'1px 8px', borderRadius:10, fontSize:11, fontWeight:600 }}>{acts.length} actividades</span>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:10 }}>
                          {acts.map(act => (
                            <div key={act.id} onClick={() => abrirNotas(act)} style={{
                              background:'#fff', borderRadius:10, padding:14, border:'1px solid #DDE3ED',
                              boxShadow:'0 2px 8px #0001', cursor:'pointer', transition:'all .15s',
                              borderLeft:'3px solid '+comp.color,
                            }}
                              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 20px #0002' }}
                              onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 2px 8px #0001' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                                <span style={{ fontSize:16 }}>{TIPO_ICONO[act.tipo]||'📝'}</span>
                                <div style={{ fontWeight:700, fontSize:13, color:'#1B3A6B', flex:1 }}>{act.nombre}</div>
                                <button onClick={e => abrirEditar(act, e)} style={{ background:'#EEF2F7', border:'none', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer', color:'#555', fontWeight:600 }}>✏️</button>
                                <button onClick={e => eliminarActividad(act, e)} style={{ background:'#FEE2E2', border:'none', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer', color:'#B91C1C', fontWeight:600 }}>🗑️</button>
                              </div>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                <span style={{ background:comp.bg, color:comp.color, padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:600 }}>Peso: {act.peso}</span>
                                <span style={{ fontSize:11, color:'#888' }}>{act.fecha||''}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )
        })()}

        {/* ── VISTA NOTAS DE ACTIVIDAD ── */}
        {vista === 'notas' && actSel && (() => {
          const esMulti = actSel.modo === 'multi'
          const compsMultiRaw = esMulti && actSel.competencias_multi ? JSON.parse(actSel.competencias_multi) : []
          compsMultiRaw.forEach(k => { if (!COMPETENCIAS.some(c => c.key === k)) console.warn('[notas] competencia desconocida ignorada:', k, 'act', actSel.id) })
          const compsMulti = COMPETENCIAS.filter(c => compsMultiRaw.includes(c.key)).map(c => c.key)
          const COL_MULTI = Object.fromEntries(COMPETENCIAS.map(c => [c.key, c.color]))

          // Filtro por grupo de trabajo: solo cambia qué filas se ven. Notas, guardado y
          // promedios siguen usando `califs` completo, así ambas vistas quedan siempre en sync.
          const gruposDisp = [...new Set(califs.map(e => e.grupo_trabajo).filter(g => g != null))].sort((a, b) => a - b)
          const haySinGrupo = gruposDisp.length > 0 && califs.some(e => e.grupo_trabajo == null)
          const filtroActivo = grupoFiltro !== null && (grupoFiltro === 'sin' ? haySinGrupo : gruposDisp.includes(grupoFiltro))
          const califsVis = !filtroActivo ? califs
            : grupoFiltro === 'sin' ? califs.filter(e => e.grupo_trabajo == null)
            : califs.filter(e => e.grupo_trabajo === grupoFiltro)
          const celdaPart = est => {
            if (!partAct) return <div />
            const v = partAct.porEstudiante[est.id] || { actividad:0, periodo:0 }
            const principal = partAct.vinculada ? v.actividad : v.periodo
            return (
              <button onClick={() => verHistorialPart({ ...est, participacion: v.periodo })}
                title={partAct.vinculada ? 'Esta actividad / total del período — clic para ver el historial' : 'Total del período (sin temas vinculados) — clic para ver el historial'}
                style={{ background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'center', fontSize:13, fontWeight:700, color:colorPts(principal) }}>
                {principal !== 0 ? fmtPts(principal) : (partAct.vinculada ? '0' : '—')}
                {partAct.vinculada && <span style={{ fontSize:11, fontWeight:400, color:'#AAB4C4' }}> / {fmtPts(v.periodo)}</span>}
              </button>
            )
          }
          const chipGrupo = (key, label, lista) => {
            const on = key === null ? !filtroActivo : filtroActivo && grupoFiltro === key
            const hechos = lista.filter(e => e.nota !== '').length
            return (
              <button key={String(key)} onClick={() => setGrupoFiltro(key)}
                style={{ padding:'5px 12px', borderRadius:16, fontSize:12, fontWeight:700, cursor:'pointer',
                  border:'1.5px solid '+(on ? colPer : '#DDE3ED'), background: on ? colPer : '#fff', color: on ? '#fff' : '#1B3A6B' }}>
                {label} <span style={{ opacity:.75, fontWeight:600 }}>{hechos}/{lista.length}</span>
              </button>
            )
          }

          return (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <button onClick={() => setVista('actividades')} style={{ padding:'7px 14px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:12, cursor:'pointer', color:'#1B3A6B', fontWeight:600 }}>← Volver</button>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:'#1B3A6B' }}>{TIPO_ICONO[actSel.tipo]} {actSel.nombre}</div>
                  <div style={{ fontSize:12, color:'#888' }}>
                    {esMulti
                      ? <>Multi-competencia · {compsMulti.join(', ')} · Peso: {actSel.peso}{actSel.fecha ? ' · '+actSel.fecha : ''}</>
                      : <>{actSel.competencia} · {actSel.tipo} · Peso: {actSel.peso}{actSel.fecha ? ' · '+actSel.fecha : ''}</>
                    }
                  </div>
                </div>
                <div style={{ flex:1 }} />
                {prom !== null && (
                  <div style={{ textAlign:'center', background:'#fff', borderRadius:10, padding:'8px 16px', border:'1px solid #DDE3ED' }}>
                    <div style={{ fontSize:22, fontWeight:900, color:colorProm }}>{prom}</div>
                    <div style={{ fontSize:11, color:'#888' }}>promedio</div>
                  </div>
                )}
              </div>

              {/* ── FILTRO POR GRUPO (solo si el curso tiene grupos asignados) ── */}
              {gruposDisp.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#7A8FA8', marginRight:2 }}>👥 GRUPO</span>
                  {chipGrupo(null, 'Todos', califs)}
                  {gruposDisp.map(g => chipGrupo(g, 'G'+g, califs.filter(e => e.grupo_trabajo === g)))}
                  {haySinGrupo && chipGrupo('sin', 'Sin grupo', califs.filter(e => e.grupo_trabajo == null))}
                </div>
              )}

              {partAct && (
                <div style={{ marginBottom:12, padding:'8px 14px', borderRadius:10, fontSize:12,
                  background: partAct.vinculada ? '#F0FDF4' : '#F8FAFD', border:'1px solid '+(partAct.vinculada ? '#BBE5C8' : '#E8EDF5'), color:'#555' }}>
                  ✋ <strong>Participación</strong> (solo referencia, no cambia la nota) —{' '}
                  {partAct.vinculada
                    ? <>de esta actividad: {partAct.temas.map(t => t.titulo).join(' · ')}</>
                    : <span style={{ color:'#888' }}>sin temas vinculados, se muestra el total del período. Vincúlalos con ✏️ en la actividad.</span>}
                </div>
              )}

              {/* ── MODO SIMPLE ── */}
              {!esMulti && (
                <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', overflow:'hidden' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'50px 1fr 150px 110px', background:'#1B3A6B', padding:'10px 20px', gap:10 }}>
                    {['#','Estudiante','Nota (0-100)','✋ Particip.'].map(h => (
                      <div key={h} style={{ color:'#9BBFED', fontSize:11, fontWeight:700 }}>{h}</div>
                    ))}
                  </div>
                  {califs.length === 0
                    ? <div style={{ padding:30, textAlign:'center', color:'#888', fontSize:13 }}>Agrega estudiantes al curso primero</div>
                    : califsVis.map((e, idx) => {
                      const n = e.nota===''?null:Number(e.nota)
                      const col = colorNota(n)
                      return (
                        <div key={e.id} style={{ display:'grid', gridTemplateColumns:'50px 1fr 150px 110px', padding:'10px 20px', gap:10, alignItems:'center', borderTop:idx>0?'1px solid #F0F4FA':'none', background:idx%2===0?'#fff':'#FAFBFD' }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#7A8FA8' }}>{String(e.numero_lista).padStart(2,'0')}</div>
                          <div style={{ fontSize:13, fontWeight:600, color:'#1B3A6B' }}>{e.nombre_completo}</div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <input type="number" min="0" max="100" value={e.nota}
                              onChange={ev => guardarNota(e.id, ev.target.value)} placeholder="—"
                              style={{ width:70, border:'1.5px solid #DDE3ED', borderRadius:8, padding:'6px 10px', fontSize:14, fontWeight:700, textAlign:'center', outline:'none', color:n!==null?col:'#888' }}
                              onFocus={ev => ev.target.style.borderColor=colPer}
                              onBlur={ev => ev.target.style.borderColor='#DDE3ED'} />
                            {n!==null && <div style={{ width:10, height:10, borderRadius:'50%', background:col }} />}
                          </div>
                          {celdaPart(e)}
                        </div>
                      )
                    })
                  }
                  {califs.length > 0 && (
                    <div style={{ padding:'12px 20px', background:'#F8FAFD', borderTop:'2px solid #E8EDF5', display:'flex', gap:24 }}>
                      {[
                        { label:'Con nota',   val: conNota.length+'/'+califs.length, color:'#1B3A6B' },
                        { label:'Promedio',   val: prom??'—',                        color:colorProm },
                        { label:'Aprobados',  val: califs.filter(e=>e.nota!==''&&Number(e.nota)>=minAprobatorio).length, color:'#1A6B3A' },
                        { label:'Reprobados', val: califs.filter(e=>e.nota!==''&&Number(e.nota)<minAprobatorio).length, color:'#B71C1C' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign:'center' }}>
                          <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.val}</div>
                          <div style={{ fontSize:11, color:'#888' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── MODO MULTI ── */}
              {esMulti && (() => {
                const nc    = compsMulti.length
                const techo = nc > 0 ? Math.round(100 / nc * 10) / 10 : 0
                return (
                  <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', overflow:'auto' }}>
                    {/* Encabezado descriptivo */}
                    <div style={{ padding:'10px 16px', background:'#EEF5FF', borderBottom:'1px solid #DDE3ED', fontSize:12, color:'#2563A8' }}>
                      🔀 Distribución por competencia (máx <strong>{techo}</strong> pts por comp) — La nota global se calcula automáticamente como suma.
                    </div>
                    {/* Cabecera tabla — 4 cols fijas en orden canónico */}
                    <div style={{ display:'grid', gridTemplateColumns:'50px 1fr 110px 110px 110px 110px 100px 90px', background:'#1B3A6B', padding:'10px 16px', gap:8, alignItems:'center' }}>
                      {['#','Estudiante'].map(h => <div key={h} style={{ color:'#9BBFED', fontSize:11, fontWeight:700 }}>{h}</div>)}
                      {COMPETENCIAS.map(c => {
                        const activa = compsMulti.includes(c.key)
                        return (
                          <div key={c.key} style={{ textAlign:'center', opacity: activa ? 1 : 0.3 }}>
                            <div style={{ fontSize:14 }}>{c.icono}</div>
                            <div style={{ fontSize:11, fontWeight:700, color: activa ? c.color : '#9BBFED', whiteSpace:'nowrap' }}>{c.label}</div>
                            {activa
                              ? <div style={{ opacity:.6, fontSize:9, color:'#9BBFED' }}>máx {techo}</div>
                              : <div style={{ fontSize:9, color:'#6B8CB4', fontStyle:'italic' }}>no aplica</div>
                            }
                          </div>
                        )
                      })}
                      <div style={{ color:'#FFD700', fontSize:10, fontWeight:700, textAlign:'center' }}>NOTA GLOBAL</div>
                      <div style={{ color:'#9BBFED', fontSize:10, fontWeight:700, textAlign:'center' }}>✋ PARTICIP.</div>
                    </div>
                    {califs.length === 0
                      ? <div style={{ padding:30, textAlign:'center', color:'#888', fontSize:13 }}>Agrega estudiantes al curso primero</div>
                      : califsVis.map((e, idx) => {
                        const guardado = e.nota !== ''
                        const dist     = distribuciones[e.id] || defaultDist(compsMulti)
                        const notaGlobal = Math.round(Object.values(dist).reduce((a, b) => a + Number(b||0), 0) * 10) / 10
                        const hayExceso  = compsMulti.some(c => (dist[c]||0) > techo + 0.01)
                        const colNota    = hayExceso ? '#B71C1C' : colorNota(guardado ? notaGlobal : null)
                        return (
                          <div key={e.id} style={{ display:'grid', gridTemplateColumns:'50px 1fr 110px 110px 110px 110px 100px 90px', padding:'8px 16px', gap:8, alignItems:'center', borderTop:idx>0?'1px solid #F0F4FA':'none', background:idx%2===0?'#fff':'#FAFBFD' }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#7A8FA8' }}>{String(e.numero_lista).padStart(2,'0')}</div>
                            <div style={{ fontSize:12, fontWeight:600, color:'#1B3A6B', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.nombre_completo}</div>
                            {/* Inputs por competencia — 4 cols fijas en orden canónico */}
                            {COMPETENCIAS.map(ci => {
                              const activa = compsMulti.includes(ci.key)
                              if (!activa) return (
                                <div key={ci.key} style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  <div style={{ width:72, height:30, border:'1.5px dashed #E5E9F0', borderRadius:8, background:'#F8FAFD', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'#D1D5DB' }}>—</div>
                                </div>
                              )
                              const excede = (dist[ci.key]||0) > techo + 0.01
                              return (
                                <div key={ci.key} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                                  <input type="number" min="0" max={techo} step="0.1"
                                    value={dist[ci.key] ?? ''}
                                    onChange={ev => cambiarDistComp(e.id, ci.key, ev.target.value)}
                                    onFocus={ev => { ev.target.style.borderColor = excede ? '#B71C1C' : ci.color }}
                                    onBlur={ev => { ev.target.style.borderColor = (excede ? '#B71C1C' : ci.color)+'60'; guardarDistComp(e.id) }}
                                    placeholder={String(techo)}
                                    style={{ width:72, border:'2px solid '+(excede?'#B71C1C':ci.color)+'60', borderRadius:8, padding:'5px 8px', fontSize:12, fontWeight:700, textAlign:'center', outline:'none', background: excede ? '#FFF0F0' : ci.bg+'80', color: excede ? '#B71C1C' : ci.color }}
                                  />
                                  {excede && <div style={{ fontSize:9, color:'#B71C1C', whiteSpace:'nowrap' }}>máx {techo}</div>}
                                </div>
                              )
                            })}
                            {/* Nota global (solo lectura) */}
                            <div style={{ textAlign:'center', fontSize:15, fontWeight:900, color: guardado ? colNota : '#BBBBBB' }}>
                              {hayExceso ? <span style={{ fontSize:11, color:'#B71C1C' }}>✗ excede</span> : notaGlobal}
                            </div>
                            {celdaPart(e)}
                          </div>
                        )
                      })
                    }
                    {califs.length > 0 && (
                      <div style={{ padding:'10px 16px', background:'#F8FAFD', borderTop:'2px solid #E8EDF5', fontSize:12, color:'#888' }}>
                        Con nota: <strong style={{ color:'#1B3A6B' }}>{conNota.length}/{califs.length}</strong>
                        {prom !== null && <> · Promedio: <strong style={{ color:colorProm }}>{prom}</strong></>}
                        {filtroActivo && <span style={{ marginLeft:10, fontStyle:'italic' }}>(totales de todo el curso)</span>}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )
        })()}
      </div>

      {/* MODAL NUEVA ACTIVIDAD */}
      {modalActT && (() => {
        const pesoUsado = actividades.filter(a => !editandoId || a.id !== editandoId).reduce((s, a) => s + a.peso, 0)
        const pesoIngresado = Number(form.peso) || 0
        const pesoDisponible = Math.max(0, 100 - pesoUsado)
        const pesoExcede = pesoUsado + pesoIngresado > 100.01
        const multiSinComps = form.modo === 'multi' && form.competencias_multi.length === 0
        const puedeGuardar = !pesoExcede && !multiSinComps
        const toggleCompMulti = key => setForm(p => ({
          ...p,
          competencias_multi: p.competencias_multi.includes(key)
            ? p.competencias_multi.filter(k => k !== key)
            : [...p.competencias_multi, key],
        }))
        return (
          <div className="modal-backdrop" data-closing={modalActT.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
            onClick={e => { if (e.target===e.currentTarget) { setModalAct(false); setFormError('') } }}>
            <div className="modal-content" data-closing={modalActT.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:500, boxShadow:'0 16px 48px #0004', maxHeight:'90vh', overflowY:'auto' }}>
              <h2 style={{ color:'#1B3A6B', marginBottom:16, fontSize:17 }}>{editandoId?'✏️ Editar Actividad':'+ Nueva Actividad'}</h2>

              {/* Nombre */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:5 }}>Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={e => { setFormError(''); setForm({...form, nombre: e.target.value}) }}
                  placeholder="Ej: Tarea 1 - Tipos de familia"
                  style={{ width:'100%', border:'1.5px solid '+(formError?'#B71C1C':'#DDE3ED'), borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }}
                  onFocus={e => { e.target.style.borderColor = formError ? '#B71C1C' : '#2563A8' }}
                  onBlur={e => { e.target.style.borderColor = formError ? '#B71C1C' : '#DDE3ED' }}
                />
                {formError && <div style={{ color:'#B71C1C', fontSize:11, marginTop:4 }}>{formError}</div>}
              </div>

              {/* Toggle simple / multi */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:8 }}>Modo de calificación</label>
                <div style={{ display:'flex', gap:0, background:'#EEF2F7', borderRadius:8, padding:3, width:'fit-content' }}>
                  {[{v:'simple',label:'Por competencia'},{v:'multi',label:'Multi-competencia'}].map(opt => (
                    <button key={opt.v} onClick={() => setForm(p => ({...p, modo:opt.v}))} style={{
                      padding:'6px 16px', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer',
                      background: form.modo===opt.v ? '#1B3A6B' : 'transparent',
                      color: form.modo===opt.v ? '#fff' : '#888', transition:'all .12s',
                    }}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Selector de competencia (modo simple) */}
              {form.modo === 'simple' && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:8 }}>Competencia *</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {COMPETENCIAS.map(c => (
                      <div key={c.key} onClick={() => setForm(p => ({...p,competencia:c.key}))} style={{
                        padding:'10px 12px', borderRadius:10, cursor:'pointer',
                        background:form.competencia===c.key?c.bg:'#F8FAFD',
                        border:'2px solid '+(form.competencia===c.key?c.color:'#DDE3ED'), transition:'all .12s',
                      }}>
                        <div style={{ fontSize:16, marginBottom:2 }}>{c.icono}</div>
                        <div style={{ fontSize:12, fontWeight:700, color:form.competencia===c.key?c.color:'#555' }}>{c.key}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checkboxes de competencias (modo multi) */}
              {form.modo === 'multi' && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:8 }}>
                    Competencias que cubre *
                    {form.competencias_multi.length > 0 &&
                      <span style={{ marginLeft:6, fontSize:11, color:'#888', fontWeight:400 }}>
                        (peso {(pesoIngresado / form.competencias_multi.length).toFixed(1)} pts cada una)
                      </span>
                    }
                  </label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {COMPETENCIAS_MULTI.map(c => {
                      const sel = form.competencias_multi.includes(c.key)
                      return (
                        <div key={c.key} onClick={() => toggleCompMulti(c.key)} style={{
                          padding:'10px 12px', borderRadius:10, cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                          background: sel ? c.bg : '#F8FAFD',
                          border:'2px solid '+(sel ? c.color : '#DDE3ED'), transition:'all .12s',
                        }}>
                          <div style={{ width:18, height:18, borderRadius:4, border:'2px solid '+(sel?c.color:'#CCC'), background:sel?c.color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            {sel && <span style={{ color:'#fff', fontSize:11, fontWeight:900 }}>✓</span>}
                          </div>
                          <div>
                            <span style={{ fontSize:14, marginRight:4 }}>{c.icono}</span>
                            <span style={{ fontSize:12, fontWeight:700, color:sel?c.color:'#555' }}>{c.label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {multiSinComps && <div style={{ fontSize:11, color:'#A32D2D', marginTop:6 }}>Selecciona al menos una competencia</div>}
                  {form.modo === 'multi' && <div style={{ fontSize:11, color:'#888', marginTop:6, padding:'6px 10px', background:'#F0F7FF', borderRadius:6 }}>
                    💡 El peso se divide equitativamente entre las competencias seleccionadas
                  </div>}
                </div>
              )}

              {/* Temas que evalúa: solo para ver la participación de esos temas al calificar */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:6 }}>
                  Temas que evalúa <span style={{ fontWeight:400, color:'#888' }}>(opcional — para ver la participación de esos temas)</span>
                </label>
                {temasPer.length === 0
                  ? <div style={{ fontSize:11, color:'#AAA', fontStyle:'italic' }}>No hay temas en este período (Temario).</div>
                  : <div style={{ maxHeight:150, overflowY:'auto', border:'1px solid #E8EDF5', borderRadius:8 }}>
                      {temasPer.map((t, i) => {
                        const sel = form.temaIds.includes(t.id)
                        return (
                          <label key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', fontSize:12, cursor:'pointer', borderTop:i>0?'1px solid #F0F4FA':'none', background: sel ? '#F0F7FF' : '#fff' }}>
                            <input type="checkbox" checked={sel}
                              onChange={() => setForm(p => ({ ...p, temaIds: sel ? p.temaIds.filter(x => x !== t.id) : [...p.temaIds, t.id] }))} />
                            <span style={{ color:'#1B3A6B', flex:1 }}>{t.titulo}</span>
                            {t.estado === 'realizado' && <span style={{ fontSize:10, color:'#1A6B3A' }}>✓ realizado</span>}
                          </label>
                        )
                      })}
                    </div>}
              </div>

              {/* Tipo / Peso / Fecha */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:8 }}>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:5 }}>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(p => ({...p,tipo:e.target.value}))}
                    style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'9px 10px', fontSize:12, outline:'none', background:'#fff' }}>
                    {TIPOS.map(t => <option key={t} value={t}>{TIPO_ICONO[t]} {t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:5 }}>Peso</label>
                  <input type="number" min="1" max="100" value={form.peso} onChange={e => setForm(p => ({...p,peso:e.target.value}))}
                    style={{ width:'100%', border:'1.5px solid '+(pesoExcede?'#B71C1C':'#DDE3ED'), borderRadius:8, padding:'9px 10px', fontSize:12, outline:'none', color:pesoExcede?'#B71C1C':'inherit' }}
                    onFocus={e => e.target.style.borderColor=pesoExcede?'#B71C1C':'#2563A8'} onBlur={e => e.target.style.borderColor=pesoExcede?'#B71C1C':'#DDE3ED'} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:5 }}>Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm(p => ({...p,fecha:e.target.value}))}
                    style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'9px 10px', fontSize:12, outline:'none' }}
                    onFocus={e => e.target.style.borderColor='#2563A8'} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
                </div>
              </div>

              {/* Preview peso disponible */}
              <div style={{ marginBottom:14, padding:'8px 12px', borderRadius:8, background: pesoExcede?'#FFF0F0':'#F8FAFD', border:'1px solid '+(pesoExcede?'#FFBBBB':'#E8EDF5'), fontSize:11 }}>
                {pesoExcede
                  ? <span style={{ color:'#B71C1C', fontWeight:700 }}>⚠️ Peso excede el 100. Usados: {pesoUsado} pts — este período solo quedan {pesoDisponible} pts disponibles.</span>
                  : <span style={{ color:'#888' }}>Período actual: <strong style={{ color:'#1B3A6B' }}>{pesoUsado}</strong>/100 pts usados — quedan <strong style={{ color: pesoDisponible < 10 ? '#C84B00' : '#1A6B3A' }}>{pesoDisponible}</strong> pts disponibles</span>
                }
              </div>

              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={() => { setModalAct(false); setEditandoId(null); setForm(VACIO); setFormError('') }} style={{ padding:'9px 20px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>Cancelar</button>
                <button onClick={crearActividad} disabled={!puedeGuardar} style={{ padding:'9px 24px', background:puedeGuardar?'#1B3A6B':'#C0C8D8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:puedeGuardar?'pointer':'not-allowed' }}>{editandoId?'Guardar cambios':'Crear actividad'}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {histPart && (
        <HistorialParticipacion nombre={histPart.est.nombre_completo} subtitulo={perSel?.nombre}
          total={histPart.est.participacion} items={histPart.items}
          resaltarTemaIds={partAct?.vinculada ? partAct.temas.map(t => t.id) : []}
          onClose={() => setHistPart(null)} />
      )}

      {/* MODAL DUPLICAR */}
      {modalDuplicarT && (
        <div className="modal-backdrop" data-closing={modalDuplicarT.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
          onClick={e => { if (e.target===e.currentTarget) setModalDuplicar(false) }}>
          <div className="modal-content" data-closing={modalDuplicarT.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:440, boxShadow:'0 16px 48px #0004' }}>
            <h2 style={{ color:'#1B3A6B', marginBottom:6, fontSize:17 }}>📋 Duplicar actividades</h2>
            <p style={{ color:'#888', fontSize:12, marginBottom:20 }}>
              Se copiarán las <strong>{actividades.length} actividades</strong> del <strong>{perSel?.nombre}</strong> de <strong style={{color:cursoSel?.color}}>{cursoSel?.nombre}</strong> a los cursos que selecciones.
            </p>
            <div style={{ fontSize:11, fontWeight:700, color:'#AAB4C4', letterSpacing:1.5, marginBottom:10 }}>SELECCIONA CURSOS DESTINO</div>
            {cursos.filter(c => c.id!==cursoSel?.id).length===0 ? (
              <div style={{ padding:20, textAlign:'center', color:'#888', fontSize:13, background:'#F8FAFD', borderRadius:8 }}>No hay otros cursos disponibles</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:280, overflowY:'auto' }}>
                {cursos.filter(c => c.id!==cursoSel?.id).map(c => {
                  const sel = cursosDestino.includes(c.id)
                  return (
                    <div key={c.id} onClick={() => toggleCursoDestino(c.id)} style={{
                      display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                      borderRadius:10, cursor:'pointer', border:'2px solid '+(sel?c.color:'#DDE3ED'),
                      background:sel?c.color+'10':'#FAFBFD', transition:'all .12s',
                    }}>
                      <div style={{ width:20, height:20, borderRadius:4, border:'2px solid '+(sel?c.color:'#CCC'), background:sel?c.color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {sel && <span style={{ color:'#fff', fontSize:12, fontWeight:900 }}>✓</span>}
                      </div>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:c.color, flexShrink:0 }} />
                      <div style={{ fontWeight:700, fontSize:13, color:sel?c.color:'#333' }}>{c.nombre}</div>
                    </div>
                  )
                })}
              </div>
            )}
            {cursosDestino.length > 0 && (
              <div style={{ marginTop:14, padding:'8px 12px', background:'#E8F5E9', borderRadius:8, fontSize:12, color:'#1A6B3A' }}>
                ✅ Se duplicarán <strong>{actividades.length}</strong> actividades a <strong>{cursosDestino.length}</strong> curso(s)
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
              <button onClick={() => setModalDuplicar(false)} style={{ padding:'9px 20px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>Cancelar</button>
              <button onClick={ejecutarDuplicar} disabled={cursosDestino.length===0} style={{ padding:'9px 24px', background:cursosDestino.length>0?'#00695C':'#CCC', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:cursosDestino.length>0?'pointer':'default' }}>📋 Duplicar ahora</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINAR */}
      {confirmT && (
        <div className="modal-backdrop" data-closing={confirmT.closing} style={{ position:'fixed', inset:0, background:'#0006', display:'flex', alignItems:'center', justifyContent:'center', zIndex:600 }}>
          <div className="modal-content" data-closing={confirmT.closing} style={{ background:'#fff', borderRadius:14, padding:32, width:400, boxShadow:'0 16px 48px #0004', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🗑️</div>
            <h3 style={{ color:'#1B3A6B', marginBottom:8, fontSize:16 }}>¿Eliminar esta actividad?</h3>
            <p style={{ color:'#555', fontSize:13, marginBottom:6 }}>Vas a eliminar <strong style={{ color:'#B71C1C' }}>{confirmT.value.nombre}</strong></p>
            <p style={{ color:'#AAB4C4', fontSize:12, marginBottom:24 }}>Se borrarán también todas las calificaciones. Esta acción no se puede deshacer.</p>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setConfirm(null)} style={{ padding:'10px 28px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555', fontWeight:600 }}>Cancelar</button>
              <button onClick={confirmarEliminar} style={{ padding:'10px 28px', background:'#B71C1C', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>🗑️ Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" data-leaving={toast.leaving}>{toast.msg}</div>
      )}
    </div>
  )
}