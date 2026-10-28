import React, { useState, useEffect, useRef } from 'react'
import { useModalTransition } from '../hooks/useModalTransition'
import { useCursoActivo } from '../hooks/useSeleccionActiva'

const ESTADOS = [
  { key:'presente', label:'P', titulo:'Presente', bg:'#D6EEE0', color:'#1A6B3A', borde:'#A8D4B8' },
  { key:'ausente',  label:'A', titulo:'Ausente',  bg:'#FDDFDF', color:'#B71C1C', borde:'#FFAAAA' },
  { key:'tardanza', label:'T', titulo:'Tardanza', bg:'#FFF8D6', color:'#7A5C00', borde:'#D4B820' },
  { key:'excusado', label:'E', titulo:'Excusado', bg:'#EDE0F7', color:'#5C2D91', borde:'#C0A0E0' },
]
const TIPOS_OBS = [
  { key:'academico', label:'Academico',   color:'#2563A8', bg:'#D6E4F7' },
  { key:'conducta',  label:'Conducta',    color:'#B71C1C', bg:'#FDDFDF' },
  { key:'familiar',  label:'Familiar',    color:'#00695C', bg:'#D0EDE8' },
  { key:'salud',     label:'Salud',       color:'#5C2D91', bg:'#EDE0F7' },
  { key:'general',   label:'Nota rapida', color:'#7A5C00', bg:'#FFF8D6' },
]
const DIAS_ORDEN  = ['Lunes','Martes','Miercoles','Jueves','Viernes']
const DIAS_NOMBRE = { Lunes:'Lun', Martes:'Mar', Miercoles:'Mie', Jueves:'Jue', Viernes:'Vie' }
const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fechaHoy() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function mesActual() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')
}

// ── FIX: usar hora al mediodía para evitar corrimiento por DST/UTC en Windows ──
function diaSemanaDeString(fechaStr) {
  const dias = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado']
  const partes = fechaStr.split('-')
  const y = parseInt(partes[0], 10)
  const m = parseInt(partes[1], 10) - 1
  const d = parseInt(partes[2], 10)
  // Hora 12:00:00 evita que DST o UTC desplacen el día
  return dias[new Date(y, m, d, 12, 0, 0).getDay()]
}

