# HANDOVER.md — Estado actual del proyecto
# Sistema Académico Docente

**Versión:** 1.5.0  
**Fecha:** 2026-06-09  
**Estado:** Estable — modo multi-competencia funcional

---

## Lo último que se hizo

### Ciclo v1.5.0 (completado)

1. **Refactor completo del modo multi-competencia** (flujo invertido): el maestro ahora ingresa puntos directamente por competencia; la nota global se calcula automáticamente como suma. Elimina la ambigüedad del flujo anterior (nota global primero).
2. **Techo por competencia** (`100 ÷ n_comps`): inputs con límite dinámico, validación inmediata, bordes rojos al exceder.
3. **UI anti-confusión**: 4 slots siempre visibles, orden fijo canónico, `"—"` para competencias inactivas.
4. **Migración de nombres**: `Científica → Pensamiento Logico`, `Ética → Tecnologica`. Script idempotente ya ejecutado en BD de producción.
5. **Fix 3 bugs críticos de backup**: WAL no incluido en export, WAL no limpiado en restore, validación de techo en `setCalificacionMulti`.
6. **Scripts de mantenimiento** documentados con `README.md`.
7. **Documentación de cierre v1.5.0**: `CHANGELOG-v1.5.0.md`, `PRD.md`, `TDR.md`, `AGENTS.md`, este `HANDOVER.md`.

---

## Estado de la BD de producción

La BD en `%APPDATA%\sistema-academico-docente\sistema_docente.db` fue restaurada a un backup anterior durante las pruebas de backup/restore. Puede tener datos en estado antiguo (warnings de `Científica`/`Ética` en consola al abrir actividades multi).

**Antes de continuar hay que decidir:**

- **Opción A**: Ejecutar `migrar-nombres-competencias.py` sobre la BD actual para normalizar los nombres y eliminar los warnings.
- **Opción B**: Restaurar `backup_pre_limpieza_v15_20260608_183112.db` (estado post-migración de nombres, pre-limpieza de datos de prueba) y luego decidir si limpiar los datos de prueba.
- **Opción C**: Ejecutar `limpiar-datos-prueba.py` (borra actividades, calificaciones, temas, asistencias) para comenzar desde cero con datos reales.

Verificar con `estado-bd-actual.py` antes de decidir.

---

## Backups disponibles

Ubicación: `%APPDATA%\sistema-academico-docente\`

| Archivo | Fecha | Estado |
|---|---|---|
| `backup_pre_migracion_nombres_20260608_181441.db` | 2026-06-08 18:14 | BD con nombres Científica/Ética (antes de migración) |
| `backup_pre_limpieza_v15_20260608_183112.db` | 2026-06-08 18:31 | BD con nombres canónicos, datos de prueba presentes |

> Los backups tienen archivos `.wal`/`.shm` asociados. Verificar con `estado-bd-actual.py` antes de restaurar.

---

## Checklist de cierre v1.5.0

- [x] Refactor flujo inverso multi-competencia
- [x] Migración de nombres de competencias
- [x] UI 4 slots fijos anti-confusión
- [x] Fix bugs críticos de backup (WAL export + WAL restore)
- [x] Scripts de mantenimiento con README
- [x] Documentación de cierre (5 archivos MD en raíz)
- [ ] **Punto pendiente**: Resolver estado de la BD (ver sección anterior)
- [ ] Limpiar `/scripts` si procede (mover diagnósticos viejos ya están en `scripts/archivo/`)
- [ ] Bump versión a `1.5.0` en `package.json` *(ya está en 1.5.0 — verificar)*
- [ ] `npm run build-app` — generar `.exe`
- [ ] Probar `.exe` instalado en ubicación limpia
- [ ] `git push` + crear release `v1.5.0` en GitHub con `.exe` adjunto

---

## Próximo bloque grande

### App de Orientación / Supervisor

Segunda aplicación de escritorio para el orientador o director del centro. Objetivo: recibir notas finales del maestro sin doble entrada de datos.

- Integración vía LAN (red local, sin internet)
- El padrón de estudiantes y notas finales de período se comparten entre apps
- La BD `supervisor.db` ya existe en AppData (creada en un prototipo anterior: `%APPDATA%\sistema-academico-docente\supervisor.db`)

---

## Notas para la próxima sesión

- La BD actual puede tener warnings de `Científica`/`Ética` — no es un bug de la app, es estado de datos. Resolverlo antes de hacer el build final.
- Los datos de prueba en la BD (actividades FIHR, etc.) pueden borrarse en cualquier momento con `limpiar-datos-prueba.py`, pero hacer backup antes.
- El `.exe` aún no se ha generado para v1.5.0. No publicar la release hasta haber probado el instalador en una ubicación limpia.
- El auto-update apunta a `NuevaAlianza/sistema-academico-docente` en GitHub. Verificar que el repo existe y tiene acceso antes del release.

---

## Referencias rápidas

| Qué necesito saber | Dónde mirarlo |
|---|---|
| Fórmulas de cálculo multi | `TDR.md` § 4 |
| Esquema de BD completo | `TDR.md` § 3 |
| Todos los IPC handlers | `docs/HANDOVER_v1.5.0.md` § 3.3 |
| Flujos de usuario | `docs/HANDOVER_v1.5.0.md` § 4 |
| Reglas de código | `AGENTS.md` |
| Bugs conocidos no críticos | `docs/HANDOVER_v1.5.0.md` § 10 |
