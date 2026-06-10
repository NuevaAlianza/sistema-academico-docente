# PRD — Product Requirements Document
# Sistema Académico Docente

**Versión:** 1.5.0  
**Fecha:** 2026-06-08  
**Estado:** Producción

---

## 1. Resumen del producto

Sistema Académico Docente es una aplicación de escritorio Windows para que un maestro lleve de forma completamente offline el seguimiento académico de sus cursos: calificaciones, asistencia, temario y reportes.

No requiere internet, servidor ni cuenta de usuario. Todos los datos se almacenan en un único archivo SQLite local en la PC del maestro. La distribución es un instalador `.exe` auto-actualizable vía GitHub Releases.

---

## 2. Usuarios objetivo

- **Perfil**: maestros de educación básica y media en República Dominicana.
- **Contexto de uso**: PC personal, sin red confiable, trabajando solos (no hay multi-usuario).
- **Expectativas técnicas bajas**: el maestro no es técnico. La app debe funcionar sin configuración y con flujos predecibles.
- **Un único usuario por instalación**: no hay roles, contraseñas ni sincronización.

---

## 3. Módulos principales

### Dashboard
Vista general del estado del año escolar activo. Muestra conteo de cursos y estudiantes, estado de temas (realizados / pendientes / aplazados / tarea) y lista de estudiantes en riesgo. Semáforo por curso con distribución verde / ámbar / rojo por período.

### Horario
Grilla visual de días × bloques (lunes–viernes). El maestro asigna un curso + materia a cada celda. Permite filtrar por materia.

### Cursos
CRUD de cursos del año activo (nombre, grado, sección, color). Cada curso tiene un **Espacio** privado con nota rápida libre, anotaciones con fecha e historial de promedios por período.

### Estudiantes
Padrón de alumnos por curso: CRUD manual o importación masiva desde Excel/CSV. Cuaderno de observaciones por estudiante. Historial de promedios por período.

### Asistencia
Registro diario por curso con estados: presente, ausente, tardanza, excusado. Vista mensual con resumen por estudiante. Filtro por materia.

### Calificaciones
Módulo central. Dos modos:
- **Simple**: actividad → una competencia → nota 0–100.
- **Multi**: actividad → 2 a 4 competencias con distribución de puntos controlada por techo.

Incluye promedio ponderado del período, resumen por competencia, exportación a PDF y Excel.

### Temario
CRUD de temas con título, estado y fecha. Reordenamiento por drag. Plan de clase con metadatos enriquecidos (subtítulo, semana, fase, competencia, indicadores). Clonar temario entre cursos, sincronizar plan a múltiples cursos, importar desde JSON, adjuntar archivos.

### Reportes
Reporte grupal (promedio + asistencia + temas por curso/período) y reporte individual (detalle completo del estudiante). Exportación PDF con jsPDF. Exportación de calificaciones a Excel.

### Configuración
Nombre del maestro y centro educativo. Pesos de evaluación (actividades, participación, asistencia, conducta). Mínimo aprobatorio y umbrales del semáforo. CRUD de materias (máximo 3 por año). Gestión de años escolares y períodos.

### Backup
Exportar BD como archivo `.db` (copia atómica WAL-safe). Importar/restaurar BD desde archivo `.db`. Exportar calificaciones a Excel. Reset total de BD. Sin backup automático ni sincronización en la nube.

---

## 4. Modelos de calificación

### Modo Simple
Una actividad evalúa **una sola competencia**. El maestro ingresa una nota de 0 a 100 por estudiante. El promedio del período es el promedio ponderado de todas las actividades simples del período para esa competencia.

**Cuándo conviene:** la mayoría de actividades cotidianas (tarea, evaluación, participación) que apuntan a una habilidad específica.

### Modo Multi-competencia
Una actividad evalúa **2, 3 o 4 competencias simultáneamente**. El maestro asigna puntos a cada competencia activa dentro de un **techo automático** (`100 ÷ n_comps`). La nota global de la actividad es la suma de los puntos asignados.

**Cuándo conviene:** proyectos integradores o evaluaciones que cruzan varias áreas. Útil cuando una sola nota global no refleja el desempeño diferenciado por competencia.

---

## 5. Reglas de negocio

### Competencias fijas
Las 4 competencias son fijas e inmutables en la versión actual:

| Nombre visible | Clave interna (BD) | Icono | Color |
|---|---|---|---|
| Comunicativa | `Comunicativa` | 💬 | #2563A8 |
| Pensamiento Lógico | `Pensamiento Logico` | 🧠 | #00695C |
| Cívica | `Civica` | 🏛️ | #5C2D91 |
| Tecnológica | `Tecnologica` | 💻 | #C84B00 |

El orden es siempre: Comunicativa → Pensamiento Lógico → Cívica → Tecnológica.

### Pesos de evaluación
El peso total del período suma 100. Distribución configurable:
- Actividades (default 60%)
- Participación (default 20%)
- Asistencia (default 10%)
- Conducta (default 10%)

### Fórmulas del modo multi-competencia

```
techo_por_competencia  = 100 / n_comps
nota_global_actividad  = Σ(puntos asignados a cada competencia activa)
nota_comp_en_actividad = (puntos_comp / techo) × 100
nota_comp_del_período  = Σ(nota_comp_en_act × peso_unitario) / Σ(peso_unitario)
  donde peso_unitario  = peso_actividad / n_comps
```

### Semáforo
- Verde: promedio ≥ `semaforo_verde` (default 80)
- Ámbar: promedio ≥ `semaforo_amarillo` (default 60)
- Rojo: promedio < `semaforo_amarillo`

Los umbrales son configurables por el maestro.

### Otras reglas
- El promedio de actividades es ponderado por el campo `peso` de cada actividad.
- No se soportan decimales en la nota final.
- Eliminar un estudiante borra en cascada todas sus calificaciones, asistencias y observaciones (acción irreversible — requiere backup previo).
- Máximo 3 materias activas por año escolar.

---

## 6. Restricciones

- **Offline-first**: la app no requiere internet para ninguna función excepto el auto-update.
- **Sin sincronización**: cada maestro tiene su propia BD. No hay compartición de datos entre instalaciones.
- **No multi-usuario**: una sola BD por instalación, un solo maestro.
- **Windows únicamente**: distribución NSIS para Windows 10+.
- **Sin contraseña ni autenticación**: el acceso a los datos depende del acceso físico a la PC.

---

## 7. Roadmap conocido

### Próximo bloque

- **App de Orientación / Supervisor**: segunda aplicación de escritorio para el orientador o director del centro. Objetivo: recibir los datos de notas finales del maestro vía LAN sin doble entrada de datos.
- **Integración LAN**: protocolo para que la app del maestro y la app del orientador se comuniquen en red local (sin internet). Padrón de estudiantes y notas finales de período compartidos.

### Mejoras pendientes dentro del sistema actual

- Auto-reload del renderer tras restore de BD (actualmente el maestro debe cerrar y reabrir la app manualmente).
- PDF de asistencia independiente.
- Exportación Excel con columnas de distribución multi por competencia (actualmente solo exporta la nota global).
- Reporte anual consolidado de boletines.
- Importación/exportación masiva de estudiantes entre años escolares.
