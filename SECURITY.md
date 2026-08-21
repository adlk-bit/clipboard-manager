# Security Policy

## Supported versions

Security fixes are applied to the latest released version and the current `master` branch. Older installers and APKs may not receive backports.

## Reporting a vulnerability

Please do not open a public Issue for a suspected vulnerability. Use GitHub's private [security advisory form](https://github.com/adlk-bit/clipboard-manager/security/advisories/new) and include:

- the affected version or commit;
- the Windows/Android version and relevant network setup;
- clear reproduction steps or a minimal proof of concept;
- the expected and observed security boundary;
- any logs or screenshots with pairing tokens, device secrets, clipboard contents, local paths, and personal data removed.

The maintainer aims to acknowledge a complete report within seven days, provide a status update within fourteen days, and coordinate disclosure after a fix is available. These are best-effort targets for a volunteer-maintained project, not a guaranteed SLA.

## Security-sensitive areas

Reports are especially useful for:

- Electron IPC and preload API authorization;
- renderer sandbox, CSP, navigation, and local asset boundaries;
- clipboard database and `.clipbackup` parsing or path handling;
- LAN pairing, one-time QR tokens, device-secret authentication, and revocation;
- Android deep-link validation, Keystore storage, notification-code filtering, and network restrictions;
- accidental credential, clipboard-content, or personally identifiable data exposure.

## Scope and current boundary

Phone sharing is local-network only and currently uses HTTP transport. Authentication protects application requests, but LAN metadata and traffic confidentiality are not equivalent to end-to-end encryption. Use the feature only on a trusted private network and never publish a live pairing QR code or connection URL.

Issues that require physical access to an already unlocked device, unsupported operating systems, or social engineering without a software defect may be closed as out of scope, but responsible reports are still welcome.

---

中文摘要：安全问题请通过 GitHub Security Advisory 私下报告，不要公开提交 Issue。请删除日志和截图中的配对令牌、设备密钥、剪贴板内容、本地路径与个人信息。手机共享当前仅适合可信私有局域网。
