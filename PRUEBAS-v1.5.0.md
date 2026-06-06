# PRUEBAS — Flujo nuevo modo multi-competencia (v1.5.0)

## Regla base
`techo = 100 / n_comps`. La nota global = suma de los pts por comp. Nunca > 100.

---

## 1. Actividad con 4 comps — todos al techo
- Crear actividad multi con las 4 competencias, peso 20.
- Abrir notas: todos los inputs deben mostrar **25** por defecto.
- Nota global debe leer **100**.

## 2. Misma actividad — bajar una comp
- Poner Ética en **15** (onBlur).
- Nota global debe actualizarse a **90** (25+25+15+25).
- Nota de Ética en la vista Resumen > Multi: `(15/25)×100 = 60`.

## 3. Intentar superar el techo
- Poner cualquier comp en **30** (techo 25).
- Input debe ponerse en rojo y mostrar mensaje **"máximo 25"**.
- Columna Nota Global debe mostrar **✗ excede**.
- onBlur: **no se guarda** (validación bloqueante).

## 4. Actividad con 2 comps (techo 50)
- Crear actividad multi con solo Comunicativa + Científica, peso 30.
- Techo = **50**. Poner Com=30, Cie=50.
- Nota global = **80**. Comunicativa = `(30/50)×100 = 60`, Científica = `(50/50)×100 = 100`.

## 5. Actividad con 1 comp (techo 100)
- Crear actividad multi con solo Comunicativa, peso 10.
- Techo = **100**. Comportamiento idéntico a modo simple.
- Input acepta 0–100. Nota global = lo que ingresó el maestro.

## 6. Dos actividades distintas — verificar promedio ponderado
- Act A: peso 30, 4 comps. Comunicativa = 20 pts → nota_comp = (20/25)×100 = 80. peso_unit = 7.5
- Act B: peso 70, 4 comps. Comunicativa = 25 pts → nota_comp = 100. peso_unit = 17.5
- Nota Comunicativa período = (80×7.5 + 100×17.5) / (7.5+17.5) = (600+1750)/25 = 94.
- Verificar en Resumen > Multi.

## 7. Vista tab Multi — coherencia
- Los valores en la tabla coinciden con los calculados en la prueba anterior.
- Promedio final de un estudiante = promedio simple de sus 4 notas por competencia.

## 8. PDF Multi — coherencia con tab Multi
- Generar PDF Multi y verificar que los números por competencia y la nota global por actividad coinciden exactamente con la vista en pantalla.

## 9. Celda vacía muestra default techo
- Estudiante sin calificación en una actividad multi.
- Al abrir la vista de notas, sus inputs muestran el valor techo (ej. 25 para 4 comps).
- La nota global aparece en gris (no guardada todavía).
- onBlur guarda correctamente y la nota pasa a color normal.

## 10. Editar competencias de actividad con notas
- Actividad con 4 comps y notas guardadas.
- Cambiar a 2 comps (techo nuevo = 50).
- Confirmar el aviso.
- Todas las distribuciones se resetean a {Com:50, Cie:50}, nota = 100.
- Resumen se recalcula correctamente con el nuevo techo.
