import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { initDatabaseAsync, closeDatabase, insertHistory, getHistoryList, saveTemplate, getTemplates, getBackupSnapshot, importBackupSnapshot, updateOcr, getSetting } from '../electron/main/database'
import { readBackupFile, writePortableBackup } from '../electron/main/backup'
import { getHistoryImagesDir, getStickersDir } from '../electron/main/asset-paths'

app.whenReady().then(async () => {
  try {
    const database = await initDatabaseAsync()
    const image = path.join(getHistoryImagesDir(), 'synthetic.png')
    fs.writeFileSync(image, Buffer.from('synthetic-asset-backup-test'))
    const text = insertHistory('text', 'database synthetic', null, '', 'notepad.exe')
    const picture = insertHistory('image', null, image, 'hash', 'snippingtool.exe')
    assert.ok(text.id && picture.id)
    updateOcr(picture.id!, '索引 2048', 'zh-Hans-CN')
    saveTemplate(null, 'Reply', 'Hello {{name}}')
    const file = path.join(process.env.CLIPBOARD_MANAGER_USER_DATA_DIR!, 'roundtrip.clipbackup')
    const snapshot = getBackupSnapshot()
    snapshot.settings.excluded_apps = '["keepass.exe"]'
    writePortableBackup(file, snapshot, '1.2.0')
    const first = readBackupFile(file, getHistoryImagesDir(), getStickersDir())
    const merged = importBackupSnapshot(first.snapshot, 'merge')
    assert.equal(merged.skippedDuplicates, 3)
    assert.equal(getTemplates().length, 1)
    assert.equal(getHistoryList('索引 2048')[0].source_app, 'snippingtool.exe')
    saveTemplate(null, 'Temporary', 'temporary')
    insertHistory('text', 'temporary-history', null)
    const second = readBackupFile(file, getHistoryImagesDir(), getStickersDir())
    const replaced = importBackupSnapshot(second.snapshot, 'replace')
    assert.equal(replaced.templateCount, 1); assert.equal(replaced.historyCount, 2)
    assert.equal(getTemplates().length, 1); assert.equal(getHistoryList().length, 2)
    assert.equal(getHistoryList('索引')[0].ocr_language, 'zh-Hans-CN')
    assert.equal(getSetting('excluded_apps'), '["keepass.exe"]')
    assert.ok(fs.existsSync(getHistoryList('索引')[0].image_path!))
    const before = getBackupSnapshot()
    assert.throws(() => importBackupSnapshot({ history: [], stickers: [], settings: {}, templates: [{ id: 0, title: '', body: '', created_at: '', updated_at: '' }] }, 'replace'), /invalid-template/)
    assert.deepEqual(getBackupSnapshot(), before, 'Invalid template import must roll back all DB changes')
    assert.equal(database.exec('PRAGMA quick_check')[0].values[0][0], 'ok')
    closeDatabase()
    console.log('Database integration passed: productivity migrations, merge/replace backup restore, source/OCR/template/settings retention, rollback and integrity.')
    app.exit(0)
  } catch (error) { console.error(error); app.exit(1) }
})
