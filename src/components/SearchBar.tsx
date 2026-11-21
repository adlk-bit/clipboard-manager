import { useStore } from '../stores/useStore'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'

export default function SearchBar() {
  const { t } = useI18n()
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearchQuery = useStore((s) => s.setSearchQuery)

  return (
    <div className="history-search no-drag relative">
      <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a8a90]" />
      <input
        id="history-search"
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        title={t('search.hint')}
        maxLength={500}
        autoComplete="off"
        spellCheck={false}
        className="w-full"
      />
      {!searchQuery && <kbd aria-hidden="true">Ctrl+F</kbd>}
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
