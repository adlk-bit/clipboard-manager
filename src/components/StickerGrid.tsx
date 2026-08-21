import { useStore } from '../stores/useStore'
import StickerCard from './StickerCard'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'

interface StickerGridProps {
  onCopy: (msg: string) => void
}

export default function StickerGrid({ onCopy }: StickerGridProps) {
  const { t } = useI18n()
  const stickers = useStore((s) => s.stickers)
  const loadStickers = useStore((s) => s.loadStickers)

  const handleImport = async () => {
    await window.api.importStickers()
    await loadStickers()
  }

  return (
    <div className="p-2.5">
      <button
        onClick={handleImport}
        className="no-drag mb-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary-300 bg-primary-50 px-3 text-xs font-medium text-primary-600 transition-colors hover:border-primary-400 hover:bg-primary-100 dark:border-primary-700 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:border-primary-600 dark:hover:bg-primary-900/30"
      >
        <Icon name="plus" size={14} />
        {t('stickers.import')}
      </button>

      {stickers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
            <Icon name="image" size={20} />
          </div>
          <p className="text-xs font-medium">{t('stickers.empty')}</p>
          <p className="mt-1 text-[11px]">{t('stickers.emptyHint')}</p>
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
