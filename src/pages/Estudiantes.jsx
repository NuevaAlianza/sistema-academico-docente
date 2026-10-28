import React, { useState, useEffect } from 'react'
import { useModalTransition } from '../hooks/useModalTransition'
import { useCursoActivo } from '../hooks/useSeleccionActiva'

const VACIO = { nombre:'', codigo:'', numero:'' }
const COLORES_PER = ['#2563A8','#00695C','#5C2D91','#1A6B3A']
const TIPOS_OBS = [
  { key:'academico', label:'Académico',   color:'#2563A8', bg:'#D6E4F7' },
  { key:'conducta',  label:'Conducta',    color:'#B71C1C', bg:'#FDDFDF' },
  { key:'familiar',  label:'Familiar',    color:'#00695C', bg:'#D0EDE8' },
  { key:'salud',     label:'Salud',       color:'#5C2D91', bg:'#EDE0F7' },
  { key:'general',   label:'Nota rápida', color:'#7A5C00', bg:'#FFF8D6' },
]

export default function Estudiantes({ anio, materia, cursoActivoId, onCambiarCurso }) {
  const materiaId = materia?.id || null
  const [cursos,          setCursos]          = useState([])
  const [cursoSel,        setCursoSel]        = useCursoActivo(cursos, cursoActivoId, onCambiarCurso)
  const [estudiantes,     setEstudiantes]     = useState([])
  const [busqueda,        setBusqueda]        = useState('')
  const [verRetirados,    setVerRetirados]    = useState(false)
  const [modal,           setModal]           = useState(false)
  const [form,            setForm]            = useState(VACIO)
  const [editId,          setEditId]          = useState(null)
  const [toast,           setToast]           = useState(null)
  const [confirm,         setConfirm]         = useState(null)
  const [modalImport,     setModalImport]     = useState(false)
  const [preview,         setPreview]         = useState([])
  const [archivoNombre,   setArchivoNombre]   = useState('')
  const [importando,      setImportando]      = useState(false)
  const [modalPadron,      setModalPadron]      = useState(false)
  const [padronArchivo,    setPadronArchivo]    = useState('')
  const [padronInvalidas,  setPadronInvalidas]  = useState(0)
  const [padronGrupos,     setPadronGrupos]     = useState([])
  const [padronCargando,   setPadronCargando]   = useState(false)
  const [padronResultado,  setPadronResultado]  = useState(null)
  const [modalGrupos,     setModalGrupos]     = useState(false)
  const [grupoTexto,      setGrupoTexto]      = useState('')
  const [grupoReemplazar, setGrupoReemplazar] = useState(false)
  const [perfil,          setPerfil]          = useState(null)
  const [perfilData,      setPerfilData]      = useState(null)
  const [cargandoPerfil,  setCargandoPerfil]  = useState(false)
  const perfilT      = useModalTransition(perfil)
  const modalT       = useModalTransition(modal)
  const modalImportT = useModalTransition(modalImport)
  const modalPadronT = useModalTransition(modalPadron)
  const modalGruposT = useModalTransition(modalGrupos)
  const confirmT     = useModalTransition(confirm)

  useEffect(() => {
    if (!anio) return
    window.api.invoke('get-cursos', anio.id).then(setCursos)
  }, [anio])

  useEffect(() => {
    if (cursoSel) { setBusqueda(''); cargarEstudiantes() }
  }, [cursoSel?.id, verRetirados])

  function cargarEstudiantes() {
    const ipc = verRetirados ? 'get-estudiantes-todos' : 'get-estudiantes'
    window.api.invoke(ipc, cursoSel.id).then(setEstudiantes)
  }

  const activos   = estudiantes.filter(e => e.estado === 'activo').length
  const retirados = estudiantes.filter(e => e.estado !== 'activo').length

  const estudiantesFiltrados = estudiantes.filter(e => {
    if (!busqueda.trim()) return true
    return e.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
           e.codigo_unico?.toLowerCase().includes(busqueda.toLowerCase())
  })

  function toast2(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }
  function pedirConfirm(msg, fn) { setConfirm({ msg, fn }) }
  function abrirNuevo()   { setForm(VACIO); setEditId(null); setModal(true) }
  function abrirEditar(e) { setForm({ nombre:e.nombre_completo, codigo:e.codigo_unico||'', numero:String(e.numero_lista) }); setEditId(e.id); setModal(true) }

  const activosLista  = estudiantes.filter(e => e.estado === 'activo')
  const maxGrupo      = activosLista.reduce((m, e) => Math.max(m, e.grupo_trabajo || 0), 0)
  const opcionesGrupo = Array.from({ length: Math.max(10, maxGrupo + 1) }, (_, i) => i + 1)
  const nGrupos       = new Set(activosLista.map(e => e.grupo_trabajo).filter(g => g != null)).size
  const hayGrupos     = nGrupos > 0
  const grupoParse    = parseGrupos(grupoTexto)
  const grupoSinLista = grupoParse.items.flatMap(it => it.numeros)
    .filter(n => !activosLista.some(e => e.numero_lista === n))

  function abrirGrupos() {
    setGrupoTexto(textoGruposActuales(activosLista))
    setGrupoReemplazar(false)
    setModalGrupos(true)
  }

  async function cambiarGrupo(e, valor) {
    const res = await window.api.invoke('set-grupo-estudiante', e.id, valor === '' ? null : Number(valor))
    if (res?.error) { toast2('❌ ' + res.error); return }
    cargarEstudiantes()
  }

  async function aplicarGrupos() {
    const { items, errores } = grupoParse
    if (errores.length > 0 || items.length === 0) return
    const ejecutar = async () => {
      const res = await window.api.invoke('asignar-grupos', cursoSel.id, items, grupoReemplazar)
      if (res?.error) { toast2('❌ ' + res.error); return }
      setModalGrupos(false)
      cargarEstudiantes()
      toast2(`👥 ${res.asignados} asignados${res.sacados ? `, ${res.sacados} sacados de grupo` : ''}${res.noEncontrados.length ? ` · sin encontrar: ${res.noEncontrados.join(', ')}` : ''}`)
    }
    if (grupoReemplazar) {
      pedirConfirm('Se reemplazarán los grupos de todo el curso.\n\nLos estudiantes que no aparezcan en la lista quedarán "Sin grupo". Sus calificaciones no se tocan.', ejecutar)
    } else {
      ejecutar()
    }
  }

  function quitarTodosLosGrupos() {
    pedirConfirm(`¿Quitar todos los grupos de "${cursoSel.nombre}"?\n\nLos estudiantes quedan "Sin grupo". Sus calificaciones no se tocan.`, async () => {
      await window.api.invoke('quitar-grupos-curso', cursoSel.id)
      setModalGrupos(false)
      cargarEstudiantes()
      toast2('👥 Grupos eliminados')
    })
  }

  async function retirarEstudiante(e) {
    pedirConfirm(
      `¿Marcar a "${e.nombre_completo}" como retirado/a?\n\nSus datos y calificaciones se conservan pero no aparecerá en la lista activa.`,
      async () => {
        await window.api.invoke('update-estudiante', e.id, {
          nombre: e.nombre_completo, codigo: e.codigo_unico||'',
          numero: e.numero_lista, estado: 'retirado',
        })
        cargarEstudiantes()
        toast2('🚪 Estudiante marcado como retirado')
      }
    )
  }

  async function reactivarEstudiante(e) {
    const r = await window.api.invoke('update-estudiante', e.id, {
      nombre: e.nombre_completo, codigo: e.codigo_unico||'',
      numero: e.numero_lista, estado: 'activo',
    })
    if (r?.error) { alert(r.error + '. Cámbiale el número antes de reactivarlo.'); return }
    cargarEstudiantes()
    toast2('✅ Estudiante reactivado')
  }

  async function eliminarEstudiante(e) {
    pedirConfirm(
      `⚠️ ELIMINAR definitivamente a "${e.nombre_completo}"?\n\nEsto borrará al estudiante y TODOS sus datos (calificaciones, asistencia, observaciones). Esta acción no se puede deshacer.`,
      async () => {
        await window.api.invoke('delete-estudiante', e.id)
        cargarEstudiantes()
        toast2('🗑️ Estudiante eliminado permanentemente')
      }
    )
  }

  async function abrirPerfil(est) {
    setPerfil(est); setPerfilData(null); setCargandoPerfil(true)
    try {
      const [obs, historial] = await Promise.all([
        window.api.invoke('get-observaciones', est.id),
        window.api.invoke('get-historial-curso', cursoSel.id, anio.id, materiaId),
      ])
      const estHist = historial.find(h => h.estudiante.id === est.id)
      const fechaInicio = anio.fecha_inicio ? new Date(anio.fecha_inicio) : new Date(new Date().getFullYear(), 7, 1)
      const fechaFin    = anio.fecha_fin    ? new Date(anio.fecha_fin)    : new Date(new Date().getFullYear()+1, 6, 31)
      const meses = []
      let cur = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), 1)
      while (cur <= fechaFin) {
        meses.push({ anio: cur.getFullYear(), mes: cur.getMonth()+1 })
        cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1)
      }
      const asistencias = []
      for (const { anio: y, mes: m } of meses) {
        const data = await window.api.invoke('get-asistencia-mes', cursoSel.id, y, m, materiaId)
        asistencias.push(...data.asistencias.filter(a => a.estudiante_id === est.id))
      }
      setPerfilData({ obs, periodos: estHist?.periodos || [], asistencias })
    } catch(e) { console.error(e) }
    setCargandoPerfil(false)
  }

  async function guardar() {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio'); return }
    const r = editId
      ? await window.api.invoke('update-estudiante', editId, { nombre:form.nombre, codigo:form.codigo, numero:Number(form.numero)||0, estado:'activo' })
      : await window.api.invoke('create-estudiante', { cursoId:cursoSel.id, nombre:form.nombre, codigo:form.codigo, numero:Number(form.numero)||0 })
    if (r?.error) { alert(r.error); return }
    toast2(editId ? '✅ Estudiante actualizado' : '✅ Estudiante agregado')
    setModal(false); cargarEstudiantes()
  }

  async function seleccionarArchivo() {
    setImportando(true)
    try {
      const res = await window.api.invoke('abrir-archivo-estudiantes')
      if (!res) { setImportando(false); return }
      if (res.error) { alert('Error: ' + res.error); setImportando(false); return }
      setPreview(res.filas); setArchivoNombre(res.archivo)
    } catch(e) { alert('Error: ' + e.message) }
    setImportando(false)
  }

  async function ejecutarImportar() {
    if (preview.length === 0) return
    setImportando(true)
    const res = await window.api.invoke('importar-estudiantes', cursoSel.id, preview)
    setImportando(false); setModalImport(false); setPreview([])
    cargarEstudiantes()
    toast2(`✅ ${res.insertados} importados${res.omitidos > 0 ? ` (${res.omitidos} ya existían)` : ''}`)
  }

  async function seleccionarArchivoPadron() {
    setPadronCargando(true)
    setPadronResultado(null)
    try {
      const res = await window.api.invoke('abrir-archivo-padron')
      if (!res) { setPadronCargando(false); return }
      if (res.error) { alert('Error: ' + res.error); setPadronCargando(false); return }
      const grupos = await window.api.invoke('preview-import-padron', anio.id, res.filas)
      setPadronGrupos(grupos.map(g => ({ ...g, crear: false })))
      setPadronArchivo(res.archivo)
      setPadronInvalidas(res.invalidas)
    } catch(e) { alert('Error: ' + e.message) }
    setPadronCargando(false)
  }

  function toggleCrearGrupoPadron(idx) {
    setPadronGrupos(prev => prev.map((g, i) => i === idx ? { ...g, crear: !g.crear } : g))
  }

  async function confirmarImportPadron() {
    setPadronCargando(true)
    const res = await window.api.invoke('confirmar-import-padron', anio.id, padronGrupos)
    setPadronCargando(false)
    setPadronResultado(res)
    setPadronGrupos([])
    setPadronArchivo('')
    window.api.invoke('get-cursos', anio.id).then(setCursos)
    if (cursoSel) cargarEstudiantes()
  }

  function cerrarModalPadron() {
    setModalPadron(false)
    setPadronResultado(null)
    setPadronArchivo('')
    setPadronGrupos([])
  }

  async function exportarPerfilPDF() {
    if (!perfil || !perfilData) return
    const cfg     = await window.api.invoke('get-config')
    const centro  = cfg.centro_educativo || ''
    const maestro = cfg.nombre_maestro   || ''
    const mNombre = materia?.nombre || 'General'
    const color   = cursoSel?.color || '#1B3A6B'
    const asists  = perfilData.asistencias || []
    const pPresente = asists.filter(a => a.estado === 'presente').length
    const pAusente  = asists.filter(a => a.estado === 'ausente').length
    const pTardanza = asists.filter(a => a.estado === 'tardanza').length
    const pExcusado = asists.filter(a => a.estado === 'excusado').length
    const pctAsist  = asists.length > 0 ? Math.round(pPresente / asists.length * 100) : null
    const promsValidos = perfilData.periodos.map(p => p.promedio).filter(n => n !== null)
    const promAnio = promsValidos.length > 0 ? Math.round(promsValidos.reduce((a,b) => a+b, 0) / promsValidos.length) : null
    const semColor = n => n===null?'#888':n>=85?'#1A6B3A':n>=70?'#C84B00':'#B71C1C'
    const semBg    = n => n===null?'#F4F4F4':n>=85?'#D6EEE0':n>=70?'#FDECD7':'#FDDFDF'
    try {
      const { jsPDF } = await import('jspdf')
      const doc  = new jsPDF({ unit:'mm', format:'letter' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const hex2rgb = h => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]
      const [cr,cg,cb] = hex2rgb(color)
      doc.setFillColor(cr,cg,cb); doc.rect(0,0,pageW,28,'F')
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(14)
      doc.text('Perfil del Estudiante', 14, 11)
      doc.setFontSize(10); doc.setFont('helvetica','normal')
      doc.text(perfil.nombre_completo, 14, 18)
      doc.setFontSize(9)
      doc.text(`${cursoSel?.nombre||''} · ${mNombre}${perfil.codigo_unico?' · '+perfil.codigo_unico:''}`, 14, 24)
      if (centro||maestro) doc.text([centro,maestro].filter(Boolean).join(' · '), pageW-14, 18, {align:'right'})
      let y = 36
      const semC = n => n===null?[150,150,150]:n>=85?[26,107,58]:n>=70?[200,75,0]:[183,28,28]
      const semB = n => n===null?[244,244,244]:n>=85?[214,238,224]:n>=70?[253,236,215]:[253,223,223]
      doc.setTextColor(30,30,30); doc.setFont('helvetica','bold'); doc.setFontSize(9)
      doc.setFillColor(248,250,253); doc.rect(14,y,pageW-28,7,'F')
      doc.text('CALIFICACIONES POR PERÍODO', 16, y+5); y+=10
      const perW = (pageW-28)/perfilData.periodos.length
      perfilData.periodos.forEach((p,i) => {
        const x=14+i*perW
        const cols=[[44,58,107],[0,105,92],[92,45,145],[26,107,58]]
        const [pr,pg,pb]=cols[i]||[44,58,107]
        doc.setFillColor(pr,pg,pb); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8)
        doc.rect(x,y,perW-2,7,'F'); doc.text(p.nombre,x+perW/2,y+5,{align:'center'})
        const n=p.promedio
        const [br,bg2,bb]=semB(n); const [tr,tg,tb]=semC(n)
        doc.setFillColor(br,bg2,bb); doc.rect(x,y+8,perW-2,14,'F')
        doc.setTextColor(tr,tg,tb); doc.setFont('helvetica','bold'); doc.setFontSize(14)
        doc.text(n!==null?String(n):'—', x+perW/2, y+18, {align:'center'})
      }); y+=28
      if (promAnio!==null) {
        const [br,bg2,bb]=semB(promAnio); const [tr,tg,tb]=semC(promAnio)
        doc.setFillColor(br,bg2,bb); doc.rect(pageW-50,y-4,36,10,'F')
        doc.setTextColor(tr,tg,tb); doc.setFont('helvetica','bold'); doc.setFontSize(10)
        doc.text('Promedio año: '+promAnio, pageW-14, y+3, {align:'right'}); y+=12
      } else { y+=4 }
      doc.setTextColor(30,30,30); doc.setFont('helvetica','bold'); doc.setFontSize(9)
      doc.setFillColor(248,250,253); doc.rect(14,y,pageW-28,7,'F')
      doc.text('ASISTENCIA TOTAL DEL AÑO', 16, y+5); y+=10
      const asistCols=[
        {label:'Presentes',val:pPresente,r:26,g:107,b:58},{label:'Ausencias',val:pAusente,r:183,g:28,b:28},
        {label:'Tardanzas',val:pTardanza,r:122,g:92,b:0},{label:'Excusados',val:pExcusado,r:92,g:45,b:145},
        {label:'Asistencia',val:pctAsist!==null?pctAsist+'%':'—',r:44,g:58,b:107},
      ]
      const bw=(pageW-28)/asistCols.length
      asistCols.forEach(({label,val,r,g,b},i) => {
        const x=14+i*bw
        doc.setFillColor(r,g,b); doc.rect(x,y,bw-2,14,'F')
        doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(13)
        doc.text(String(val), x+bw/2, y+9, {align:'center'})
        doc.setFontSize(7); doc.setFont('helvetica','normal')
        doc.text(label, x+bw/2, y+13, {align:'center'})
      }); y+=20
      if (perfilData.obs.length>0) {
        doc.setTextColor(30,30,30); doc.setFont('helvetica','bold'); doc.setFontSize(9)
        doc.setFillColor(248,250,253); doc.rect(14,y,pageW-28,7,'F')
        doc.text(`OBSERVACIONES (${perfilData.obs.length})`, 16, y+5); y+=10
        perfilData.obs.slice(0,8).forEach((obs,i) => {
          if (y>pageH-20) {doc.addPage(); y=20}
          const t=TIPOS_OBS.find(x=>x.key===obs.tipo)||TIPOS_OBS[0]
          doc.setFillColor(...(i%2===0?[255,255,255]:[250,251,253])); doc.rect(14,y,pageW-28,9,'F')
          doc.setTextColor(100,100,100); doc.setFont('helvetica','normal'); doc.setFontSize(8)
          doc.text(obs.fecha, 16, y+6)
          doc.setTextColor(30,30,30); doc.setFont('helvetica','bold'); doc.setFontSize(8)
          doc.text(t.label.toUpperCase(), 38, y+6)
          doc.setFont('helvetica','normal')
          const lines=doc.splitTextToSize(obs.texto, pageW-70)
          doc.text(lines[0], 62, y+6); y+=9
        })
      }
      doc.save(`Perfil_${perfil.nombre_completo.replace(/ /g,'_')}_${mNombre}.pdf`)
      toast2('📄 PDF descargado')
    } catch(err) { console.error(err); toast2('❌ Error generando PDF') }
  }

  const cambio = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const color  = cursoSel?.color || '#1B3A6B'

  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20 }}>

      {/* SIDEBAR */}
      <div style={{ background:'#fff', borderRadius:12, padding:14, border:'1px solid #DDE3ED', boxShadow:'0 2px 8px #0001', height:'fit-content' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#AAB4C4', marginBottom:10, letterSpacing:1.5 }}>CURSO</div>
        {cursos.map(c => (
          <div key={c.id} onClick={() => setCursoSel(c)} style={{
            padding:'8px 10px', borderRadius:8, cursor:'pointer', marginBottom:4,
            background: cursoSel?.id===c.id ? c.color : 'transparent',
            color:      cursoSel?.id===c.id ? '#fff' : c.color,
            fontWeight:600, fontSize:13, display:'flex', alignItems:'center', gap:8,
          }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:cursoSel?.id===c.id?'#fff':c.color, flexShrink:0 }}/>
            {c.nombre}
          </div>
        ))}
        <button onClick={() => { cerrarModalPadron(); setModalPadron(true) }}
          style={{ width:'100%', marginTop:10, padding:'8px 6px', background:'#F0FDF4', color:'#166534', border:'1px dashed #86EFAC', borderRadius:8, fontSize:11.5, fontWeight:700, cursor:'pointer' }}>
          📥 Importar padrón completo
        </button>
      </div>

      {/* PANEL PRINCIPAL */}
      <div>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', marginBottom:16, gap:10, flexWrap:'wrap' }}>
          <h2 style={{ fontSize:18, color:'#1B3A6B', margin:0 }}>👨‍🎓 {cursoSel?.nombre || 'Selecciona un curso'}</h2>
          <span style={{ background:'#D6E4F7', color:'#2563A8', padding:'2px 10px', borderRadius:12, fontSize:12, fontWeight:600 }}>
            {activos} activos
          </span>
          {retirados > 0 && (
            <span style={{ background:'#FEF3C7', color:'#92400E', padding:'2px 10px', borderRadius:12, fontSize:12, fontWeight:600 }}>
              {retirados} retirados
            </span>
          )}
          <div style={{ flex:1 }}/>

          {/* Toggle retirados */}
          {retirados > 0 && (
            <button onClick={() => setVerRetirados(v => !v)} style={{
              padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
              background: verRetirados ? '#FEF3C7' : '#F8FAFD',
              color:      verRetirados ? '#92400E' : '#555',
              border: `1.5px solid ${verRetirados ? '#D4B820' : '#DDE3ED'}`,
            }}>
              {verRetirados ? '👁 Ocultar retirados' : '👁 Ver retirados'}
            </button>
          )}
          {cursoSel && (
            <>
              <button onClick={() => { setPreview([]); setArchivoNombre(''); setModalImport(true) }}
                style={{ padding:'8px 14px', background:'#00695C', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                📥 Importar
              </button>
              <button onClick={abrirGrupos}
                style={{ padding:'8px 14px', background:'#EEF2F7', color:'#1B3A6B', border:'1.5px solid #DDE3ED', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                👥 Grupos{hayGrupos ? ` (${nGrupos})` : ''}
              </button>
              <button onClick={abrirNuevo}
                style={{ padding:'8px 16px', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                + Agregar
              </button>
            </>
          )}
        </div>

        {/* Búsqueda */}
        {estudiantes.length > 0 && (
          <div style={{ position:'relative', marginBottom:14 }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:15, pointerEvents:'none' }}>🔍</span>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o código..."
              style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:9, padding:'9px 12px 9px 36px', fontSize:13, outline:'none', boxSizing:'border-box' }}
              onFocus={e => e.target.style.borderColor='#2563A8'}
              onBlur={e  => e.target.style.borderColor='#DDE3ED'}/>
            {busqueda && <button onClick={() => setBusqueda('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#AAB4C4' }}>✕</button>}
          </div>
        )}

        {/* Lista */}
        {estudiantes.length === 0 ? (
          <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', border:'1px solid #DDE3ED' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>👨‍🎓</div>
            <p style={{ color:'#888', fontSize:13, marginBottom:16 }}>Sin estudiantes en este curso</p>
            <button onClick={() => { setPreview([]); setArchivoNombre(''); setModalImport(true) }}
              style={{ padding:'9px 24px', background:'#00695C', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
              📥 Importar desde Excel/CSV
            </button>
          </div>
        ) : estudiantesFiltrados.length === 0 ? (
          <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', border:'1px solid #DDE3ED' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🔍</div>
            <p style={{ color:'#888', fontSize:13 }}>Sin resultados para <strong>"{busqueda}"</strong></p>
            <button onClick={() => setBusqueda('')} style={{ padding:'8px 20px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer' }}>Limpiar</button>
          </div>
        ) : (
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #DDE3ED', overflow:'hidden' }}>
            {/* Cabecera tabla */}
            <div style={{ display:'grid', gridTemplateColumns:'56px 1fr 84px 110px 100px 110px', background:'#1B3A6B', padding:'10px 16px', gap:10 }}>
              {['#','Nombre','Grupo','Código','Estado','Acciones'].map(h => (
                <div key={h} style={{ color:'#9BBFED', fontSize:11, fontWeight:700 }}>{h}</div>
              ))}
            </div>

            {estudiantesFiltrados.map((e, idx) => {
              const retirado = e.estado !== 'activo'
              return (
                <div key={e.id} style={{
                  display:'grid', gridTemplateColumns:'56px 1fr 84px 110px 100px 110px',
                  padding:'10px 16px', gap:10, alignItems:'center',
                  borderTop: idx>0 ? '1px solid #F0F4FA' : 'none',
                  background: retirado ? '#FFFBF0' : idx%2===0 ? '#fff' : '#FAFBFD',
                  opacity: retirado ? .75 : 1,
                }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#7A8FA8' }}>{String(e.numero_lista).padStart(2,'0')}</div>

                  <div onClick={() => !retirado && abrirPerfil(e)}
                    style={{ fontSize:13, color: retirado ? '#888' : color, fontWeight:700,
                      cursor: retirado ? 'default' : 'pointer',
                      textDecoration: retirado ? 'line-through' : 'underline',
                      textDecorationStyle:'dotted', textUnderlineOffset:3 }}>
                    {busqueda.trim() ? destacar(e.nombre_completo, busqueda) : e.nombre_completo}
                  </div>

                  <div>
                    {retirado
                      ? <span style={{ fontSize:12, color:'#888' }}>{e.grupo_trabajo ? 'G'+e.grupo_trabajo : '—'}</span>
                      : <select value={e.grupo_trabajo ?? ''} onChange={ev => cambiarGrupo(e, ev.target.value)}
                          title="Grupo de trabajo"
                          style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:6, padding:'3px 4px', fontSize:12, fontWeight:700, color: e.grupo_trabajo ? '#1B3A6B' : '#AAB4C4', background:'#fff', cursor:'pointer' }}>
                          <option value="">—</option>
                          {opcionesGrupo.map(g => <option key={g} value={g}>G{g}</option>)}
                        </select>
                    }
                  </div>

                  <div style={{ fontSize:12, color:'#888' }}>{e.codigo_unico || '—'}</div>

                  <div>
                    {retirado
                      ? <span style={{ background:'#FEF3C7', color:'#92400E', padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600 }}>🚪 Retirado</span>
                      : <span style={{ background:'#D6EEE0', color:'#1A6B3A', padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600 }}>✓ Activo</span>
                    }
                  </div>

                  <div style={{ display:'flex', gap:4 }}>
                    {retirado ? (
                      <>
                        <button onClick={() => reactivarEstudiante(e)} title="Reactivar"
                          style={btnSm('#D6EEE0', '#1A6B3A')}>↩</button>
                        <button onClick={() => eliminarEstudiante(e)} title="Eliminar permanentemente"
                          style={btnSm('#FDDFDF', '#B71C1C')}>🗑</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => abrirEditar(e)} title="Editar"
                          style={btnSm('#EEF2F7', '#1B3A6B')}>✏️</button>
                        <button onClick={() => retirarEstudiante(e)} title="Retirar del curso"
                          style={btnSm('#FEF3C7', '#92400E')}>🚪</button>
                        <button onClick={() => eliminarEstudiante(e)} title="Eliminar permanentemente"
                          style={btnSm('#FDDFDF', '#B71C1C')}>🗑</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            {busqueda.trim() && (
              <div style={{ padding:'8px 16px', background:'#F8FAFD', borderTop:'1px solid #F0F4FA', fontSize:12, color:'#888', textAlign:'right' }}>
                {estudiantesFiltrados.length} de {estudiantes.length}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL PERFIL ── */}
      {perfilT && (
        <div className="modal-backdrop" data-closing={perfilT.closing} style={{ position:'fixed', inset:0, background:'#0006', display:'flex', alignItems:'center', justifyContent:'center', zIndex:600 }}
          onClick={e => { if (e.target===e.currentTarget) setPerfil(null) }}>
          <div className="modal-content" data-closing={perfilT.closing} style={{ background:'#fff', borderRadius:14, width:640, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 16px 48px #0004', overflow:'hidden' }}>
            <div style={{ background:`linear-gradient(135deg,${color},${color}CC)`, padding:'20px 24px', display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color:'#fff', flexShrink:0 }}>
                {perfilT.value.nombre_completo.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:'#fff', fontWeight:800, fontSize:18 }}>{perfilT.value.nombre_completo}</div>
                <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12, marginTop:2 }}>
                  {cursoSel?.nombre}{materia?' · '+materia.nombre:''}{perfilT.value.codigo_unico?' · '+perfilT.value.codigo_unico:''}
                </div>
              </div>
              <button onClick={exportarPerfilPDF} style={{ padding:'8px 16px', background:'rgba(255,255,255,0.2)', border:'1.5px solid rgba(255,255,255,0.5)', borderRadius:8, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>📄 PDF</button>
              <button onClick={() => setPerfil(null)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:6, width:30, height:30, cursor:'pointer', fontSize:16 }}>✕</button>
            </div>

            {cargandoPerfil ? (
              <div style={{ padding:40, textAlign:'center', color:'#AAA' }}>
                <div className="spinner" style={{ margin:'0 auto 8px' }} />
                Cargando datos...
              </div>
            ) : perfilData ? (
              <div className="content-fade-in" style={{ flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:14 }}>
                {/* Calificaciones */}
                <div style={{ borderRadius:12, border:'1px solid #DDE3ED', overflow:'hidden' }}>
                  <div style={{ padding:'10px 16px', background:'#1B3A6B', color:'#9BBFED', fontSize:11, fontWeight:700, letterSpacing:1.2 }}>
                    📊 CALIFICACIONES — {materia?.nombre||'Todas las materias'}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:`repeat(${perfilData.periodos.length},1fr)` }}>
                    {perfilData.periodos.map((p,i) => {
                      const col=COLORES_PER[i]||'#2563A8'; const n=p.promedio
                      const sC=n===null?'#888':n>=85?'#1A6B3A':n>=70?'#C84B00':'#B71C1C'
                      const sB=n===null?'#F4F4F4':n>=85?'#D6EEE0':n>=70?'#FDECD7':'#FDDFDF'
                      return (
                        <div key={p.periodoId} style={{ padding:'14px 10px', textAlign:'center', borderRight:i<perfilData.periodos.length-1?'1px solid #E8EDF5':'none' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:col, marginBottom:8 }}>{p.nombre}</div>
                          {n!==null ? <div style={{ display:'inline-block', background:sB, color:sC, padding:'6px 16px', borderRadius:20, fontWeight:900, fontSize:20 }}>{n}</div>
                                    : <span style={{ color:'#DDE3ED', fontSize:14 }}>—</span>}
                        </div>
                      )
                    })}
                  </div>
                  {(() => {
                    const v=perfilData.periodos.map(p=>p.promedio).filter(n=>n!==null)
                    const pr=v.length>0?Math.round(v.reduce((a,b)=>a+b,0)/v.length):null
                    const sC=pr===null?'#888':pr>=85?'#1A6B3A':pr>=70?'#C84B00':'#B71C1C'
                    const sB=pr===null?'#F4F4F4':pr>=85?'#D6EEE0':pr>=70?'#FDECD7':'#FDDFDF'
                    return pr!==null?<div style={{ padding:'10px 16px', borderTop:'1px solid #E8EDF5', display:'flex', justifyContent:'flex-end', gap:10, alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'#888' }}>Promedio del año:</span>
                      <span style={{ background:sB, color:sC, padding:'4px 16px', borderRadius:20, fontWeight:900, fontSize:16 }}>{pr}</span>
                    </div>:null
                  })()}
                </div>

                {/* Asistencia */}
                {(() => {
                  const a=perfilData.asistencias||[]
                  const pP=a.filter(x=>x.estado==='presente').length, pA=a.filter(x=>x.estado==='ausente').length
                  const pT=a.filter(x=>x.estado==='tardanza').length, pE=a.filter(x=>x.estado==='excusado').length
                  const pct=a.length>0?Math.round(pP/a.length*100):null
                  return (
                    <div style={{ borderRadius:12, border:'1px solid #DDE3ED', overflow:'hidden' }}>
                      <div style={{ padding:'10px 16px', background:'#1B3A6B', color:'#9BBFED', fontSize:11, fontWeight:700, letterSpacing:1.2, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span>✅ ASISTENCIA TOTAL DEL AÑO</span>
                        {pct!==null&&<span style={{ background:'rgba(255,255,255,0.15)', padding:'2px 10px', borderRadius:10, color:'#fff', fontSize:12 }}>{pct}%</span>}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)' }}>
                        {[{l:'Presentes',v:pP,c:'#1A6B3A',b:'#D6EEE0'},{l:'Ausencias',v:pA,c:'#B71C1C',b:'#FDDFDF'},{l:'Tardanzas',v:pT,c:'#7A5C00',b:'#FFF8D6'},{l:'Excusados',v:pE,c:'#5C2D91',b:'#EDE0F7'}].map((s,i)=>(
                          <div key={s.l} style={{ padding:'14px 10px', textAlign:'center', background:s.b, borderRight:i<3?'1px solid #fff':'' }}>
                            <div style={{ fontSize:26, fontWeight:900, color:s.c }}>{s.v}</div>
                            <div style={{ fontSize:11, color:s.c, fontWeight:600 }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Observaciones */}
                <div style={{ borderRadius:12, border:'1px solid #DDE3ED', overflow:'hidden' }}>
                  <div style={{ padding:'10px 16px', background:'#1B3A6B', color:'#9BBFED', fontSize:11, fontWeight:700, letterSpacing:1.2 }}>
                    📓 OBSERVACIONES ({perfilData.obs.length})
                  </div>
                  {perfilData.obs.length===0
                    ? <div style={{ padding:20, textAlign:'center', color:'#AAA', fontSize:13, fontStyle:'italic' }}>Sin observaciones</div>
                    : <div style={{ maxHeight:200, overflowY:'auto' }}>
                        {perfilData.obs.map((obs,idx) => {
                          const t=TIPOS_OBS.find(x=>x.key===obs.tipo)||TIPOS_OBS[0]
                          return (
                            <div key={obs.id} style={{ padding:'10px 16px', borderTop:idx>0?'1px solid #EEF2F7':'none', display:'flex', gap:10, alignItems:'flex-start' }}>
                              <span style={{ background:t.bg, color:t.color, padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700, flexShrink:0, marginTop:2 }}>{t.label}</span>
                              <div style={{ flex:1, fontSize:13, color:'#333', lineHeight:1.5 }}>{obs.texto}</div>
                              <span style={{ fontSize:11, color:'#AAA', flexShrink:0 }}>{obs.fecha}</span>
                            </div>
                          )
                        })}
                      </div>
                  }
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── MODAL AGREGAR/EDITAR ── */}
      {modalT && (
        <div className="modal-backdrop" data-closing={modalT.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
          onClick={e => { if (e.target===e.currentTarget) setModal(false) }}>
          <div className="modal-content" data-closing={modalT.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:400, boxShadow:'0 16px 48px #0004' }}>
            <h2 style={{ color:'#1B3A6B', marginBottom:20, fontSize:17 }}>{editId?'✏️ Editar':'+ Nuevo'} Estudiante</h2>
            {[
              {label:'Nombre completo *',key:'nombre',placeholder:'Ej: Juan Pérez'},
              {label:'Código único',key:'codigo',placeholder:'Ej: EST-001'},
              {label:'Número de lista',key:'numero',placeholder:'Ej: 1',type:'number'},
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:5 }}>{f.label}</label>
                <input type={f.type||'text'} value={form[f.key]} onChange={e=>cambio(f.key,e.target.value)} placeholder={f.placeholder}
                  style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }}
                  onFocus={e=>e.target.style.borderColor='#2563A8'} onBlur={e=>e.target.style.borderColor='#DDE3ED'}/>
              </div>
            ))}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
              <button onClick={()=>setModal(false)} style={{ padding:'9px 20px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>Cancelar</button>
              <button onClick={guardar} style={{ padding:'9px 24px', background:'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>{editId?'Guardar':'Agregar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL IMPORTAR ── */}
      {modalImportT && (
        <div className="modal-backdrop" data-closing={modalImportT.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
          onClick={e => { if (e.target===e.currentTarget) setModalImport(false) }}>
          <div className="modal-content" data-closing={modalImportT.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:560, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 16px 48px #0004' }}>
            <h2 style={{ color:'#1B3A6B', marginBottom:6, fontSize:17 }}>📥 Importar Estudiantes</h2>
            <p style={{ color:'#888', fontSize:12, marginBottom:16 }}>Importando a: <strong style={{ color:cursoSel?.color }}>{cursoSel?.nombre}</strong></p>
            <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:12, marginBottom:14, fontSize:12 }}>
              <div style={{ fontWeight:700, color:'#166534', marginBottom:6 }}>Columnas aceptadas:</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {['nombre','nombre_completo','nombre completo','alumno','estudiante'].map(c=>(
                  <span key={c} style={{ background:'#DCFCE7', color:'#166534', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600 }}>{c}</span>
                ))}
              </div>
              <div style={{ color:'#166534', marginTop:6 }}>Opcionales: <strong>codigo</strong>, <strong>numero</strong></div>
            </div>
            {!archivoNombre ? (
              <button onClick={seleccionarArchivo} disabled={importando}
                style={{ padding:'12px', background:'#00695C', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', marginBottom:14 }}>
                {importando?'⏳ Leyendo...':'📂 Seleccionar Excel o CSV'}
              </button>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'10px 14px', background:'#F0FDF4', borderRadius:8, border:'1px solid #BBF7D0' }}>
                <span style={{ fontSize:20 }}>📄</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'#166534' }}>{archivoNombre}</div>
                  <div style={{ fontSize:12, color:'#16a34a' }}>{preview.length} estudiantes detectados</div>
                </div>
                <button onClick={seleccionarArchivo} style={{ padding:'5px 10px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:6, fontSize:11, cursor:'pointer' }}>Cambiar</button>
              </div>
            )}
            {preview.length > 0 && (
              <div style={{ flex:1, overflow:'auto', border:'1px solid #DDE3ED', borderRadius:8, marginBottom:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'50px 1fr 100px 70px', background:'#1B3A6B', padding:'8px 14px', gap:10, position:'sticky', top:0 }}>
                  {['#','Nombre','Código','Lista'].map(h=><div key={h} style={{ color:'#9BBFED', fontSize:11, fontWeight:700 }}>{h}</div>)}
                </div>
                {preview.slice(0,50).map((e,i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'50px 1fr 100px 70px', padding:'7px 14px', gap:10, borderTop:i>0?'1px solid #F0F4FA':'none', background:i%2===0?'#fff':'#FAFBFD' }}>
                    <div style={{ fontSize:12, color:'#7A8FA8', fontWeight:600 }}>{String(e.numero).padStart(2,'0')}</div>
                    <div style={{ fontSize:12, color:'#1B3A6B', fontWeight:600 }}>{e.nombre}</div>
                    <div style={{ fontSize:12, color:'#888' }}>{e.codigo||'—'}</div>
                    <div style={{ fontSize:12, color:'#888' }}>{e.numero}</div>
                  </div>
                ))}
                {preview.length>50&&<div style={{ padding:'8px 14px', textAlign:'center', fontSize:12, color:'#888' }}>... y {preview.length-50} más</div>}
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>setModalImport(false)} style={{ padding:'9px 20px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>Cancelar</button>
              <button onClick={ejecutarImportar} disabled={preview.length===0||importando}
                style={{ padding:'9px 24px', background:preview.length>0?'#00695C':'#CCC', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:preview.length>0?'pointer':'default' }}>
                {importando?'⏳ Importando...':`📥 Importar ${preview.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL IMPORTAR PADRÓN COMPLETO (varios cursos a la vez) ── */}
      {modalPadronT && (
        <div className="modal-backdrop" data-closing={modalPadronT.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
          onClick={e => { if (e.target===e.currentTarget && !padronCargando) cerrarModalPadron() }}>
          <div className="modal-content" data-closing={modalPadronT.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:640, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 16px 48px #0004' }}>
            <h2 style={{ color:'#1B3A6B', marginBottom:6, fontSize:17 }}>📥 Importar padrón completo</h2>
            <p style={{ color:'#888', fontSize:12, marginBottom:16 }}>
              Un solo archivo con estudiantes de <strong>varios cursos a la vez</strong> — cada fila se ubica en el curso que coincida por grado y sección.
            </p>

            {padronResultado ? (
              <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:16, fontSize:13, color:'#166534' }}>
                <div style={{ fontWeight:700, marginBottom:6 }}>✅ Importación completada</div>
                <div>{padronResultado.cursosCreados} curso(s) creado(s), {padronResultado.insertados} estudiante(s) nuevo(s), {padronResultado.actualizados} actualizado(s), {padronResultado.sinCambios} sin cambios.</div>
                {padronResultado.errores.length > 0 && (
                  <div style={{ marginTop:8, color:'#991B1B' }}>
                    {padronResultado.errores.map((e,i) => <div key={i}>⚠ {e}</div>)}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:12, marginBottom:14, fontSize:12 }}>
                  <div style={{ fontWeight:700, color:'#166534', marginBottom:6 }}>Columnas requeridas (todas obligatorias):</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {['grado','seccion','numero_orden','nombre'].map(c=>(
                      <span key={c} style={{ background:'#DCFCE7', color:'#166534', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600 }}>{c}</span>
                    ))}
                  </div>
                </div>

                {!padronArchivo ? (
                  <button onClick={seleccionarArchivoPadron} disabled={padronCargando}
                    style={{ padding:'12px', background:'#00695C', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', marginBottom:14 }}>
                    {padronCargando?'⏳ Leyendo...':'📂 Seleccionar Excel o CSV'}
                  </button>
                ) : (
                  <>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'10px 14px', background:'#F0FDF4', borderRadius:8, border:'1px solid #BBF7D0' }}>
                      <span style={{ fontSize:20 }}>📄</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:'#166534' }}>{padronArchivo}</div>
                        <div style={{ fontSize:12, color:'#16a34a' }}>
                          {padronGrupos.reduce((s,g)=>s+g.estudiantes.length,0)} estudiante(s) en {padronGrupos.length} grupo(s) de grado/sección
                          {padronInvalidas > 0 ? ` — ${padronInvalidas} fila(s) descartada(s) por faltarle grado, sección, número o nombre` : ''}
                        </div>
                      </div>
                      <button onClick={seleccionarArchivoPadron} style={{ padding:'5px 10px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:6, fontSize:11, cursor:'pointer' }}>Cambiar</button>
                    </div>

                    <div style={{ flex:1, overflow:'auto', marginBottom:14 }}>
                      {padronGrupos.map((g, i) => (
                        <div key={i} style={{ border:'1px solid #DDE3ED', borderRadius:8, marginBottom:8, overflow:'hidden' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background: g.cursoId ? '#F0FDF4' : '#FFFBEB' }}>
                            <span style={{ fontSize:14 }}>{g.cursoId ? '✓' : '⚠'}</span>
                            <div style={{ flex:1, fontSize:13, fontWeight:700, color: g.cursoId ? '#166534' : '#92400E' }}>
                              {g.cursoId ? g.cursoNombre : `${g.grado} ${g.seccion} — no existe un curso con ese grado/sección`}
                            </div>
                            <span style={{ fontSize:12, color:'#888' }}>{g.estudiantes.length} estudiante(s)</span>
                            {!g.cursoId && (
                              <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'#92400E', cursor:'pointer' }}>
                                <input type="checkbox" checked={!!g.crear} onChange={() => toggleCrearGrupoPadron(i)} />
                                Crear curso "{g.grado} {g.seccion}"
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={cerrarModalPadron} style={{ padding:'9px 20px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>
                {padronResultado ? 'Cerrar' : 'Cancelar'}
              </button>
              {!padronResultado && padronGrupos.length > 0 && (
                <button onClick={confirmarImportPadron} disabled={padronCargando}
                  style={{ padding:'9px 24px', background:'#00695C', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  {padronCargando ? '⏳ Importando...' : '📥 Confirmar importación'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL GRUPOS DE TRABAJO ── */}
      {modalGruposT && (
        <div className="modal-backdrop" data-closing={modalGruposT.closing} style={{ position:'fixed', inset:0, background:'#0005', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
          onClick={e => { if (e.target===e.currentTarget) setModalGrupos(false) }}>
          <div className="modal-content" data-closing={modalGruposT.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:520, maxHeight:'85vh', overflowY:'auto', boxShadow:'0 16px 48px #0004' }}>
            <h2 style={{ color:'#1B3A6B', marginBottom:6, fontSize:17 }}>👥 Grupos de trabajo</h2>
            <p style={{ color:'#888', fontSize:12, marginBottom:14 }}>
              {cursoSel?.nombre} — un grupo por línea con los <strong>números de lista</strong> de sus integrantes. También puedes cambiar el grupo de cada estudiante desde la lista.
            </p>
            <textarea value={grupoTexto} onChange={e => setGrupoTexto(e.target.value)} rows={8}
              placeholder={'G1: 3, 7, 12, 20, 31, 38\nG2: 1, 5, 9, 14, 22\nG3: 10-15'}
              style={{ width:'100%', border:'1.5px solid #DDE3ED', borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:'monospace', outline:'none', boxSizing:'border-box', resize:'vertical' }}
              onFocus={e => e.target.style.borderColor='#2563A8'} onBlur={e => e.target.style.borderColor='#DDE3ED'} />
            <div style={{ fontSize:12, minHeight:18, margin:'6px 0 12px' }}>
              {grupoParse.errores.length > 0
                ? <span style={{ color:'#B71C1C' }}>⚠ {grupoParse.errores[0]}</span>
                : grupoParse.items.length > 0
                  ? <span style={{ color:'#166534' }}>
                      {grupoParse.items.length} grupo(s) · {grupoParse.items.reduce((s, it) => s + it.numeros.length, 0)} estudiante(s)
                      {grupoSinLista.length > 0 && <span style={{ color:'#92400E' }}> · ⚠ no están en la lista: {[...new Set(grupoSinLista)].join(', ')}</span>}
                    </span>
                  : <span style={{ color:'#AAB4C4' }}>Escribe al menos un grupo</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
              {[
                { val:false, t:'Agregar / actualizar', d:'Solo toca a los listados (los mueve si ya tenían otro grupo). Los demás quedan como están.' },
                { val:true,  t:'Reemplazar todo',      d:'Lo que no aparezca en el texto queda "Sin grupo". Úsalo para sacar a alguien.' },
              ].map(o => (
                <label key={String(o.val)} style={{ display:'flex', gap:8, alignItems:'flex-start', fontSize:12, cursor:'pointer',
                  padding:'8px 10px', borderRadius:8, border:'1.5px solid '+(grupoReemplazar===o.val?'#2563A8':'#DDE3ED'), background: grupoReemplazar===o.val?'#EEF5FF':'#fff' }}>
                  <input type="radio" checked={grupoReemplazar===o.val} onChange={() => setGrupoReemplazar(o.val)} style={{ marginTop:2 }} />
                  <span><strong style={{ color:'#1B3A6B' }}>{o.t}</strong><br/><span style={{ color:'#888' }}>{o.d}</span></span>
                </label>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              {hayGrupos && (
                <button onClick={quitarTodosLosGrupos} style={{ padding:'9px 14px', background:'#FDDFDF', color:'#B71C1C', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>Quitar todos</button>
              )}
              <div style={{ flex:1 }} />
              <button onClick={() => setModalGrupos(false)} style={{ padding:'9px 20px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555' }}>Cancelar</button>
              <button onClick={aplicarGrupos} disabled={grupoParse.errores.length > 0 || grupoParse.items.length === 0}
                style={{ padding:'9px 24px', background:(grupoParse.errores.length > 0 || grupoParse.items.length === 0)?'#CCC':'#1B3A6B', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR ── */}
      {confirmT && (
        <div className="modal-backdrop" data-closing={confirmT.closing} style={{ position:'fixed', inset:0, background:'#0006', display:'flex', alignItems:'center', justifyContent:'center', zIndex:700 }}>
          <div className="modal-content" data-closing={confirmT.closing} style={{ background:'#fff', borderRadius:14, padding:28, width:400, boxShadow:'0 16px 48px #0004', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
            <div style={{ fontSize:14, color:'#1B3A6B', marginBottom:20, lineHeight:1.6, whiteSpace:'pre-line' }}>{confirmT.value.msg}</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setConfirm(null)} style={{ padding:'9px 24px', background:'#EEF2F7', border:'1px solid #DDE3ED', borderRadius:8, fontSize:13, cursor:'pointer', color:'#555', fontWeight:600 }}>Cancelar</button>
              <button onClick={() => { const fn=confirmT.value.fn; setConfirm(null); fn() }} style={{ padding:'9px 24px', background:'#B71C1C', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position:'fixed', bottom:24, right:24, background:'#1A6B3A', color:'#fff', padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:600, boxShadow:'0 4px 16px #0003', zIndex:999 }}>{toast}</div>}
    </div>
  )
}

const btnSm = (bg, color) => ({
  width:28, height:28, borderRadius:6, border:`1.5px solid ${color}40`,
  background:bg, color, fontSize:13, cursor:'pointer', display:'flex',
  alignItems:'center', justifyContent:'center', flexShrink:0,
})

// "G1: 3, 7, 12" / "Grupo 2: 1 5 9" / "3: 10-15" -> [{ grupo, numeros }]
function parseGrupos(texto) {
  const porGrupo = new Map()
  const errores = []
  texto.split(/\r?\n/).forEach((linea, i) => {
    if (!linea.trim()) return
    const m = linea.match(/^\s*(?:grupo|g)?\s*(\d+)\s*[:=]\s*(.*)$/i)
    if (!m || Number(m[1]) < 1) { errores.push(`Línea ${i + 1} no se entiende: "${linea.trim()}" (usa "G1: 3, 7, 12")`); return }
    const g = Number(m[1])
    const nums = porGrupo.get(g) || []
    for (const tok of m[2].split(/[\s,;]+/).filter(Boolean)) {
      const r = tok.match(/^(\d+)-(\d+)$/)
      if (/^\d+$/.test(tok) && Number(tok) >= 1) nums.push(Number(tok))
      else if (r && Number(r[1]) >= 1 && Number(r[1]) <= Number(r[2]) && Number(r[2]) - Number(r[1]) <= 100) {
        for (let n = Number(r[1]); n <= Number(r[2]); n++) nums.push(n)
      } else { errores.push(`Línea ${i + 1}: "${tok}" no es un número de lista válido`); return }
    }
    porGrupo.set(g, nums)
  })
  const dueno = new Map()
  for (const [g, nums] of porGrupo) for (const n of nums) {
    if (dueno.has(n) && dueno.get(n) !== g) errores.push(`El número ${n} aparece en G${dueno.get(n)} y en G${g}`)
    dueno.set(n, g)
  }
  const items = [...porGrupo].sort((a, b) => a[0] - b[0]).map(([grupo, nums]) => ({ grupo, numeros: [...new Set(nums)] }))
  return { items, errores: [...new Set(errores)] }
}

function textoGruposActuales(activos) {
  const porGrupo = new Map()
  for (const e of activos) if (e.grupo_trabajo != null) {
    if (!porGrupo.has(e.grupo_trabajo)) porGrupo.set(e.grupo_trabajo, [])
    porGrupo.get(e.grupo_trabajo).push(e.numero_lista)
  }
  return [...porGrupo].sort((a, b) => a[0] - b[0])
    .map(([g, nums]) => `G${g}: ${nums.sort((a, b) => a - b).join(', ')}`).join('\n')
}

function destacar(texto, busqueda) {
  const idx = texto.toLowerCase().indexOf(busqueda.toLowerCase())
  if (idx===-1) return texto
  return <>{texto.slice(0,idx)}<span style={{ background:'#FFF176', borderRadius:3, padding:'0 2px', color:'#1B3A6B' }}>{texto.slice(idx,idx+busqueda.length)}</span>{texto.slice(idx+busqueda.length)}</>
}