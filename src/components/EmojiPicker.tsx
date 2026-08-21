import { useEffect, useMemo, useRef, useState } from 'react'
import { emojiByValue, emojiCategories, type EmojiItem } from '../data/emojis'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'

const RECENT_EMOJI_KEY = 'clipboard-manager:recent-emojis'
const MAX_RECENT_EMOJIS = 24

interface EmojiPickerProps {
  onCopy: (message: string, type?: 'success' | 'info') => void
}

function loadRecentEmojis(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_EMOJI_KEY) || '[]')
    if (!Array.isArray(stored)) return []
    return stored.filter((value): value is string => typeof value === 'string' && emojiByValue.has(value)).slice(0, MAX_RECENT_EMOJIS)
  } catch {
    return []
  }
}

export default function EmojiPicker({ onCopy }: EmojiPickerProps) {
  const { language, locale, t } = useI18n()
  const [selectedCategory, setSelectedCategory] = useState(emojiCategories[0].id)
  const [query, setQuery] = useState('')
  const [recentEmojis, setRecentEmojis] = useState(loadRecentEmojis)
  const [copiedEmoji, setCopiedEmoji] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
  }, [])

  const visibleEmojis = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale)
    if (normalizedQuery) {
      return emojiCategories.flatMap((category) => category.items.filter((item) => (
        `${item.emoji} ${item.name} ${item.keywords} ${category.label}`
          .toLocaleLowerCase(locale)
          .includes(normalizedQuery)
      )))
    }

    if (selectedCategory === 'recent') {
      return recentEmojis.map((emoji) => emojiByValue.get(emoji)).filter((item): item is EmojiItem => Boolean(item))
    }

    return emojiCategories.find((category) => category.id === selectedCategory)?.items || []
  }, [locale, query, recentEmojis, selectedCategory])

  const handleSend = async (item: EmojiItem) => {
    const result = await window.api.sendEmoji(item.emoji)
    if (!result.success) {
      onCopy(t('emoji.copyFailed'), 'info')
      return
    }

    const nextRecent = [item.emoji, ...recentEmojis.filter((emoji) => emoji !== item.emoji)].slice(0, MAX_RECENT_EMOJIS)
    setRecentEmojis(nextRecent)
    localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(nextRecent))
    setCopiedEmoji(item.emoji)
    onCopy(t('emoji.copied', { emoji: item.emoji }))

    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopiedEmoji(null), 700)
  }

  return (
    <div className="flex min-h-full flex-col p-2.5">
      <div className="relative mb-2.5">
        <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7a7a80] dark:text-[#929298]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('emoji.search')}
          aria-label={t('emoji.search')}
          className="h-8 w-full rounded-lg border border-[#d9d9de] bg-white py-1 pl-8 pr-8 text-xs text-[#242428] outline-none transition-colors placeholder:text-[#8a8a90] focus:border-[#3d91df] dark:border-white/10 dark:bg-white/[0.07] dark:text-[#f5f5f7] dark:placeholder:text-[#8f8f95]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('emoji.clear')}
            className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-[#77777d] hover:bg-black/[0.06] dark:text-[#a0a0a6] dark:hover:bg-white/[0.08]"
          >
            <Icon name="x" size={12} />
          </button>
        )}
      </div>

      <div className="mb-2.5 flex gap-1 overflow-x-auto pb-0.5" aria-label={t('emoji.categories')}>
        {recentEmojis.length > 0 && (
          <button
            type="button"
            onClick={() => { setSelectedCategory('recent'); setQuery('') }}
            aria-label={t('emoji.recent')}
            title={t('emoji.recent')}
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-base transition-colors ${
              !query && selectedCategory === 'recent'
                ? 'bg-[#dceeff] shadow-sm ring-1 ring-[#b7d9f8] dark:bg-[#0a4a7c] dark:ring-[#23699d]'
                : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07]'
            }`}
          >
            🕘
          </button>
        )}
        {emojiCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => { setSelectedCategory(category.id); setQuery('') }}
            aria-label={t(`emoji.category.${category.id}`)}
            title={t(`emoji.category.${category.id}`)}
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-base transition-colors ${
              !query && selectedCategory === category.id
                ? 'bg-[#dceeff] shadow-sm ring-1 ring-[#b7d9f8] dark:bg-[#0a4a7c] dark:ring-[#23699d]'
                : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07]'
            }`}
          >
            {category.icon}
          </button>
        ))}
      </div>

      {visibleEmojis.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(38px,1fr))] gap-1">
          {visibleEmojis.map((item) => (
            <button
              key={item.emoji}
              type="button"
              onClick={() => handleSend(item)}
              aria-label={language === 'en' ? getEnglishEmojiName(item) : item.name}
              title={language === 'en' ? getEnglishEmojiName(item) : item.name}
              className={`relative flex aspect-square min-h-9 items-center justify-center rounded-lg text-[22px] leading-none transition-[background-color,transform,box-shadow] duration-100 hover:bg-black/[0.055] active:scale-90 dark:hover:bg-white/[0.08] ${
                copiedEmoji === item.emoji
                  ? 'bg-[#dcf5df] shadow-[inset_0_0_0_1px_rgba(52,150,63,0.35)] dark:bg-[#174a25]'
                  : ''
              }`}
            >
              {item.emoji}
              {copiedEmoji === item.emoji && (
                <span className="absolute right-0.5 top-0.5 flex size-3.5 items-center justify-center rounded-full bg-[#2f9e44] text-white">
                  <Icon name="check" size={9} strokeWidth={2.8} />
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-[#8a8a90] dark:text-[#8f8f95]">
          <Icon name="search" size={20} />
          <p className="mt-2 text-xs font-medium">{t('emoji.notFound')}</p>
        </div>
      )}
    </div>
  )
}

function getEnglishEmojiName(item: EmojiItem): string {
  const englishWords = item.keywords.split(/\s+/).filter((word) => /^[a-z]/i.test(word))
  return englishWords.join(' ') || item.emoji
}
