import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { unzipSync } from 'fflate'
import compactWindowsPackage from '../scripts/compact-windows-package.cjs'

test('Windows packages retain the full notices and the application payload', async () => {
  const appOutDir = await mkdtemp(path.join(os.tmpdir(), 'clipboard-pack-'))
  try {
    const resources = path.join(appOutDir, 'resources')
    const name = 'LICENSES.chromium.html'
    const original = Buffer.from('<pre>示例 attribution\r\n© contributor</pre>')
    await mkdir(resources)
    await writeFile(path.join(resources, 'app.asar'), 'application')
    await writeFile(path.join(resources, 'default_app.asar'), 'sample')
    await writeFile(path.join(appOutDir, name), original)
    await compactWindowsPackage({ electronPlatformName: 'win32', appOutDir })

    const archive = unzipSync(await readFile(path.join(appOutDir, 'LICENSES.chromium.zip')))
    assert.deepEqual(Object.keys(archive), [name])
    assert.deepEqual(Buffer.from(archive[name]), original)
    assert.equal(await readFile(path.join(resources, 'app.asar'), 'utf8'), 'application')
    await assert.rejects(readFile(path.join(resources, 'default_app.asar')), { code: 'ENOENT' })
    await assert.rejects(readFile(path.join(appOutDir, name)), { code: 'ENOENT' })
  } finally {
    await rm(appOutDir, { recursive: true, force: true })
  }
})
