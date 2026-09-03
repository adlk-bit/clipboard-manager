export interface LoginItemSettingsSnapshot {
  openAtLogin: boolean
  executableWillLaunchAtLogin?: boolean
}

export interface AutoLaunchApp {
  isPackaged: boolean
  getPath: (name: 'exe') => string
  getLoginItemSettings: (options?: { path?: string; args?: string[] }) => LoginItemSettingsSnapshot
  setLoginItemSettings: (settings: { openAtLogin: boolean; path?: string; args?: string[] }) => void
}

export interface AutoLaunchStatus {
  supported: boolean
  configured: boolean
  enabled: boolean
  error?: string
}

export interface AutoLaunchUpdateResult extends AutoLaunchStatus {
  success: boolean
}

function unsupportedStatus(): AutoLaunchStatus {
  return {
    supported: false,
    configured: false,
    enabled: false,
  }
}

export function getAutoLaunchStatus(
  app: AutoLaunchApp,
  platform: NodeJS.Platform = process.platform,
): AutoLaunchStatus {
  // Never register the development Electron executable as a Windows startup
  // program. Login items are only meaningful for the packaged application.
  if (platform !== 'win32' || !app.isPackaged) return unsupportedStatus()

  try {
    const executablePath = app.getPath('exe')
    const settings = app.getLoginItemSettings({ path: executablePath, args: [] })
    const configured = settings.openAtLogin
    const enabled = configured && settings.executableWillLaunchAtLogin !== false
    return { supported: true, configured, enabled }
  } catch (error) {
    return {
      supported: true,
      configured: false,
      enabled: false,
      error: String(error),
    }
  }
}

export function setAutoLaunchEnabled(
  app: AutoLaunchApp,
  enabled: boolean,
  platform: NodeJS.Platform = process.platform,
): AutoLaunchUpdateResult {
  const current = getAutoLaunchStatus(app, platform)
  if (!current.supported) {
    return { ...current, success: false, error: 'Auto-launch is only available in the packaged Windows app.' }
  }

  try {
    const executablePath = app.getPath('exe')
    app.setLoginItemSettings({ openAtLogin: enabled, path: executablePath, args: [] })

    const next = getAutoLaunchStatus(app, platform)
    const applied = enabled ? next.enabled : !next.configured
    return {
      ...next,
      success: applied,
      error: applied ? next.error : 'Windows did not apply the requested startup setting.',
    }
  } catch (error) {
    return {
      ...getAutoLaunchStatus(app, platform),
      success: false,
      error: String(error),
    }
  }
}

export function synchronizeAutoLaunch(
  app: AutoLaunchApp,
  savedPreference: string | null,
  platform: NodeJS.Platform = process.platform,
): AutoLaunchUpdateResult {
  const current = getAutoLaunchStatus(app, platform)
  if (!current.supported || current.error) {
    return { ...current, success: false }
  }

  // Auto-launch was the intended default for this background utility. Older
  // releases never created the login item, so a missing preference is the
  // migration signal that repairs existing installations on their next run.
  if (savedPreference === null) {
    // Preserve an existing entry that the user disabled in Windows. Releases
    // before v1.1.4 did not create one, so only a genuinely missing entry
    // needs the one-time repair.
    if (current.configured) return { ...current, success: true }
    return setAutoLaunchEnabled(app, true, platform)
  }

  const desired = savedPreference === 'true'
  if (desired) {
    // Startup Apps can disable a still-configured Run entry. Respect that OS
    // choice instead of re-enabling it every time ClipboardManager starts.
    if (current.configured && !current.enabled) return { ...current, success: true }
    if (!current.configured) return setAutoLaunchEnabled(app, true, platform)
    return { ...current, success: true }
  }

  if (current.configured) return setAutoLaunchEnabled(app, false, platform)
  return { ...current, success: true }
}
