# UltraWide ChatGPT

A stable and configurable Tampermonkey userscript that restores and improves the ultra-wide layout in ChatGPT.

It expands conversation content and the message composer while preserving ChatGPT features such as images, attachments, Canvas, split view, scrolling, code blocks, tables, and generated media.

## Features

- Restores a responsive ultra-wide conversation layout
- Supports the current ChatGPT interface
- Widens the message composer independently
- Optional left-aligned conversation content
- Configurable maximum content width
- Adaptive activation based on viewport size
- Optional touch-device and minimum-height rules
- Adjustable responsive side gutters
- Canvas and split-view safe mode
- Safe media constraints for images, videos, iframes, code blocks, and tables
- Persistent settings with migration from earlier storage versions
- Keyboard shortcuts and Tampermonkey menu commands
- Lightweight route detection and automatic layout repair
- Built-in settings dialog and diagnostic console API
- No external runtime dependencies

## Installation

### Greasy Fork

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/).
2. Open the [UltraWide ChatGPT page on Greasy Fork](https://greasyfork.org/en/scripts/557270-ultrawide-chatgpt).
3. Select **Install this script**.
4. Open or reload [ChatGPT](https://chatgpt.com/).

Updates installed through Greasy Fork are handled automatically by the userscript manager.

### Manual installation

1. Open `UltraWide-ChatGPT.user.js` from this repository.
2. Select **Raw**.
3. Confirm the installation in Tampermonkey.
4. Reload ChatGPT.

For automatic updates, the Greasy Fork installation is recommended.

## Usage

The script starts automatically on:

- `https://chatgpt.com/*`
- `https://www.chatgpt.com/*`

Open the Tampermonkey extension menu while ChatGPT is active and select **UltraWide settings** to configure the layout.

The default configuration enables:

- The userscript
- Ultra-wide mode
- Left-aligned content
- Adaptive mode
- A widened message composer
- Safe media constraints
- Canvas and split-view protection
- Status messages

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt + O` | Enable or disable the complete script |
| `Alt + U` | Enable or disable ultra-wide mode |
| `Alt + L` | Enable or disable left alignment |
| `Alt + M` | Cycle through width caps |
| `Alt + A` | Enable or disable adaptive mode |
| `Alt + S` | Open the settings dialog |
| `Alt + R` | Reset all settings |

Shortcuts are ignored while typing in an input, textarea, select field, contenteditable element, or textbox.

## Settings

### UltraWide

| Setting | Description |
|---|---|
| Enable script | Enables or disables all layout modifications |
| Enable UltraWide | Controls the widened conversation layout |
| Left-align content | Aligns conversation text to the left |
| Maximum content width | Applies no limit or a fixed width cap |
| Widen message composer | Expands the verified composer shell |
| Safe media constraints | Prevents supported media and wide content from overflowing |
| Canvas and split-view safe mode | Uses pane-relative sizing for Canvas and multi-pane layouts |
| Show status messages | Displays short status notifications after changes |

Available width caps:

`No limit`, `1200`, `1400`, `1600`, `1800`, `2000`, `2200`, `2400`, `2800`, `3200`, `3600`, and `4200` pixels.

### Adaptive mode

Adaptive mode activates UltraWide only when the configured viewport conditions are satisfied.

| Setting | Description |
|---|---|
| Enable adaptive mode | Automatically controls whether UltraWide is active |
| Minimum viewport width | Disables UltraWide below the configured width |
| Disable on touch devices | Optionally keeps the standard layout on touch-oriented devices |
| Minimum viewport height | Disables UltraWide below the configured height; `0` disables this condition |

### Spacing

The side gutter uses a responsive CSS `clamp()` value based on:

- Minimum side gutter
- Viewport-width gutter
- Maximum side gutter

### Runtime

Advanced runtime options control:

- DOM scan debounce
- Periodic repair interval
- Route fallback interval
- Status-message duration
- Backdrop behavior for the settings dialog

The default runtime values are designed to avoid excessive DOM activity. Change them only when troubleshooting a specific issue.

## Design and safety

UltraWide ChatGPT avoids broad global selectors and unrestricted `max-width` overrides.

Instead, it:

1. Detects verified ChatGPT conversation turns and composer anchors.
2. Identifies their limited structural paths.
3. Marks only those elements with private `data-uwc-*` attributes.
4. Applies scoped CSS only to marked layout elements.
5. Rechecks the layout after relevant DOM changes and route transitions.

This reduces the risk of affecting unrelated interface components, generated media, attachments, dialogs, Canvas, editors, or split-view panes.

The script does not read, transmit, or store conversation content. Its persistent storage is limited to its own configuration values.

## Console API

The following API is available in the browser developer console:

```javascript
window.__mlUltraWide.state();
window.__mlUltraWide.apply();
window.__mlUltraWide.restart();
window.__mlUltraWide.stop();
window.__mlUltraWide.openSettings();
window.__mlUltraWide.set({ cap: "2400", auto: false });
window.__mlUltraWide.reset();
```

### Examples

Inspect the current runtime state:

```javascript
window.__mlUltraWide.state();
```

Set a fixed maximum width and disable adaptive mode:

```javascript
window.__mlUltraWide.set({
  cap: "2400",
  auto: false
});
```

Force the script to rescan and reapply the layout:

```javascript
window.__mlUltraWide.apply();
```

Restore all default settings:

```javascript
window.__mlUltraWide.reset();
```

## Troubleshooting

### UltraWide is not active

Check the following:

1. The script and UltraWide mode are enabled.
2. Adaptive mode is not disabling the layout because of viewport width or height.
3. Touch-device detection is not enabled for your current device.
4. Reload ChatGPT.
5. Open the settings dialog and select **Force layout scan**.

You can also inspect:

```javascript
window.__mlUltraWide.state();
```

Review `activeWide`, `detectedTurns`, `conversationRootFound`, `composerFound`, and `lastError`.

### The composer is not wide

Verify that **Widen message composer** is enabled, then force a layout scan or reload ChatGPT.

### Canvas or split view behaves incorrectly

Keep **Canvas and split-view safe mode** enabled. This mode deliberately uses the available chat-pane width instead of the complete browser viewport.

### Reset the configuration

Press `Alt + R`, use the Tampermonkey menu command, or run:

```javascript
window.__mlUltraWide.reset();
```

## Compatibility

The script is intended for modern desktop browsers supported by Tampermonkey and the current ChatGPT web interface.

ChatGPT can change its internal interface without notice. When reporting a compatibility issue, include:

- Browser and version
- Userscript manager and version
- Script version
- A screenshot of the affected layout
- Output from `window.__mlUltraWide.state()`
- Steps required to reproduce the problem

Do not include private conversation content in public issue reports.

## Updates

The official install and automatic-update source is Greasy Fork:

- [UltraWide ChatGPT on Greasy Fork](https://greasyfork.org/en/scripts/557270-ultrawide-chatgpt)

The GitHub repository provides source history, documentation, releases, and issue tracking.

## Contributing

Bug reports and focused improvements are welcome.

Before submitting a change:

1. Preserve existing behavior outside the requested layout adjustment.
2. Avoid broad selectors and global layout overrides.
3. Keep Canvas, split view, attachments, media, scrolling, and the composer functional.
4. Minimize DOM work inside mutation observers.
5. Test navigation between multiple conversations without a full page reload.

## License

Released under the [MIT License](LICENSE).

## Author

Created by **jsmdev**.
