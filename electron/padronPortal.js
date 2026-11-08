'use strict';
// Comparación entre los cursos de este sistema y el padrón de Portal-Ars
// (que se actualiza desde el SIGERD). Arma SUGERENCIAS; no cambia nada:
// el maestro elige cuáles aplicar.
//
// Empareja por NOMBRE dentro del mismo grado (no por número de lista):
// los números se corren cuando entra o sale alguien, y emparejar por
// número le pondría las notas de uno a otro.

function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\(.*?\)/g, ' ').replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ¿Dos palabras son la misma con un error de tipeo? (ASHLY/ASHLEY,
// ESPINOSA/ESPINOZA): a lo sumo una letra de diferencia, en palabras de
// 4 letras o más.
function casiIgual(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, dif = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++dif > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return dif + (a.length - i) + (b.length - j) <= 1;
}

// Parecido por palabras sin importar el orden («APELLIDOS NOMBRES» vs
// «Nombres Apellidos»), tolerando un error de tipeo por palabra.
// 1 = mismas palabras.
function parecido(a, b) {
  // «DE», «LA», «DEL»… no cuentan: dos personas distintas «De La Cruz»
  // compartirían palabras sin ser parecidas.
  const PARTICULAS = new Set(['DE', 'LA', 'LAS', 'LOS', 'DEL', 'Y']);
  const palabras = s => [...new Set(normalizar(s).split(' ').filter(t => t && !PARTICULAS.has(t)))];
  const A = palabras(a);
  const B = palabras(b);
  if (!A.length || !B.length) return 0;
  const usadas = new Set();
  let comunes = 0;
  for (const t of A) {
    let k = B.findIndex((u, idx) => !usadas.has(idx) && u === t);
    if (k === -1) k = B.findIndex((u, idx) => !usadas.has(idx) && casiIgual(t, u));
    if (k !== -1) { usadas.add(k); comunes++; }
  }
  return comunes / Math.max(A.length, B.length);
}

// 2 de 4 palabras (0,5) NO alcanza: dos hermanos comparten los dos
// apellidos. 2 de 3 (0,67) sí se muestra, como «revisá».
const SEGURO = 0.75, DUDOSO = 0.6;

function esPruebaPortal(e) {
  return e.numero_orden >= 90 || /prueba|test/i.test(e.nombre || '');
}

// cursos: [{id, nombre, grado, seccion}] activos del año
// locales: [{id, curso_id, numero_lista, nombre_completo}] activos
// portal:  [{id, nombre, grado, seccion, numero_orden, activo}]
function compararConPortal(cursos, locales, portal) {
  const cursoPorClave = new Map(cursos.map(c => [c.grado + '|' + c.seccion, c]));
  const cursoPorId = new Map(cursos.map(c => [c.id, c]));
  const grados = new Set(cursos.map(c => c.grado));

  // Del portal, solo los grados que este maestro tiene.
  const pool = portal.filter(p => p.activo !== false && !esPruebaPortal(p) && grados.has(p.grado));
  const locs = locales.filter(l => cursoPorId.has(l.curso_id))
    .map(l => ({ ...l, grado: cursoPorId.get(l.curso_id).grado }));

  // Pares más parecidos primero, en todo el grado.
  const pares = [];
  for (const p of pool) for (const l of locs) {
    if (l.grado !== p.grado) continue;
    const s = parecido(p.nombre, l.nombre_completo);
    if (s >= DUDOSO) pares.push({ p, l, s });
  }
  pares.sort((a, b) => b.s - a.s);
  const usadoP = new Set(), usadoL = new Set(), match = new Map();
  for (const x of pares) {
    if (usadoP.has(x.p.id) || usadoL.has(x.l.id)) continue;
    usadoP.add(x.p.id); usadoL.add(x.l.id);
    match.set(x.p.id, x);
  }

  const sugerencias = [];
  let iguales = 0;
  for (const p of pool) {
    const destino = cursoPorClave.get(p.grado + '|' + p.seccion) || null;
    const m = match.get(p.id);
    const base = {
      portal: { nombre: p.nombre, grado: p.grado, seccion: p.seccion, numero: p.numero_orden },
      destinoCursoId: destino ? destino.id : null,
      destinoCurso: destino ? destino.nombre : null,
      dudoso: !!(m && m.s < SEGURO),
    };
    if (!m) {
      if (destino) sugerencias.push({ ...base, tipo: 'agregar', id: 'a' + p.id });
      continue; // de una sección que este maestro no tiene: no le incumbe
    }
    const l = m.l;
    const origen = cursoPorId.get(l.curso_id);
    const local = { id: l.id, nombre: l.nombre_completo, curso: origen.nombre, cursoId: origen.id, numero: l.numero_lista };
    if (destino && destino.id === origen.id) {
      // Mismo curso y mismo número: nada que hacer (aunque el nombre
      // esté escrito un poco distinto).
      if (l.numero_lista === p.numero_orden) { iguales++; continue; }
      sugerencias.push({ ...base, tipo: 'numero', local, id: 'n' + p.id });
    } else if (destino) {
      sugerencias.push({ ...base, tipo: 'mover', local, id: 'm' + p.id });
    } else {
      // Pasó a una sección que este maestro no tiene.
      sugerencias.push({ ...base, tipo: 'salio', local, id: 's' + p.id });
    }
  }

  // Locales sin pareja en el portal (en grados que el portal sí trae).
  const gradosPortal = new Set(pool.map(p => p.grado));
  const sinPortal = locs.filter(l => !usadoL.has(l.id) && gradosPortal.has(l.grado)).map(l => ({
    id: 'r' + l.id, tipo: 'no_esta',
    local: { id: l.id, nombre: l.nombre_completo, curso: cursoPorId.get(l.curso_id).nombre, cursoId: l.curso_id, numero: l.numero_lista },
  }));

  return { sugerencias: sugerencias.concat(sinPortal), iguales, gradosSinPortal: [...grados].filter(g => !gradosPortal.has(g)) };
}

// Qué viene marcado al abrir: altas, cambios de número y de sección (si
// el nombre coincide bien). Retiros, solo cuando ese estudiante ocupa el
// número que necesita otro (si no, chocarían y no se aplicaría nada).
// Si aun así un lugar lo ocupa alguien que no se mueve (ej. un nombre
// «parecido» sin marcar), esa sugerencia se desmarca y se avisa con quién
// choca: lo marcado por defecto siempre se puede aplicar.
function marcadasPorDefecto(sugerencias, locales) {
  const POR_DEFECTO = { agregar: true, numero: true, mover: true, salio: false, no_esta: false };
  const m = {};
  for (const s of sugerencias) m[s.id] = POR_DEFECTO[s.tipo] && !s.dudoso;
  const destinoDe = s => (s.tipo === 'numero' ? s.local.cursoId : s.destinoCursoId) + '|' + s.portal.numero;
  const ocupa = ['agregar', 'numero', 'mover'];

  const destinos = new Set(sugerencias.filter(s => m[s.id] && ocupa.includes(s.tipo)).map(destinoDe));
  for (const s of sugerencias) {
    if ((s.tipo === 'no_esta' || s.tipo === 'salio') && destinos.has(s.local.cursoId + '|' + s.local.numero)) {
      m[s.id] = true;
      s.liberaNumero = true;
    }
  }

  // Hasta que no quede ningún choque: quién queda en cada lugar.
  for (let vuelta = 0; vuelta < 50; vuelta++) {
    const seVa = new Set(sugerencias.filter(s => m[s.id] && s.local && s.tipo !== 'agregar').map(s => s.local.id));
    const quedan = new Map();
    for (const l of locales || []) if (!seVa.has(l.id)) quedan.set(l.curso_id + '|' + l.numero_lista, l.nombre_completo);
    const usados = new Map();
    let cambio = false;
    for (const s of sugerencias) {
      if (!m[s.id] || !ocupa.includes(s.tipo)) continue;
      const k = destinoDe(s);
      const quien = quedan.get(k) || usados.get(k);
      if (quien) { m[s.id] = false; s.chocaCon = quien; cambio = true; continue; }
      usados.set(k, s.portal.nombre);
    }
    if (!cambio) break;
  }
  return m;
}

module.exports = { normalizar, parecido, casiIgual, compararConPortal, marcadasPorDefecto, esPruebaPortal };
