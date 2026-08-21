## Outcome / 改动结果

Describe the user-visible result and why the change is needed.

## Scope / 范围

- Affected surface: Desktop / Android / Pairing web / Documentation
- Security or privacy boundary changed: Yes / No

## Validation / 验证

- [ ] `npm test`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] `node scripts/runtime-smoke.mjs` (desktop runtime changes)
- [ ] `cd android && ./gradlew testDebugUnitTest lintRelease` (Android changes)
- [ ] UI evidence is attached and redacted (UI changes)
- [ ] Real-device limits or unverified behavior are stated

## Security and privacy / 安全与隐私

Explain changes to IPC, local files, clipboard retention, LAN traffic, pairing credentials, Android permissions, or notification access. Write “No boundary change” when applicable.

## Documentation / 文档

- [ ] Public behavior is reflected in both `README.md` and `README_CN.md`
- [ ] No credentials, signing material, pairing tokens, private addresses, clipboard contents, or personal data are included
