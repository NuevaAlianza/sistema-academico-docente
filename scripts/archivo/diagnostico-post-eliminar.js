#!/usr/bin/env node
/**
 * DIAGNÓSTICO POST-ELIMINAR ACTIVIDAD MULTI
 * Solo lectura — no modifica nada.
 *
 * NOTA: better-sqlite3 en este proyecto está compilado para la versión de
 * Node de Electron (NODE_MODULE_VERSION 121), no para Node del sistema (v22).
 * Por eso el diagnóstico delega al script Python equivalente.
 *
 * Uso:
 *   node scripts/diagnostico-post-eliminar.js
 *   python scripts/diagnostico-post-eliminar.py   (equivalente directo)
 */

const { spawnSync } = require('child_process')
const path          = require('path')

const py = path.join(__dirname, 'diagnostico-post-eliminar.py')

const result = spawnSync('python', [py], {
  stdio: 'inherit',
  env: { ...process.env, PYTHONUTF8: '1' },
})

process.exit(result.status ?? 0)
