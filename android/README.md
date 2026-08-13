# Clipboard Manager Android Companion

[简体中文](README_CN.md)

This is the open-source Android companion for Clipboard Manager on Windows. It uses no cloud server and communicates with the PC on the same local network.

## Features

- Pair through the desktop's one-time QR code and an Android custom-scheme deep link.
- While foregrounded, explicitly send the Android text clipboard to Windows or copy the Windows text clipboard to Android.
- After the user explicitly grants notification access in system settings, extract one six-digit verification code from message-style notifications and relay it to Windows.
- Encrypt stored device credentials with an AES-GCM key held by Android Keystore.
- Disconnect from Android and revoke the PC credential at the same time.
- English/Simplified Chinese UI and light/dark themes.

## Build

Requirements: JDK 17, Android SDK Platform 36, and Android SDK Build Tools 35.0.0.

```powershell
cd android
$env:ANDROID_HOME = "C:\path\to\Android\Sdk"
.\gradlew.bat testDebugUnitTest assembleDebug lintDebug
```

The debug APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Release maintainers can run `scripts/build-android-release.ps1` from the repository root. It creates or reuses a dedicated signing key under `%LOCALAPPDATA%\ClipboardManager\android-signing` for the current Windows user and writes an installable `dist/ClipboardManager-Android-<version>.apk`. The key never enters Git; maintainers must back up that directory securely so later APKs remain upgrade-compatible.

Install it on a USB-debugging device with:

```powershell
$env:ANDROID_HOME = "C:\path\to\Android\Sdk"
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r app\build\outputs\apk\debug\app-debug.apk
```

## Use

1. Open **Connected Devices** on Windows and generate a QR code.
2. Scan it with Android Camera and choose **Open Android app** on the browser page.
3. Confirm pairing. Normal clipboard exchange requires the foreground companion and a user tap.
4. To relay verification codes, enable the switch and grant notification access on the Android system page.
5. Windows receives a paste-ready code without retaining it in clipboard history.

You can also download the Android APK matching the desktop version from the project's [GitHub Releases](https://github.com/adlk-bit/clipboard-manager/releases).

## Permissions and privacy

- Declares only `INTERNET`; it requests no `READ_SMS`, `RECEIVE_SMS`, contacts, files, location, or accessibility permission.
- Notification access is a special Android user grant. The system sends new notifications to the service only after the user enables it in system settings.
- Only known SMS packages, or system message-category notifications whose app label resembles SMS/Messages, are inspected.
- A notification must contain verification-code context and exactly one standalone six-digit value. Full titles and bodies are matched briefly in memory, never stored, and never transmitted.
- Codes are deduplicated for one minute. The phone stores only the success/failure timestamp and a code hash, never plaintext.
- Android 10+ prevents arbitrary background clipboard reads. The app does not bypass that restriction; normal clipboard actions are foreground-only and user-initiated.
- The device secret is encrypted with an AES-GCM key managed by Android Keystore; the PC stores only its SHA-256 hash.

## Network boundary

The current protocol uses HTTP on dynamic RFC1918/link-local IPv4 addresses. Application code rejects public hosts, domain names, HTTPS downgrade paths, user-info URLs, and missing ports. No cloud relay is involved, but a malicious device on the same LAN may still observe or alter cleartext traffic.

Use only trusted home/personal Wi-Fi, never public Wi-Fi, for clipboard or verification-code traffic. Android 17 apps targeting SDK 37 will need the new `ACCESS_LOCAL_NETWORK` runtime permission. This project targets SDK 36 and follows the platform's current implicit LAN access through `INTERNET`.

## Test boundary

- JVM unit tests cover private IPv4/pairing URL validation, verification-code context, ambiguity rejection, and notification source filtering.
- `assembleDebug` proves APK generation.
- `lintDebug` performs Android static analysis.
- Without a physical Android phone, these results do not prove camera deep-link handling, OEM-specific SMS notification formats, or the system notification-access flow on real hardware.