// Normalizar nombre de día (quitar tildes, minúsculas) para comparación robusta
function normalizarDia(dia) {
  return (dia || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function diasIguales(a, b) {
  return normalizarDia(a) === normalizarDia(b)
}

function diasClaseIncluye(diasClase, dia) {
  return diasClase.some(d => diasIguales(d, dia))
}

function calcResumen(asistencias, estudianteId) {
  const arr = asistencias.filter(a => a.estudiante_id === estudianteId)
  const tot = { presente:0, ausente:0, tardanza:0, excusado:0 }
  arr.forEach(a => { if (tot[a.estado] !== undefined) tot[a.estado]++ })
  const total = arr.length
  const pct   = total > 0 ? Math.round(tot.presente / total * 100) : null
  return { ...tot, pct, total }
}

function BadgePct({ pct }) {
  if (pct === null) return <span style={{ fontSize:11, color:'#CCC' }}>—</span>
  const color = pct >= 80 ? '#1A6B3A' : pct >= 60 ? '#C84B00' : '#B71C1C'
  const bg    = pct >= 80 ? '#D6EEE0' : pct >= 60 ? '#FDECD7' : '#FDDFDF'
  const borde = pct >= 80 ? '#A8D4B8' : pct >= 60 ? '#E8A878' : '#FFAAAA'
  return (
    <span style={{ background:bg, color, border:'1px solid '+borde, borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:700, flexShrink:0 }}>
      {pct}%
    </span>
  )
}

export default function Asistencia({ anio, materia, cursoActivoId, onCambiarCurso }) {
  const materiaId = materia?.id || null
  const [cursos,        setCursos]        = useState([])
  const [cursoSel,      setCursoSel]      = useCursoActivo(cursos, cursoActivoId, onCambiarCurso)
  const [diasClase,     setDiasClase]     = useState([])
  const [modo,          setModo]          = useState('dia')
  const [fecha,         setFecha]         = useState(fechaHoy())
  const [lista,         setLista]         = useState([])
  const [mesAnio,       setMesAnio]       = useState(mesActual())
  const [mesDatos,      setMesDatos]      = useState({ estudiantes:[], asistencias:[] })
  const [toast,         setToast]         = useState(null) // { msg, leaving }
  const toastGen = useRef(0)
  const [modalObs,      setModalObs]      = useState(null)
  const modalObsT = useModalTransition(modalObs)
  const [obsForm,       setObsForm]       = useState({ texto:'', tipo:'academico' })
  const [obsLista,      setObsLista]      = useState([])
  const [diaValido,     setDiaValido]     = useState(true)
  const [marcandoTodos, setMarcandoTodos] = useState(false)
  const [mesBadge,      setMesBadge]      = useState({ estudiantes:[], asistencias:[] })
  const [diasPorCurso,  setDiasPorCurso]  = useState({})
  

 useEffect(() => {
  if (!anio) return
  window.api.invoke('get-cursos', anio.id).then(async c => {
    setCursos(c)
    const mapa = {}
    await Promise.all(c.map(async curso => {
      const dias = await window.api.invoke('get-dias-curso', curso.id, materiaId)
      mapa[curso.id] = dias
    }))
    setDiasPorCurso(mapa)
  })
}, [anio, materia])


  useEffect(() => {
    if (!cursoSel) return
    window.api.invoke('get-dias-curso', cursoSel.id, materiaId).then(setDiasClase)
  }, [cursoSel, materia])

  useEffect(() => {
    if (!cursoSel) return
    const hoy = new Date()
    window.api.invoke('get-asistencia-mes', cursoSel.id, hoy.getFullYear(), hoy.getMonth()+1, materiaId).then(setMesBadge)
  }, [cursoSel, materia])

  useEffect(() => {
    if (!cursoSel) return
    if (modo === 'dia') {
      const dia    = diaSemanaDeString(fecha)
      const valido = diasClase.length === 0 || diasClaseIncluye(diasClase, dia)
      setDiaValido(valido)
      if (valido) window.api.invoke('get-asistencia-dia', cursoSel.id, fecha, materiaId).then(setLista)
    } else if (modo === 'mes' || modo === 'ranking') {
      const [y, m] = mesAnio.split('-')
      window.api.invoke('get-asistencia-mes', cursoSel.id, y, Number(m), materiaId).then(setMesDatos)
    }
  }, [cursoSel, fecha, modo, mesAnio, diasClase])

  function toast2(msg) {
    const gen = ++toastGen.current
    setToast({ msg, leaving:false })
    setTimeout(() => { if (toastGen.current===gen) setToast(t => t && ({ ...t, leaving:true })) }, 1800)
    setTimeout(() => { if (toastGen.current===gen) setToast(null) }, 2000)
  }

  async function marcar(estudianteId, estado) {
    await window.api.invoke('set-asistencia', { estudianteId, cursoId:cursoSel.id, fecha, estado, materiaId })
    setLista(prev => prev.map(e => e.id === estudianteId ? { ...e, asistencia:estado } : e))
    const hoy = new Date()
    window.api.invoke('get-asistencia-mes', cursoSel.id, hoy.getFullYear(), hoy.getMonth()+1, materiaId).then(setMesBadge)
    toast2(ESTADOS.find(x => x.key === estado).titulo + ' registrado')
  }

  async function marcarTodosPresentes() {
    if (lista.length === 0) return
    setMarcandoTodos(true)
    for (const est of lista) {
      await window.api.invoke('set-asistencia', { estudianteId:est.id, cursoId:cursoSel.id, fecha, estado:'presente', materiaId })
    }
    setLista(prev => prev.map(e => ({ ...e, asistencia:'presente' })))
    const hoy = new Date()
    window.api.invoke('get-asistencia-mes', cursoSel.id, hoy.getFullYear(), hoy.getMonth()+1, materiaId).then(setMesBadge)
    setMarcandoTodos(false)
    toast2(`✅ ${lista.length} estudiantes marcados como presentes`)
  }

  function resumen(estudianteId) { return calcResumen(mesDatos.asistencias, estudianteId) }

  function estadoDia(estudianteId, dia) {
    const [y, m] = mesAnio.split('-')
    const f = y + '-' + m + '-' + String(dia).padStart(2,'0')
    const a = mesDatos.asistencias.find(x => x.estudiante_id === estudianteId && x.fecha === f)
    return a ? a.estado : null
  }

  async function abrirObservaciones(estudiante) {
    setModalObs(estudiante)
    setObsForm({ texto:'', tipo:'academico' })
    const obs = await window.api.invoke('get-observaciones', estudiante.id)
    setObsLista(obs)
  }

  async function guardarObs() {
    if (!obsForm.texto.trim()) return
    await window.api.invoke('create-observacion', { estudianteId:modalObs.id, fecha:fechaHoy(), texto:obsForm.texto.trim(), tipo:obsForm.tipo })
    const obs = await window.api.invoke('get-observaciones', modalObs.id)
    setObsLista(obs)
    setObsForm({ texto:'', tipo:'academico' })
    toast2('📓 Observacion guardada')
  }

  async function eliminarObs(id) {
    if (!window.confirm('Eliminar esta observacion?')) return
    await window.api.invoke('delete-observacion', id)
    setObsLista(prev => prev.filter(o => o.id !== id))
  }

  function exportarPDF() {
    const [y, m]   = mesAnio.split('-')
    const mesNombre = MESES[Number(m)]
    const numDias  = new Date(Number(y), Number(m), 0).getDate()
    const diasArr  = Array.from({ length:numDias }, (_, i) => i + 1)
    const colores  = { P:'#D6EEE0', A:'#FDDFDF', T:'#FFF8D6', E:'#EDE0F7' }
    const textCol  = { P:'#1A6B3A', A:'#B71C1C', T:'#7A5C00', E:'#5C2D91' }
    const filas = mesDatos.estudiantes.map((est, idx) => {
      const res    = resumen(est.id)
      const celdas = diasArr.map(d => {
        const a  = mesDatos.asistencias.find(x => x.estudiante_id === est.id && x.fecha === `${y}-${m}-${String(d).padStart(2,'0')}`)
        const l  = a ? a.estado.charAt(0).toUpperCase() : ''
        const bg = l ? (colores[l]||'#fff') : '#F9F9F9'
        const tc = l ? (textCol[l]||'#333') : '#CCC'
        return `<td style="text-align:center;padding:3px 2px;background:${bg};color:${tc};font-weight:700;font-size:10px">${l||'·'}</td>`
      }).join('')
      const pctCol = res.pct >= 80 ? '#1A6B3A' : res.pct >= 60 ? '#C84B00' : '#B71C1C'
      return `<tr style="background:${idx%2===0?'#fff':'#FAFBFD'}">
        <td style="padding:4px 6px;font-weight:700;color:#888;font-size:10px">${String(est.numero_lista).padStart(2,'0')}</td>
        <td style="padding:4px 8px;font-weight:600;color:#1B3A6B;white-space:nowrap;font-size:11px">${est.nombre_completo}</td>
        ${celdas}
        <td style="text-align:center;font-weight:800;color:${pctCol};font-size:11px">${res.pct ?? '—'}%</td>
        <td style="text-align:center;color:#1A6B3A;font-weight:700;font-size:10px">${res.presente}</td>
        <td style="text-align:center;color:#B71C1C;font-weight:700;font-size:10px">${res.ausente}</td>
        <td style="text-align:center;color:#7A5C00;font-weight:700;font-size:10px">${res.tardanza}</td>
        <td style="text-align:center;color:#5C2D91;font-weight:700;font-size:10px">${res.excusado}</td>
      </tr>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Asistencia ${cursoSel.nombre} — ${mesNombre} ${y}</title>
    <style>body{font-family:'Segoe UI',sans-serif;margin:20px;color:#333}h1{color:#1B3A6B;font-size:16px;margin-bottom:4px}.sub{color:#888;font-size:12px;margin-bottom:16px}table{border-collapse:collapse;width:100%}th{background:#1B3A6B;color:#9BBFED;padding:6px 4px;font-size:10px}td{border-bottom:1px solid #F0F4FA}@media print{@page{size:landscape;margin:10mm}}</style>
    </head><body>
    <h1>📋 Registro de Asistencia — ${cursoSel.nombre}</h1>
    <div class="sub">${mesNombre} ${y} · ${mesDatos.estudiantes.length} estudiantes</div>
    <table><thead><tr>
      <th style="text-align:left;padding:6px;font-size:10px">#</th>
      <th style="text-align:left;padding:6px 8px;font-size:10px">Estudiante</th>
      ${diasArr.map(d=>`<th style="padding:4px 2px;font-size:9px;min-width:18px">${d}</th>`).join('')}
      <th style="color:#FFD700">%</th><th style="color:#6FCF97">P</th>
      <th style="color:#FF8A8A">A</th><th style="color:#FFD700">T</th><th style="color:#D4AAFF">E</th>
    </tr></thead><tbody>${filas}</tbody></table>
    <script>window.onload=()=>window.print()</script></body></html>`
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
  }

  async function exportarExcel() {
    const [y, m]    = mesAnio.split('-')
    const mesNombre = MESES[Number(m)]
    const numDias   = new Date(Number(y), Number(m), 0).getDate()
    const diasArr   = Array.from({ length:numDias }, (_, i) => i + 1)
    const encabezado = ['#', 'Estudiante', ...diasArr.map(String), '%', 'P', 'A', 'T', 'E']
    const filas = mesDatos.estudiantes.map(est => {
      const res  = resumen(est.id)
      const dias = diasArr.map(d => {
        const a = mesDatos.asistencias.find(x => x.estudiante_id === est.id && x.fecha === `${y}-${m}-${String(d).padStart(2,'0')}`)
        return a ? a.estado.charAt(0).toUpperCase() : ''
      })
      return [String(est.numero_lista).padStart(2,'0'), est.nombre_completo, ...dias, (res.pct ?? '—')+'%', res.presente, res.ausente, res.tardanza, res.excusado]
    })
    try {
      const XLSX = require('xlsx')
      const ws   = XLSX.utils.aoa_to_sheet([encabezado, ...filas])
      const wb   = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Asistencia')
      XLSX.writeFile(wb, `Asistencia_${cursoSel.nombre}_${mesNombre}_${y}.xlsx`)
      toast2('📊 Excel guardado')
    } catch(e) {
      const csv  = [encabezado, ...filas].map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `Asistencia_${cursoSel.nombre}_${mesNombre}_${y}.csv`; a.click()
      URL.revokeObjectURL(url)
      toast2('📊 CSV guardado')
    }
  }

  const [y, m]   = mesAnio.split('-')
  const numDias  = new Date(Number(y), Number(m), 0).getDate()
  const diasArr  = Array.from({ length:numDias }, (_, i) => i + 1)
  const diaActual = diaSemanaDeString(fecha)

  const rankingData = mesDatos.estudiantes
    .map(est => ({ est, ...calcResumen(mesDatos.asistencias, est.id) }))
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))

  const verdes    = rankingData.filter(d => d.pct !== null && d.pct >= 80).length
  const amarillos = rankingData.filter(d => d.pct !== null && d.pct >= 60 && d.pct < 80).length
  const rojos     = rankingData.filter(d => d.pct !== null && d.pct < 60).length
  const sinDatos  = rankingData.filter(d => d.pct === null).length

  // Nombre normalizado de días de clase para mostrar en el mensaje
  const diasClaseNombres = DIAS_ORDEN.filter(d => diasClaseIncluye(diasClase, d))

  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20 }}>

      {/* PANEL IZQUIERDO */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:14, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#AAB4C4', marginBottom:10, letterSpacing:1.5 }}>CURSO</div>
          {(() => {
            const diaHoy = diaSemanaDeString(fechaHoy())
            return cursos.map(c => {
              const diasC    = diasPorCurso[c.id] || []
              const tieneHoy = diasC.length > 0 && diasClaseIncluye(diasC, diaHoy)
              const selec    = cursoSel?.id === c.id
              return (
                <div key={c.id} onClick={() => setCursoSel(c)} style={{
                  padding:'8px 10px', borderRadius:8, cursor:'pointer', marginBottom:4,
                  background: selec ? c.color : tieneHoy ? c.color+'15' : 'transparent',
                  color:      selec ? '#fff' : c.color,
                  fontWeight:600, fontSize:13, display:'flex', alignItems:'center', gap:8,
                  border: tieneHoy && !selec ? '1.5px solid '+c.color+'50' : '1.5px solid transparent',
                }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:selec?'#fff':c.color, flexShrink:0 }} />
                  <span style={{ flex:1 }}>{c.nombre}</span>
                  {tieneHoy && !selec && <span style={{ fontSize:9, fontWeight:800, padding:'1px 5px', borderRadius:6, background:c.color, color:'#fff' }}>HOY</span>}
                  {tieneHoy && selec  && <span style={{ fontSize:9, fontWeight:800, padding:'1px 5px', borderRadius:6, background:'rgba(255,255,255,0.3)', color:'#fff' }}>HOY</span>}
                </div>
              )
            })
          })()}
        </div>

        {diasClase.length > 0 && (
          <div style={{ background:'#fff', borderRadius:12, padding:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#AAB4C4', marginBottom:8, letterSpacing:1.5 }}>DIAS DE CLASE</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {DIAS_ORDEN.map(d => {
                const tiene = diasClaseIncluye(diasClase, d)
                return <div key={d} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, fontWeight:700, background:tiene?'#D6E4F7':'#F4F4F4', color:tiene?'#2563A8':'#CCC', border:tiene?'1px solid #9BBFED':'1px solid #E0E0E0' }}>{DIAS_NOMBRE[d]||d}</div>
              })}
            </div>
          </div>
        )}

        <div style={{ background:'#fff', borderRadius:12, padding:14, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#AAB4C4', marginBottom:10, letterSpacing:1.5 }}>VISTA</div>
          {[
            { k:'dia',     label:'📅 Día a día'     },
            { k:'mes',     label:'📆 Vista mensual' },
            { k:'ranking', label:'🏅 Ranking'       },
          ].map(v => (
            <div key={v.k} onClick={() => setModo(v.k)} style={{
              padding:'8px 10px', borderRadius:8, cursor:'pointer', marginBottom:4,
              background:modo===v.k?'#EEF2F7':'transparent', color:modo===v.k?'#1B3A6B':'#555',
              fontWeight:modo===v.k?700:400, fontSize:13,
              borderRight:modo===v.k?'3px solid #2563A8':'3px solid transparent',
            }}>{v.label}</div>
          ))}
        </div>

        <div style={{ background:'#fff', borderRadius:12, padding:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#AAB4C4', marginBottom:8, letterSpacing:1.5 }}>LEYENDA</div>
          {ESTADOS.map(e => (
            <div key={e.key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
              <div style={{ width:22, height:22, borderRadius:6, background:e.bg, border:'1.5px solid '+e.borde, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:e.color }}>{e.label}</div>
              <span style={{ fontSize:12, color:e.color, fontWeight:600 }}>{e.titulo}</span>
            </div>
          ))}
          <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #EEF2F7', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:14 }}>📓</span>
            <span style={{ fontSize:12, color:'#555', fontWeight:600 }}>Cuaderno anecdotico</span>
          </div>
        </div>
      </div>

      {/* PANEL PRINCIPAL */}
      <div>

        {/* VISTA DÍA */}
        {modo === 'dia' && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              <h2 style={{ fontSize:18, color:'#1B3A6B' }}>✅ Asistencia Diaria</h2>
              <div style={{ flex:1 }} />
              {diaValido && lista.length > 0 && (
                <button onClick={marcarTodosPresentes} disabled={marcandoTodos} style={{
                  padding:'8px 16px', background:marcandoTodos?'#AAA':'#1A6B3A',
                  color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:marcandoTodos?'default':'pointer',
                }}>{marcandoTodos ? '⏳ Marcando...' : '✅ Todos presentes'}</button>
              )}
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                style={{ border:'1.5px solid #DDE3ED', borderRadius:8, padding:'7px 12px', fontSize:13, outline:'none', color:'#1B3A6B' }} />
            </div>

            {!diaValido && diasClase.length > 0 && (
              <div style={{ background:'#FDECD7', border:'1px solid #E8A878', borderRadius:10, padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:20 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight:700, color:'#C84B00', fontSize:13 }}>
                    {cursoSel?.nombre} no tiene clase los {diaActual}
                  </div>
                  <div style={{ fontSize:12, color:'#C84B00', marginTop:2 }}>
                    Este curso tiene clase los: {diasClaseNombres.join(', ')}. Selecciona otro día.
                  </div>
                </div>
              </div>
            )}

            {diaValido && lista.length === 0 && (
              <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', border:'1px solid #DDE3ED' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>👨‍🎓</div>
                <p style={{ color:'#888', fontSize:13 }}>Agrega estudiantes al curso primero</p>
              </div>
            )}

            {diaValido && lista.length > 0 && (
              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', overflow:'hidden' }}>
                <div style={{ padding:'10px 20px', background:'#1B3A6B', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ color:'#9BBFED', fontWeight:700, fontSize:13 }}>{cursoSel?.nombre} · {diaActual} · {fecha}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ color:'#7A9FC8', fontSize:12 }}>{lista.filter(e => e.asistencia==='presente').length}/{lista.length} presentes</span>
                    <span style={{ color:'#7A9FC8', fontSize:11, opacity:0.7 }}>% = mes actual</span>
                  </div>
                </div>
                {lista.map((e, idx) => {
                  const res = calcResumen(mesBadge.asistencias, e.id)
                  return (
                    <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', borderTop:idx>0?'1px solid #F0F4FA':'none', background:idx%2===0?'#fff':'#FAFBFD' }}>
                      <span style={{ width:28, height:28, borderRadius:'50%', background:'#EEF2F7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#7A8FA8', flexShrink:0 }}>
                        {String(e.numero_lista).padStart(2,'0')}
                      </span>
                      <span style={{ flex:1, fontSize:13, fontWeight:600, color:'#1B3A6B' }}>{e.nombre_completo}</span>
                      <BadgePct pct={res.pct} />
                      <div style={{ display:'flex', gap:6 }}>
                        {ESTADOS.map(st => (
                          <button key={st.key} onClick={() => marcar(e.id, st.key)} style={{
                            width:36, height:36, borderRadius:8,
                            border:'1.5px solid '+(e.asistencia===st.key?st.borde:'#E0E6EE'),
                            background:e.asistencia===st.key?st.bg:'#fff',
                            color:e.asistencia===st.key?st.color:'#AAA',
                            fontSize:12, fontWeight:800, cursor:'pointer', transition:'all .1s',
                          }}>{st.label}</button>
                        ))}
                      </div>
                      <button onClick={() => abrirObservaciones(e)} style={{ width:34, height:34, borderRadius:8, border:'1.5px solid #DDE3ED', background:'#fff', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
                        onMouseEnter={e2 => { e2.currentTarget.style.background='#EEF2F7'; e2.currentTarget.style.borderColor='#2563A8' }}
                        onMouseLeave={e2 => { e2.currentTarget.style.background='#fff';    e2.currentTarget.style.borderColor='#DDE3ED' }}
                        title="Cuaderno anecdotico">📓</button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* VISTA MES */}
        {modo === 'mes' && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              <h2 style={{ fontSize:18, color:'#1B3A6B' }}>📆 Asistencia Mensual</h2>
              <div style={{ flex:1 }} />
              {mesDatos.estudiantes.length > 0 && (
                <>
                  <button onClick={exportarExcel} style={{ padding:'8px 16px', background:'#1A6B3A', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>📊 Excel</button>
                  <button onClick={exportarPDF}   style={{ padding:'8px 16px', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>🖨️ PDF</button>
                </>
              )}
              <input type="month" value={mesAnio} onChange={e => setMesAnio(e.target.value)}
                style={{ border:'1.5px solid #DDE3ED', borderRadius:8, padding:'7px 12px', fontSize:13, outline:'none', color:'#1B3A6B' }} />
            </div>
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', overflow:'auto' }}>
              {mesDatos.estudiantes.length === 0 ? (
                <div style={{ padding:40, textAlign:'center', color:'#888', fontSize:13 }}>Sin estudiantes en este curso</div>
              ) : (
                <table style={{ borderCollapse:'collapse', fontSize:11, width:'100%', minWidth:800 }}>
                  <thead>
                    <tr style={{ background:'#1B3A6B' }}>
                      <th style={{ padding:'8px 12px', color:'#9BBFED', textAlign:'left', fontWeight:700, position:'sticky', left:0, background:'#1B3A6B', zIndex:10, whiteSpace:'nowrap' }}>Estudiante</th>
                      {diasArr.map(d => <th key={d} style={{ padding:'8px 4px', color:'#9BBFED', fontWeight:700, textAlign:'center', minWidth:24 }}>{d}</th>)}
                      <th style={{ padding:'8px 8px', color:'#FFD700', fontWeight:700, textAlign:'center' }}>%</th>
                      <th style={{ padding:'8px 6px', color:'#6FCF97', fontWeight:700, textAlign:'center' }}>P</th>
                      <th style={{ padding:'8px 6px', color:'#FF8A8A', fontWeight:700, textAlign:'center' }}>A</th>
                      <th style={{ padding:'8px 6px', color:'#FFD700', fontWeight:700, textAlign:'center' }}>T</th>
                      <th style={{ padding:'8px 6px', color:'#D4AAFF', fontWeight:700, textAlign:'center' }}>E</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mesDatos.estudiantes.map((est, idx) => {
                      const res = resumen(est.id)
                      return (
                        <tr key={est.id} style={{ background:idx%2===0?'#fff':'#FAFBFD' }}>
                          <td style={{ padding:'7px 12px', fontWeight:600, color:'#1B3A6B', position:'sticky', left:0, background:'inherit', zIndex:5, borderRight:'1px solid #E8EDF5', whiteSpace:'nowrap' }}>
                            <span style={{ color:'#999', marginRight:6 }}>{String(est.numero_lista).padStart(2,'0')}</span>
                            {est.nombre_completo}
                          </td>
                          {diasArr.map(d => {
                            const est2 = estadoDia(est.id, d)
                            const cfg  = est2 ? ESTADOS.find(x => x.key === est2) : null
                            return (
                              <td key={d} style={{ textAlign:'center', padding:'4px 2px' }}>
                                {cfg
                                  ? <div style={{ width:20, height:20, borderRadius:4, background:cfg.bg, border:'1px solid '+cfg.borde, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:cfg.color }}>{cfg.label}</div>
                                  : <div style={{ width:20, height:20, borderRadius:4, background:'#F4F4F4', display:'inline-block' }} />
                                }
                              </td>
                            )
                          })}
                          <td style={{ textAlign:'center', fontWeight:800, fontSize:12, color:res.pct===null?'#CCC':res.pct>=80?'#1A6B3A':res.pct>=60?'#C84B00':'#B71C1C' }}>{res.pct ?? '—'}{res.pct !== null ? '%' : ''}</td>
                          <td style={{ textAlign:'center', color:'#1A6B3A', fontWeight:700 }}>{res.presente}</td>
                          <td style={{ textAlign:'center', color:'#B71C1C', fontWeight:700 }}>{res.ausente}</td>
                          <td style={{ textAlign:'center', color:'#7A5C00', fontWeight:700 }}>{res.tardanza}</td>
                          <td style={{ textAlign:'center', color:'#5C2D91', fontWeight:700 }}>{res.excusado}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* VISTA RANKING */}
        {modo === 'ranking' && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              <h2 style={{ fontSize:18, color:'#1B3A6B' }}>🏅 Ranking de Asistencia</h2>
              <div style={{ flex:1 }} />
              <input type="month" value={mesAnio} onChange={e => setMesAnio(e.target.value)}
                style={{ border:'1.5px solid #DDE3ED', borderRadius:8, padding:'7px 12px', fontSize:13, outline:'none', color:'#1B3A6B' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
              {[
                { label:'🟢 Buena asistencia',   val:verdes,    sub:'≥ 80%',    color:'#1A6B3A', bg:'#D6EEE0', borde:'#A8D4B8' },
                { label:'🟡 Asistencia regular', val:amarillos, sub:'60–79%',   color:'#7A5C00', bg:'#FFF8D6', borde:'#D4B820' },
                { label:'🔴 Asistencia baja',    val:rojos,     sub:'< 60%',    color:'#B71C1C', bg:'#FDDFDF', borde:'#FFAAAA' },
                { label:'⬜ Sin registros',       val:sinDatos,  sub:'sin datos', color:'#888',   bg:'#F4F4F4', borde:'#DDE3ED' },
              ].map(s => (
                <div key={s.label} style={{ background:s.bg, borderRadius:12, padding:'14px 16px', border:'1px solid '+s.borde, textAlign:'center' }}>
                  <div style={{ fontSize:26, fontWeight:900, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:11, color:s.color, fontWeight:600, marginTop:2 }}>{s.label}</div>
                  <div style={{ fontSize:10, color:s.color, opacity:0.7, marginTop:2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
            {rankingData.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', border:'1px solid #DDE3ED' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📊</div>
                <p style={{ color:'#888', fontSize:13 }}>Sin datos para este mes</p>
              </div>
            ) : (
              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', overflow:'hidden' }}>
                <div style={{ display:'grid', gridTemplateColumns:'50px 30px 1fr 80px 1fr 60px 60px 60px 60px', background:'#1B3A6B', padding:'10px 20px', gap:10, alignItems:'center' }}>
                  {['Pos','','Estudiante','%','','P','A','T','E'].map((h,i) => (
                    <div key={i} style={{ color:'#9BBFED', fontSize:11, fontWeight:700 }}>{h}</div>
                  ))}
                </div>
                {rankingData.map((d, idx) => {
                  const pct    = d.pct
                  const color  = pct===null?'#CCC':pct>=80?'#1A6B3A':pct>=60?'#C84B00':'#B71C1C'
                  const bg     = pct===null?'#F4F4F4':pct>=80?'#D6EEE0':pct>=60?'#FFF8D6':'#FDDFDF'
                  const borde  = pct===null?'#DDE3ED':pct>=80?'#A8D4B8':pct>=60?'#D4B820':'#FFAAAA'
                  const medalla = idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':''
                  const barW   = pct!==null ? Math.max(2,pct) : 0
                  return (
                    <div key={d.est.id} style={{ display:'grid', gridTemplateColumns:'50px 30px 1fr 80px 1fr 60px 60px 60px 60px', padding:'10px 20px', gap:10, alignItems:'center', borderTop:idx>0?'1px solid #F0F4FA':'none', background:idx%2===0?'#fff':'#FAFBFD' }}>
                      <div style={{ fontSize:13, fontWeight:800, color:idx<3?color:'#AAB4C4' }}>#{idx+1}</div>
                      <div style={{ fontSize:18 }}>{medalla}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1B3A6B' }}>
                        <span style={{ color:'#AAB4C4', fontSize:11, marginRight:6 }}>{String(d.est.numero_lista).padStart(2,'0')}</span>
                        {d.est.nombre_completo}
                      </div>
                      <div><span style={{ background:bg, color, border:'1px solid '+borde, borderRadius:20, padding:'3px 10px', fontSize:12, fontWeight:800 }}>{pct!==null?pct+'%':'—'}</span></div>
                      <div style={{ background:'#F0F4FA', borderRadius:4, height:8, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:4, background:color, width:barW+'%', transition:'width .4s' }} />
                      </div>
                      <div style={{ textAlign:'center', color:'#1A6B3A', fontWeight:700, fontSize:13 }}>{d.presente}</div>
                      <div style={{ textAlign:'center', color:'#B71C1C', fontWeight:700, fontSize:13 }}>{d.ausente}</div>
                      <div style={{ textAlign:'center', color:'#7A5C00', fontWeight:700, fontSize:13 }}>{d.tardanza}</div>
                      <div style={{ textAlign:'center', color:'#5C2D91', fontWeight:700, fontSize:13 }}>{d.excusado}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL OBSERVACIONES */}
      {modalObsT && (
        <div className="modal-backdrop" data-closing={modalObsT.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
          onClick={e => { if (e.target===e.currentTarget) setModalObs(null) }}>
          <div className="modal-content" data-closing={modalObsT.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:520, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 16px 48px #0004' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <span style={{ fontSize:22 }}>📓</span>
              <div>
                <div style={{ fontWeight:800, fontSize:16, color:'#1B3A6B' }}>{modalObsT.value.nombre_completo}</div>
                <div style={{ fontSize:12, color:'#888' }}>Cuaderno Anecdotico</div>
              </div>
              <div style={{ flex:1 }} />
              <button onClick={() => setModalObs(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#AAA' }}>✕</button>
            </div>
            <div style={{ background:'#F8FAFD', borderRadius:10, padding:14, marginBottom:16, border:'1px solid #DDE3ED' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#444', marginBottom:8 }}>Nueva observacion</div>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                {TIPOS_OBS.map(t => (
                  <div key={t.key} onClick={() => setObsForm(p => ({...p, tipo:t.key}))} style={{
                    padding:'4px 10px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:700,
                    background:obsForm.tipo===t.key?t.bg:'#fff', color:obsForm.tipo===t.key?t.color:'#888',
                    border:'1.5px solid '+(obsForm.tipo===t.key?t.color+'50':'#DDE3ED'),
                  }}>{t.label}</div>
                ))}
              </div>
              <textarea value={obsForm.texto} onChange={e => setObsForm(p => ({...p, texto:e.target.value}))}
                placeholder="Escribe la observacion aqui..." rows={3}
                style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit' }}
                onFocus={e => e.target.style.borderColor='#2563A8'}
                onBlur={e  => e.target.style.borderColor='#DDE3ED'} />
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                <button onClick={guardarObs} disabled={!obsForm.texto.trim()} style={{
                  padding:'8px 20px', background:obsForm.texto.trim()?'#1B3A6B':'#C0C8D8',
                  color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:obsForm.texto.trim()?'pointer':'not-allowed',
                }}>Guardar</button>
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:10 }}>Historial ({obsLista.length} registros)</div>
              {obsLista.length===0
                ? <div style={{ textAlign:'center', color:'#AAA', fontSize:13, padding:20, fontStyle:'italic' }}>Sin observaciones todavia</div>
                : obsLista.map(obs => {
                    const t = TIPOS_OBS.find(x => x.key===obs.tipo)||TIPOS_OBS[0]
                    return (
                      <div key={obs.id} style={{ borderRadius:10, padding:12, marginBottom:8, background:'#FAFBFD', border:'1px solid #E8EDF5' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <span style={{ background:t.bg, color:t.color, padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:700 }}>{t.label}</span>
                          <span style={{ fontSize:11, color:'#AAA' }}>{obs.fecha}</span>
                          <div style={{ flex:1 }} />
                          <button onClick={() => eliminarObs(obs.id)} style={{ background:'none', border:'none', color:'#CCC', fontSize:13, cursor:'pointer', padding:'2px 4px' }}
                            onMouseEnter={e => e.currentTarget.style.color='#B71C1C'}
                            onMouseLeave={e => e.currentTarget.style.color='#CCC'}>🗑️</button>
                        </div>
                        <div style={{ fontSize:13, color:'#333', lineHeight:1.5 }}>{obs.texto}</div>
                      </div>
                    )
                  })
              }
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