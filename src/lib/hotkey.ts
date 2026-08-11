export interface HotkeyKeyEvent {
  key: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

export function buildHotkey(event: HotkeyKeyEvent): string | null {
  const key = getAcceleratorKey(event.key)
  const modifiers = [
    event.ctrlKey && 'Ctrl',
    event.altKey && 'Alt',
    event.shiftKey && 'Shift',
    event.metaKey && 'Super',
  ].filter(Boolean) as string[]

  return key && modifiers.length > 0 ? [...modifiers, key].join('+') : null
}

export function getAcceleratorKey(key: string): string | null {
  if (new Set(['Control', 'Alt', 'Shift', 'Meta']).has(key)) return null
  if (/^[a-zA-Z0-9]$/.test(key)) return key.toUpperCase()
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) return key

  const keyMap: Record<string, string> = {
    ' ': 'Space', Tab: 'Tab', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Enter: 'Enter', Backspace: 'Backspace', Delete: 'Delete', Home: 'Home', End: 'End',
    PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert',
  }
  return keyMap[key] || null
}
