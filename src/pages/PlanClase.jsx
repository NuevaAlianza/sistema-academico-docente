// src/pages/PlanClase.jsx
import { useState, useRef, useEffect } from 'react'
import React from 'react'
// ── Carga imagen local via IPC ────────────────────────────────────────────────
function ImgLocal({ ruta, style, onClick }) {
  const [src, setSrc] = React.useState(null)
  React.useEffect(() => {
    if (!ruta) return
    window.api.invoke('leer-imagen', ruta).then(b64 => { if (b64) setSrc(b64) })
  }, [ruta])
  if (!src) return (
    <div style={{ ...style, background: '#F0F4FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#CCC', cursor: onClick ? 'zoom-in' : 'default' }}
      onClick={onClick}>🖼️</div>
  )
  return <img src={src} alt="" style={{ ...style, objectFit: 'contain', cursor: onClick ? 'zoom-in' : 'default' }} onClick={onClick} />
}


function pf(v) { if (!v||typeof v!=='string') return v; try{return JSON.parse(v)}catch{return v} }
function arr(v) { const p=pf(v); return Array.isArray(p)?p:[] }
function obj(v) { if(!v) return null; const p=pf(v); return(p&&typeof p==='object'&&!Array.isArray(p))?p:null }

function parseMeta(raw) {
  if (!raw) return null
  try {
    const m = typeof raw==='string'?JSON.parse(raw):raw
    return {
      subtitulo:m.subtitulo||'', fase:m.fase||'', semana:m.semana||'',
      competencia:m.competencia||'', indicadores:arr(m.indicadores),
      peso:m.peso||'', instrumento:m.instrumento||'',
      actividades:arr(m.actividades), texto_biblico:obj(m.texto_biblico),
      actividades_cuaderno:arr(m.actividades_cuaderno), rubrica:obj(m.rubrica),
      metacognicion:m.metacognicion||'', recursos:arr(m.recursos),
      nota_sustituto:m.nota_sustituto||'', classroom_txt:m.classroom_txt||'',
    }
  } catch { return null }
}

function normalize(item) {
  return {
    subtitulo:item.subtitulo||'', fase:item.fase||'', semana:item.semana||'',
    competencia:item.competencia||'', indicadores:arr(item.indicadores),
    peso:item.peso||'', instrumento:item.instrumento||'',
    actividades:arr(item.actividades), texto_biblico:obj(item.texto_biblico),
    actividades_cuaderno:arr(item.actividades_cuaderno), rubrica:obj(item.rubrica),
    metacognicion:item.metacognicion||'', recursos:arr(item.recursos),
    nota_sustituto:item.nota_sustituto||'', classroom_txt:item.classroom_txt||'',
  }
}

// ─── Genera el prompt listo para copiar en Claude.ai ─────────────────────────
function buildPrompt(titulo, materiaNombre) {
  return `Eres un asistente pedagógico experto. Generá un Plan de Clase en JSON para:

Materia: ${materiaNombre || 'Sin especificar'}
Tema: ${titulo || ''}

REGLAS ESTRICTAS:
- Devolvé ÚNICAMENTE el objeto JSON. Sin texto previo, sin explicaciones, sin bloques markdown.
- Respetá EXACTAMENTE los nombres de campo y tipos indicados.
- Adaptá el contenido al material que te proporciono abajo.
- actividades: siempre tres momentos con tipo "I" (Inicio), "D" (Desarrollo), "C" (Cierre).
- Si la materia NO es religiosa, dejá texto_biblico con todos los campos en "".
- classroom_txt: texto breve para pegar en Google Classroom. Si no hay tarea, "".
- nota_sustituto: instrucciones para un docente sustituto. Si no hay info suficiente, "".

ESTRUCTURA JSON ESPERADA:
{
  "subtitulo": "",
  "fase": "SENTIR | PENSAR | ACTUAR | CELEBRAR | vacío si no aplica",
  "semana": "",
  "competencia": "",
  "indicadores": ["indicador 1", "indicador 2"],
  "peso": "",
  "instrumento": "",
  "actividades": [
    { "tipo": "I", "titulo": "Inicio (~10 min)", "pasos": ["paso 1", "paso 2"] },
    { "tipo": "D", "titulo": "Desarrollo (~25 min)", "pasos": ["paso 1", "paso 2"] },
    { "tipo": "C", "titulo": "Cierre (~15 min)", "pasos": ["paso 1", "paso 2"] }
  ],
  "texto_biblico": { "cita": "", "texto": "", "contexto": "" },
  "actividades_cuaderno": [
    { "instruccion": "instrucción para el cuaderno", "tiene_tabla": false }
  ],
  "metacognicion": "",
  "recursos": ["recurso 1", "recurso 2"],
  "nota_sustituto": "",
  "classroom_txt": ""
}

MATERIAL DEL DOCENTE:
[pegá aquí tu material: apuntes, fragmento del libro, preguntas, texto bíblico, objetivos, lo que sea]`
}

