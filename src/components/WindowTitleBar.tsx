import { useEffect, useState } from 'react'
import Icon from './Icon'

export default function WindowTitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    let mounted = true

    window.api.isWindowMaximized().then((maximized) => {
      if (mounted) setIsMaximized(maximized)
    })

    const unsubscribe = window.api.onWindowMaximizedChanged(setIsMaximized)
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  const toggleMaximize = async () => {
    setIsMaximized(await window.api.toggleMaximizeWindow(isMaximized))
  }

  return (
    <header
      className="window-titlebar drag-region flex h-8 shrink-0 items-center justify-between border-b border-[#dedee3] bg-[#f8f8f9] pl-2.5 dark:border-white/10 dark:bg-[#2a2a2d]"
      onDoubleClick={toggleMaximize}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-4 shrink-0 items-center justify-center rounded bg-[#0078d4] text-[9px] font-semibold text-white">
          C
        </div>
        <span className="truncate text-[11px] font-medium text-[#48484d] dark:text-[#d1d1d6]">
          剪贴板管理器
        </span>
      </div>

      <div className="window-controls no-drag flex h-full shrink-0" onDoubleClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="window-control-button"
          aria-label="最小化"
          title="最小化"
          onClick={() => window.api.minimizeWindow()}
        >
          <Icon name="window-minimize" size={12} />
        </button>
        <button
          type="button"
          className="window-control-button"
          aria-label={isMaximized ? '还原' : '最大化'}
          title={isMaximized ? '还原' : '最大化'}
          onClick={toggleMaximize}
        >
          <Icon name={isMaximized ? 'window-restore' : 'window-maximize'} size={12} />
        </button>
        <button
          type="button"
          className="window-control-button window-close-button"
          aria-label="关闭到托盘"
          title="关闭到托盘"
          onClick={() => window.api.closeWindow()}
        >
          <Icon name="x" size={13} />
        </button>
      </div>
    </header>
  )
}
