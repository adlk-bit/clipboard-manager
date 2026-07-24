import { useEffect, type ReactNode } from 'react'
import { useStore } from '../stores/useStore'
import WindowTitleBar from './WindowTitleBar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const darkMode = useStore((s) => s.darkMode)

  // Tailwind's dark variants and the frameless window shell need the same root
  // theme marker. Keeping it on <html> also makes #root's surface switch.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <div className="flex h-screen flex-col bg-[#f2f2f7] dark:bg-[#1c1c1e]">
      <WindowTitleBar />
      <div className="flex min-h-0 flex-1">
        {children}
      </div>
    </div>
  )
}
