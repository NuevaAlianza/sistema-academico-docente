import React, { useState, useEffect, useRef } from 'react'
import PlanClase from './PlanClase'
import { useModalTransition } from '../hooks/useModalTransition'
import { useCursoActivo, usePeriodoActivo } from '../hooks/useSeleccionActiva'
// Carga imágenes locales via IPC (evita bloqueo de file:// en Electron)
function ImgLocal({ ruta, style, onClick }) {
  const [src, setSrc] = React.useState(null)
  React.useEffect(() => {
    if (!ruta) return
    window.api.invoke('leer-imagen', ruta).then(b64 => { if (b64) setSrc(b64) })
  }, [ruta])
  if (!src) return (
    <div style={{ ...style, background: '#F0F4FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#CCC', cursor: onClick ? 'zoom-in' : 'default' }}
      onClick={onClick}>🖼️</div>
  )
  return <img src={src} alt="" style={{ ...style, objectFit: 'contain', cursor: onClick ? 'zoom-in' : 'default' }} onClick={onClick} />
}


const ESTADO_CFG = {
  pendiente:{label:'Pendiente',emoji:'⬜',bg:'#F4F4F4',color:'#555',border:'#CCCCCC'},
  realizado:{label:'Realizado',emoji:'✅',bg:'#D6EEE0',color:'#1A6B3A',border:'#A8D4B8'},
  tarea:    {label:'Tarea',    emoji:'📌',bg:'#FFF8D6',color:'#7A5C00',border:'#D4B820'},
  aplazado: {label:'Aplazado', emoji:'🔄',bg:'#FDECD7',color:'#C84B00',border:'#E8A878'},
}
const ESTADOS_ORDEN=['pendiente','realizado','tarea','aplazado']
const COLORES_PER  =['#2563A8','#00695C','#5C2D91','#1A6B3A']
const EXT_ICON={pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📊',pptx:'📊',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',webp:'🖼️',mp4:'🎬',mp3:'🎵',zip:'📦',rar:'📦',txt:'📋'}
const iconoArch=n=>EXT_ICON[(n||'').split('.').pop().toLowerCase()]||'📎'
const EXT_IMG=['jpg','jpeg','png','gif','webp']
const esImagen=n=>EXT_IMG.includes((n||'').split('.').pop().toLowerCase())
function hoy(){const d=new Date();return`${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`}

