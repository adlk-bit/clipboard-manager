import { useStore } from '../stores/useStore'
import type { PageView } from '../types'

const navItems: { id: PageView; label: string; icon: string }[] = [
  { id: 'all', label: '全部记录', icon: '📋' },
  { id: 'favorites', label: '收藏', icon: '⭐' },
  { id: 'stickers', label: '贴图库', icon: '🖼️' },
  { id: 'settings', label: '设置', icon: '⚙️' },
]

export default function Sidebar() {
  const currentPage = useStore((s) => s.currentPage)
  const setCurrentPage = useStore((s) => s.setCurrentPage)

  return (
    <div className="w-20 shrink-0 bg-white dark:bg-gray-900 border-r border-primary-100 dark:border-gray-700 flex flex-col items-center py-4 gap-2">
      {/* App icon */}
      <div className="w-10 h-10 rounded-xl bg-primary-400 flex items-center justify-center text-white text-lg font-bold mb-4 shadow-sm">
        C
      </div>

      {/* Nav items */}
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setCurrentPage(item.id)}
          className={`no-drag flex flex-col items-center gap-0.5 w-16 py-2 rounded-xl transition-colors ${
            currentPage === item.id
              ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
              : 'text-gray-500 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400'
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  )
}
