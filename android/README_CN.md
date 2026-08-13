# Clipboard Manager Android 配套应用

[English](README.md)

这是 Windows Clipboard Manager 的开源 Android 配套端。它不依赖云服务器，与电脑在同一局域网内通信。

## 功能

- 扫描电脑端一次性二维码，通过 Android 自定义协议深链完成配对。
- 应用处于前台时，手动把 Android 文字剪贴板发送到电脑，或把电脑文字剪贴板复制到 Android。
- 经用户在系统设置中明确授予“通知访问”后，从消息类通知中提取唯一的六位验证码并转发到电脑。
- 使用 Android Keystore 的 AES-GCM 密钥加密保存设备凭据。
- 可在 Android 端主动断开，同时撤销电脑端凭据。
- 简体中文与英文界面、浅色/深色主题。

## 构建

环境要求：JDK 17、Android SDK Platform 36、Android SDK Build Tools 35.0.0。

```powershell
cd android
$env:ANDROID_HOME = "C:\path\to\Android\Sdk"
.\gradlew.bat testDebugUnitTest assembleDebug lintDebug
```

Debug APK 输出到：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

发布维护者可运行仓库根目录的 `scripts/build-android-release.ps1`。脚本会在当前 Windows 用户的 `%LOCALAPPDATA%\ClipboardManager\android-signing` 中创建或复用专用签名密钥，并输出可安装的 `dist/ClipboardManager-Android-<版本>.apk`；签名密钥不会写入 Git 仓库，发布者应安全备份该目录以保证后续版本可直接升级。

安装到已通过 USB 调试连接的手机：

```powershell
$env:ANDROID_HOME = "C:\path\to\Android\Sdk"
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r app\build\outputs\apk\debug\app-debug.apk
```

## 使用

1. 在 Windows 应用中打开「连接设备」，生成二维码。
2. 用 Android 相机扫码，浏览器页面中点击「用 Android 应用连接」。
3. 确认配对。普通剪贴板收发需打开配套应用并点击对应按钮。
4. 如需验证码转发，开启「转发六位验证码」，然后在 Android 系统页面授予本应用通知访问。
5. Windows 收到验证码后不会写入剪贴板历史，可直接按 `Ctrl+V`。

也可直接从项目的 [GitHub Releases](https://github.com/adlk-bit/clipboard-manager/releases) 下载与桌面版本一致的 Android APK。

## 权限与隐私

- 仅声明 `INTERNET`；不申请 `READ_SMS`、`RECEIVE_SMS`、联系人、文件、位置或无障碍权限。
- 通知访问是 Android 的特殊用户授权：只有用户在系统设置中手动允许后，系统才会把新通知交给服务。
- 只检查已知短信应用，或系统标记为消息且应用名称属于“短信/信息/Messages”的通知。
- 通知必须包含验证码语义，并且只能出现一个独立六位数字；完整标题和正文仅在内存中短暂匹配，不落盘、不发送。
- 验证码一分钟内去重；本机只记录成功/失败时间和验证码哈希，不记录验证码明文。
- Android 10 以后后台应用不能任意读取剪贴板。本应用不尝试绕过限制，普通剪贴板操作只在前台由用户点击执行。
- 设备密钥由 Android Keystore 管理的 AES-GCM 密钥加密保存；电脑仅保存 SHA-256 哈希。

## 网络边界

当前协议使用动态 RFC1918/链路本地 IPv4 地址上的 HTTP，并在应用代码中拒绝公网、域名、HTTPS 降级、用户信息和无端口地址。它不经过云端，但同一局域网中的恶意设备仍可能监听或篡改明文流量。

只在可信家庭/个人 Wi-Fi 使用，不要在公共 Wi-Fi 传输剪贴板或验证码。Android 17（targetSdk 37）开始需要新增 `ACCESS_LOCAL_NETWORK` 运行时权限；当前工程 targetSdk 36，依照平台规则使用 `INTERNET` 的隐式局域网访问。

## 测试范围

- JVM 单元测试覆盖专用 IPv4/配对 URL 校验、验证码语义、歧义拒绝和通知来源过滤。
- `assembleDebug` 验证 APK 生成。
- `lintDebug` 验证 Android 静态检查。
- 未连接实体 Android 手机时，上述结果不等同于相机深链、厂商短信通知格式或系统通知授权的真机证明。
