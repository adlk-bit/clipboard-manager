const { readFile, rm, writeFile } = require('node:fs/promises')
const path = require('node:path')
const { zipSync } = require('fflate')

module.exports = async function compactWindowsPackage({ electronPlatformName, appOutDir }) {
  if (electronPlatformName !== 'win32') return

  // A locally supplied Electron distribution can include its sample app.
  await rm(path.join(appOutDir, 'resources', 'default_app.asar'), { force: true })

  // Ship the complete Chromium notices in a ZIP that Explorer can open offline.
  const name = 'LICENSES.chromium.html'
  const original = path.join(appOutDir, name)
  const notices = await readFile(original)
  const archive = zipSync({ [name]: notices }, { level: 9, mtime: new Date(2000, 0, 1) })
  await writeFile(path.join(appOutDir, 'LICENSES.chromium.zip'), archive)
  await rm(original)
}