const EMPTY = {
  subtitulo:'',fase:'SENTIR',semana:'',competencia:'',indicadores:[],peso:'',instrumento:'',
  actividades:[
    {tipo:'I',titulo:'Inicio (~10 min)',pasos:['']},
    {tipo:'D',titulo:'Desarrollo (~25 min)',pasos:['']},
    {tipo:'C',titulo:'Cierre (~15 min)',pasos:['']},
  ],
  texto_biblico:{cita:'',texto:'',contexto:''},
  actividades_cuaderno:[{instruccion:'',tiene_tabla:false}],
  rubrica:null, metacognicion:'', recursos:[], nota_sustituto:'', classroom_txt:'',
}

const TBG={I:'#E0F7FA',D:'#E8F5E9',C:'#FFF3E0'}
const TFG={I:'#006064',D:'#1B5E20',C:'#E65100'}
const TLB={I:'Inicio',D:'Desarrollo',C:'Cierre'}
const FASES=['SENTIR','PENSAR','ACTUAR','CELEBRAR']

export default function PlanClase({tema,materia,periodoColor,cursos,anioId,onSave,onClose}) {
  const col=periodoColor||materia?.color||'#2563A8'
  const [mode,setMode]=useState(()=>parseMeta(tema?.meta_json)?'view':'empty')
  const [form,setForm]=useState(()=>parseMeta(tema?.meta_json)||{...EMPTY})
  const [saving,setSaving]=useState(false)
  const [actTab,setActTab]=useState(0)
  const [tag,setTag]=useState('')
  const [msg,setMsg]=useState(null)
  const [showSync,setShowSync]=useState(false)
  const [syncSel,setSyncSel]=useState([])
  const fileRef=useRef()

  // ── Estado modo IA ────────────────────────────────────────────────────────
  const [copiado,    setCopiado]    = useState(false)

  // ── Estados imágenes adjuntas ─────────────────────────────────────────────
  const [imgs,       setImgs]       = useState([])
  const [slideIdx,   setSlideIdx]   = useState(0)
  const [imgLightbox,setImgLightbox]= useState(null)

  useEffect(()=>{
    const m=parseMeta(tema?.meta_json)
    setForm(m||{...EMPTY}); setMode(m?'view':'empty')
    setActTab(0); setShowSync(false); setSyncSel([]); setMsg(null)
    setCopiado(false)
    setSlideIdx(0); setImgLightbox(null)
    // Cargar imágenes adjuntas del tema
    if (tema?.id) {
      window.api.invoke('get-archivos-tema', tema.id).then(lista => {
        const EXT_IMG = ['jpg','jpeg','png','gif','webp']
        setImgs((lista||[]).filter(a => EXT_IMG.includes((a.nombre||'').split('.').pop().toLowerCase())))
      })
    } else { setImgs([]) }
  },[tema?.id])

  useEffect(()=>{
    const fn=e=>{if(e.key==='Escape')onClose()}
    window.addEventListener('keydown',fn); return()=>window.removeEventListener('keydown',fn)
  },[onClose])

  // ── Importar JSON desde archivo ───────────────────────────────────────────
  async function handleFile(e) {
    const file=e.target.files[0]; if(!file) return
    const reader=new FileReader()
    reader.onload=async ev=>{
      try {
        let data=JSON.parse(ev.target.result), item=null
        if(Array.isArray(data)){item=data.find(t=>t.titulo===tema?.titulo)||data[0]}
        else if(data.periodos){const t=data.periodos.flatMap(p=>p.temas||[]);item=t.find(x=>x.titulo===tema?.titulo)||t[0]}
        else item=data
        if(!item){alert('No se encontró contenido.');return}
        const norm=normalize(item)
        setForm(norm); setMode('view')
        setSaving(true)
        await onSave(tema.id,norm)
        setSaving(false); flash('✓ Importado y guardado')
      } catch{alert('JSON inválido')}
    }
    reader.readAsText(file); e.target.value=''
  }

  async function save() {
    setSaving(true); await onSave(tema.id,form)
    setSaving(false); setMode('view'); flash('✓ Guardado')
  }

  async function sync() {
    if(!syncSel.length||!anioId) return
    setSaving(true)
    await window.api.invoke('sync-plan-cursos',{titulo:tema.titulo,materiaId:materia?.id||null,anioId,metaJson:form,cursoIds:syncSel})
    setSaving(false); setShowSync(false); setSyncSel([]); flash(`✓ Aplicado a ${syncSel.length} curso(s)`)
  }

  function copiarPrompt() {
    const prompt = buildPrompt(tema?.titulo, materia?.nombre)
    navigator.clipboard.writeText(prompt)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  function flash(t){setMsg(t);setTimeout(()=>setMsg(null),2500)}
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  function setStep(ai,si,v){setForm(p=>({...p,actividades:p.actividades.map((a,i)=>i!==ai?a:{...a,pasos:a.pasos.map((x,j)=>j===si?v:x)})}))}
  function addStep(ai){setForm(p=>({...p,actividades:p.actividades.map((a,i)=>i===ai?{...a,pasos:[...a.pasos,'']}:a)}))}
  function rmStep(ai,si){setForm(p=>({...p,actividades:p.actividades.map((a,i)=>i===ai?{...a,pasos:a.pasos.filter((_,j)=>j!==si)}:a)}))}
  function setBib(k,v){setForm(p=>({...p,texto_biblico:{...(p.texto_biblico||{}),[k]:v}}))}
  function setCuad(idx,k,v){setForm(p=>{const a=[...p.actividades_cuaderno];a[idx]={...a[idx],[k]:v};return{...p,actividades_cuaderno:a}})}
  function addCuad(){setForm(p=>({...p,actividades_cuaderno:[...p.actividades_cuaderno,{instruccion:'',tiene_tabla:false}]}))}
  function rmCuad(idx){setForm(p=>({...p,actividades_cuaderno:p.actividades_cuaderno.filter((_,i)=>i!==idx)}))}
  function addTag(){if(!tag.trim())return;setForm(p=>({...p,recursos:[...p.recursos,tag.trim()]}));setTag('')}
  function rmTag(idx){setForm(p=>({...p,recursos:p.recursos.filter((_,i)=>i!==idx)}))}

  const otros=(cursos||[]).filter(c=>c.id!==tema?.curso_id)

  // ─── Head ──────────────────────────────────────────────────────────────────
  const Head=()=>(
    <div style={{background:`linear-gradient(135deg,${col},${col}CC)`,padding:'14px 20px',flexShrink:0}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,.7)',textTransform:'uppercase',letterSpacing:.8,marginBottom:2}}>Plan de clase</div>
          <div style={{fontSize:15,fontWeight:800,color:'#fff',lineHeight:1.3}}>{tema?.titulo}</div>
          {form.subtitulo&&<div style={{fontSize:12,color:'rgba(255,255,255,.8)',marginTop:2}}>{form.subtitulo}</div>}
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
          {msg&&<span style={{fontSize:11,background:'rgba(255,255,255,.25)',padding:'3px 9px',borderRadius:10,color:'#fff'}}>{msg}</span>}
          {saving&&<span style={{fontSize:12,color:'rgba(255,255,255,.8)'}}>⏳</span>}
          <input type="file" accept=".json" ref={fileRef} style={{display:'none'}} onChange={handleFile}/>
          <button onClick={()=>fileRef.current?.click()} title="Importar JSON" style={BG}>📥 JSON</button>
          <button onClick={()=>setMode(mode==='ia'?(parseMeta(tema?.meta_json)?'view':'empty'):'ia')} style={{...BG,background:mode==='ia'?'rgba(255,255,255,.9)':'rgba(255,255,255,.2)',color:mode==='ia'?col:'#fff',fontWeight:mode==='ia'?700:500}}>✨ IA</button>
          {mode==='view'&&<button onClick={()=>setMode('edit')} style={BG}>✏️ Editar</button>}
          {mode==='edit'&&<button onClick={save} disabled={saving} style={{...BG,background:'rgba(255,255,255,.9)',color:col,fontWeight:700}}>💾 Guardar</button>}
          {mode==='edit'&&<button onClick={()=>setMode('view')} style={BG}>✕</button>}
          {mode!=='edit'&&<button onClick={onClose} style={BG}>✕</button>}
        </div>
      </div>
      {(mode==='view'||mode==='edit')&&(
        <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}}>
          {form.semana&&<span style={BADGE}>Sem {form.semana}</span>}
          {form.fase&&<span style={{...BADGE,background:`rgba(255,255,255,.28)`}}>{form.fase}</span>}
          {form.peso&&<span style={BADGE}>{form.peso}</span>}
          {form.instrumento&&<span style={BADGE}>{form.instrumento}</span>}
        </div>
      )}
    </div>
  )

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.52)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}}
      onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:740,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,.35)',overflow:'hidden'}}>

        <Head/>

        {/* ═══ VACÍO ═══ */}
        {mode==='empty'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48,gap:10}}>
            <div style={{fontSize:52}}>📋</div>
            <div style={{fontSize:16,fontWeight:700,color:'#1B3A6B'}}>Sin plan de clase</div>
            <div style={{fontSize:13,color:'#888',textAlign:'center',lineHeight:1.6,maxWidth:360,marginBottom:4}}>
              Generá el plan con IA, importá el JSON, o crealo manualmente.
            </div>
            <button onClick={()=>setMode('ia')} style={{padding:'11px 0',background:`linear-gradient(135deg,${col},${col}CC)`,color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer',width:280,boxShadow:`0 4px 14px ${col}40`}}>
              ✨ Generar con IA
            </button>
            <button onClick={()=>fileRef.current?.click()} style={{padding:'11px 0',background:'#EEF2F7',border:'1px solid #DDE3ED',borderRadius:8,fontSize:13,cursor:'pointer',width:280,color:'#1B3A6B',fontWeight:600}}>
              📥 Importar JSON
            </button>
            <button onClick={()=>{setForm({...EMPTY});setMode('edit')}} style={{padding:'10px 0',background:'#EEF2F7',border:'1px solid #DDE3ED',borderRadius:8,fontSize:13,cursor:'pointer',width:280,color:'#1B3A6B',fontWeight:600}}>
              ✏️ Crear manualmente
            </button>
          </div>
        )}

        {/* ═══ MODO IA — prompt para copiar ═══ */}
        {mode==='ia'&&(
          <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>

            {/* Pasos */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              {[
                {n:'1',icon:'📋',txt:'Copiá el prompt'},
                {n:'2',icon:'🤖',txt:'Pegalo en Claude.ai + tu material'},
                {n:'3',icon:'📥',txt:'Importá el JSON que devuelve'},
              ].map(s=>(
                <div key={s.n} style={{background:'#F8FAFD',border:'1px solid #E8EDF5',borderRadius:10,padding:'12px 14px',textAlign:'center'}}>
                  <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                  <div style={{fontSize:10,fontWeight:700,color:col,marginBottom:2}}>PASO {s.n}</div>
                  <div style={{fontSize:12,color:'#555',lineHeight:1.4}}>{s.txt}</div>
                </div>
              ))}
            </div>

            {/* Prompt */}
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <div style={{fontSize:11,fontWeight:700,color:'#7A8FA8',letterSpacing:.8,textTransform:'uppercase'}}>
                  Prompt — ya tiene el tema y la estructura incluidos
                </div>
                <button
                  onClick={copiarPrompt}
                  style={{
                    padding:'6px 16px',borderRadius:7,border:'none',cursor:'pointer',fontSize:12,fontWeight:700,
                    background: copiado ? '#1A6B3A' : col,
                    color:'#fff', transition:'background .2s',
                    boxShadow: `0 2px 8px ${col}30`,
                  }}>
                  {copiado ? '✓ Copiado' : '📋 Copiar prompt'}
                </button>
              </div>
              <div style={{position:'relative'}}>
                <textarea
                  readOnly
                  value={buildPrompt(tema?.titulo, materia?.nombre)}
                  rows={18}
                  style={{
                    width:'100%',boxSizing:'border-box',
                    border:'1.5px solid #DDE3ED',borderRadius:8,
                    padding:'12px 14px',fontSize:11,
                    fontFamily:'monospace',lineHeight:1.65,
                    color:'#333',background:'#FAFBFD',
                    resize:'none',outline:'none',
                  }}
                />
              </div>
              <div style={{marginTop:8,fontSize:11,color:'#AAA',lineHeight:1.5}}>
                💡 Copiá el prompt, pegalo en <strong>Claude.ai</strong> y reemplazá la última línea con tu material real del tema. La IA devuelve el JSON — luego lo importás con 📥 JSON.
              </div>
            </div>

          </div>
        )}

        {/* ═══ VISTA ═══ */}
        {mode==='view'&&(
          <div style={{flex:1,overflowY:'auto'}}>

            {otros.length>0&&(
              <div style={{background:'#F0F7FF',borderBottom:'1px solid #DCE8F5',padding:'8px 16px',display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:12,color:'#1B3A6B',flex:1}}>💡 Este tema puede estar en {otros.length} curso(s) más. ¿Aplicar este mismo plan?</span>
                <button onClick={()=>setShowSync(v=>!v)} style={{padding:'4px 12px',background:'#1B3A6B',color:'#fff',border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer'}}>{showSync?'Cancelar':'Sincronizar'}</button>
              </div>
            )}
            {showSync&&(
              <div style={{padding:'10px 16px',background:'#F8FAFD',borderBottom:'1px solid #DDE3ED'}}>
                <div style={{fontSize:12,color:'#555',marginBottom:8}}>Seleccioná los cursos donde copiar este plan:</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                  {otros.map(c=>(
                    <div key={c.id} onClick={()=>setSyncSel(p=>p.includes(c.id)?p.filter(x=>x!==c.id):[...p,c.id])} style={{padding:'5px 13px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:600,background:syncSel.includes(c.id)?c.color:'#fff',color:syncSel.includes(c.id)?'#fff':c.color,border:`1.5px solid ${c.color}`}}>{c.nombre}</div>
                  ))}
                </div>
                <button onClick={sync} disabled={!syncSel.length||saving} style={{padding:'6px 18px',background:syncSel.length?col:'#CCC',color:'#fff',border:'none',borderRadius:6,fontSize:12,fontWeight:700,cursor:syncSel.length?'pointer':'default'}}>Aplicar a {syncSel.length} curso(s)</button>
              </div>
            )}

            {(form.competencia||form.indicadores.length>0)&&(
              <div style={S}>
                {form.competencia&&<div style={{fontSize:12,color:'#555'}}><b>Competencia:</b> {form.competencia}</div>}
                {form.indicadores.length>0&&<div style={{fontSize:12,color:'#555',marginTop:3}}><b>Indicadores:</b> {form.indicadores.join(' · ')}</div>}
              </div>
            )}

            {form.texto_biblico?.texto&&(
              <div style={S}>
                <div style={sT('#4A148C')}>Texto bíblico</div>
                <div style={{background:'#EDE7F6',borderLeft:'4px solid #4A148C',padding:'10px 12px',borderRadius:'0 8px 8px 0',fontSize:13,lineHeight:1.75}}>
                  {form.texto_biblico.cita&&<div style={{fontWeight:700,color:'#4A148C',marginBottom:6,fontSize:12}}>{form.texto_biblico.cita}</div>}
                  <span style={{fontStyle:'italic'}}>{form.texto_biblico.texto}</span>
                </div>
                {form.texto_biblico.contexto&&<div style={{marginTop:6,fontSize:12,color:'#666',lineHeight:1.5,fontStyle:'italic'}}>{form.texto_biblico.contexto}</div>}
              </div>
            )}

            {form.actividades?.some(a=>a.pasos?.some(p=>p))&&(
              <div style={S}>
                <div style={sT(col)}>Secuencia de clase</div>
                <div style={{display:'flex',gap:4,marginBottom:10}}>
                  {form.actividades.map((a,i)=>(
                    <button key={i} onClick={()=>setActTab(i)} style={{padding:'5px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:actTab===i?TBG[a.tipo]:'#F4F4F4',color:actTab===i?TFG[a.tipo]:'#888',borderBottom:actTab===i?`2px solid ${TFG[a.tipo]}`:'2px solid transparent'}}>{TLB[a.tipo]||a.tipo}</button>
                  ))}
                </div>
                {form.actividades[actTab]&&(
                  <div style={{background:TBG[form.actividades[actTab].tipo]||'#F5F5F5',borderRadius:8,padding:'10px 14px'}}>
                    <div style={{fontSize:11,fontWeight:700,color:TFG[form.actividades[actTab].tipo],marginBottom:7}}>{form.actividades[actTab].titulo}</div>
                    <ul style={{paddingLeft:18,margin:0}}>{(form.actividades[actTab].pasos||[]).filter(p=>p).map((p,k)=><li key={k} style={{fontSize:13,lineHeight:1.75,marginBottom:2}}>{p}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {form.actividades_cuaderno?.some(c=>c.instruccion)&&(
              <div style={S}>
                <div style={sT('#1B3A6B')}>Actividades del cuaderno</div>
                {form.actividades_cuaderno.filter(c=>c.instruccion).map((c,i)=>(
                  <div key={i} style={{background:'#F8F9FA',borderLeft:'4px solid #1B3A6B',padding:'9px 12px',borderRadius:'0 6px 6px 0',marginBottom:6}}>
                    <b style={{color:'#1B3A6B',fontSize:12,marginRight:6}}>{i+1}.</b>
                    <span style={{fontSize:13,lineHeight:1.65}}>{c.instruccion}</span>
                  </div>
                ))}
              </div>
            )}

            {form.metacognicion&&(
              <div style={S}>
                <div style={sT('#7B5800')}>Reflexión</div>
                <div style={{background:'#FFF8DC',borderLeft:'4px solid #7B5800',padding:'10px 12px',borderRadius:'0 6px 6px 0',fontSize:13,lineHeight:1.65}}>
                  <b style={{color:'#7B5800'}}>Pregunta: </b>{form.metacognicion}
                </div>
              </div>
            )}

            {form.rubrica?.criterios?.length>0&&(
              <div style={S}>
                <div style={sT('#37474F')}>Rúbrica</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                    <thead><tr>{[['Criterio','#455A64'],['Excelente','#1B5E20'],['Logrado','#0D47A1'],['En Proceso','#E65100'],['Inicio','#B71C1C']].map(([h,bg])=><th key={h} style={{padding:'6px 8px',background:bg,color:'#fff',textAlign:'left'}}>{h}</th>)}</tr></thead>
                    <tbody>{form.rubrica.criterios.map((c,i)=>(
                      <tr key={i} style={{background:i%2===0?'#fff':'#F9F9F9'}}>
                        <td style={{padding:'6px 8px',fontWeight:600,color:'#1B3A6B',background:'#DCE8F5'}}>{c.nombre}</td>
                        <td style={{padding:'6px 8px',background:'#F1F8F1'}}>{c.niveles?.excelente||''}</td>
                        <td style={{padding:'6px 8px'}}>{c.niveles?.logrado||''}</td>
                        <td style={{padding:'6px 8px'}}>{c.niveles?.proceso||''}</td>
                        <td style={{padding:'6px 8px',background:'#FFF3F3'}}>{c.niveles?.inicio||''}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            {form.recursos?.length>0&&(
              <div style={S}>
                <div style={sT('#1B5E20')}>Recursos</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:5}}>{form.recursos.map((r,i)=><span key={i} style={{background:'#E8F5E9',border:'1px solid #A5D6A7',color:'#1B5E20',padding:'3px 10px',borderRadius:4,fontSize:12}}>{r}</span>)}</div>
              </div>
            )}


            {/* ── Recursos visuales (carousel) ─────────────────────────── */}
            {imgs.length>0&&(
              <div style={S}>
                <div style={{...sT(col),display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span>Recursos visuales</span>
                  <span style={{fontSize:11,fontWeight:400,color:'#AAA',textTransform:'none',letterSpacing:0}}>{slideIdx+1} / {imgs.length}</span>
                </div>
                {/* Imagen principal */}
                <div style={{position:'relative',width:'100%',background:'#F0F4FA',borderRadius:10,overflow:'hidden',border:'1px solid #E0E8F4',marginBottom:8}}>
                  <ImgLocal
                    ruta={imgs[slideIdx]?.ruta}
                    style={{width:'100%',height:280,display:'block'}}
                    onClick={()=>setImgLightbox(imgs[slideIdx]?.ruta)}
                  />
                  {/* Flechas */}
                  {imgs.length>1&&(
                    <>
                      <button onClick={()=>setSlideIdx(i=>(i-1+imgs.length)%imgs.length)}
                        style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',background:'rgba(0,0,0,.45)',border:'none',color:'#fff',width:32,height:32,borderRadius:'50%',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
                      <button onClick={()=>setSlideIdx(i=>(i+1)%imgs.length)}
                        style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'rgba(0,0,0,.45)',border:'none',color:'#fff',width:32,height:32,borderRadius:'50%',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
                    </>
                  )}
                  <div style={{position:'absolute',bottom:8,right:10,background:'rgba(0,0,0,.4)',color:'#fff',fontSize:10,padding:'2px 8px',borderRadius:6,cursor:'zoom-in'}}
                    onClick={()=>setImgLightbox(imgs[slideIdx]?.ruta)}>🔍 ampliar</div>
                </div>
                {/* Nombre del archivo */}
                <div style={{fontSize:11,color:'#AAA',textAlign:'center',marginBottom:imgs.length>1?8:0}}>{imgs[slideIdx]?.nombre}</div>
                {/* Thumbnails */}
                {imgs.length>1&&(
                  <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
                    {imgs.map((img,i)=>(
                      <div key={img.id??img.ruta} onClick={()=>setSlideIdx(i)}
                        style={{flexShrink:0,width:56,height:56,borderRadius:6,overflow:'hidden',border:`2px solid ${i===slideIdx?col:'transparent'}`,cursor:'pointer',background:'#F0F4FA'}}>
                        <ImgLocal ruta={img.ruta} style={{width:'100%',height:'100%'}}/>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {form.nota_sustituto&&(
              <div style={S}>
                <div style={sT('#37474F')}>Nota para sustituto/a</div>
                <div style={{background:'#F8F9FA',border:'1px solid #E0E0E0',padding:'10px 12px',borderRadius:6,fontSize:12,color:'#555',lineHeight:1.65}}>{form.nota_sustituto}</div>
              </div>
            )}

            {form.classroom_txt&&(
              <div style={S}>
                <div style={sT('#1B5E20')}>Tarea Google Classroom</div>
                <div style={{background:'#F8F8F8',border:'1px solid #DDD',borderRadius:6,overflow:'hidden'}}>
                  <div style={{background:'#1B3A6B',color:'#fff',padding:'6px 12px',fontSize:11,fontWeight:700,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    Copiar en Classroom
                    <button onClick={()=>navigator.clipboard.writeText(form.classroom_txt)} style={{background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.4)',color:'#fff',padding:'3px 10px',borderRadius:10,fontSize:11,cursor:'pointer'}}>Copiar</button>
                  </div>
                  <div style={{padding:'10px 12px',fontSize:11,fontFamily:'monospace',lineHeight:1.6,whiteSpace:'pre-wrap',maxHeight:130,overflowY:'auto'}}>{form.classroom_txt}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ EDICIÓN ═══ */}
        {mode==='edit'&&(
          <div style={{flex:1,overflowY:'auto',padding:16,display:'flex',flexDirection:'column',gap:12}}>

            <Blq title="Información básica" col={col}>
              <G2>
                <Fld label="Subtítulo / Textos"><input value={form.subtitulo} onChange={e=>set('subtitulo',e.target.value)} style={IN} placeholder="Análisis de Mt 4,1-10…"/></Fld>
                <Fld label="Fase pedagógica">
                  <select value={form.fase} onChange={e=>set('fase',e.target.value)} style={IN}>
                    <option value="">— Sin fase —</option>
                    {FASES.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                </Fld>
              </G2>
              <G2>
                <Fld label="Semana"><input value={form.semana} onChange={e=>set('semana',e.target.value)} style={IN} placeholder="4"/></Fld>
                <Fld label="Competencia"><input value={form.competencia} onChange={e=>set('competencia',e.target.value)} style={IN} placeholder="Ética y Ciudadana…"/></Fld>
              </G2>
              <G2>
                <Fld label="Indicadores (coma)"><input value={form.indicadores.join(', ')} onChange={e=>set('indicadores',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} style={IN} placeholder="#1, #2"/></Fld>
                <G2>
                  <Fld label="Peso"><input value={form.peso} onChange={e=>set('peso',e.target.value)} style={IN} placeholder="10%"/></Fld>
                  <Fld label="Instrumento"><input value={form.instrumento} onChange={e=>set('instrumento',e.target.value)} style={IN} placeholder="Rúbrica…"/></Fld>
                </G2>
              </G2>
            </Blq>

            <Blq title="Texto bíblico" col="#4A148C">
              <Fld label="Cita"><input value={form.texto_biblico?.cita||''} onChange={e=>setBib('cita',e.target.value)} style={IN} placeholder="Juan 13:14-15"/></Fld>
              <Fld label="Texto"><textarea value={form.texto_biblico?.texto||''} onChange={e=>setBib('texto',e.target.value)} rows={3} style={{...IN,resize:'vertical',fontFamily:'inherit'}} placeholder="Texto bíblico…"/></Fld>
              <Fld label="Contexto"><textarea value={form.texto_biblico?.contexto||''} onChange={e=>setBib('contexto',e.target.value)} rows={2} style={{...IN,resize:'none',fontFamily:'inherit'}} placeholder="Conexión con el tema…"/></Fld>
            </Blq>

            <Blq title="Secuencia de clase (I / D / C)" col={col}>
              <div style={{display:'flex',gap:4,marginBottom:10}}>
                {form.actividades.map((a,i)=><button key={i} onClick={()=>setActTab(i)} style={{padding:'4px 12px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:actTab===i?TBG[a.tipo]:'#F4F4F4',color:actTab===i?TFG[a.tipo]:'#888',borderBottom:actTab===i?`2px solid ${TFG[a.tipo]}`:'2px solid transparent'}}>{TLB[a.tipo]||a.tipo}</button>)}
              </div>
              {form.actividades[actTab]&&(()=>{
                const a=form.actividades[actTab]
                return(<>
                  <input value={a.titulo} onChange={e=>setForm(p=>({...p,actividades:p.actividades.map((x,i)=>i===actTab?{...x,titulo:e.target.value}:x)}))} style={{...IN,marginBottom:8}} placeholder="Título del momento"/>
                  {(a.pasos||[]).map((p,si)=>(
                    <div key={si} style={{display:'flex',gap:5,marginBottom:5,alignItems:'flex-start'}}>
                      <span style={{fontSize:11,color:'#AAA',marginTop:8,flexShrink:0}}>{si+1}.</span>
                      <textarea value={p} onChange={e=>setStep(actTab,si,e.target.value)} rows={2} style={{...IN,flex:1,resize:'none',fontFamily:'inherit'}} placeholder="Paso…"/>
                      <button onClick={()=>rmStep(actTab,si)} style={RB}>✕</button>
                    </div>
                  ))}
                  <button onClick={()=>addStep(actTab)} style={AB}>+ Paso</button>
                </>)
              })()}
            </Blq>

            <Blq title="Actividades del cuaderno" col="#1B3A6B">
              {form.actividades_cuaderno.map((c,idx)=>(
                <div key={idx} style={{display:'flex',gap:5,marginBottom:7,alignItems:'flex-start'}}>
                  <span style={{fontSize:11,color:'#AAA',marginTop:8,flexShrink:0}}>{idx+1}.</span>
                  <textarea value={c.instruccion} onChange={e=>setCuad(idx,'instruccion',e.target.value)} rows={2} style={{...IN,flex:1,resize:'none',fontFamily:'inherit'}} placeholder="Instrucción para el estudiante…"/>
                  <button onClick={()=>rmCuad(idx)} style={RB}>✕</button>
                </div>
              ))}
              <button onClick={addCuad} style={AB}>+ Actividad</button>
            </Blq>

            <Blq title="Reflexión / Metacognición" col="#7B5800">
              <textarea value={form.metacognicion} onChange={e=>set('metacognicion',e.target.value)} rows={3} style={{...IN,resize:'none',fontFamily:'inherit',width:'100%'}} placeholder="Pregunta de reflexión personal…"/>
            </Blq>

            <Blq title="Recursos" col="#1B5E20">
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:7}}>
                {form.recursos.map((r,i)=><span key={i} style={{background:'#E8F5E9',border:'1px solid #A5D6A7',color:'#1B5E20',padding:'3px 9px',borderRadius:4,fontSize:12,display:'flex',alignItems:'center',gap:4}}>{r}<button onClick={()=>rmTag(i)} style={{background:'none',border:'none',color:'#888',cursor:'pointer',fontSize:11,padding:0}}>✕</button></span>)}
              </div>
              <div style={{display:'flex',gap:5}}>
                <input value={tag} onChange={e=>setTag(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTag()} style={{...IN,flex:1}} placeholder="Biblia, Libro Abierto… Enter"/>
                <button onClick={addTag} style={{...AB,margin:0}}>+</button>
              </div>
            </Blq>

            <Blq title="Nota para sustituto/a" col="#37474F">
              <textarea value={form.nota_sustituto} onChange={e=>set('nota_sustituto',e.target.value)} rows={3} style={{...IN,resize:'none',fontFamily:'inherit',width:'100%'}} placeholder="Instrucciones si no podés dar la clase…"/>
            </Blq>

            <Blq title="Tarea Google Classroom" col="#1B5E20">
              <textarea value={form.classroom_txt} onChange={e=>set('classroom_txt',e.target.value)} rows={4} style={{...IN,resize:'vertical',fontFamily:'monospace',fontSize:11,width:'100%'}} placeholder="Texto para copiar en Classroom…"/>
            </Blq>

            <button onClick={save} disabled={saving} style={{padding:12,background:saving?'#AAA':col,color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:saving?'default':'pointer'}}>{saving?'⏳ Guardando…':'💾 Guardar plan de clase'}</button>
          </div>
        )}

      </div>

      {/* ── Lightbox imágenes ── */}
      {imgLightbox&&(
        <div onClick={()=>setImgLightbox(null)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.9)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:600,cursor:'zoom-out',padding:24}}>
          <ImgLocal ruta={imgLightbox} style={{maxWidth:'100%',maxHeight:'100%',borderRadius:8,boxShadow:'0 8px 40px rgba(0,0,0,.6)'}}/>
          <button onClick={()=>setImgLightbox(null)}
            style={{position:'fixed',top:20,right:24,background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',color:'#fff',fontSize:22,width:42,height:42,borderRadius:'50%',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>✕</button>
        </div>
      )}
    </div>
  )
}

function Blq({title,col,children}){return(<div style={{border:'1px solid #E8EDF5',borderRadius:10,overflow:'hidden'}}><div style={{padding:'7px 12px',background:col+'18',borderBottom:`1px solid ${col}30`}}><span style={{fontSize:10,fontWeight:700,color:col,letterSpacing:.8,textTransform:'uppercase'}}>{title}</span></div><div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:8}}>{children}</div></div>)}
function Fld({label,children}){return(<div style={{display:'flex',flexDirection:'column',gap:3}}><span style={{fontSize:10,fontWeight:600,color:'#AAB4C4',textTransform:'uppercase',letterSpacing:.5}}>{label}</span>{children}</div>)}
function G2({children}){return(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{children}</div>)}

const S={padding:'12px 16px',borderBottom:'1px solid #F5F5F5'}
const sT=col=>({fontSize:10,fontWeight:700,color:col,letterSpacing:1,textTransform:'uppercase',marginBottom:8,paddingBottom:5,borderBottom:`2px solid ${col}`})
const BADGE={fontSize:10,padding:'2px 9px',borderRadius:10,background:'rgba(255,255,255,.25)',color:'rgba(255,255,255,.95)',fontWeight:500}
const IN={border:'1.5px solid #DDE3ED',borderRadius:7,padding:'7px 10px',fontSize:12,outline:'none',width:'100%',color:'#333',background:'#fff'}
const RB={background:'none',border:'none',color:'#CCC',fontSize:12,cursor:'pointer',padding:'6px 4px',flexShrink:0}
const AB={padding:'5px 12px',background:'#EEF2F7',border:'1px solid #DDE3ED',borderRadius:6,fontSize:12,cursor:'pointer',color:'#555',marginTop:2}
const BG={background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.4)',color:'#fff',padding:'5px 11px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}