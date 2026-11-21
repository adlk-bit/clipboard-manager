import { useStore } from '../stores/useStore'
import type { PageView } from '../types'
import Icon, { type IconName } from './Icon'
import { useI18n } from '../lib/i18n'

const navItems: { id: PageView; icon: IconName }[] = [
  { id: 'all', icon: 'clipboard' },
  { id: 'favorites', icon: 'star' },
  { id: 'templates', icon: 'edit' },
  { id: 'emoji', icon: 'smile' },
  { id: 'stickers', icon: 'image' },
  { id: 'devices', icon: 'devices' },
  { id: 'settings', icon: 'settings' },
]

export default function Sidebar() {
  const { t } = useI18n()
  const currentPage = useStore((s) => s.currentPage)
  const setCurrentPage = useStore((s) => s.setCurrentPage)

  return (
    <nav aria-label={t('app.name')} className="app-sidebar no-drag">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setCurrentPage(item.id)}
          aria-current={currentPage === item.id ? 'page' : undefined}
          aria-label={t(`nav.${item.id}`)}
          title={t(`nav.${item.id}`)}
          className={item.id === 'devices' ? 'sidebar-utility' : undefined}
        >
          <Icon name={item.icon} size={19} />
          <span>{t(`nav.${item.id}`)}</span>
        </button>
      ))}
    </nav>
  )
}
