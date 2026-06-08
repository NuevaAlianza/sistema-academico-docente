#!/usr/bin/env python3
"""Copia la BD a un backup con timestamp antes de la limpieza v1.5.0."""
import os, shutil, sys
from pathlib import Path
from datetime import datetime

DB_DIR  = Path(os.environ['APPDATA']) / 'sistema-academico-docente'
DB_PATH = DB_DIR / 'sistema_docente.db'

if not DB_PATH.exists():
    print(f"❌  BD no encontrada: {DB_PATH}"); sys.exit(1)

ts     = datetime.now().strftime('%Y%m%d_%H%M%S')
BACKUP = DB_DIR / f'backup_pre_limpieza_v15_{ts}.db'

shutil.copy2(DB_PATH, BACKUP)

orig_kb   = DB_PATH.stat().st_size  // 1024
backup_kb = BACKUP.stat().st_size   // 1024

print(f"✅  Backup creado exitosamente")
print(f"    Original : {DB_PATH}  ({orig_kb} KB)")
print(f"    Backup   : {BACKUP}  ({backup_kb} KB)")
print(f"    Timestamp: {ts}")
