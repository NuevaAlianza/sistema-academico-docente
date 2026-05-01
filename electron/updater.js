'use strict'
const { autoUpdater } = require('electron-updater')
const { dialog } = require('electron')

let mainWin = null

function iniciarAutoUpdater(win) {
  mainWin = win

  if (!require('electron').app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  setTimeout(() => autoUpdater.checkForUpdates(), 5000)
  setInterval(() => autoUpdater.checkForUpdates(), 2 * 60 * 60 * 1000)

  autoUpdater.on('update-available', info => {
    const { response } = dialog.showMessageBoxSync(mainWin, {
      type: 'info',
      title: 'Nueva versión disponible',
      message: `Versión ${info.version} disponible`,
      detail: 'Hay una actualización del Sistema Académico.\n¿Descargar ahora? Se instalará al cerrar la app.',
      buttons: ['Descargar', 'Más tarde'],
      defaultId: 0,
    })
    if (response === 0) {
      autoUpdater.downloadUpdate()
      mainWin.webContents.send('update-downloading')
    }
  })

  autoUpdater.on('download-progress', progress => {
    mainWin.webContents.send('update-progress', Math.round(progress.percent))
    mainWin.setProgressBar(progress.percent / 100)
  })

  autoUpdater.on('update-downloaded', () => {
    mainWin.setProgressBar(-1)
    const { response } = dialog.showMessageBoxSync(mainWin, {
      type: 'info',
      title: 'Actualización lista',
      message: 'Actualización descargada correctamente',
      detail: '¿Reiniciar ahora para instalar?',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0,
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', err => {
    console.error('Auto-updater error:', err)
  })
}

module.exports = { iniciarAutoUpdater }
