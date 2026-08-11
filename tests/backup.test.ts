import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { readBackupFile, removePreparedFiles, writePortableBackup, type BackupSnapshot } from '../electron/main/backup'

function makeWorkspace(): { root: string; images: string; stickers: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clipboard-manager-backup-test-'))
  const images = path.join(root, 'images')
  const stickers = path.join(root, 'stickers')
  fs.mkdirSync(images)
  fs.mkdirSync(stickers)
  return { root, images, stickers }
}

test('portable backup round-trips text, images, stickers, metadata and settings', () => {
  const workspace = makeWorkspace()
  try {
    const sourceImage = path.join(workspace.root, 'source.png')
    const sourceSticker = path.join(workspace.root, 'sticker.webp')
    fs.writeFileSync(sourceImage, Buffer.from('fake-png-history'))
    fs.writeFileSync(sourceSticker, Buffer.from('fake-webp-sticker'))

    const snapshot: BackupSnapshot = {
      history: [
        {
          type: 'text', content: 'hello', image_path: null, is_pinned: 1, is_favorite: 1,
          created_at: '2026-01-01T00:00:00.000Z', favorite_folder: 'Work', favorite_tags: 'reply,email',
          favorite_sort_order: -2, use_count: 7, last_used_at: '2026-01-02T00:00:00.000Z', content_hash: '',
        },
        {
          type: 'image', content: null, image_path: sourceImage, is_pinned: 0, is_favorite: 0,
          created_at: '2026-01-03T00:00:00.000Z', favorite_folder: '', favorite_tags: '',
          favorite_sort_order: 0, use_count: 2, last_used_at: '2026-01-04T00:00:00.000Z', content_hash: '',
        },
      ],
      stickers: [{ name: 'wave', image_path: sourceSticker, created_at: '2026-01-05T00:00:00.000Z' }],
      settings: { retention_days: '5', dark_mode: 'true', max_history_items: '500' },
    }

    const backupPath = path.join(workspace.root, 'sample.clipbackup')
    const exported = writePortableBackup(backupPath, snapshot, '1.0.5')
    assert.deepEqual(
      { historyCount: exported.historyCount, stickerCount: exported.stickerCount, skippedFiles: exported.skippedFiles },
      { historyCount: 2, stickerCount: 1, skippedFiles: 0 }
    )

    const restored = readBackupFile(backupPath, workspace.images, workspace.stickers)
    assert.equal(restored.source, 'portable')
    assert.equal(restored.skippedItems, 0)
    assert.equal(restored.snapshot.history.length, 2)
    assert.equal(restored.snapshot.history[0].favorite_folder, 'Work')
    assert.equal(restored.snapshot.history[0].favorite_tags, 'reply,email')
    assert.equal(restored.snapshot.history[0].use_count, 7)
    assert.equal(restored.snapshot.settings.dark_mode, 'true')
    assert.ok(restored.snapshot.history[1].image_path)
    assert.ok(fs.existsSync(restored.snapshot.history[1].image_path!))
    assert.equal(restored.snapshot.stickers[0].name, 'wave')
    assert.ok(fs.existsSync(restored.snapshot.stickers[0].image_path))
    removePreparedFiles(restored.createdFiles)
  } finally {
    fs.rmSync(workspace.root, { recursive: true, force: true })
  }
})

test('legacy JSON import copies valid images and preserves available metadata', () => {
  const workspace = makeWorkspace()
  try {
    const sourceImage = path.join(workspace.root, 'legacy.png')
    fs.writeFileSync(sourceImage, Buffer.from('legacy-image'))
    const legacyPath = path.join(workspace.root, 'legacy.json')
    fs.writeFileSync(legacyPath, JSON.stringify([
      {
        type: 'image', image_path: sourceImage, is_pinned: 1, is_favorite: 1,
        created_at: '2026-02-01T00:00:00.000Z', favorite_folder: 'Legacy', favorite_tags: 'old', use_count: 3,
      },
      { type: 'text', content: 'legacy text', created_at: '2026-02-02T00:00:00.000Z' },
    ]))

    const restored = readBackupFile(legacyPath, workspace.images, workspace.stickers)
    assert.equal(restored.source, 'legacy-json')
    assert.equal(restored.snapshot.history.length, 2)
    assert.equal(restored.snapshot.history[0].favorite_folder, 'Legacy')
    assert.ok(restored.snapshot.history[0].image_path?.startsWith(workspace.images))
    assert.equal(restored.snapshot.history[1].content, 'legacy text')
    removePreparedFiles(restored.createdFiles)
  } finally {
    fs.rmSync(workspace.root, { recursive: true, force: true })
  }
})
