import { useStore } from '../stores/useStore'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'

export default function SearchBar() {
  const { t } = useI18n()
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearchQuery = useStore((s) => s.setSearchQuery)

  return (
    <div className="relative">
      <Icon name="search" size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#8a8a90]" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        className="no-drag h-7 w-36 rounded-md border border-[#d8d8dd] bg-white pl-7 pr-7 text-xs text-[#333338] placeholder-[#929298] outline-none transition-colors focus:border-[#1683d8] dark:border-white/10 dark:bg-white/[0.07] dark:text-[#f2f2f4] dark:focus:border-[#53a9ff]"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          type="button"
          aria-label={t('search.clear')}
          title={t('search.clear')}
          className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-[#8a8a90] hover:bg-black/[0.06] hover:text-[#3a3a3c] dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  )
}
