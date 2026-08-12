import { useEffect, useRef, useState, memo } from 'react'
import type { HistoryItem } from '../types'
import { useStore } from '../stores/useStore'
import { normalizeHttpUrl } from '../../shared/url'
import Icon from './Icon'

interface HistoryCardProps {
  item: HistoryItem
  onCopy: (msg: string) => void
  onEdit: (item: HistoryItem) => void
}

const actionButtonClass = 'flex size-6 items-center justify-center rounded text-[#8a8a90] transition-colors hover:bg-black/[0.05] hover:text-[#3a3a3c] focus-visible:opacity-100 dark:text-[#96969c] dark:hover:bg-white/[0.08] dark:hover:text-white'

const HistoryCard = memo(function HistoryCard({ item, onCopy, onEdit }: HistoryCardProps) {
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
    const result = await window.api.copyToClipboard(item.id)
    if (!result.success) {
      setCopied(false)
      onCopy('复制失败')
      return
    }
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
        className={`no-drag group relative rounded-lg border px-2.5 py-2 transition-colors duration-100 ${
          isSelected
            ? 'border-[#1683d8] bg-[#edf6ff] ring-1 ring-[#1683d8]/20 dark:bg-[#0a84ff]/[0.12] dark:ring-[#0a84ff]/25'
            : isKeyboardActive
            ? 'border-[#1683d8] bg-[#edf6ff] ring-1 ring-[#1683d8]/20 dark:bg-[#0a84ff]/[0.12] dark:ring-[#0a84ff]/25'
            : item.is_pinned
            ? 'border-[#bad9f4] bg-[#f5faff] dark:border-[#0a84ff]/30 dark:bg-[#28282b]'
            : 'border-[#e2e2e6] bg-white hover:border-[#b9d8f3] dark:border-white/[0.08] dark:bg-[#28282b] dark:hover:border-white/[0.16]'
        } ${selectionMode ? 'cursor-pointer' : ''}`}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <div className="absolute left-2 top-2 z-10">
            <div
              className={`flex size-4 items-center justify-center rounded border transition-colors ${
                isSelected
                  ? 'border-primary-500 bg-primary-500'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
              }`}
            >
              {isSelected && (
                <Icon name="check" size={11} className="text-white" strokeWidth={3} />
              )}
            </div>
          </div>
        )}

        {/* Content area */}
        <div className={`min-w-0 ${item.type === 'text' && item.content ? 'pr-16' : 'pr-7'} ${selectionMode ? 'ml-6' : ''}`}>
          {item.type === 'text' ? (
            <p className="line-clamp-2 select-text whitespace-pre-wrap break-words text-[13px] leading-[18px] text-[#3a3a3c] dark:text-[#e5e5ea]">
              {item.content}
            </p>
          ) : item.image_path ? (
            <div className="flex items-center gap-2.5">
              <div className="size-11 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700">
                <img
                  src={imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">图片</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">[图片已丢失]</p>
          )}

          {currentPage === 'favorites' && item.type === 'text' && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {item.favorite_folder && <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">{item.favorite_folder}</span>}
              {item.favorite_tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-300">#{tag}</span>
              ))}
            </div>
          )}

          {currentPage === 'all' && item.use_count > 1 && (
            <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
              已使用 {item.use_count} 次
            </div>
          )}
        </div>

        {currentPage === 'favorites' && editingFavorite && !selectionMode && (
          <div className="mt-2 space-y-1.5 rounded-md bg-gray-50 p-2 dark:bg-gray-700/50" onClick={(e) => e.stopPropagation()}>
            <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="文件夹，例如：工作" className="no-drag w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary-400 dark:border-gray-600 dark:bg-gray-700" />
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签，用逗号分隔" className="no-drag w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary-400 dark:border-gray-600 dark:bg-gray-700" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingFavorite(false)} className="no-drag text-xs text-gray-500">取消</button>
              <button onClick={handleSaveFavoriteMetadata} className="no-drag rounded bg-primary-500 px-2 py-1 text-xs text-white">保存</button>
            </div>
          </div>
        )}

        {currentPage === 'favorites' && choosingFolder && !selectionMode && (
          <div className="mt-2 rounded-md bg-gray-50 p-2 dark:bg-gray-700/50" onClick={(e) => e.stopPropagation()}>
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

        {/* Primary actions - always visible (hidden in selection mode) */}
        {!selectionMode && (
          <div className="absolute right-2 top-2 flex items-center gap-1">
            {item.type === 'text' && item.content && (
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); onEdit(item) }}
                aria-label="编辑后复制"
                title="编辑后复制"
                className="flex size-7 items-center justify-center rounded-md bg-[#f1f1f3] text-[#77777d] transition-colors duration-100 hover:bg-[#e4f1fc] hover:text-[#006bd6] dark:bg-white/[0.07] dark:text-[#aaaab0] dark:hover:bg-[#0a84ff]/20 dark:hover:text-[#53a9ff]"
              >
                <Icon name="edit" size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              aria-label="复制到剪贴板"
              className={`flex size-7 items-center justify-center rounded-md transition-colors duration-100 ${
                copied
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                  : 'bg-[#f1f1f3] text-[#77777d] hover:bg-[#e4f1fc] hover:text-[#006bd6] dark:bg-white/[0.07] dark:text-[#aaaab0] dark:hover:bg-[#0a84ff]/20 dark:hover:text-[#53a9ff]'
              }`}
              title="复制到剪贴板"
            >
              <Icon name={copied ? 'check' : 'copy'} size={14} strokeWidth={copied ? 2.5 : 1.8} />
            </button>
          </div>
        )}

        {/* Meta bar */}
        <div className="mt-1.5 flex min-h-6 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {item.is_pinned === 1 && !selectionMode && (
              <span className="flex items-center gap-0.5 text-[10px] text-primary-500 dark:text-primary-400">
                <Icon name="pin" size={11} />
                置顶
              </span>
            )}
            <span className="shrink-0 text-[10px] tracking-[0.01em] text-[#8e8e93] dark:text-[#98989d]">{timeStr}</span>
          </div>

          {!selectionMode && (
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {openableUrl && (
                <button
                  onClick={handleOpenUrl}
                  className={actionButtonClass}
                  title="在浏览器中打开链接"
                  aria-label="在浏览器中打开链接"
                >
                  <Icon name="link" size={14} />
                </button>
              )}
              {currentPage === 'favorites' && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setEditingFavorite(!editingFavorite) }} className={actionButtonClass} title="编辑文件夹和标签" aria-label="编辑文件夹和标签"><Icon name="tag" size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setChoosingFolder(!choosingFolder) }} className={actionButtonClass} title="归入已有文件夹" aria-label="归入已有文件夹"><Icon name="folder" size={14} /></button>
                  <button onClick={(e) => handleMoveFavorite(e, 'up')} className={actionButtonClass} title="上移" aria-label="上移"><Icon name="chevron-up" size={14} /></button>
                  <button onClick={(e) => handleMoveFavorite(e, 'down')} className={actionButtonClass} title="下移" aria-label="下移"><Icon name="chevron-down" size={14} /></button>
                </>
              )}
              <button
                onClick={handleTogglePin}
                aria-label={item.is_pinned ? '取消置顶' : '置顶'}
                className={`flex size-6 items-center justify-center rounded transition-colors ${
                  item.is_pinned ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : actionButtonClass
                }`}
                title={item.is_pinned ? '取消置顶' : '置顶'}
              >
                <Icon name="pin" size={14} />
              </button>

              <button
                onClick={handleToggleFavorite}
                aria-label={item.is_favorite ? '取消收藏' : '收藏'}
                className={`flex size-6 items-center justify-center rounded transition-colors ${
                  item.is_favorite ? 'bg-amber-50 text-amber-500 dark:bg-amber-900/20' : actionButtonClass
                }`}
                title={item.is_favorite ? '取消收藏' : '收藏'}
              >
                <Icon name="star" size={14} fill={item.is_favorite ? 'currentColor' : 'none'} />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.id) }}
                className={`${actionButtonClass} hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400`}
                title="删除"
                aria-label="删除"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          )}
        </div>

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
