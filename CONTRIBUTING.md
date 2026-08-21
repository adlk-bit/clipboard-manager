# Contributing

Thanks for helping improve Clipboard Manager. Bug reports, focused pull requests, documentation corrections, security reviews, and real-device feedback are all welcome. The project does not treat stars or download counts as evidence that a feature is broadly adopted; reproducible reports and test results are more useful.

## Before opening an Issue

1. Search existing Issues and Releases.
2. Reproduce the problem on the latest release or current `master` when practical.
3. Remove clipboard contents, pairing URLs/tokens, device secrets, local paths, IP addresses, and other personal data from screenshots and logs.
4. Use a private [security advisory](SECURITY.md) instead of an Issue for vulnerabilities.

## Desktop development

Requirements: Windows 10/11, Node.js 22, and npm.

```powershell
npm ci
npm test
npx tsc --noEmit
npm run build
node scripts/runtime-smoke.mjs
```

The runtime smoke test launches an isolated Electron profile. A successful build alone is not proof that the frameless window, clipboard APIs, tray behavior, or preload bridge work at runtime.

## Android development

Requirements: JDK 17 and Android SDK 36.

```bash
cd android
./gradlew testDebugUnitTest lintRelease
```

Never commit a signing keystore or passwords. Release signing is configured only through the `CLIPBOARD_MANAGER_ANDROID_*` environment variables used by the local release script.

## Pull requests

- Keep each PR focused and explain the user-visible outcome.
- Add or update tests for logic and security-boundary changes.
- Include a redacted screenshot for UI changes and state the viewport/window size.
- Document what was validated and what still requires real Windows or Android hardware.
- Preserve the Electron security model: sandboxed renderer, narrow preload bridge, validated IPC input, denied navigation, and managed asset paths.
- Preserve the LAN fail-closed rules: private numeric IPv4 targets, short-lived one-time pairing, authenticated device requests, and explicit revocation.
- Update both `README.md` and `README_CN.md` when public behavior changes.

Maintainers may ask for a smaller patch or additional evidence before merging. Release publication, installer signing, and Android signing remain maintainer-controlled steps.

## Good first contributions

Look for [`good first issue`](https://github.com/adlk-bit/clipboard-manager/labels/good%20first%20issue) and [`help wanted`](https://github.com/adlk-bit/clipboard-manager/labels/help%20wanted), or open a focused proposal using the feature request template.

---

中文摘要：欢迎可复现的 Bug、文档修正、安全审查、真实设备反馈和范围明确的 PR。提交前请运行桌面与 Android 检查，删除日志/截图中的敏感数据；安全漏洞请私下报告。公开行为变化需同步更新中英文 README。
