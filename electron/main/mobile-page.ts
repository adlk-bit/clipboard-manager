export const MOBILE_PAGE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#0a84ff">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'">
  <title>手机剪贴板连接</title>
  <style>
    :root{color-scheme:light dark;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",sans-serif;background:#f2f2f7;color:#1c1c1e}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;padding:max(22px,env(safe-area-inset-top)) 16px max(28px,env(safe-area-inset-bottom));background:linear-gradient(180deg,#eaf4ff 0,#f2f2f7 260px)}
    main{max-width:560px;margin:0 auto}.hero{padding:12px 4px 18px}.eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;color:#007aff;text-transform:uppercase}.hero h1{font-size:29px;line-height:1.12;margin:8px 0}.hero p{font-size:14px;line-height:1.55;color:#636366;margin:0}
    .card{background:rgba(255,255,255,.92);border:1px solid rgba(0,0,0,.06);border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 8px 30px rgba(0,38,77,.06)}
    h2{font-size:16px;margin:0 0 10px}.status{display:flex;align-items:center;gap:8px;font-size:13px;color:#636366}.dot{width:9px;height:9px;border-radius:50%;background:#ff9f0a}.dot.online{background:#34c759;box-shadow:0 0 0 4px rgba(52,199,89,.13)}
    label{display:block;font-size:12px;font-weight:650;color:#636366;margin:12px 0 6px}input,textarea{width:100%;font:inherit;color:inherit;background:#f7f7fa;border:1px solid #d8d8dc;border-radius:12px;padding:12px;outline:none}textarea{min-height:112px;resize:vertical}input:focus,textarea:focus{border-color:#0a84ff;box-shadow:0 0 0 3px rgba(10,132,255,.12)}
    button{width:100%;border:0;border-radius:12px;padding:12px 14px;font:600 15px/1.2 inherit;background:#0a84ff;color:#fff;margin-top:10px}button.secondary{background:#e8f2ff;color:#0067ce}button.tertiary{background:#eeeeF2;color:#3a3a3c}button:disabled{opacity:.45}.row{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .clip{white-space:pre-wrap;word-break:break-word;min-height:72px;max-height:210px;overflow:auto;background:#f7f7fa;border-radius:12px;padding:12px;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#3a3a3c}.muted{font-size:12px;line-height:1.5;color:#8e8e93}.steps{padding-left:20px;margin:8px 0 0;font-size:13px;line-height:1.65;color:#3a3a3c}.secret{font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;background:#f7f7fa;border-radius:10px;padding:9px;color:#636366}.hidden{display:none!important}.toast{position:fixed;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translateX(-50%);background:#1c1c1e;color:#fff;border-radius:999px;padding:9px 14px;font-size:13px;opacity:0;transition:.2s;pointer-events:none}.toast.show{opacity:1}
    @media(prefers-color-scheme:dark){:root{background:#000;color:#f5f5f7}body{background:linear-gradient(180deg,#071b30 0,#000 300px)}.hero p,.status,label,.muted{color:#98989d}.card{background:rgba(28,28,30,.94);border-color:rgba(255,255,255,.09)}input,textarea,.clip,.secret{background:#2c2c2e;border-color:#48484a;color:#f5f5f7}button.secondary{background:#102f4f;color:#64b5ff}button.tertiary{background:#2c2c2e;color:#e5e5ea}.steps{color:#d1d1d6}}
  </style>
</head>
<body>
<main>
  <section class="hero"><div class="eyebrow">Clipboard Manager</div><h1>连接手机与电脑</h1><p>支持 iPhone 与 Android，内容只在当前局域网内传输。电脑应用需保持运行（可缩到托盘）。</p></section>
  <section id="androidCard" class="card hidden">
    <h2>使用 Android 配套应用</h2>
    <p class="muted">配套应用支持前台双向剪贴板，以及经你授权的通知验证码转发。请先安装本项目提供的 Android APK。</p>
    <button id="openAndroidApp">用 Android 应用连接</button>
  </section>
  <section id="pairCard" class="card hidden">
    <h2>连接这台电脑</h2>
    <p class="muted">也可以直接使用手机浏览器共享文字。二维码将在电脑端显示 5 分钟。</p>
    <label for="deviceName">设备名称</label><input id="deviceName" maxlength="40" value="我的手机">
    <button id="pairButton">在浏览器中连接</button>
  </section>
  <section id="connectedArea" class="hidden">
    <section class="card"><div class="status"><span id="statusDot" class="dot"></span><span id="statusText">正在连接电脑…</span></div></section>
    <section class="card">
      <h2>发送到电脑</h2><p class="muted">在下方粘贴或输入内容，发送后会立即进入 Windows 剪贴板。</p>
      <textarea id="sendText" maxlength="10000" placeholder="长按此处，粘贴手机剪贴板内容"></textarea>
      <div class="row"><button id="readPhone" class="secondary">读取剪贴板</button><button id="sendButton">发送到电脑</button></div>
    </section>
    <section class="card">
      <h2>电脑当前剪贴板</h2><div id="computerClip" class="clip">等待电脑内容…</div><button id="copyButton" class="secondary">复制到手机</button>
    </section>
    <section class="card">
      <h2>短信验证码自动同步</h2>
      <div id="iosOtpGuide"><p class="muted">iOS 不允许第三方网页读取短信。请用系统“快捷指令”把匹配到的六位数字发送给电脑。</p>
      <ol class="steps"><li>打开“快捷指令”→“自动化”→“信息”。</li><li>设置“信息包含”为“验证码”，选择“立即运行”。</li><li>添加“匹配文本”，表达式填 <strong>(?&lt;![0-9])[0-9]{6}(?![0-9])</strong>。</li><li>取第一项匹配结果；添加“URL”，粘贴下方地址，并在末尾插入匹配结果变量。</li><li>添加“获取 URL 内容”，方法保持 GET。</li></ol>
      <label>快捷指令 URL（属于私密设备密钥）</label><div id="shortcutUrl" class="secret"></div><button id="copyShortcut" class="secondary">复制快捷指令 URL</button></div>
      <div id="androidOtpGuide" class="hidden"><p class="muted">浏览器不能在后台读取通知。请重新扫描二维码并选择“用 Android 应用连接”，再在应用内显式开启通知访问。</p></div>
      <p class="muted">电脑必须在线且与手机在同一 Wi‑Fi。若电脑 IP 改变，请重新扫码配对。</p>
    </section>
    <button id="forgetButton" class="tertiary">在此手机上断开连接</button>
  </section>
</main><div id="toast" class="toast"></div><script src="/phone.js" defer></script>
</body></html>`

export const MOBILE_PAGE_SCRIPT = String.raw`(() => {
  const storageKey = 'clipboard-manager-device-v1';
  const $ = (id) => document.getElementById(id);
  const pairCard = $('pairCard');
  const connectedArea = $('connectedArea');
  const token = new URLSearchParams(location.search).get('token');
  const isAndroid = /Android/i.test(navigator.userAgent);
  let device = null;
  let pollTimer = null;

  try { device = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}

  const toast = (text) => {
    $('toast').textContent = text;
    $('toast').classList.add('show');
    setTimeout(() => $('toast').classList.remove('show'), 1800);
  };
  const authHeaders = () => ({ 'Authorization': 'Bearer ' + device.secret, 'X-Device-Id': device.id });
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select(); area.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy'); area.remove(); return copied;
  };
  const showConnected = () => {
    pairCard.classList.add('hidden'); $('androidCard').classList.add('hidden'); connectedArea.classList.remove('hidden');
    history.replaceState({}, '', '/phone');
    const base = location.origin + '/api/shortcut/otp?device=' + encodeURIComponent(device.id) + '&key=' + encodeURIComponent(device.secret) + '&code=';
    $('shortcutUrl').textContent = base + '[在此插入“匹配结果”的第一项]';
    $('iosOtpGuide').classList.toggle('hidden', isAndroid);
    $('androidOtpGuide').classList.toggle('hidden', !isAndroid);
    startPolling();
  };
  const disconnect = (message) => {
    if (pollTimer) clearInterval(pollTimer);
    $('statusDot').classList.remove('online'); $('statusText').textContent = message || '连接已失效，请在电脑端重新扫码';
  };
  const poll = async () => {
    try {
      const response = await fetch('/api/state', { headers: authHeaders(), cache: 'no-store' });
      if (response.status === 401 || response.status === 403) { localStorage.removeItem(storageKey); disconnect(); return; }
      if (!response.ok) throw new Error('offline');
      const state = await response.json();
      $('statusDot').classList.add('online'); $('statusText').textContent = '已连接 · ' + state.computerName;
      $('computerClip').textContent = state.text || '电脑剪贴板当前没有文本';
    } catch { $('statusDot').classList.remove('online'); $('statusText').textContent = '电脑暂时离线，正在重试…'; }
  };
  const startPolling = () => { poll(); pollTimer = setInterval(poll, 2500); };

  $('pairButton').addEventListener('click', async () => {
    if (!token) return;
    $('pairButton').disabled = true;
    try {
      const response = await fetch('/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, name: $('deviceName').value, platform: isAndroid ? 'android' : 'iphone' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '配对失败');
      device = { id: result.deviceId, secret: result.deviceSecret };
      localStorage.setItem(storageKey, JSON.stringify(device)); showConnected(); toast('连接成功');
    } catch (error) { toast(error.message || '配对失败，请刷新二维码'); $('pairButton').disabled = false; }
  });
  $('sendButton').addEventListener('click', async () => {
    const text = $('sendText').value;
    if (!text) return toast('请先输入或粘贴内容');
    try {
      const response = await fetch('/api/clipboard', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!response.ok) throw new Error(); toast('已发送到电脑'); poll();
    } catch { toast('发送失败，请检查连接'); }
  });
  $('readPhone').addEventListener('click', async () => {
    try { $('sendText').value = await navigator.clipboard.readText(); toast('已读取'); }
    catch { $('sendText').focus(); toast('请长按输入框后点“粘贴”'); }
  });
  $('copyButton').addEventListener('click', async () => toast(await copyText($('computerClip').textContent || '') ? '已复制到手机' : '请长按文字手动复制'));
  $('copyShortcut').addEventListener('click', async () => {
    const base = location.origin + '/api/shortcut/otp?device=' + encodeURIComponent(device.id) + '&key=' + encodeURIComponent(device.secret) + '&code=';
    toast(await copyText(base) ? '已复制；请在末尾插入匹配结果变量' : '复制失败');
  });
  $('forgetButton').addEventListener('click', async () => {
    try { await fetch('/api/device', { method: 'DELETE', headers: authHeaders() }); } catch {}
    localStorage.removeItem(storageKey); location.replace('/phone');
  });
  $('openAndroidApp').addEventListener('click', () => {
    location.href = 'clipboardmanager://pair?url=' + encodeURIComponent(location.href);
  });

  // A freshly scanned one-time token takes priority over stale credentials on
  // the same IP/port, so a revoked device can be paired again in one scan.
  if (token) {
    pairCard.classList.remove('hidden');
    if (isAndroid) {
      $('androidCard').classList.remove('hidden');
      $('deviceName').value = 'Android 手机';
    }
  }
  else if (device && device.id && device.secret) showConnected();
  else { pairCard.classList.remove('hidden'); $('pairButton').disabled = true; $('pairButton').textContent = '请扫描电脑端的新二维码'; }
})();`
