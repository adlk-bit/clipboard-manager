import { useEffect, useState } from 'react'

function MinimizeIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1.5 6.5h9" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function MaximizeIcon({ isMaximized }: { isMaximized: boolean }) {
  if (isMaximized) {
    return (
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3.5 1.5h7v7h-2v-5h-5v-2Z" fill="currentColor" />
        <rect x="1.5" y="3.5" width="7" height="7" rx=".4" stroke="currentColor" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1.5" y="1.5" width="9" height="9" rx=".5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

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
      className="window-titlebar drag-region flex h-10 shrink-0 items-center justify-between border-b border-white/70 bg-white/78 pl-3 dark:border-white/10 dark:bg-[#2c2c2e]/88"
      onDoubleClick={toggleMaximize}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-gradient-to-br from-[#0a84ff] to-[#0071e3] text-[10px] font-semibold text-white shadow-sm">
          C
        </div>
        <span className="truncate text-xs font-medium text-[#3a3a3c] dark:text-[#d1d1d6]">
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
          <MinimizeIcon />
        </button>
        <button
          type="button"
          className="window-control-button"
          aria-label={isMaximized ? '还原' : '最大化'}
          title={isMaximized ? '还原' : '最大化'}
          onClick={toggleMaximize}
        >
          <MaximizeIcon isMaximized={isMaximized} />
        </button>
        <button
          type="button"
          className="window-control-button window-close-button"
          aria-label="关闭到托盘"
          title="关闭到托盘"
          onClick={() => window.api.closeWindow()}
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  )
}