export default function Temario({anio,materia,cursoActivoId,onCambiarCurso,periodoActivoId,onCambiarPeriodo}){
  const materiaId=materia?.id||null
  const [cursos,     setCursos]     =useState([])
  const [periodos,   setPeriodos]   =useState([])
  const [cursoSel,   setCursoSel]   =useCursoActivo(cursos,cursoActivoId,onCambiarCurso)
  const [perSel,     setPerSel]     =usePeriodoActivo(periodos,periodoActivoId,onCambiarPeriodo)
  const [temas,      setTemas]      =useState([])
  const [nuevoTema,  setNuevoTema]  =useState('')
  const [toast,      setToast]      =useState(null)
  const [confirm,    setConfirm]    =useState(null)
  const [modalClonar,setModalClonar]=useState(false)
  const [clonDest,   setClonDest]   =useState([])
  const [clonando,   setClonando]   =useState(false)
  const [dragIdx,    setDragIdx]    =useState(null)
  const [dragOver,   setDragOver]   =useState(null)
  const dragNode=useRef(null)
  const [modalArch,  setModalArch]  =useState(null)
  const [archivos,   setArchivos]   =useState([])
  const [adjuntando, setAdjuntando] =useState(false)
  const [titulosPer, setTitulosPer] =useState({})
  const [temaEdit,   setTemaEdit]   =useState(null)
  const [lightbox,   setLightbox]   =useState(null)
  const [lightboxSrc,setLightboxSrc]=useState(null)
  const [modalImportar,setModalImportar]=useState(false)
  const [importJson,   setImportJson]   =useState(null)
  const [importPreview,setImportPreview]=useState(null)
  const [importResumen,setImportResumen]=useState(null)
  const [importando,   setImportando]   =useState(false)
  const [descargandoPortalArs,setDescargandoPortalArs]=useState(false)
  const confirmT      = useModalTransition(confirm)
  const modalClonarT  = useModalTransition(modalClonar)
  const modalImportarT= useModalTransition(modalImportar)
  const modalArchT    = useModalTransition(modalArch)
  const temaEditT     = useModalTransition(temaEdit)

  useEffect(() => {
    if (!anio) return
    Promise.all([
      window.api.invoke('get-cursos',   anio.id),
      window.api.invoke('get-periodos', anio.id),
    ]).then(([c, p]) => {
      setCursos(c); setPeriodos(p)
    })
  }, [anio])

  useEffect(()=>{
    if(cursoSel&&perSel) window.api.invoke('get-temas',cursoSel.id,perSel.id,materiaId).then(setTemas)
    setTemaEdit(null)
  },[cursoSel,perSel,materia])

  useEffect(()=>{
    if(!cursoSel?.grado||!materia?.id||!anio?.id){setTitulosPer({});return}
    window.api.invoke('get-periodo-titulos',materia.id).then(ts=>{
      const m={};ts.filter(t=>t.grado===cursoSel.grado).forEach(t=>{m[t.numero_periodo]=t.titulo})
      setTitulosPer(m)
    }).catch(console.error)
  },[cursoSel,materia])

  function cargarTemas(){
    if(cursoSel&&perSel)
      window.api.invoke('get-temas',cursoSel.id,perSel.id,materiaId).then(ts=>{
        setTemas(ts)
        if(temaEdit){const u=ts.find(t=>t.id===temaEdit.id);if(u)setTemaEdit(u)}
      })
  }

  function toast2(msg){setToast(msg);setTimeout(()=>setToast(null),2200)}
  function pedirConfirm(msg,fn){setConfirm({msg,fn})}

  async function handleSavePlan(temaId,metaData){
    const t=temas.find(x=>x.id===temaId);if(!t)return
    await window.api.invoke('update-tema',temaId,{
      titulo:t.titulo,estado:t.estado,contenido_texto:t.contenido_texto||'',
      fecha_realizado:t.fecha_realizado||null,fecha_aplazado:t.fecha_aplazado||null,
      metaJson:metaData,
    })
    cargarTemas()
  }

  async function cambiarEstado(tema){
    const i=ESTADOS_ORDEN.indexOf(tema.estado)
    const nuevo=ESTADOS_ORDEN[(i+1)%ESTADOS_ORDEN.length]
    const d={titulo:tema.titulo,estado:nuevo,contenido_texto:tema.contenido_texto||'',
      fecha_realizado:nuevo==='realizado'?hoy():tema.fecha_realizado||null,
      fecha_aplazado:nuevo==='aplazado'?hoy():tema.fecha_aplazado||null}
    await window.api.invoke('update-tema',tema.id,d)
    setTemas(p=>p.map(t=>t.id===tema.id?{...t,...d}:t))
    toast2(ESTADO_CFG[nuevo].emoji+' Marcado como '+ESTADO_CFG[nuevo].label)
  }

  async function agregarTema(){
    if(!nuevoTema.trim()||!cursoSel||!perSel)return
    await window.api.invoke('create-tema',{cursoId:cursoSel.id,periodoId:perSel.id,materiaId,titulo:nuevoTema.trim()})
    window.api.invoke('get-temas',cursoSel.id,perSel.id,materiaId).then(setTemas)
    setNuevoTema('');toast2('📋 Tema agregado')
  }

  function eliminarTema(tema){
    pedirConfirm(`¿Eliminar "${tema.titulo}"?`,async()=>{
      await window.api.invoke('delete-tema',tema.id)
      setTemas(p=>p.filter(t=>t.id!==tema.id))
      if(temaEdit?.id===tema.id)setTemaEdit(null)
      toast2('🗑️ Tema eliminado')
    })
  }

  function onDragStart(e,idx){dragNode.current=e.target;setDragIdx(idx);setTimeout(()=>{if(dragNode.current)dragNode.current.style.opacity='0.4'},0)}
  function onDragEnter(idx){setDragOver(idx)}
  function onDragOver(e){e.preventDefault()}
  function onDrop(e,idx){
    e.preventDefault();if(dragIdx===null||dragIdx===idx)return
    const o=[...temas];const[m]=o.splice(dragIdx,1);o.splice(idx,0,m)
    setTemas(o);window.api.invoke('reordenar-temas',o.map(t=>t.id));toast2('↕️ Orden guardado')
  }
  function onDragEnd(){if(dragNode.current)dragNode.current.style.opacity='1';setDragIdx(null);setDragOver(null);dragNode.current=null}

  // Misma logica de match que db.importTemarioJson (numero_orden o nombre del periodo),
  // para poder mostrar la vista previa antes de tocar la BD.
  function calcularPreviewImport(jsonData){
    const porPeriodo=[],noMatchean=[]
    ;(jsonData.periodos||[]).forEach(p=>{
      const periodo=periodos.find(dbP=>dbP.numero_orden===p.numero||dbP.nombre===p.nombre)
      const nTemas=(p.temas||[]).length
      if(!periodo){noMatchean.push({id:p.numero??p.nombre??'?',nTemas});return}
      porPeriodo.push({nombre:periodo.nombre,nTemas})
    })
    return {porPeriodo,noMatchean}
  }

  // Mismo cálculo que arriba pero para el shape plano que exporta/descarga
  // Portal-Ars (un array de semanas, no agrupado por periodo todavía).
  function calcularPreviewImportClases(filas){
    const porNumero={}
    ;(filas||[]).forEach(f=>{ (porNumero[f.periodo]=porNumero[f.periodo]||[]).push(f) })
    const porPeriodo=[],noMatchean=[]
    Object.entries(porNumero).forEach(([n,fs])=>{
      const periodo=periodos.find(dbP=>dbP.numero_orden===Number(n))
      if(!periodo){noMatchean.push({id:n,nTemas:fs.length});return}
      porPeriodo.push({nombre:periodo.nombre,nTemas:fs.length})
    })
    return {porPeriodo,noMatchean}
  }

  async function seleccionarJsonTemario(){
    const res=await window.api.invoke('seleccionar-json-temario')
    if(!res)return
    if(res.error){alert(res.error);return}
    if(Array.isArray(res.jsonData)){
      // Shape plano exportado por Portal-Ars ("📤 Exportar JSON" en su
      // admin de Contenido) -- mismo modal de vista previa de abajo,
      // solo cambia a qué IPC se llama al confirmar.
      setImportJson({tipo:'clases-portal-ars',archivo:res.archivo,filas:res.jsonData})
      setImportPreview(calcularPreviewImportClases(res.jsonData))
      setImportResumen(null)
      setModalImportar(true)
      return
    }
    if(!res.jsonData||!Array.isArray(res.jsonData.periodos)){
      alert('El JSON no tiene la estructura esperada: falta el campo "periodos".');return
    }
    setImportJson({tipo:'temario',jsonData:res.jsonData,archivo:res.archivo})
    setImportPreview(calcularPreviewImport(res.jsonData))
    setImportResumen(null)
    setModalImportar(true)
  }

  // Descarga directa: mismo destino (Temario) y mismo modal de vista
  // previa que la opción de archivo de arriba, solo que los datos vienen
  // de admin_listar_contenido de Portal-Ars en vez de un archivo local.
  async function traerDePortalArs(){
    if(!cursoSel)return
    setDescargandoPortalArs(true)
    const res=await window.api.invoke('descargar-clases-portal-ars',{grado:cursoSel.grado})
    setDescargandoPortalArs(false)
    if(res&&res.error){alert(res.error);return}
    if(!res.filas||!res.filas.length){alert(`Portal-Ars no tiene clases cargadas para el grado "${cursoSel.grado}".`);return}
    setImportJson({tipo:'clases-portal-ars',archivo:'Portal-Ars (descarga directa)',filas:res.filas})
    setImportPreview(calcularPreviewImportClases(res.filas))
    setImportResumen(null)
    setModalImportar(true)
  }

  async function confirmarImportarTemario(){
    if(!importJson||!cursoSel)return
    setImportando(true)
    const res = importJson.tipo==='clases-portal-ars'
      ? await window.api.invoke('import-clases-portal-ars-json',{filas:importJson.filas,cursoId:cursoSel.id,materiaId,anioId:anio.id})
      : await window.api.invoke('import-temario-json',{jsonData:importJson.jsonData,cursoId:cursoSel.id,materiaId,anioId:anio.id})
    setImportando(false)
    if(res&&res.error){alert('Error al importar: '+res.error);return}
    setImportResumen(res)
    cargarTemas()
  }

  function cerrarModalImportar(){
    if(importando)return
    setModalImportar(false);setImportJson(null);setImportPreview(null);setImportResumen(null)
  }

  function abrirClonar(){setClonDest([]);setModalClonar(true)}
  function toggleClon(id){setClonDest(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}
  async function ejecutarClonar(){
    if(!clonDest.length||!cursoSel||!perSel)return;setClonando(true)
    let total=0
    for(const d of clonDest){const r=await window.api.invoke('clonar-temas',cursoSel.id,perSel.id,d,perSel.id,materiaId);total+=r.copiados}
    setClonando(false);setModalClonar(false);toast2(`📋 ${total} temas clonados`)
  }

  async function abrirArchivos(tema){
    setModalArch(tema)
    setArchivos(await window.api.invoke('get-archivos-tema',tema.id))
  }
  async function adjuntarArchivo(){
    if(!modalArch)return;setAdjuntando(true)
    const r=await window.api.invoke('adjuntar-archivo-tema',modalArch.id)
    setAdjuntando(false)
    if(r){
      // Recargar lista completa para tener IDs correctos desde BD
      const lista=await window.api.invoke('get-archivos-tema',modalArch.id)
      setArchivos(lista)
      toast2('📎 Archivo adjuntado')
    }
  }
  async function abrirArchivo(a){
    const r=await window.api.invoke('abrir-archivo',a.ruta)
    if(r&&r.ok===false) toast2('⚠️ No se pudo abrir: '+(r.error||'error desconocido'))
  }
  async function eliminarArchivo(a){
    pedirConfirm(`¿Eliminar "${a.nombre}"?`,async()=>{
      await window.api.invoke('delete-archivo-tema',a.id)
      setArchivos(p=>p.filter(x=>x.id!==a.id))
      toast2('🗑️ Archivo eliminado')
    })
  }

  const realizados=temas.filter(t=>t.estado==='realizado').length
  const progreso=temas.length>0?Math.round(realizados/temas.length*100):0
  const colPer=COLORES_PER[periodos.indexOf(perSel)]||'#2563A8'
  const cursosOtros=cursos.filter(c=>c.id!==cursoSel?.id)

  return(
    <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:16}}>

      {/* IZQUIERDA */}
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={CARD}>
          <div style={LBL}>CURSO</div>
          {cursos.map(c=>(
            <div key={c.id} onClick={()=>setCursoSel(c)} style={{padding:'8px 10px',borderRadius:8,cursor:'pointer',marginBottom:4,background:cursoSel?.id===c.id?c.color:'transparent',color:cursoSel?.id===c.id?'#fff':c.color,fontWeight:600,fontSize:13,display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:cursoSel?.id===c.id?'#fff':c.color,flexShrink:0}}/>
              {c.nombre}
            </div>
          ))}
        </div>

        <div style={CARD}>
          <div style={LBL}>PERÍODO</div>
          {periodos.map((per,i)=>{
            const col=COLORES_PER[i]||'#2563A8',isA=perSel?.id===per.id
            return(
              <div key={per.id} onClick={()=>setPerSel(per)} style={{padding:'9px 10px',borderRadius:8,cursor:'pointer',marginBottom:4,background:isA?col+'15':'transparent',border:isA?`1.5px solid ${col}50`:'1.5px solid transparent'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontWeight:700,fontSize:13,color:isA?col:'#444'}}>{per.nombre}</span>
                  {isA&&<span style={{fontSize:11,background:col+'20',color:col,padding:'1px 7px',borderRadius:10,fontWeight:600}}>{realizados}/{temas.length}</span>}
                </div>
                <div style={{fontSize:11,color:'#888',marginTop:2}}>{titulosPer[per.numero_orden]||per.titulo}</div>
                {isA&&<div style={{marginTop:5,background:'#E8EDF5',borderRadius:4,height:4,overflow:'hidden'}}><div style={{height:'100%',background:col,width:progreso+'%',borderRadius:4,transition:'width .4s'}}/></div>}
              </div>
            )
          })}
        </div>

        <div style={CARD}>
          <div style={LBL}>ESTADOS</div>
          {Object.entries(ESTADO_CFG).map(([k,v])=>(
            <div key={k} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
              <span style={{fontSize:14}}>{v.emoji}</span>
              <span style={{fontSize:12,color:v.color,fontWeight:600}}>{v.label}</span>
            </div>
          ))}
          <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #EEF2F7',fontSize:11,color:'#888'}}>
            ↕️ Arrastra para reordenar<br/>
            📋 Clic en título → plan de clase
          </div>
        </div>
      </div>

      {/* CENTRO */}
      <div style={{display:'flex',flexDirection:'column',gap:14}}>

        {perSel&&cursoSel&&(
          <div style={{background:`linear-gradient(135deg,${colPer},${colPer}CC)`,borderRadius:12,padding:'16px 24px',color:'#fff',display:'flex',alignItems:'center',gap:16,boxShadow:`0 4px 16px ${colPer}40`}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,opacity:.8,marginBottom:2,fontWeight:600}}>{materia?materia.nombre+' · ':''}{cursoSel.nombre}  ·  {perSel.nombre}</div>
              <div style={{fontSize:17,fontWeight:800}}>{titulosPer[perSel?.numero_orden]||perSel.titulo||'Sin título'}</div>
            </div>
            <div style={{textAlign:'center',marginRight:8}}>
              <div style={{fontSize:30,fontWeight:900}}>{progreso}%</div>
              <div style={{fontSize:11,opacity:.8}}>{realizados}/{temas.length} temas</div>
            </div>
            <button onClick={seleccionarJsonTemario} style={{padding:'8px 14px',background:'rgba(255,255,255,.2)',border:'1.5px solid rgba(255,255,255,.5)',borderRadius:8,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>📥 Importar JSON</button>
            <button onClick={traerDePortalArs} disabled={descargandoPortalArs} style={{padding:'8px 14px',background:'rgba(255,255,255,.2)',border:'1.5px solid rgba(255,255,255,.5)',borderRadius:8,color:'#fff',fontSize:12,fontWeight:700,cursor:descargandoPortalArs?'default':'pointer',opacity:descargandoPortalArs?.6:1}}>{descargandoPortalArs?'⏳ Buscando...':'🌐 Traer de Portal-Ars'}</button>
            {temas.length>0&&cursosOtros.length>0&&(
              <button onClick={abrirClonar} style={{padding:'8px 14px',background:'rgba(255,255,255,.2)',border:'1.5px solid rgba(255,255,255,.5)',borderRadius:8,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>📋 Clonar</button>
            )}
          </div>
        )}

        <div style={{...CARD,overflow:'hidden'}}>
          <div style={{padding:'12px 20px',borderBottom:'1px solid #E8EDF5',display:'flex',alignItems:'center'}}>
            <span style={{fontWeight:700,fontSize:14,color:'#1B3A6B'}}>{temas.length>0?`${temas.length} temas`:'Sin temas aún'}</span>
          </div>
          <div style={{maxHeight:440,overflowY:'auto'}}>
            {temas.map((tema,idx)=>{
              const cfg=ESTADO_CFG[tema.estado]||ESTADO_CFG.pendiente
              const isDO=dragOver===idx,isSel=temaEdit?.id===tema.id,hasPlan=!!tema.meta_json
              return(
                <div key={tema.id} draggable onDragStart={e=>onDragStart(e,idx)} onDragEnter={()=>onDragEnter(idx)} onDragOver={onDragOver} onDrop={e=>onDrop(e,idx)} onDragEnd={onDragEnd}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'11px 20px',borderBottom:idx<temas.length-1?'1px solid #F0F4FA':'none',background:isSel?colPer+'0D':isDO?colPer+'15':idx%2===0?'#fff':'#FAFBFD',borderLeft:isSel?`3px solid ${colPer}`:isDO?`3px solid ${colPer}`:'3px solid transparent',transition:'all .1s',cursor:'grab'}}>
                  <span style={{color:'#CCC',fontSize:14,cursor:'grab',flexShrink:0,userSelect:'none'}}>☰</span>
                  <span style={{width:22,height:22,borderRadius:'50%',background:'#E8EDF5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#7A8FA8',flexShrink:0}}>{idx+1}</span>
                  <span onClick={()=>setTemaEdit(isSel?null:tema)}
                    style={{flex:1,fontSize:13,color:isSel?colPer:tema.estado==='realizado'?'#888':'#1B3A6B',textDecoration:tema.estado==='aplazado'?'line-through':'none',cursor:'pointer',fontWeight:isSel?700:400}}
                    title="Clic para ver/editar plan de clase">
                    {tema.titulo}
                    {hasPlan&&<span style={{marginLeft:6,fontSize:10,color:colPer,background:colPer+'18',padding:'1px 6px',borderRadius:8,fontWeight:700}}>📋</span>}
                  </span>
                  {tema.fecha_realizado&&tema.estado==='realizado'&&<span style={{fontSize:11,color:'#AAA',flexShrink:0}}>{tema.fecha_realizado}</span>}
                  <button onClick={()=>abrirArchivos(tema)} title="Archivos" style={{width:30,height:30,borderRadius:7,border:'1.5px solid #DDE3ED',background:'#fff',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#EEF2F7';e.currentTarget.style.borderColor=colPer}}
                    onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.borderColor='#DDE3ED'}}>📎</button>
                  <button onClick={()=>cambiarEstado(tema)} style={{padding:'4px 10px',borderRadius:20,border:`1.5px solid ${cfg.border}`,background:cfg.bg,color:cfg.color,fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:4,flexShrink:0}}>{cfg.emoji} {cfg.label}</button>
                  <button onClick={()=>eliminarTema(tema)} style={{background:'none',border:'none',color:'#CCC',fontSize:14,cursor:'pointer',padding:'4px 6px',borderRadius:6,flexShrink:0}}
                    onMouseEnter={e=>e.currentTarget.style.color='#B71C1C'} onMouseLeave={e=>e.currentTarget.style.color='#CCC'}>🗑️</button>
                </div>
              )
            })}
            {temas.length===0&&<div style={{padding:'30px 20px',textAlign:'center',color:'#AAA',fontSize:13,fontStyle:'italic'}}>Agrega el primer tema abajo</div>}
          </div>
        </div>

        <div style={{...CARD,display:'flex',gap:10,padding:14}}>
          <input value={nuevoTema} onChange={e=>setNuevoTema(e.target.value)} onKeyDown={e=>e.key==='Enter'&&agregarTema()}
            placeholder="Título del nuevo tema — Enter para agregar" disabled={!cursoSel||!perSel}
            style={{flex:1,border:'1.5px solid #DDE3ED',borderRadius:8,padding:'9px 14px',fontSize:13,outline:'none',color:'#1B3A6B'}}
            onFocus={e=>e.target.style.borderColor=colPer} onBlur={e=>e.target.style.borderColor='#DDE3ED'}/>
          <button onClick={agregarTema} disabled={!nuevoTema.trim()} style={{padding:'9px 20px',background:nuevoTema.trim()?'#1B3A6B':'#C0C8D8',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:nuevoTema.trim()?'pointer':'not-allowed'}}>+ Agregar</button>
        </div>
      </div>

      {/* MODAL Plan de Clase */}
      {temaEditT&&(
        <PlanClase
          tema={temaEditT.value}
          materia={materia}
          periodoColor={colPer}
          cursos={cursos}
          anioId={anio?.id}
          onSave={handleSavePlan}
          onClose={()=>setTemaEdit(null)}
          closing={temaEditT.closing}
        />
      )}

      {/* MODAL Confirmar */}
      {confirmT&&(
        <div className="modal-backdrop" data-closing={confirmT.closing} style={{position:'fixed',inset:0,background:'#0006',display:'flex',alignItems:'center',justifyContent:'center',zIndex:600}}>
          <div className="modal-content" data-closing={confirmT.closing} style={{background:'#fff',borderRadius:14,padding:28,width:360,boxShadow:'0 16px 48px #0004',textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:10}}>⚠️</div>
            <div style={{fontSize:15,fontWeight:700,color:'#1B3A6B',marginBottom:8}}>{confirmT.value.msg}</div>
            <div style={{fontSize:12,color:'#888',marginBottom:20}}>Esta acción no se puede deshacer.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button onClick={()=>setConfirm(null)} style={{padding:'9px 24px',background:'#EEF2F7',border:'1px solid #DDE3ED',borderRadius:8,fontSize:13,cursor:'pointer',color:'#555',fontWeight:600}}>Cancelar</button>
              <button onClick={()=>{const fn=confirmT.value.fn;setConfirm(null);fn()}} style={{padding:'9px 24px',background:'#B71C1C',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL Clonar */}
      {modalClonarT&&(
        <div className="modal-backdrop" data-closing={modalClonarT.closing} style={{position:'fixed',inset:0,background:'#0005',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500}} onClick={e=>{if(e.target===e.currentTarget)setModalClonar(false)}}>
          <div className="modal-content" data-closing={modalClonarT.closing} style={{background:'#fff',borderRadius:14,padding:28,width:420,maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 16px 48px #0004'}}>
            <h2 style={{color:'#1B3A6B',marginBottom:6,fontSize:17}}>📋 Clonar temas</h2>
            <p style={{color:'#888',fontSize:12,marginBottom:16}}>Copiando <strong>{temas.length} temas</strong> de <strong style={{color:colPer}}>{perSel?.nombre}</strong> de <strong style={{color:cursoSel?.color}}>{cursoSel?.nombre}</strong> a:</p>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20,overflowY:'auto',flex:1,minHeight:0}}>
              {cursosOtros.map(c=>(
                <div key={c.id} onClick={()=>toggleClon(c.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,cursor:'pointer',background:clonDest.includes(c.id)?c.color+'15':'#F8FAFD',border:`2px solid ${clonDest.includes(c.id)?c.color:'#DDE3ED'}`}}>
                  <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${clonDest.includes(c.id)?c.color:'#CCC'}`,background:clonDest.includes(c.id)?c.color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {clonDest.includes(c.id)&&<span style={{color:'#fff',fontSize:10,fontWeight:900}}>✓</span>}
                  </div>
                  <div style={{width:8,height:8,borderRadius:'50%',background:c.color,flexShrink:0}}/>
                  <span style={{fontWeight:600,fontSize:13,color:'#1B3A6B'}}>{c.nombre}</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end',flexShrink:0}}>
              <button onClick={()=>setModalClonar(false)} style={{padding:'9px 20px',background:'#EEF2F7',border:'1px solid #DDE3ED',borderRadius:8,fontSize:13,cursor:'pointer',color:'#555'}}>Cancelar</button>
              <button onClick={ejecutarClonar} disabled={!clonDest.length||clonando} style={{padding:'9px 24px',background:clonDest.length?'#1B3A6B':'#CCC',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:clonDest.length?'pointer':'default'}}>{clonando?'⏳ Clonando...':'📋 Clonar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL Importar temario JSON */}
      {modalImportarT&&(
        <div className="modal-backdrop" data-closing={modalImportarT.closing} style={{position:'fixed',inset:0,background:'#0005',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500}} onClick={e=>{if(e.target===e.currentTarget)cerrarModalImportar()}}>
          <div className="modal-content" data-closing={modalImportarT.closing} style={{background:'#fff',borderRadius:14,padding:28,width:480,maxHeight:'80vh',overflowY:'auto',boxShadow:'0 16px 48px #0004'}}>
            <h2 style={{color:'#1B3A6B',marginBottom:6,fontSize:17}}>{importJson?.tipo==='clases-portal-ars'?'🌐 Traer clases de Portal-Ars':'📥 Importar temario (JSON)'}</h2>
            <p style={{color:'#888',fontSize:12,marginBottom:16}}>
              Archivo: <strong>{importJson?.archivo}</strong><br/>
              Destino: <strong style={{color:cursoSel?.color}}>{cursoSel?.nombre}</strong>{materia?' · '+materia.nombre:''}
            </p>

            {!importResumen ? (
              <>
                {importPreview?.porPeriodo.length>0&&(
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#1A6B3A',marginBottom:6}}>✓ Períodos que coinciden:</div>
                    {importPreview.porPeriodo.map((p,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 10px',background:'#F0FDF4',borderRadius:8,marginBottom:4,fontSize:13}}>
                        <span style={{fontWeight:600,color:'#166534'}}>{p.nombre}</span>
                        <span style={{color:'#166534'}}>{p.nTemas} tema{p.nTemas!==1?'s':''}</span>
                      </div>
                    ))}
                  </div>
                )}
                {importPreview?.noMatchean.length>0&&(
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#B71C1C',marginBottom:6}}>⚠️ No coinciden con ningún período del año activo (se omitirán):</div>
                    {importPreview.noMatchean.map((p,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 10px',background:'#FDDFDF',borderRadius:8,marginBottom:4,fontSize:13}}>
                        <span style={{fontWeight:600,color:'#B71C1C'}}>"{p.id}"</span>
                        <span style={{color:'#B71C1C'}}>{p.nTemas} tema{p.nTemas!==1?'s':''}</span>
                      </div>
                    ))}
                  </div>
                )}
                {importPreview&&importPreview.porPeriodo.length===0&&importPreview.noMatchean.length===0&&(
                  <p style={{color:'#888',fontSize:13,fontStyle:'italic'}}>El archivo no tiene un campo "periodos" con contenido.</p>
                )}
                <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:10}}>
                  <button onClick={cerrarModalImportar} disabled={importando} style={{padding:'9px 20px',background:'#EEF2F7',border:'1px solid #DDE3ED',borderRadius:8,fontSize:13,cursor:'pointer',color:'#555'}}>Cancelar</button>
                  <button onClick={confirmarImportarTemario} disabled={importando||!importPreview?.porPeriodo.length}
                    style={{padding:'9px 24px',background:importPreview?.porPeriodo.length?'#1B3A6B':'#CCC',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:importPreview?.porPeriodo.length?'pointer':'default'}}>
                    {importando?'⏳ Importando...':'📥 Importar'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:10,padding:14,marginBottom:14}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#166534',marginBottom:6}}>✓ Importación completada</div>
                  <div style={{fontSize:13,color:'#166534'}}>{importResumen.count} tema{importResumen.count!==1?'s':''} nuevo{importResumen.count!==1?'s':''} importado{importResumen.count!==1?'s':''}</div>
                  {importResumen.omitidos>0&&<div style={{fontSize:13,color:'#7A5C00',marginTop:4}}>{importResumen.omitidos} ya {importResumen.omitidos!==1?'existían':'existía'} y se {importResumen.omitidos!==1?'omitieron':'omitió'} (duplicados)</div>}
                  {importResumen.periodosNoEncontrados?.length>0&&<div style={{fontSize:13,color:'#B71C1C',marginTop:4}}>{importResumen.periodosNoEncontrados.length} período(s) del archivo no coincidieron: {importResumen.periodosNoEncontrados.map(x=>`"${x}"`).join(', ')}</div>}
                </div>
                <div style={{display:'flex',justifyContent:'flex-end'}}>
                  <button onClick={cerrarModalImportar} style={{padding:'9px 24px',background:'#1B3A6B',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>Cerrar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL Archivos — con visor de imágenes */}
      {modalArchT&&(
        <div className="modal-backdrop" data-closing={modalArchT.closing} style={{position:'fixed',inset:0,background:'#0005',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500}} onClick={e=>{if(e.target===e.currentTarget)setModalArch(null)}}>
          <div className="modal-content" data-closing={modalArchT.closing} style={{background:'#fff',borderRadius:14,padding:28,width:560,maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 16px 48px #0004'}}>

            {/* Cabecera */}
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <span style={{fontSize:22}}>📎</span>
              <div>
                <div style={{fontWeight:800,fontSize:15,color:'#1B3A6B'}}>{modalArchT.value.titulo}</div>
                <div style={{fontSize:12,color:'#888'}}>Archivos adjuntos</div>
              </div>
              <div style={{flex:1}}/>
              <button onClick={()=>setModalArch(null)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#AAA'}}>✕</button>
            </div>

            <button onClick={adjuntarArchivo} disabled={adjuntando} style={{padding:'10px 18px',background:adjuntando?'#AAA':'#1B3A6B',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:adjuntando?'default':'pointer',marginBottom:14}}>
              {adjuntando?'⏳ Adjuntando...':'+ Adjuntar archivo'}
            </button>

            {/* Lista de archivos */}
            <div style={{flex:1,overflowY:'auto'}}>
              {archivos.length===0
                ? <div style={{textAlign:'center',padding:30,color:'#AAA',fontSize:13,fontStyle:'italic'}}>Sin archivos adjuntos.</div>
                : archivos.map(a=>(
                  <div key={a.id??a.ruta} style={{marginBottom:8}}>

                    {/* Thumbnail si es imagen */}
                    {esImagen(a.nombre)&&(
                      <div
                        onClick={()=>{setLightbox(a.ruta);window.api.invoke('leer-imagen',a.ruta).then(setLightboxSrc)}}
                        style={{width:'100%',height:160,borderRadius:10,overflow:'hidden',marginBottom:4,cursor:'zoom-in',background:'#F0F4FA',border:'1.5px solid #E0E8F4',position:'relative'}}>
                        <ImgLocal ruta={a.ruta} style={{width:'100%',height:'100%'}} onClick={()=>setLightbox(a.ruta)}/>
                        <div style={{position:'absolute',bottom:6,right:8,background:'rgba(0,0,0,.45)',color:'#fff',fontSize:10,padding:'2px 8px',borderRadius:6}}>
                          🔍 clic para ampliar
                        </div>
                      </div>
                    )}

                    {/* Fila del archivo */}
                    <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,background:'#F8FAFD',border:'1px solid #E8EDF5'}}>
                      <span style={{fontSize:20,flexShrink:0}}>{iconoArch(a.nombre)}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13,color:'#1B3A6B',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.nombre}</div>
                        <div style={{fontSize:11,color:'#AAA'}}>{a.fecha}</div>
                      </div>
                      {esImagen(a.nombre)&&(
                        <button onClick={()=>{setLightbox(a.ruta);window.api.invoke('leer-imagen',a.ruta).then(setLightboxSrc)}} style={{padding:'4px 10px',background:'#EEF2F7',border:'1px solid #DDE3ED',borderRadius:6,fontSize:11,cursor:'pointer',color:'#1B3A6B',fontWeight:600}}>
                          🔍 Ver
                        </button>
                      )}
                      <button onClick={()=>abrirArchivo(a)} style={{padding:'4px 10px',background:'#EEF2F7',border:'1px solid #DDE3ED',borderRadius:6,fontSize:11,cursor:'pointer',color:'#1B3A6B',fontWeight:600}}>
                        Abrir
                      </button>
                      <button onClick={()=>eliminarArchivo(a)} style={{background:'none',border:'none',color:'#CCC',fontSize:14,cursor:'pointer',padding:'4px 6px'}}
                        onMouseEnter={e=>e.currentTarget.style.color='#B71C1C'} onMouseLeave={e=>e.currentTarget.style.color='#CCC'}>🗑️</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX — visor de imagen a pantalla completa */}
      {lightbox&&(
        <div
          className="modal-backdrop"
          onClick={()=>{setLightbox(null);setLightboxSrc(null)}}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:700,cursor:'zoom-out',padding:24}}>
          <img
            className="modal-content"
            src={lightboxSrc}
            alt="Vista completa"
            style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',borderRadius:8,boxShadow:'0 8px 40px rgba(0,0,0,.6)'}}
            onClick={e=>e.stopPropagation()}
          />
          <button
            onClick={()=>{setLightbox(null);setLightboxSrc(null)}}
            style={{position:'fixed',top:20,right:24,background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',color:'#fff',fontSize:22,width:42,height:42,borderRadius:'50%',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>
            ✕
          </button>
        </div>
      )}

      {toast&&<div style={{position:'fixed',bottom:24,right:24,background:'#1A6B3A',color:'#fff',padding:'10px 20px',borderRadius:10,fontSize:13,fontWeight:600,boxShadow:'0 4px 16px #0003',zIndex:999}}>{toast}</div>}
    </div>
  )
}

const CARD={background:'#fff',borderRadius:12,padding:14,border:'1px solid #DDE3ED',boxShadow:'0 2px 8px #0001'}
const LBL={fontSize:10,fontWeight:700,color:'#AAB4C4',marginBottom:10,letterSpacing:1.5}