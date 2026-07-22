import { useStore } from '../stores/useStore'
import StickerCard from './StickerCard'

interface StickerGridProps {
  onCopy: (msg: string) => void
}

export default function StickerGrid({ onCopy }: StickerGridProps) {
  const stickers = useStore((s) => s.stickers)
  const loadStickers = useStore((s) => s.loadStickers)

  const handleImport = async () => {
    await window.api.importStickers()
    await loadStickers()
  }

  return (
    <div className="p-4">
      <button
        onClick={handleImport}
        className="no-drag w-full mb-4 py-3 px-4 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:border-primary-400 dark:hover:border-primary-600 transition-all text-sm font-medium"
      >
        + 导入贴图
      </button>

      {stickers.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 py-16">
          <span className="text-5xl mb-3">🖼️</span>
          <p className="text-sm">还没有贴图</p>
          <p className="text-xs mt-1">点击上方按钮从本地导入图片</p>
        </div>
      ) : (
        <div className="sticker-grid">
          {stickers.map((sticker) => (
            <StickerCard key={sticker.id} sticker={sticker} onCopy={onCopy} />
          ))}
        </div>
      )}
    </div>
  )
}
