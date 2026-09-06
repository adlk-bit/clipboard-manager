import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'win32') {
  console.log('Windows native bridge is only built on Windows.')
} else {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const source = path.join(root, 'native', 'ClipboardBridge.cs')
  const output = path.join(root, 'native', 'bin', 'ClipboardBridge.exe')
  const compiler = path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  if (!fs.existsSync(output) || fs.statSync(output).mtimeMs < fs.statSync(source).mtimeMs) {
    const result = spawnSync(compiler, ['/nologo', '/optimize+', '/target:exe', '/platform:x64',
      '/r:System.Windows.Forms.dll', '/r:System.Web.Extensions.dll', `/out:${output}`, source], { stdio: 'inherit', windowsHide: true })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status || 1)
  }
  console.log(`Windows native bridge ready (${fs.statSync(output).size} bytes).`)
}
