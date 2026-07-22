import type { ReactNode } from 'react'
import { useStore } from '../stores/useStore'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const darkMode = useStore((s) => s.darkMode)

  return (
    <div className={`flex h-screen bg-primary-50 ${darkMode ? 'dark' : ''}`}>
      {children}
    </div>
  )
}
