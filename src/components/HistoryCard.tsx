import { useState, memo } from 'react'
import type { HistoryItem } from '../types'
import { useStore } from '../stores/useStore'

interface HistoryCardProps {
  item: HistoryItem
  onCopy: (msg: string) => void
}

const HistoryCard = memo(function HistoryCard({ item, onCopy }: HistoryCardProps) {
  const [copied, setCopied] = useState(false)
  const loadHistory = useStore((s) => s.loadHistory)
  const searchQuery = useStore((s) => s.searchQuery)
  const currentPage = useStore((s) => s.currentPage)
  const setConfirmDeleteId = useStore((s) => s.setConfirmDeleteId)
  const selectionMode = useStore((s) => s.selectionMode)
  const selectedIds = useStore((s) => s.selectedIds)
  const toggleSelectId = useStore((s) => s.toggleSelectId)

  const isSelected = selectedIds.has(item.id)
  const filter = currentPage === 'favorites' ? 'favorites' : 'all'
  const timeStr = formatTime(item.created_at)
  const imageUrl = item.image_path
    ? `local-asset://file/${encodeURIComponent(item.image_path)}`
    : ''

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setCopied(true)
    await window.api.copyToClipboard(item)
    const label = item.type === 'text'
      ? (item.content?.slice(0, 20) + (item.content && item.content.length > 20 ? '...' : '')) || '文字'
      : '图片'
    onCopy(`已复制: ${label}`)
    setTimeout(() => setCopied(false), 800)
  }

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await window.api.togglePin(item.id)
    await loadHistory(searchQuery, filter)
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await window.api.toggleFavorite(item.id)
    await loadHistory(searchQuery, filter)
  }

  const handleClick = () => {
    if (selectionMode) {
      toggleSelectId(item.id)
    }
  }

  return (
    <div className="history-card">
      <div
        onClick={handleClick}
        className={`no-drag group relative rounded-xl border p-3 transition-all ${
          isSelected
            ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-300 dark:ring-primary-600 shadow-md'
            : item.is_pinned
            ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-gray-800 shadow-sm'
            : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-200 dark:hover:border-gray-600'
        } ${selectionMode ? 'cursor-pointer' : ''}`}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <div className="absolute top-2 left-2 z-10">
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-primary-500 border-primary-500'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
              }`}
            >
              {isSelected && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Content area */}
        <div className={`min-w-0 pr-8 ${selectionMode ? 'ml-7' : ''}`}>
          {item.type === 'text' ? (
            <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-3 whitespace-pre-wrap break-words select-text">
              {item.content}
            </p>
          ) : item.image_path ? (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0 border border-gray-200 dark:border-gray-600">
                <img
                  src={imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">图片</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">[图片已丢失]</p>
          )}
        </div>

        {/* Copy button - always visible (hidden in selection mode) */}
        {!selectionMode && (
          <button
            onClick={handleCopy}
            className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${
              copied
                ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 scale-110'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400'
            }`}
            title="复制到剪贴板"
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        )}

        {/* Meta bar */}
        <div className="flex items-center justify-between mt-2 gap-2">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">{timeStr}</span>

          {!selectionMode && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleTogglePin}
                className={`p-1 rounded-md text-xs transition-colors ${
                  item.is_pinned ? 'text-primary-500 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30' : 'text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                }`}
                title={item.is_pinned ? '取消置顶' : '置顶'}
              >
                📌
              </button>

              <button
                onClick={handleToggleFavorite}
                className={`p-1 rounded-md text-xs transition-colors ${
                  item.is_favorite ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/10'
                }`}
                title={item.is_favorite ? '取消收藏' : '收藏'}
              >
                ⭐
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.id) }}
                className="p-1 rounded-md text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="删除"
              >
                🗑️
              </button>
            </div>
          )}
        </div>

        {/* Pinned indicator */}
        {item.is_pinned === 1 && !selectionMode && (
          <div className="absolute top-2 left-2">
            <span className="text-[10px] text-primary-400 dark:text-primary-500">📌 置顶</span>
          </div>
        )}
      </div>
    </div>
  )
})

export default HistoryCard

function formatTime(dateStr: string): string {
  const date = new Date(dateStr + 'Z')
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHour < 24) return `${diffHour} 小时前`
  if (diffDay < 7) return `${diffDay} 天前`

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}
