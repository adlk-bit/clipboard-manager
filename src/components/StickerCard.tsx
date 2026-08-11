import { useState } from 'react'
import type { StickerItem } from '../types'
import { useStore } from '../stores/useStore'

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
      className={`sticker-card relative group ${copied ? 'ring-2 ring-green-400 scale-95' : ''}`}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      onClick={handleSend}
    >
      <img
        src={imageUrl}
        alt={sticker.name || 'sticker'}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Copy indicator overlay */}
      {copied && (
        <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center rounded-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Delete button */}
      {showDelete && !copied && (
        <button
          onClick={handleDelete}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
          title="删除贴图"
        >
          ✕
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
