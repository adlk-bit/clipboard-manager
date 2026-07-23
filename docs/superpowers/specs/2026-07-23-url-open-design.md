# Clipboard URL quick-open design

## Goal

Let people open a URL copied to the clipboard directly from its history card. URL-like text without a scheme, such as `www.example.com` or `example.com/path`, is supported.

## Scope

- Apply only to text history cards.
- Show a `🔗` action only when the entire trimmed clipboard text is one supported URL.
- Supported forms are `http://...`, `https://...`, `www....`, and a conventional domain name with an optional path, query, or fragment.
- Add `https://` before opening a supported scheme-less URL.
- Open only `http:` and `https:` targets in the default system browser.

## Architecture and data flow

1. The renderer derives an openable URL from a history item's text with a small, reusable helper.
2. When the helper returns a URL, `HistoryCard` renders a `🔗` button beside the existing card actions.
3. Clicking the button invokes a typed preload API rather than exposing Electron APIs to the renderer.
4. The main-process IPC handler normalizes and validates the value again, then calls `shell.openExternal()`.

## Error handling

- Inputs that fail validation do not show the action in the renderer.
- The main process independently rejects invalid values and non-HTTP(S) schemes.
- A failed browser launch is caught and logged; it does not change clipboard history or interrupt other card actions.

## Testing

- Unit-test URL normalization for protocol, `www`, bare-domain, invalid, and unsafe-scheme cases if the project test setup supports it.
- Run the existing TypeScript/build checks after implementation.
- Manually verify that a valid history card displays `🔗`, a non-URL card does not, and clicking opens a valid URL through the IPC boundary.

## Non-goals

- Extracting URLs embedded in arbitrary prose.
- Supporting `file:`, app-specific, or other custom URL schemes.
- Persisting URL metadata in the database.
