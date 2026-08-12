import { useState } from 'react'
import type { StickerItem } from '../types'
import { useStore } from '../stores/useStore'
import Icon from './Icon'

interface StickerCardProps {
  sticker: StickerItem
  onCopy: (msg: string) => void
}

export default function StickerCard({ sticker, onCopy }: StickerCardProps) {
  const [showDelete, setShowDelete] = useState(false)
  const [copied, setCopied] = useState(false)
  const loadStickers = useStore((s) => s.loadStickers)

  const imageUrl = `local-asset://file/${encodeURIComponent(sticker.image_path)}`

  const handleSend = async () => {
    setCopied(true)
    const result = await window.api.sendSticker(sticker.id)
    onCopy(result.success ? '贴图已复制到剪贴板' : '贴图复制失败')
    setTimeout(() => setCopied(false), 800)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await window.api.deleteSticker(sticker.id)
    await loadStickers()
  }

  return (
    <div
      className={`sticker-card group relative ${copied ? 'ring-2 ring-green-400' : ''}`}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      onClick={handleSend}
    >
      <img
        src={imageUrl}
        alt={sticker.name || 'sticker'}
        className="w-full h-full object-cover"
        draggable={false}
        loading="lazy"
        decoding="async"
      />

      {/* Copy indicator overlay */}
      {copied && (
        <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center rounded-lg">
          <Icon name="check" size={20} className="text-white" strokeWidth={3} />
        </div>
      )}

      {/* Delete button */}
      {showDelete && !copied && (
        <button
          onClick={handleDelete}
          aria-label="删除贴图"
          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-md bg-black/60 text-white transition-colors hover:bg-red-600"
          title="删除贴图"
        >
          <Icon name="x" size={13} />
        </button>
      )}

      {/* Name label */}
      {sticker.name && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <p className="text-[10px] text-white text-center truncate">{sticker.name}</p>
        </div>
      )}
    </div>
  )
}
