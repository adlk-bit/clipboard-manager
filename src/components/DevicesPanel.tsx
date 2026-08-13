import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { MobileSyncStatus, PairingInfo } from '../types'
import Icon from './Icon'

const EMPTY_STATUS: MobileSyncStatus = { running: false, port: null, addresses: [], devices: [] }

export default function DevicesPanel() {
  const [status, setStatus] = useState<MobileSyncStatus>(EMPTY_STATUS)
  const [selectedAddress, setSelectedAddress] = useState('')
  const [pairing, setPairing] = useState<PairingInfo | null>(null)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const next = await window.api.getMobileSyncStatus()
      setStatus(next)
      setSelectedAddress((current) => next.addresses.some((item) => item.address === current)
        ? current
        : (next.addresses[0]?.address || ''))
    } catch (error) {
      setStatus({ ...EMPTY_STATUS, error: String(error) })
    }
  }, [])

  useEffect(() => {
    loadStatus()
    const unsubscribe = window.api.onMobileSyncChanged(() => {
      setPairing(null)
      loadStatus()
    })
    const timer = window.setInterval(() => {
      setNow(Date.now())
      loadStatus()
    }, 3000)
    return () => {
      unsubscribe()
      window.clearInterval(timer)
    }
  }, [loadStatus])

  const remainingSeconds = pairing
    ? Math.max(0, Math.ceil((Date.parse(pairing.expiresAt) - now) / 1000))
    : 0
  const pairingExpired = pairing !== null && remainingSeconds === 0

  const selectedNetwork = useMemo(
    () => status.addresses.find((item) => item.address === selectedAddress),
    [selectedAddress, status.addresses],
  )

  const createPairing = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await window.api.createMobilePairing(selectedAddress || undefined)
      if (result.success) {
        setPairing(result.pairing)
        setNow(Date.now())
      } else {
        setMessage(result.error)
      }
    } catch (error) {
      setMessage(String(error))
    } finally {
      setBusy(false)
    }
  }

  const copyPairingUrl = async () => {
    if (!pairing) return
    const result = await window.api.writeTextToClipboard(pairing.pairingUrl)
    setMessage(result.success ? '连接地址已复制。' : '复制连接地址失败。')
  }

  const toggleOtp = async (id: string, enabled: boolean) => {
    await window.api.setMobileOtpEnabled(id, enabled)
    await loadStatus()
  }

  const removeDevice = async (id: string) => {
    await window.api.removeMobileDevice(id)
    setConfirmRemoveId(null)
    await loadStatus()
  }

  return (
    <div className="space-y-3 p-3">
      <section className="rounded-xl border border-[#dfe4ea] bg-white p-3 dark:border-white/[0.08] dark:bg-[#28282b]">
        <div className="flex items-start gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf4ff] text-[#0078d4] dark:bg-[#0a84ff]/15 dark:text-[#53a9ff]">
            <Icon name="devices" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#29292d] dark:text-[#f5f5f7]">连接手机</h2>
              <span className={`flex items-center gap-1 text-[10px] ${status.running ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                <span className={`size-1.5 rounded-full ${status.running ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {status.running ? '服务已启动' : '服务不可用'}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-[#76767c] dark:text-[#a6a6ab]">支持 iPhone 与 Android；连接同一 Wi-Fi 后扫码即可双向发送文本。</p>
          </div>
        </div>

        {status.addresses.length > 0 && (
          <div className="mt-3">
            <label className="mb-1 block text-[10px] font-medium text-[#6b6b70] dark:text-[#aaaab0]" htmlFor="network-address">电脑网络</label>
            <select
              id="network-address"
              value={selectedAddress}
              onChange={(event) => { setSelectedAddress(event.target.value); setPairing(null) }}
              className="no-drag h-8 w-full rounded-lg border border-[#d8d8dd] bg-[#fafafa] px-2 text-[11px] text-[#3a3a3f] outline-none focus:border-[#0a84ff] dark:border-white/10 dark:bg-[#1f1f22] dark:text-[#e5e5ea]"
            >
              {status.addresses.map((item) => <option key={`${item.name}-${item.address}`} value={item.address}>{item.name} · {item.address}</option>)}
            </select>
          </div>
        )}

        {!pairing || pairingExpired ? (
          <button
            type="button"
            onClick={createPairing}
            disabled={busy || !status.running || !selectedAddress}
            className="no-drag mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0078d4] text-xs font-semibold text-white transition-colors hover:bg-[#006cbe] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Icon name="plus" size={14} />
            {busy ? '正在生成…' : pairingExpired ? '二维码已过期，重新生成' : '生成配对二维码'}
          </button>
        ) : (
          <div className="mt-3 rounded-xl bg-[#f6f9fc] p-3 text-center dark:bg-[#1f1f22]">
            <div className="mx-auto w-fit rounded-xl bg-white p-2 shadow-sm">
              <QRCodeSVG value={pairing.pairingUrl} size={176} level="M" marginSize={1} />
            </div>
            <p className="mt-2 text-[11px] font-medium text-[#3f3f44] dark:text-[#dedee3]">用手机相机扫描</p>
            <p className="mt-0.5 text-[10px] text-[#8a8a90]">{selectedNetwork?.name || '局域网'} · {pairing.address}:{pairing.port} · {remainingSeconds} 秒后过期</p>
            <button type="button" onClick={copyPairingUrl} className="no-drag mt-2 text-[10px] font-medium text-[#0078d4] hover:underline dark:text-[#53a9ff]">无法扫码？复制连接地址</button>
          </div>
        )}

        {status.addresses.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">未找到局域网 IPv4 地址。请先连接 Wi-Fi 或有线网络，再重新打开此页面。</p>
        )}
        {(message || status.error) && <p className="mt-2 text-[10px] leading-4 text-red-500">{message || status.error}</p>}
      </section>

      <section>
        <div className="mb-1.5 flex items-center justify-between px-0.5">
          <h3 className="text-xs font-semibold text-[#55555a] dark:text-[#d1d1d6]">已连接设备</h3>
          <span className="text-[10px] text-[#9a9aa0]">{status.devices.length} 台</span>
        </div>
        {status.devices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d4d4da] px-3 py-8 text-center dark:border-white/10">
            <Icon name="devices" size={24} className="mx-auto text-[#aaaab0]" />
            <p className="mt-2 text-xs text-[#77777d] dark:text-[#a6a6ab]">还没有连接设备</p>
            <p className="mt-1 text-[10px] text-[#aaaab0]">生成二维码后用手机相机扫描</p>
          </div>
        ) : status.devices.map((device) => (
          <div key={device.id} className="mb-2 rounded-xl border border-[#e0e0e5] bg-white p-3 dark:border-white/[0.08] dark:bg-[#28282b]">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#f0f0f3] text-[#5c5c61] dark:bg-white/[0.07] dark:text-[#d1d1d6]"><Icon name="devices" size={17} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><p className="truncate text-xs font-semibold text-[#3a3a3f] dark:text-[#ededf0]">{device.name}</p><span className="shrink-0 rounded bg-[#eeeeF2] px-1 py-0.5 text-[8px] font-medium text-[#77777d] dark:bg-white/[0.07] dark:text-[#aaaab0]">{device.platform === 'android' ? 'Android' : 'iPhone'}</span></div>
                <p className={`mt-0.5 text-[10px] ${device.online ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#99999f]'}`}>{device.online ? '在线' : `上次连接 ${formatRelativeTime(device.lastSeenAt, now)}`}</p>
              </div>
              {confirmRemoveId !== device.id && <button type="button" onClick={() => setConfirmRemoveId(device.id)} className="no-drag rounded-md p-1.5 text-[#a0a0a5] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" aria-label="移除设备"><Icon name="trash" size={14} /></button>}
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-[#eeeeF1] pt-2.5 dark:border-white/[0.07]">
              <div><p className="text-[11px] font-medium text-[#55555a] dark:text-[#d1d1d6]">验证码自动复制</p><p className="text-[9px] text-[#aaaab0]">收到后不写入历史记录</p></div>
              <button type="button" role="switch" aria-checked={device.otpEnabled} onClick={() => toggleOtp(device.id, !device.otpEnabled)} className={`no-drag relative h-5 w-9 rounded-full transition-colors ${device.otpEnabled ? 'bg-[#34a853]' : 'bg-[#c7c7cc] dark:bg-[#636366]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${device.otpEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} /></button>
            </div>
            {confirmRemoveId === device.id && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-red-50 px-2 py-1.5 dark:bg-red-500/10"><span className="text-[10px] text-red-600 dark:text-red-300">撤销后需重新扫码</span><div className="flex gap-1"><button type="button" onClick={() => setConfirmRemoveId(null)} className="no-drag rounded px-2 py-1 text-[10px] text-[#66666b] dark:text-[#c7c7cc]">取消</button><button type="button" onClick={() => removeDevice(device.id)} className="no-drag rounded bg-red-500 px-2 py-1 text-[10px] text-white">确认撤销</button></div></div>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-[#e3e3e7] bg-[#fbfbfc] p-3 dark:border-white/[0.07] dark:bg-[#242427]">
        <h3 className="text-xs font-semibold text-[#55555a] dark:text-[#d1d1d6]">验证码设置</h3>
        <div className="mt-1.5 grid gap-2 text-[10px] leading-4 text-[#77777d] dark:text-[#aaaab0]">
          <div><p className="font-semibold text-[#55555a] dark:text-[#d1d1d6]">Android</p><p>安装开源配套 APK，扫码后选择用应用连接，再在应用内开启通知访问。不会申请短信读取权限。</p></div>
          <div><p className="font-semibold text-[#55555a] dark:text-[#d1d1d6]">iPhone</p><p>在配对页面按说明创建“收到信息时”快捷指令自动化，并选择“立即运行”。</p></div>
        </div>
        <p className="mt-2 text-[9px] leading-4 text-[#8a8a90]">若 Windows 防火墙首次询问，请只允许“专用网络”；不要开放公用网络。</p>
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[9px] leading-4 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">不经过云端。请只在可信的家庭或个人网络使用，不建议在公共 Wi-Fi 传输剪贴板或验证码。</p>
      </section>
    </div>
  )
}

function formatRelativeTime(timestamp: string, now: number): string {
  const elapsed = Math.max(0, now - Date.parse(timestamp))
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return '刚刚'
  if (elapsed < 60 * 60_000) return `${Math.floor(elapsed / 60_000)} 分钟前`
  if (elapsed < 24 * 60 * 60_000) return `${Math.floor(elapsed / (60 * 60_000))} 小时前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}
