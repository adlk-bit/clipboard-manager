import { useState } from 'react'
import type { HistoryItem } from '../types'
import { useStore } from '../stores/useStore'

interface HistoryCardProps {
  item: HistoryItem
  onCopy: (msg: string) => void
}

export default function HistoryCard({ item, onCopy }: HistoryCardProps) {
  const [copied, setCopied] = useState(false)
  const loadHistory = useStore((s) => s.loadHistory)
  const searchQuery = useStore((s) => s.searchQuery)
  const currentPage = useStore((s) => s.currentPage)
  const setConfirmDeleteId = useStore((s) => s.setConfirmDeleteId)

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

  const handleDelete = async () => {
    await window.api.deleteHistory(item.id)
    await loadHistory(searchQuery, filter)
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

  return (
    <div className="history-card">
      <div
        className={`no-drag group relative rounded-xl border p-3 transition-all ${
          item.is_pinned
            ? 'border-primary-300 bg-primary-50 shadow-sm'
            : 'border-gray-100 bg-white hover:border-primary-200'
        }`}
      >
        {/* Content area */}
        <div className="min-w-0 pr-8">
          {item.type === 'text' ? (
            <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap break-words select-text">
              {item.content}
            </p>
          ) : item.image_path ? (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                <img
                  src={imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>
              <div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">图片</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">[图片已丢失]</p>
          )}
        </div>

        {/* Copy button - always visible */}
        <button
          onClick={handleCopy}
          className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${
            copied
              ? 'bg-green-100 text-green-600 scale-110'
              : 'bg-gray-50 text-gray-400 hover:bg-primary-100 hover:text-primary-600'
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

        {/* Meta bar */}
        <div className="flex items-center justify-between mt-2 gap-2">
          <span className="text-[10px] text-gray-400 shrink-0">{timeStr}</span>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleTogglePin}
              className={`p-1 rounded-md text-xs transition-colors ${
                item.is_pinned ? 'text-primary-500 bg-primary-100' : 'text-gray-400 hover:text-primary-500 hover:bg-primary-50'
              }`}
              title={item.is_pinned ? '取消置顶' : '置顶'}
            >
              📌
            </button>

            <button
              onClick={handleToggleFavorite}
              className={`p-1 rounded-md text-xs transition-colors ${
                item.is_favorite ? 'text-yellow-500 bg-yellow-50' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
              }`}
              title={item.is_favorite ? '取消收藏' : '收藏'}
            >
              ⭐
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.id) }}
              className="p-1 rounded-md text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="删除"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Pinned indicator */}
        {item.is_pinned === 1 && (
          <div className="absolute top-2 left-2">
            <span className="text-[10px] text-primary-400">📌 置顶</span>
          </div>
        )}
      </div>
    </div>
  )
}

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
