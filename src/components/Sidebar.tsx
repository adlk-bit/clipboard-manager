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
    <aside className="app-sidebar w-[76px] shrink-0 bg-white/[0.72] dark:bg-[#2c2c2e]/[0.82] border-r border-white/70 dark:border-white/10 flex flex-col items-center py-4 gap-2 backdrop-blur-xl">
      {/* App icon */}
      <div className="w-10 h-10 rounded-[13px] bg-gradient-to-br from-[#0a84ff] to-[#0071e3] flex items-center justify-center text-white text-[17px] font-semibold mb-4 shadow-[0_5px_12px_rgba(0,113,227,0.28)]">
        C
      </div>

      {/* Nav items */}
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setCurrentPage(item.id)}
          className={`no-drag flex flex-col items-center gap-0.5 w-[60px] py-2 rounded-[12px] transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${
            currentPage === item.id
              ? 'bg-white/90 dark:bg-white/[0.12] text-[#007aff] dark:text-[#0a84ff] shadow-[0_1px_2px_rgba(60,60,67,0.08)]'
              : 'text-[#636366] dark:text-[#98989d] hover:bg-white/[0.65] dark:hover:bg-white/[0.08] hover:text-[#007aff] dark:hover:text-[#0a84ff]'
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </aside>
  )
}
