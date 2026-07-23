import { useEffect, useRef, useState, memo } from 'react'
import type { HistoryItem } from '../types'
import { useStore } from '../stores/useStore'
import { normalizeHttpUrl } from '../../shared/url'

interface HistoryCardProps {
  item: HistoryItem
  onCopy: (msg: string) => void
}

const HistoryCard = memo(function HistoryCard({ item, onCopy }: HistoryCardProps) {
  const [copied, setCopied] = useState(false)
  const [editingFavorite, setEditingFavorite] = useState(false)
  const [choosingFolder, setChoosingFolder] = useState(false)
  const [folder, setFolder] = useState(item.favorite_folder || '')
  const [tags, setTags] = useState(item.favorite_tags || '')
  const cardRef = useRef<HTMLDivElement>(null)
  const loadHistory = useStore((s) => s.loadHistory)
  const searchQuery = useStore((s) => s.searchQuery)
  const currentPage = useStore((s) => s.currentPage)
  const setConfirmDeleteId = useStore((s) => s.setConfirmDeleteId)
  const selectionMode = useStore((s) => s.selectionMode)
  const selectedIds = useStore((s) => s.selectedIds)
  const toggleSelectId = useStore((s) => s.toggleSelectId)
  const favoriteFolders = useStore((s) => s.favoriteFolders)
  const keyboardActiveId = useStore((s) => s.keyboardActiveId)

  const isSelected = selectedIds.has(item.id)
  const isKeyboardActive = keyboardActiveId === item.id
  const filter = currentPage === 'favorites' ? 'favorites' : 'all'
  const timeStr = formatTime(item.created_at)
  const imageUrl = item.image_path
    ? `local-asset://file/${encodeURIComponent(item.image_path)}`
    : ''
  const openableUrl = item.type === 'text' && item.content
    ? normalizeHttpUrl(item.content)
    : null

  useEffect(() => {
    if (isKeyboardActive) {
      cardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    }
  }, [isKeyboardActive])

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

  const handleOpenUrl = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!openableUrl) return

    const result = await window.api.openExternalUrl(openableUrl)
    if (!result.success) {
      console.error('Failed to open URL:', result.error)
      onCopy('链接打开失败')
    }
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await window.api.toggleFavorite(item.id)
    await loadHistory(searchQuery, filter)
  }

  const refreshFavorites = async () => {
    await loadHistory(searchQuery, filter)
    if (currentPage === 'favorites') await useStore.getState().loadFavoriteFolders()
  }

  const handleSaveFavoriteMetadata = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await window.api.updateFavoriteMetadata(item.id, folder, tags)
    setEditingFavorite(false)
    await refreshFavorites()
  }

  const handleMoveFavorite = async (e: React.MouseEvent, direction: 'up' | 'down') => {
    e.stopPropagation()
    await window.api.moveFavorite(item.id, direction)
    await refreshFavorites()
  }

  const handleAssignFolder = async (e: React.MouseEvent, nextFolder: string) => {
    e.stopPropagation()
    await window.api.updateFavoriteMetadata(item.id, nextFolder, item.favorite_tags || '')
    setFolder(nextFolder)
    setChoosingFolder(false)
    await refreshFavorites()
  }

  const handleClick = () => {
    if (selectionMode) {
      toggleSelectId(item.id)
    }
  }

  return (
    <div ref={cardRef} className="history-card">
      <div
        onClick={handleClick}
        className={`no-drag group relative rounded-[14px] border p-3.5 transition-[border-color,background-color,box-shadow] duration-150 ${
          isSelected
            ? 'border-[#0a84ff] bg-[#eef7ff] dark:bg-[#0a84ff]/15 ring-2 ring-[#0a84ff]/25 dark:ring-[#0a84ff]/35 shadow-[0_4px_12px_rgba(10,132,255,0.12)]'
            : isKeyboardActive
            ? 'border-[#0a84ff] bg-[#eef7ff] dark:bg-[#0a84ff]/15 ring-2 ring-[#0a84ff]/25 dark:ring-[#0a84ff]/35 shadow-[0_4px_12px_rgba(10,132,255,0.12)]'
            : item.is_pinned
            ? 'border-[#b9dcff] dark:border-[#0a84ff]/35 bg-[#f4faff] dark:bg-[#2c2c2e] shadow-[0_1px_2px_rgba(60,60,67,0.08)]'
            : 'border-white/80 dark:border-white/10 bg-white/88 dark:bg-[#2c2c2e] shadow-[0_1px_2px_rgba(60,60,67,0.08)] hover:border-[#c6e2ff] dark:hover:border-white/18 hover:shadow-[0_5px_14px_rgba(60,60,67,0.1)]'
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
            <p className="text-sm leading-5 text-[#3a3a3c] dark:text-[#e5e5ea] line-clamp-3 whitespace-pre-wrap break-words select-text">
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

          {currentPage === 'favorites' && item.type === 'text' && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.favorite_folder && <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">{item.favorite_folder}</span>}
              {item.favorite_tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-300">#{tag}</span>
              ))}
            </div>
          )}
        </div>

        {currentPage === 'favorites' && editingFavorite && !selectionMode && (
          <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-700/50" onClick={(e) => e.stopPropagation()}>
            <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="文件夹，例如：工作" className="no-drag w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary-400 dark:border-gray-600 dark:bg-gray-700" />
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签，用逗号分隔" className="no-drag w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary-400 dark:border-gray-600 dark:bg-gray-700" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingFavorite(false)} className="no-drag text-xs text-gray-500">取消</button>
              <button onClick={handleSaveFavoriteMetadata} className="no-drag rounded bg-primary-500 px-2 py-1 text-xs text-white">保存</button>
            </div>
          </div>
        )}

        {currentPage === 'favorites' && choosingFolder && !selectionMode && (
          <div className="mt-3 rounded-lg bg-gray-50 p-2 dark:bg-gray-700/50" onClick={(e) => e.stopPropagation()}>
            <p className="mb-1.5 text-[10px] text-gray-500 dark:text-gray-400">选择已有文件夹</p>
            {favoriteFolders.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {favoriteFolders.map((favoriteFolder) => (
                  <button key={favoriteFolder} onClick={(e) => handleAssignFolder(e, favoriteFolder)} className={`no-drag rounded px-2 py-1 text-xs transition-colors ${item.favorite_folder === favoriteFolder ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-primary-50 hover:text-primary-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-primary-900/30'}`}>
                    {favoriteFolder}
                  </button>
                ))}
                {item.favorite_folder && <button onClick={(e) => handleAssignFolder(e, '')} className="no-drag rounded px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-500 dark:text-gray-300">移出文件夹</button>}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">还没有文件夹，请先通过标签按钮创建一个。</p>
            )}
          </div>
        )}

        {/* Copy button - always visible (hidden in selection mode) */}
        {!selectionMode && (
          <button
            onClick={handleCopy}
            className={`absolute top-2.5 right-2.5 p-1.5 rounded-[9px] transition-[background-color,color,transform] duration-150 active:scale-95 ${
              copied
                ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 scale-110'
                : 'bg-[#f2f2f7] dark:bg-white/10 text-[#8e8e93] dark:text-[#98989d] hover:bg-[#e8f3ff] dark:hover:bg-[#0a84ff]/20 hover:text-[#007aff] dark:hover:text-[#0a84ff]'
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
        <div className="flex items-center justify-between mt-2.5 gap-2">
          <span className="text-[10px] tracking-[0.01em] text-[#8e8e93] dark:text-[#98989d] shrink-0">{timeStr}</span>

          {!selectionMode && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {openableUrl && (
                <button
                  onClick={handleOpenUrl}
                  className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  title="在浏览器中打开链接"
                  aria-label="在浏览器中打开链接"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.07.07l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.07-.07l-3 3A5 5 0 0 0 11 21l1.71-1.71" />
                  </svg>
                </button>
              )}
              {currentPage === 'favorites' && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setEditingFavorite(!editingFavorite) }} className="p-1 rounded-md text-xs text-gray-400 hover:bg-primary-50 hover:text-primary-500" title="编辑文件夹和标签">🏷️</button>
                  <button onClick={(e) => { e.stopPropagation(); setChoosingFolder(!choosingFolder) }} className="p-1 rounded-md text-xs text-gray-400 hover:bg-primary-50 hover:text-primary-500" title="归入已有文件夹">📁</button>
                  <button onClick={(e) => handleMoveFavorite(e, 'up')} className="p-1 rounded-md text-xs text-gray-400 hover:bg-primary-50 hover:text-primary-500" title="上移">↑</button>
                  <button onClick={(e) => handleMoveFavorite(e, 'down')} className="p-1 rounded-md text-xs text-gray-400 hover:bg-primary-50 hover:text-primary-500" title="下移">↓</button>
                </>
              )}
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
