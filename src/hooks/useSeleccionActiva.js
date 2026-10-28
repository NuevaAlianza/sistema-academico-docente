import { useMemo, useCallback } from 'react'

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Período actual según la fecha de hoy. Todos los períodos quedan en estado 'abierto'
// (nunca se cierran), así que el estado no sirve para elegir: se usan las fechas.
// Entre dos períodos (vacaciones) gana el último que ya empezó; sin fechas, el primero.
export function periodoPorFecha(periodos, hoy = hoyISO()) {
  if (!periodos?.length) return null
  const enCurso = periodos.find(p => p.fecha_inicio && p.fecha_fin && p.fecha_inicio <= hoy && hoy <= p.fecha_fin)
  if (enCurso) return enCurso
  const empezados = periodos.filter(p => p.fecha_inicio && p.fecha_inicio <= hoy)
  if (empezados.length) return empezados.reduce((a, b) => (b.fecha_inicio > a.fecha_inicio ? b : a))
  return periodos[0]
}

// Curso y período compartidos por todas las páginas (viven en App.jsx).
// Cada página carga su propia lista; aquí solo se resuelve cuál está activo.
export function useCursoActivo(cursos, cursoActivoId, onCambiarCurso) {
  const cursoSel = useMemo(
    () => cursos.find(c => c.id === cursoActivoId) || cursos[0] || null,
    [cursos, cursoActivoId]
  )
  const setCursoSel = useCallback(c => { if (c) onCambiarCurso(c.id) }, [onCambiarCurso])
  return [cursoSel, setCursoSel]
}

export function usePeriodoActivo(periodos, periodoActivoId, onCambiarPeriodo) {
  const perSel = useMemo(
    () => periodos.find(p => p.id === periodoActivoId) || periodoPorFecha(periodos),
    [periodos, periodoActivoId]
  )
  const setPerSel = useCallback(p => { if (p) onCambiarPeriodo(p.id) }, [onCambiarPeriodo])
  return [perSel, setPerSel]
}
