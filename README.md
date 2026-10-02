## Wide ChatGPT

Wide ChatGPT expands the usable conversation area on wide and ultrawide displays while preserving compatibility with the current ChatGPT interface.

It is designed to remain lightweight, adaptive, and resilient across normal conversations, Work, split views, Canvas/artifact-style layouts, code editors, responsive panes, and single-page navigation.

## Main features

- Wider conversation layout on desktop and ultrawide displays
- Optional maximum-width limits
- Adaptive activation based on the effective ChatGPT pane width
- Optional left-aligned conversation content
- Optional wider composer
- Safe handling for images, videos, tables, code blocks, and embedded content
- Split-view and Work-safe layout behavior
- SPA navigation support
- Resize-aware handling for sidebars, panes, and responsive layout changes
- Automatic ChatGPT DOM capability detection
- Runtime compatibility and selector-health diagnostics
- Unified repair scheduling with duplicate request coalescing
- Dirty-region processing to reduce unnecessary rescans
- Layout integrity checks with automatic safe fallback
- Runtime debug event history
- Reload-loop protection for settings-triggered reloads
- Settings validation and migration from earlier versions
- Complete cleanup of observers, listeners, timers, styles, and managed markers

## ChatGPT-style settings interface

The built-in settings interface is designed to visually integrate with ChatGPT rather than looking like a separate browser extension panel.

It includes:

- ChatGPT-style surfaces and neutral colors
- Compact section-based layout
- Modern toggle controls
- Clear active and inactive states
- Responsive two-column and single-column layouts
- Improved keyboard focus states
- Sticky action controls
- Current runtime and layout status
- Version information
- Automatic settings persistence

Open the settings interface through your userscript manager or with:

`Alt + S`

Settings are saved automatically. If settings were changed, closing the settings dialog reloads the page once so the new layout starts from a clean state.

A reload-loop guard prevents unintended repeated reloads.

## Adaptive width

When Adaptive Mode is enabled, UltraWide evaluates the actual available ChatGPT pane width rather than relying only on the browser viewport.

This improves behavior when:

- The ChatGPT sidebar is opened or closed
- Work or split-view panels are visible
- The browser window is resized
- ChatGPT remounts interface components
- The conversation pane changes size without a full window resize

If the effective pane cannot be measured reliably, the script falls back safely to the browser viewport width.

## Split-view safety

UltraWide detects supported split-view, Canvas, artifact, Work, document, spreadsheet, and code-editor surfaces where possible.

When Split View Safe Mode is enabled, width handling remains constrained to the available chat pane instead of forcing content across adjacent panels.

## Runtime resilience

Modern ChatGPT uses a frequently changing, virtualized interface. UltraWide includes several mechanisms intended to remain stable across these changes:

- DOM capability detection
- Multiple layout strategies and structural fallbacks
- Resize observation
- SPA route detection
- Mutation classification
- Repair request coalescing
- Partial dirty-region rescanning
- Runtime layout invariants
- Automatic safe fallback after repeated integrity failures

If aggressive width handling becomes unsafe because the detected ChatGPT structure no longer matches expected invariants, UltraWide can automatically fall back to a safer mode instead of continuously forcing potentially broken layout rules.

## Keyboard shortcuts

- `Alt + O` - Enable or disable the script
- `Alt + U` - Enable or disable UltraWide layout
- `Alt + L` - Enable or disable left alignment
- `Alt + M` - Cycle maximum width
- `Alt + A` - Enable or disable Adaptive Mode
- `Alt + C` - Enable or disable Split View Safe Mode
- `Alt + S` - Open settings
- `Alt + R` - Reset settings

## Diagnostics

UltraWide includes built-in diagnostics for troubleshooting ChatGPT interface changes.

Available console helpers:

```js
window.__mlUltraWide.state()
window.__mlUltraWide.capabilities()
window.__mlUltraWide.diagnostics()
window.__mlUltraWide.verify()
window.__mlUltraWide.debugEvents()
window.__mlUltraWide.copyDiagnostics()
window.__mlUltraWide.apply()
window.__mlUltraWide.scan()
window.__mlUltraWide.restart()
window.__mlUltraWide.stop()
window.__mlUltraWide.openSettings()
window.__mlUltraWide.clearSafeFallback()
window.__mlUltraWide.reset()
