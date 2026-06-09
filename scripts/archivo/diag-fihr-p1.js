#!/usr/bin/env node
// DIAGNÓSTICO — Actividad multi FIHR 2do B / P1 con techo incorrecto.
// Solo lectura. Delega al script Python (better-sqlite3 compilado para Electron).
const { spawnSync } = require('child_process')
const path = require('path')
const result = spawnSync('python', [path.join(__dirname, 'diag-fihr-p1.py')], {
  stdio: 'inherit',
  env: { ...process.env, PYTHONUTF8: '1' },
})
process.exit(result.status ?? 0)
