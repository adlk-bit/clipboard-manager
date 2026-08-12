import { useStore } from '../stores/useStore'
import type { PageView } from '../types'
import Icon, { type IconName } from './Icon'

const navItems: { id: PageView; label: string; icon: IconName }[] = [
  { id: 'all', label: '全部记录', icon: 'clipboard' },
  { id: 'favorites', label: '收藏', icon: 'star' },
  { id: 'emoji', label: 'Emoji', icon: 'smile' },
  { id: 'stickers', label: '贴图库', icon: 'image' },
  { id: 'settings', label: '设置', icon: 'settings' },
]

export default function Sidebar() {
  const currentPage = useStore((s) => s.currentPage)
  const setCurrentPage = useStore((s) => s.setCurrentPage)

  return (
    <aside className="app-sidebar flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-[#dedee3] bg-[#f2f2f4] py-2 dark:border-white/10 dark:bg-[#232326]">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setCurrentPage(item.id)}
          aria-label={item.label}
          title={item.label}
          className={`no-drag relative flex size-10 items-center justify-center rounded-lg transition-colors duration-100 ${
            currentPage === item.id
              ? 'bg-white text-[#006bd6] shadow-sm dark:bg-white/10 dark:text-[#53a9ff]'
              : 'text-[#69696f] hover:bg-black/[0.045] hover:text-[#1d1d1f] dark:text-[#a6a6ab] dark:hover:bg-white/[0.07] dark:hover:text-white'
          }`}
        >
          {currentPage === item.id && <span className="absolute -left-1 h-5 w-0.5 rounded-r bg-[#0078d4]" />}
          <Icon name={item.icon} size={18} />
        </button>
      ))}
    </aside>
  )
}
