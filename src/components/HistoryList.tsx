import { useStore } from '../stores/useStore'
import HistoryCard from './HistoryCard'

interface HistoryListProps {
  onCopy: (msg: string) => void
}

export default function HistoryList({ onCopy }: HistoryListProps) {
  const historyItems = useStore((s) => s.historyItems)
  const setConfirmClearAll = useStore((s) => s.setConfirmClearAll)
  const currentPage = useStore((s) => s.currentPage)
  const searchQuery = useStore((s) => s.searchQuery)

  if (historyItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
        <span className="text-4xl mb-3">
          {currentPage === 'favorites' ? '⭐' : '📋'}
        </span>
        <p className="text-sm">
          {searchQuery
            ? '没有匹配的记录'
            : currentPage === 'favorites'
            ? '还没有收藏任何记录'
            : '还没有复制记录，试试复制一些内容吧'}
        </p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      {historyItems.map((item) => (
        <HistoryCard key={item.id} item={item} onCopy={onCopy} />
      ))}

      <div className="pt-2 text-center">
        <button
          onClick={() => setConfirmClearAll(true)}
          className="no-drag text-xs text-gray-400 hover:text-red-400 transition-colors py-2 px-4"
        >
          清空全部记录
        </button>
      </div>
    </div>
  )
}
