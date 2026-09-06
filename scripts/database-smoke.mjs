import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const root = path.resolve(import.meta.dirname, '..')
const directory = path.join(root, 'artifacts', 'productivity')
const profile = await mkdtemp(path.join(os.tmpdir(), 'clipboard-productivity-db-'))
try {
  await mkdir(directory, { recursive: true })
  const entry = path.join(directory, 'database-runtime.cjs')
  await build({ entryPoints: [path.join(root, 'tests', 'database-runtime.ts')], outfile: entry, bundle: true, platform: 'node', format: 'cjs', external: ['electron', 'sql.js'] })
  const child = spawn(path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'), [entry], { windowsHide: true, stdio: 'inherit', env: { ...process.env, CLIPBOARD_MANAGER_USER_DATA_DIR: profile } })
  const timeout = setTimeout(() => child.kill(), 20000)
  const code = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject) })
  clearTimeout(timeout)
  if (code !== 0) throw new Error(`Database integration failed: ${code}`)
} finally { await rm(profile, { recursive: true, force: true }) }
