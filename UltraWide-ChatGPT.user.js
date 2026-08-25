// ==UserScript==
// @name         UltraWide ChatGPT
// @namespace    https://www.instagram.com/jsm.ig/
// @version      2026.08.25.1
// @author       jsmdev
// @description  Robust ultra-wide layout for current ChatGPT Chat and Work with adaptive width, split-view safety, diagnostics, settings, SPA support, and complete cleanup.
// @license      MIT
// @match        https://chatgpt.com/*
// @match        https://www.chatgpt.com/*
// @icon         https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/openai.svg
// @run-at       document-start
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @downloadURL  https://update.greasyfork.org/scripts/557270/UltraWide%20ChatGPT.user.js
// @updateURL    https://update.greasyfork.org/scripts/557270/UltraWide%20ChatGPT.meta.js
// ==/UserScript==

/*
  UltraWide ChatGPT
  Version: 2026.08.25.1

  Improvements
  - Updated for the current ChatGPT Chat + Work web surface
  - Safer SPA navigation hooks that do not overwrite hooks installed after UltraWide
  - Better composer selection to avoid widening unrelated editors and dialog inputs
  - Expanded split-view/artifact detection while preserving legacy Canvas compatibility
  - Atomic marker updates without clearing/scanning the entire page
  - Cleans conflicting styles and attributes from older script versions
  - Avoids body.innerText and broad generated-class selectors
  - Avoids nested composer-width shrinking
  - Uses verified conversation turns as structural anchors
  - Lightweight, bounded MutationObserver processing
  - SPA route handling without aggressive polling
  - Chat/Work split-view-safe pane-relative sizing
  - Complete timer, observer, listener, style, and marker cleanup
  - Settings validation and migration from earlier versions
  - Fixed CSS cache recursion and hardened cache generation
  - Hot-reload-safe single-instance lifecycle
  - Storage failure reporting and copyable diagnostics
  - Live settings status synchronization
  - Native Navigation API support when available, with safe history fallback

  Shortcuts
  - Alt+O  Enable/disable script
  - Alt+U  Enable/disable UltraWide
  - Alt+L  Enable/disable left alignment
  - Alt+M  Cycle maximum width
  - Alt+A  Enable/disable adaptive mode
  - Alt+C  Enable/disable split-view safe mode
  - Alt+S  Open settings
  - Alt+R  Reset settings

  Console API
  - window.__mlUltraWide.state()
  - window.__mlUltraWide.diagnostics()
  - window.__mlUltraWide.copyDiagnostics()
  - window.__mlUltraWide.apply()
  - window.__mlUltraWide.scan()
  - window.__mlUltraWide.restart()
  - window.__mlUltraWide.stop()
  - window.__mlUltraWide.openSettings()
  - window.__mlUltraWide.set({ cap: "2400", auto: false })
  - window.__mlUltraWide.reset()
*/

(() => {
  'use strict';

  const VERSION = '2026.08.25.1';
  const STORAGE_KEY = 'uwc.settings.v12';

  const ID = Object.freeze({
    style: 'uwc-style-v10',
    uiStyle: 'uwc-ui-style-v10',
    toast: 'uwc-toast-v10',
    modal: 'uwc-settings-v10'
  });

  const LEGACY_STYLE_IDS = Object.freeze([
    'uwc-style',
    'uwc-ui-style',
    'uwc-style-v8',
    'uwc-ui-style-v8',
    'uwc-style-v9',
    'uwc-ui-style-v9'
  ]);

  const LEGACY_ELEMENT_IDS = Object.freeze([
    'uwc-toast',
    'uwc-settings-modal',
    'uwc-toast-v8',
    'uwc-settings-v8',
    'uwc-toast-v9',
    'uwc-settings-v9'
  ]);

  const LEGACY_STORAGE_KEYS = Object.freeze([
    'uwc.settings.v11',
    'uwc.settings.v10',
    'uwc.settings.v9',
    'uwc.settings.v8',
    'uwc.settings.v7',
    'uwc.settings.v6',
    'uwc.settings.v5',
    'uwc.settings.v4',
    'uwc.settings.v3',
    'uwc.settings.v2',
    'uwc.settings.v1'
  ]);

  const ATTR = Object.freeze({
    enabled: 'data-uwc-enabled',
    wide: 'data-uwc-wide',
    left: 'data-uwc-left',
    canvas: 'data-uwc-canvas',
    cap: 'data-uwc-cap',
    version: 'data-uwc-version',

    conversationRoot: 'data-uwc-conversation-root',
    conversationPath: 'data-uwc-conversation-path',
    turn: 'data-uwc-turn',
    turnPath: 'data-uwc-turn-path',

    composer: 'data-uwc-composer',
    composerPath: 'data-uwc-composer-path'
  });

  const MANAGED_MARKERS = Object.freeze([
    ATTR.conversationRoot,
    ATTR.conversationPath,
    ATTR.turn,
    ATTR.turnPath,
    ATTR.composer,
    ATTR.composerPath
  ]);

  const CAPS = Object.freeze([
    'none',
    '1200',
    '1400',
    '1600',
    '1800',
    '2000',
    '2200',
    '2400',
    '2800',
    '3200',
    '3600',
    '4200'
  ]);

  const DEFAULTS = Object.freeze({
    enabled: true,
    wide: true,
    left: true,

    cap: 'none',
    auto: true,
    autoMinWidth: 1100,
    disableOnTouch: false,
    disableBelowHeight: 560,

    gutterMin: 16,
    gutterVw: 2,
    gutterMax: 36,

    widenComposer: true,
    safeMedia: true,
    canvasSafeMode: true,

    toast: true,
    toastMs: 1500,

    scanDebounceMs: 240,
    repairIntervalMs: 10000,
    routePollMs: 10000,

    pauseWhenHidden: true,
    performanceTelemetry: true,

    closeSettingsOnBackdrop: true
  });

  const LIMITS = Object.freeze({
    autoMinWidth: [640, 10000],
    disableBelowHeight: [0, 4000],

    gutterMin: [0, 100],
    gutterVw: [0, 15],
    gutterMax: [0, 200],

    toastMs: [300, 10000],
    scanDebounceMs: [80, 3000],
    repairIntervalMs: [2500, 60000],
    routePollMs: [1000, 30000]
  });

  const CONFIG = Object.freeze({
    maxMutationRecords: 24,
    maxMutationNodes: 10,
    maxComposerCandidates: 24,
    maxConversationPathDepth: 12,
    maxTurnPathDepth: 6,
    maxComposerPathDepth: 7,
    routeDelayMs: 100,
    idleTimeoutMs: 700
  });

  const SELECTOR = Object.freeze({
    preferredTurns: [
      '[data-testid="conversation-turn"]',
      '[data-testid^="conversation-turn-"]',
      'article[data-testid="conversation-turn"]',
      'article[data-testid^="conversation-turn-"]'
    ].join(','),

    fallbackMessages: [
      '[data-message-author-role]',
      '[data-message-id][data-message-author-role]'
    ].join(','),

    main: [
      'main',
      '[role="main"]',
      '[data-testid="main-app"]',
      '[data-testid="chat-layout"]'
    ].join(','),

    composerInput: [
      '[data-testid="composer-input"]',
      '[data-testid="composer:input"]',
      'form[data-type="unified-composer"] textarea',
      'form[data-type="unified-composer"] [contenteditable="true"]',
      'form[data-type="unified-composer"] [role="textbox"]',
      'main form textarea',
      'main form [contenteditable="true"][role="textbox"]'
    ].join(','),

    composerShell: [
      '[data-testid="composer"]',
      '[data-testid="composer-shell"]',
      '[data-testid="composer-container"]',
      'form[data-type="unified-composer"]'
    ].join(','),

    excludedComposerAncestor: [
      '#uwc-settings-v10',
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[data-testid="artifact"]',
      '[data-testid^="artifact-"]',
      '[data-testid="code-editor"]',
      '[data-testid^="code-editor-"]',
      '.monaco-editor',
      '.cm-editor',
      '.CodeMirror'
    ].join(','),

    splitViewIndicators: [
      '[data-testid="canvas"]',
      '[data-testid^="canvas-"]',
      '[data-testid="artifact"]',
      '[data-testid^="artifact-"]',
      '[data-testid="code-editor"]',
      '[data-testid^="code-editor-"]',
      '[data-testid="document-editor"]',
      '[data-testid^="document-editor-"]',
      '[data-testid="spreadsheet-editor"]',
      '[data-testid^="spreadsheet-editor-"]',
      '.monaco-editor',
      '.cm-editor',
      '.CodeMirror'
    ].join(','),

    turnContent: [
      '.markdown',
      '[class*="prose"]',
      '[data-message-author-role]'
    ].join(',')
  });

  const settings = {
    ...DEFAULTS
  };

  const runtime = {
    started: false,
    href: '',

    bodyObserver: null,
    headObserver: null,
    bootstrapObserver: null,

    observedBody: null,
    observedHead: null,

    eventController: null,

    scanTimer: 0,
    repairTimer: 0,
    routeTimer: 0,
    routeDelayTimer: 0,
    toastTimer: 0,
    animationFrame: 0,
    idleCallback: 0,

    originalPushState: null,
    originalReplaceState: null,
    wrappedPushState: null,
    wrappedReplaceState: null,

    menusRegistered: false,
    menuCommandIds: new Map(),
    modalSyncing: false,
    modalReturnFocus: null,

    canvasDetected: false,
    lastTurnCount: 0,
    lastScanAt: 0,
    lastScanDurationMs: 0,
    scanCount: 0,
    mutationBatchCount: 0,
    deferredScan: false,
    cssCacheKey: '',
    mainCssCache: '',
    uiCssCache: '',
    lastError: null,
    lastSavedAt: 0,
    storageAvailable: true,
    instanceStartedAt: 0,

    marked: new Map(
      MANAGED_MARKERS.map((attribute) => [
        attribute,
        new Set()
      ])
    )
  };

  function getRoot() {
    return document.documentElement || null;
  }

  function getHead() {
    return (
      document.head ||
      document.getElementsByTagName('head')[0] ||
      null
    );
  }

  function getBody() {
    return document.body || null;
  }

  function isElement(value) {
    return value instanceof Element;
  }

  function isConnectedElement(value) {
    return isElement(value) && value.isConnected;
  }

  function setAttributeValue(element, name, value) {
    if (!element || element.getAttribute(name) === value) {
      return false;
    }

    element.setAttribute(name, value);
    return true;
  }

  function setBooleanAttribute(element, name, enabled) {
    if (!element) {
      return false;
    }

    if (enabled) {
      return setAttributeValue(element, name, '1');
    }

    if (element.hasAttribute(name)) {
      element.removeAttribute(name);
      return true;
    }

    return false;
  }

  function shouldPauseWork() {
    return Boolean(
      settings.pauseWhenHidden &&
      document.hidden
    );
  }

  function nowMs() {
    return typeof performance?.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function hasConnectedMarker(attribute) {
    const elements = runtime.marked.get(attribute);

    if (!elements || elements.size === 0) {
      return false;
    }

    for (const element of elements) {
      if (element?.isConnected) {
        return true;
      }
    }

    return false;
  }

  function hasDisconnectedMarkers() {
    for (const elements of runtime.marked.values()) {
      for (const element of elements) {
        if (!element?.isConnected) {
          return true;
        }
      }
    }

    return false;
  }

  function hasGmStorage() {
    return (
      typeof GM_getValue === 'function' &&
      typeof GM_setValue === 'function'
    );
  }

  function readStorage(key) {
    try {
      if (hasGmStorage()) {
        return GM_getValue(key, null);
      }
    } catch (_) {}

    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      if (hasGmStorage()) {
        GM_setValue(key, value);
        runtime.storageAvailable = true;
        runtime.lastSavedAt = Date.now();
        return true;
      }
    } catch (_) {}

    try {
      localStorage.setItem(key, JSON.stringify(value));
      runtime.storageAvailable = true;
      runtime.lastSavedAt = Date.now();
      return true;
    } catch (error) {
      runtime.storageAvailable = false;
      runtime.lastError = `Settings storage failed: ${
        error?.message || error
      }`;
      return false;
    }
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, number));
  }

  function clampInteger(value, min, max, fallback) {
    return Math.round(
      clampNumber(value, min, max, fallback)
    );
  }

  function normalizeBoolean(value, fallback) {
    return typeof value === 'boolean'
      ? value
      : fallback;
  }

  function normalizeSettings(input) {
    const output = {
      ...DEFAULTS
    };

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input)
    ) {
      return output;
    }

    output.enabled = normalizeBoolean(
      input.enabled,
      output.enabled
    );

    output.wide = normalizeBoolean(
      input.wide,
      output.wide
    );

    output.left = normalizeBoolean(
      input.left,
      output.left
    );

    output.cap = CAPS.includes(String(input.cap))
      ? String(input.cap)
      : output.cap;

    output.auto = normalizeBoolean(
      input.auto,
      output.auto
    );

    output.autoMinWidth = clampInteger(
      input.autoMinWidth,
      ...LIMITS.autoMinWidth,
      output.autoMinWidth
    );

    output.disableOnTouch = normalizeBoolean(
      input.disableOnTouch,
      output.disableOnTouch
    );

    output.disableBelowHeight = clampInteger(
      input.disableBelowHeight,
      ...LIMITS.disableBelowHeight,
      output.disableBelowHeight
    );

    output.gutterMin = clampInteger(
      input.gutterMin,
      ...LIMITS.gutterMin,
      output.gutterMin
    );

    output.gutterVw = clampNumber(
      input.gutterVw,
      ...LIMITS.gutterVw,
      output.gutterVw
    );

    output.gutterMax = clampInteger(
      input.gutterMax,
      ...LIMITS.gutterMax,
      output.gutterMax
    );

    output.widenComposer = normalizeBoolean(
      input.widenComposer ?? input.composerWide,
      output.widenComposer
    );

    output.safeMedia = normalizeBoolean(
      input.safeMedia ?? input.mediaSafe,
      output.safeMedia
    );

    output.canvasSafeMode = normalizeBoolean(
      input.canvasSafeMode ?? input.canvasTuning,
      output.canvasSafeMode
    );

    output.toast = normalizeBoolean(
      input.toast ?? input.showToast,
      output.toast
    );

    output.toastMs = clampInteger(
      input.toastMs,
      ...LIMITS.toastMs,
      output.toastMs
    );

    output.scanDebounceMs = clampInteger(
      input.scanDebounceMs ?? input.mutationDebounceMs,
      ...LIMITS.scanDebounceMs,
      output.scanDebounceMs
    );

    output.repairIntervalMs = clampInteger(
      input.repairIntervalMs,
      ...LIMITS.repairIntervalMs,
      output.repairIntervalMs
    );

    output.routePollMs = clampInteger(
      input.routePollMs,
      ...LIMITS.routePollMs,
      output.routePollMs
    );

    output.pauseWhenHidden = normalizeBoolean(
      input.pauseWhenHidden,
      output.pauseWhenHidden
    );

    output.performanceTelemetry = normalizeBoolean(
      input.performanceTelemetry,
      output.performanceTelemetry
    );

    output.closeSettingsOnBackdrop = normalizeBoolean(
      input.closeSettingsOnBackdrop ??
        input.optionsCloseOnBackdrop,
      output.closeSettingsOnBackdrop
    );

    if (output.gutterMax < output.gutterMin) {
      output.gutterMax = output.gutterMin;
    }

    return output;
  }

  function loadSettings() {
    const current = readStorage(STORAGE_KEY);

    if (current) {
      Object.assign(
        settings,
        normalizeSettings(current)
      );

      return;
    }

    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = readStorage(key);

      if (!legacy) {
        continue;
      }

      Object.assign(
        settings,
        normalizeSettings(legacy)
      );

      saveSettings();
      return;
    }
  }

  function saveSettings() {
    return writeStorage(
      STORAGE_KEY,
      { ...settings }
    );
  }

  function removeById(id) {
    document.getElementById(id)?.remove();
  }

  function cleanupLegacyArtifacts() {
    for (const id of LEGACY_STYLE_IDS) {
      removeById(id);
    }

    for (const id of LEGACY_ELEMENT_IDS) {
      removeById(id);
    }

    const root = getRoot();

    if (root) {
      const oldRootAttributes = [
        'data-uwc-on',
        'data-uwc-mounted'
      ];

      for (const attribute of oldRootAttributes) {
        root.removeAttribute(attribute);
      }
    }

    const oldManagedAttributes = [
      'data-uwc-conversation-root',
      'data-uwc-conversation-path',
      'data-uwc-turn',
      'data-uwc-turn-path',
      'data-uwc-composer',
      'data-uwc-composer-path'
    ];

    for (const attribute of oldManagedAttributes) {
      try {
        document
          .querySelectorAll(`[${attribute}]`)
          .forEach((element) => {
            element.removeAttribute(attribute);
          });
      } catch (_) {}
    }
  }

  function isTouchLike() {
    try {
      const coarse =
        typeof matchMedia === 'function' &&
        matchMedia('(pointer: coarse)').matches;

      const touchPoints =
        Number(navigator.maxTouchPoints || 0) > 0;

      return coarse || touchPoints;
    } catch (_) {
      return false;
    }
  }

  function isWideActive() {
    if (!settings.enabled || !settings.wide) {
      return false;
    }

    if (!settings.auto) {
      return true;
    }

    if (
      settings.disableOnTouch &&
      isTouchLike()
    ) {
      return false;
    }

    if (
      settings.disableBelowHeight > 0 &&
      window.innerHeight > 0 &&
      window.innerHeight <
        settings.disableBelowHeight
    ) {
      return false;
    }

    return (
      (window.innerWidth || 0) >=
      settings.autoMinWidth
    );
  }

  function detectCanvas() {
    try {
      runtime.canvasDetected = Boolean(
        document.querySelector(
          SELECTOR.splitViewIndicators
        )
      );
    } catch (_) {
      runtime.canvasDetected = false;
    }

    return runtime.canvasDetected;
  }

  function buildMainCss() {
    const cap =
      settings.cap === 'none'
        ? 'none'
        : `${settings.cap}px`;

    const safeMediaCss = settings.safeMedia
      ? `
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.turn}="1"] img,
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.turn}="1"] video,
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.turn}="1"] iframe,
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.turn}="1"] figure{
  max-width:100%!important;
  box-sizing:border-box!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.turn}="1"] img,
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.turn}="1"] video{
  height:auto!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.turn}="1"] pre{
  max-width:100%!important;
  overflow-x:auto!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.turn}="1"] table{
  display:block!important;
  width:100%!important;
  max-width:100%!important;
  overflow-x:auto!important;
}`
      : '';

    return `
:root[${ATTR.version}="${VERSION}"]{
  --uwc-gutter:clamp(
    ${settings.gutterMin}px,
    ${settings.gutterVw}vw,
    ${settings.gutterMax}px
  );
  --uwc-cap:${cap};
  --uwc-available-width:calc(
    100% - (var(--uwc-gutter) * 2)
  );
  --uwc-content-width:var(--uwc-available-width);
}

:root[${ATTR.version}="${VERSION}"]:not([${ATTR.cap}="none"]){
  --uwc-content-width:min(
    var(--uwc-available-width),
    var(--uwc-cap)
  );
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"] body{
  overflow-x:clip!important;
}

@supports not (overflow-x:clip){
  :root[${ATTR.enabled}="1"][${ATTR.wide}="1"] body{
    overflow-x:hidden!important;
  }
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.conversationRoot}="1"],
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.conversationPath}="1"]{
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  box-sizing:border-box!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.turn}="1"]{
  width:var(--uwc-content-width)!important;
  max-width:var(--uwc-content-width)!important;
  min-width:0!important;
  margin-inline:auto!important;
  box-sizing:border-box!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.turnPath}="1"]{
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  box-sizing:border-box!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.composerPath}="1"]{
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  margin-inline:0!important;
  box-sizing:border-box!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.composer}="1"]{
  width:var(--uwc-content-width)!important;
  max-width:var(--uwc-content-width)!important;
  min-width:0!important;
  margin-inline:auto!important;
  box-sizing:border-box!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"][${ATTR.canvas}="1"]
[${ATTR.turn}="1"],
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"][${ATTR.canvas}="1"]
[${ATTR.composer}="1"]{
  width:calc(
    100% - (var(--uwc-gutter) * 2)
  )!important;
  max-width:calc(
    100% - (var(--uwc-gutter) * 2)
  )!important;
}

:root[${ATTR.enabled}="1"][${ATTR.left}="1"]
[${ATTR.turn}="1"]{
  text-align:left!important;
}

:root[${ATTR.enabled}="1"][${ATTR.left}="1"]
[${ATTR.composer}="1"] textarea,
:root[${ATTR.enabled}="1"][${ATTR.left}="1"]
[${ATTR.composer}="1"] [contenteditable="true"]{
  text-align:left!important;
}

${safeMediaCss}

@media (max-width:1099px), (max-height:559px){
  :root[${ATTR.version}="${VERSION}"]{
    --uwc-gutter:12px;
  }
}

@media print{
  :root[${ATTR.enabled}="1"]
  [${ATTR.turn}="1"]{
    width:100%!important;
    max-width:none!important;
  }
}`.trim();
  }

  function buildUiCss() {
    return `
#${ID.toast}{
  position:fixed!important;
  right:18px!important;
  bottom:18px!important;
  z-index:2147483647!important;
  max-width:min(460px,calc(100vw - 36px))!important;
  padding:10px 13px!important;
  border:1px solid color-mix(in srgb,CanvasText 18%,transparent)!important;
  border-radius:12px!important;
  background:Canvas!important;
  color:CanvasText!important;
  box-shadow:0 10px 32px rgba(0,0,0,.24)!important;
  font:12px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
  pointer-events:none!important;
}

#${ID.modal}{
  position:fixed!important;
  inset:0!important;
  z-index:2147483646!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  padding:18px!important;
  background:rgba(0,0,0,.48)!important;
  color:CanvasText!important;
  font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
}

#${ID.modal} *{
  box-sizing:border-box!important;
}

#${ID.modal} .uwc-panel{
  width:min(780px,100%)!important;
  max-height:min(88vh,880px)!important;
  overflow:auto!important;
  border:1px solid color-mix(in srgb,CanvasText 16%,transparent)!important;
  border-radius:18px!important;
  background:Canvas!important;
  color:CanvasText!important;
  box-shadow:0 22px 80px rgba(0,0,0,.4)!important;
}

#${ID.modal} .uwc-header{
  position:sticky!important;
  top:0!important;
  z-index:2!important;
  display:flex!important;
  align-items:flex-start!important;
  justify-content:space-between!important;
  gap:16px!important;
  padding:18px!important;
  border-bottom:1px solid color-mix(in srgb,CanvasText 12%,transparent)!important;
  background:Canvas!important;
}

#${ID.modal} .uwc-title{
  margin:0!important;
  font-size:18px!important;
  line-height:1.25!important;
  font-weight:700!important;
}

#${ID.modal} .uwc-subtitle{
  margin:5px 0 0!important;
  opacity:.68!important;
  font-size:12px!important;
}

#${ID.modal} .uwc-close{
  width:36px!important;
  min-width:36px!important;
  height:36px!important;
  padding:0!important;
  font-size:20px!important;
}

#${ID.modal} .uwc-body{
  padding:18px!important;
}

#${ID.modal} .uwc-section{
  margin:0 0 16px!important;
  padding:14px!important;
  border:1px solid color-mix(in srgb,CanvasText 12%,transparent)!important;
  border-radius:14px!important;
}

#${ID.modal} .uwc-section h3{
  margin:0 0 12px!important;
  font-size:12px!important;
  text-transform:uppercase!important;
  letter-spacing:.07em!important;
  opacity:.68!important;
}

#${ID.modal} .uwc-grid{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:12px!important;
}

#${ID.modal} .uwc-field{
  display:flex!important;
  flex-direction:column!important;
  gap:6px!important;
}

#${ID.modal} .uwc-check{
  display:flex!important;
  align-items:center!important;
  gap:9px!important;
  min-height:36px!important;
}

#${ID.modal} label{
  font-weight:600!important;
}

#${ID.modal} .uwc-hint{
  font-size:12px!important;
  font-weight:400!important;
  opacity:.65!important;
}

#${ID.modal} input,
#${ID.modal} select,
#${ID.modal} textarea,
#${ID.modal} button{
  color:CanvasText!important;
  background:Canvas!important;
  border:1px solid color-mix(in srgb,CanvasText 18%,transparent)!important;
  border-radius:10px!important;
  font:13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
}

#${ID.modal} input,
#${ID.modal} select,
#${ID.modal} textarea{
  width:100%!important;
  min-height:36px!important;
  padding:8px 10px!important;
}

#${ID.modal} input[type="checkbox"]{
  width:17px!important;
  min-height:17px!important;
  accent-color:CanvasText!important;
}

#${ID.modal} button{
  min-height:36px!important;
  padding:8px 12px!important;
  cursor:pointer!important;
  font-weight:600!important;
}

#${ID.modal} button:hover{
  background:color-mix(in srgb,CanvasText 8%,Canvas)!important;
}

#${ID.modal} button:focus-visible,
#${ID.modal} input:focus-visible,
#${ID.modal} select:focus-visible{
  outline:2px solid CanvasText!important;
  outline-offset:2px!important;
}

#${ID.modal} .uwc-primary{
  background:CanvasText!important;
  color:Canvas!important;
}

#${ID.modal} .uwc-danger{
  border-color:color-mix(in srgb,red 55%,CanvasText 12%)!important;
}

#${ID.modal} .uwc-actions{
  display:flex!important;
  flex-wrap:wrap!important;
  justify-content:flex-end!important;
  gap:8px!important;
}


#${ID.modal} .uwc-status{
  display:flex!important;
  flex-wrap:wrap!important;
  gap:5px!important;
  margin:0 0 16px!important;
  padding:11px 13px!important;
  border:1px solid color-mix(in srgb,CanvasText 12%,transparent)!important;
  border-radius:12px!important;
  background:color-mix(in srgb,CanvasText 5%,Canvas)!important;
  font-size:12px!important;
}

#${ID.modal} .uwc-status span{
  opacity:.68!important;
}

#${ID.modal} .uwc-shortcuts{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:8px!important;
}

#${ID.modal} .uwc-shortcuts span{
  padding:7px 9px!important;
  border:1px solid color-mix(in srgb,CanvasText 10%,transparent)!important;
  border-radius:9px!important;
  background:color-mix(in srgb,CanvasText 4%,Canvas)!important;
  font:12px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace!important;
}

@media (max-width:700px){
  #${ID.modal}{
    align-items:stretch!important;
    padding:8px!important;
  }

  #${ID.modal} .uwc-panel{
    max-height:100%!important;
  }

  #${ID.modal} .uwc-grid{
    grid-template-columns:1fr!important;
  }

  #${ID.modal} .uwc-shortcuts{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }
}

@media (prefers-reduced-motion:reduce){
  #${ID.toast},
  #${ID.modal},
  #${ID.modal} *{
    scroll-behavior:auto!important;
    transition:none!important;
    animation:none!important;
  }
}`.trim();
  }

  function getCssCacheKey() {
    return [
      VERSION,
      settings.cap,
      settings.gutterMin,
      settings.gutterVw,
      settings.gutterMax,
      settings.safeMedia
    ].join('|');
  }

  function getMainCss() {
    const key = getCssCacheKey();

    if (
      runtime.cssCacheKey !== key ||
      !runtime.mainCssCache
    ) {
      runtime.cssCacheKey = key;
      runtime.mainCssCache = buildMainCss();
    }

    return runtime.mainCssCache;
  }

  function getUiCss() {
    if (!runtime.uiCssCache) {
      runtime.uiCssCache = buildUiCss();
    }

    return runtime.uiCssCache;
  }

  function invalidateCssCache() {
    runtime.cssCacheKey = '';
    runtime.mainCssCache = '';
  }

  function ensureStyle(id, content) {
    const head = getHead();

    if (!head) {
      return false;
    }

    let style = document.getElementById(id);

    if (!style) {
      style = document.createElement('style');
      style.id = id;
      style.type = 'text/css';
      head.appendChild(style);
    }

    style.setAttribute('data-version', VERSION);

    if (style.textContent !== content) {
      style.textContent = content;
    }

    return true;
  }

  function removeMainStyle() {
    removeById(ID.style);
  }

  function removeUiStyle() {
    removeById(ID.uiStyle);
  }

  function setRootState() {
    const root = getRoot();

    if (!root) {
      return;
    }

    setAttributeValue(
      root,
      ATTR.version,
      VERSION
    );

    setAttributeValue(
      root,
      ATTR.cap,
      settings.cap
    );

    setBooleanAttribute(
      root,
      ATTR.enabled,
      settings.enabled
    );

    setBooleanAttribute(
      root,
      ATTR.wide,
      isWideActive()
    );

    setBooleanAttribute(
      root,
      ATTR.left,
      settings.enabled &&
        settings.left
    );

    setBooleanAttribute(
      root,
      ATTR.canvas,
      settings.enabled &&
        settings.canvasSafeMode &&
        runtime.canvasDetected
    );
  }

  function clearRootState() {
    const root = getRoot();

    if (!root) {
      return;
    }

    root.removeAttribute(
      ATTR.enabled
    );

    root.removeAttribute(
      ATTR.wide
    );

    root.removeAttribute(
      ATTR.left
    );

    root.removeAttribute(
      ATTR.canvas
    );

    root.removeAttribute(
      ATTR.cap
    );

    root.removeAttribute(
      ATTR.version
    );
  }

  function createDesiredMarkers() {
    return new Map(
      MANAGED_MARKERS.map((attribute) => [
        attribute,
        new Set()
      ])
    );
  }

  function addDesiredMarker(
    desired,
    attribute,
    element
  ) {
    if (!isConnectedElement(element)) {
      return;
    }

    desired.get(attribute)?.add(element);
  }

  function applyMarkerDiff(desired) {
    for (const attribute of MANAGED_MARKERS) {
      const previous =
        runtime.marked.get(attribute) ||
        new Set();

      const next =
        desired.get(attribute) ||
        new Set();

      for (const element of previous) {
        if (
          !element.isConnected ||
          !next.has(element)
        ) {
          element.removeAttribute(attribute);
        }
      }

      for (const element of next) {
        if (!previous.has(element)) {
          element.setAttribute(
            attribute,
            '1'
          );
        }
      }

      runtime.marked.set(
        attribute,
        next
      );
    }
  }

  function clearManagedMarkers() {
    for (const attribute of MANAGED_MARKERS) {
      const elements =
        runtime.marked.get(attribute) ||
        new Set();

      for (const element of elements) {
        if (element?.removeAttribute) {
          element.removeAttribute(attribute);
        }
      }

      runtime.marked.set(
        attribute,
        new Set()
      );
    }
  }

  function nearestMain(element) {
    if (!isConnectedElement(element)) {
      return null;
    }

    try {
      return element.closest(
        SELECTOR.main
      );
    } catch (_) {
      return null;
    }
  }

  function commonAncestor(
    elements,
    boundary
  ) {
    const valid =
      elements.filter(
        isConnectedElement
      );

    if (valid.length === 0) {
      return null;
    }

    let candidate = valid[0];

    while (
      candidate &&
      candidate !== boundary &&
      !valid.every((element) =>
        candidate.contains(element)
      )
    ) {
      candidate =
        candidate.parentElement;
    }

    if (
      candidate &&
      valid.every((element) =>
        candidate.contains(element)
      )
    ) {
      return candidate;
    }

    return boundary || null;
  }

  function addPath(
    desired,
    start,
    stopExclusive,
    attribute,
    maxDepth
  ) {
    let current = start;
    let depth = 0;

    while (
      current &&
      current !== stopExclusive &&
      depth < maxDepth
    ) {
      addDesiredMarker(
        desired,
        attribute,
        current
      );

      current =
        current.parentElement;

      depth += 1;
    }
  }

  function queryConversationTurns() {
    let preferred = [];

    try {
      preferred = Array.from(
        document.querySelectorAll(
          SELECTOR.preferredTurns
        )
      ).filter(isConnectedElement);
    } catch (_) {}

    if (preferred.length > 0) {
      return Array.from(
        new Set(preferred)
      );
    }

    let fallbackMessages = [];

    try {
      fallbackMessages = Array.from(
        document.querySelectorAll(
          SELECTOR.fallbackMessages
        )
      ).filter(isConnectedElement);
    } catch (_) {}

    const fallbackTurns =
      fallbackMessages
        .map((message) => {
          return (
            message.closest('article') ||
            message.parentElement
          );
        })
        .filter(isConnectedElement);

    return Array.from(
      new Set(fallbackTurns)
    );
  }

  function findTurnContentAnchor(turn) {
    if (!isConnectedElement(turn)) {
      return null;
    }

    try {
      return (
        turn.querySelector(
          SELECTOR.turnContent
        ) ||
        turn.firstElementChild ||
        turn
      );
    } catch (_) {
      return (
        turn.firstElementChild ||
        turn
      );
    }
  }

  function markConversation(desired) {
    const turns =
      queryConversationTurns();

    runtime.lastTurnCount =
      turns.length;

    if (turns.length === 0) {
      return;
    }

    const mainCounts =
      new Map();

    for (const turn of turns) {
      const main =
        nearestMain(turn);

      if (!main) {
        continue;
      }

      mainCounts.set(
        main,
        (mainCounts.get(main) || 0) + 1
      );
    }

    const main =
      Array.from(
        mainCounts.entries()
      ).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];

    if (!main) {
      return;
    }

    const mainTurns =
      turns.filter((turn) =>
        main.contains(turn)
      );

    if (mainTurns.length === 0) {
      return;
    }

    let conversationRoot =
      commonAncestor(
        mainTurns,
        main
      ) || main;

    if (
      mainTurns.length === 1 &&
      conversationRoot === mainTurns[0]
    ) {
      let current =
        conversationRoot.parentElement;

      let hops = 0;

      while (
        current &&
        current !== main &&
        hops < 4
      ) {
        conversationRoot = current;

        if (
          current.children.length > 1
        ) {
          break;
        }

        current =
          current.parentElement;

        hops += 1;
      }
    }

    addDesiredMarker(
      desired,
      ATTR.conversationRoot,
      conversationRoot
    );

    for (const turn of mainTurns) {
      addDesiredMarker(
        desired,
        ATTR.turn,
        turn
      );

      addPath(
        desired,
        turn.parentElement,
        conversationRoot,
        ATTR.conversationPath,
        CONFIG.maxConversationPathDepth
      );

      const anchor =
        findTurnContentAnchor(turn);

      if (
        anchor &&
        anchor !== turn
      ) {
        addPath(
          desired,
          anchor,
          turn,
          ATTR.turnPath,
          CONFIG.maxTurnPathDepth
        );
      }

      let direct =
        turn.firstElementChild;

      let directDepth = 0;

      while (
        direct &&
        directDepth < 3 &&
        direct.children.length === 1
      ) {
        addDesiredMarker(
          desired,
          ATTR.turnPath,
          direct
        );

        direct =
          direct.firstElementChild;

        directDepth += 1;
      }
    }
  }

  function findComposerInput() {
    let candidates = [];

    try {
      candidates = Array.from(
        document.querySelectorAll(
          SELECTOR.composerInput
        )
      )
        .filter(isConnectedElement)
        .slice(-CONFIG.maxComposerCandidates);
    } catch (_) {}

    if (candidates.length === 0) {
      return null;
    }

    const isExcluded = (element) => {
      try {
        return Boolean(
          element.closest(
            SELECTOR.excludedComposerAncestor
          )
        );
      } catch (_) {
        return false;
      }
    };

    const isVisible = (element) => {
      try {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      } catch (_) {
        return true;
      }
    };

    const focused =
      document.activeElement;

    if (
      isElement(focused) &&
      candidates.includes(focused) &&
      !isExcluded(focused) &&
      isVisible(focused)
    ) {
      return focused;
    }

    const scored = candidates
      .filter((element) =>
        !isExcluded(element) &&
        isVisible(element)
      )
      .map((element, index) => {
        let score = index;

        try {
          if (
            element.matches(
              '[data-testid="composer-input"],[data-testid="composer:input"]'
            )
          ) {
            score += 1000;
          }

          if (
            element.closest(
              'form[data-type="unified-composer"]'
            )
          ) {
            score += 500;
          }

          const rect =
            element.getBoundingClientRect();

          score += Math.max(
            0,
            Math.min(
              window.innerHeight || 0,
              rect.bottom
            )
          ) / 10;
        } catch (_) {}

        return {
          element,
          score
        };
      })
      .sort((a, b) =>
        b.score - a.score
      );

    return scored[0]?.element || null;
  }

  function markComposer(desired) {
    if (!settings.widenComposer) {
      return;
    }

    const input =
      findComposerInput();

    if (!input) {
      return;
    }

    const main =
      nearestMain(input);

    if (!main) {
      return;
    }

    let shell = null;

    try {
      shell = input.closest(
        SELECTOR.composerShell
      );
    } catch (_) {}

    if (!shell) {
      shell =
        input.closest('form') ||
        input.parentElement;
    }

    if (
      !shell ||
      !main.contains(shell)
    ) {
      return;
    }

    addDesiredMarker(
      desired,
      ATTR.composer,
      shell
    );

    let current =
      shell.parentElement;

    let depth = 0;

    while (
      current &&
      current !== main &&
      depth <
        CONFIG.maxComposerPathDepth
    ) {
      addDesiredMarker(
        desired,
        ATTR.composerPath,
        current
      );

      if (
        depth >= 1 &&
        current.parentElement &&
        current.parentElement
          .children.length > 2
      ) {
        break;
      }

      current =
        current.parentElement;

      depth += 1;
    }
  }

  function performScan() {
    if (shouldPauseWork()) {
      runtime.deferredScan = true;
      return;
    }

    const startedAt = nowMs();

    runtime.lastScanAt = Date.now();
    runtime.lastError = null;
    runtime.deferredScan = false;

    try {
      const desired = createDesiredMarkers();

      detectCanvas();
      markConversation(desired);
      markComposer(desired);

      applyMarkerDiff(desired);
      setRootState();
      runtime.scanCount += 1;
    } catch (error) {
      runtime.lastError = String(
        error?.message || error
      );

      console.error(
        '[UltraWide] Layout scan failed:',
        error
      );
    } finally {
      if (settings.performanceTelemetry) {
        runtime.lastScanDurationMs =
          Math.max(0, nowMs() - startedAt);
      }
    }
  }

  function cancelScheduledScan() {
    if (runtime.scanTimer) {
      clearTimeout(
        runtime.scanTimer
      );

      runtime.scanTimer = 0;
    }

    if (
      runtime.idleCallback &&
      typeof cancelIdleCallback ===
        'function'
    ) {
      cancelIdleCallback(
        runtime.idleCallback
      );

      runtime.idleCallback = 0;
    }

    if (runtime.animationFrame) {
      cancelAnimationFrame(
        runtime.animationFrame
      );

      runtime.animationFrame = 0;
    }
  }

  function scheduleScan(force = false) {
    if (
      !runtime.started &&
      !force
    ) {
      return;
    }

    if (shouldPauseWork()) {
      runtime.deferredScan = true;
      return;
    }

    if (force) {
      cancelScheduledScan();
    } else if (
      runtime.scanTimer ||
      runtime.idleCallback ||
      runtime.animationFrame
    ) {
      return;
    }

    const run = () => {
      runtime.scanTimer = 0;
      runtime.idleCallback = 0;
      runtime.animationFrame = 0;

      if (
        runtime.started ||
        force
      ) {
        performScan();
      }
    };

    if (force) {
      runtime.animationFrame =
        requestAnimationFrame(run);

      return;
    }

    runtime.scanTimer =
      window.setTimeout(() => {
        runtime.scanTimer = 0;

        if (
          typeof requestIdleCallback ===
          'function'
        ) {
          runtime.idleCallback =
            requestIdleCallback(
              run,
              {
                timeout:
                  CONFIG.idleTimeoutMs
              }
            );
        } else {
          run();
        }
      }, settings.scanDebounceMs);
  }

  function applyStyles() {
    ensureStyle(
      ID.uiStyle,
      getUiCss()
    );

    if (!settings.enabled) {
      removeMainStyle();
      clearRootState();
      clearManagedMarkers();
      return;
    }

    ensureStyle(
      ID.style,
      getMainCss()
    );

    setRootState();
    scheduleScan(true);
  }

  function showToast(message) {
    if (!settings.toast) {
      return;
    }

    ensureStyle(
      ID.uiStyle,
      getUiCss()
    );

    const parent =
      getBody() ||
      getRoot();

    if (!parent) {
      return;
    }

    let toast =
      document.getElementById(
        ID.toast
      );

    if (!toast) {
      toast =
        document.createElement('div');

      toast.id = ID.toast;

      toast.setAttribute(
        'role',
        'status'
      );

      toast.setAttribute(
        'aria-live',
        'polite'
      );

      parent.appendChild(toast);
    }

    toast.textContent =
      String(
        message ||
        'UltraWide updated'
      );

    if (runtime.toastTimer) {
      clearTimeout(
        runtime.toastTimer
      );
    }

    runtime.toastTimer =
      window.setTimeout(() => {
        runtime.toastTimer = 0;
        removeById(ID.toast);
      }, settings.toastMs);
  }

  function getStatusText() {
    return [
      `UltraWide ${
        settings.enabled
          ? 'on'
          : 'off'
      }`,
      `wide ${
        isWideActive()
          ? 'active'
          : 'inactive'
      }`,
      `turns ${
        runtime.lastTurnCount
      }`,
      `split ${
        runtime.canvasDetected
          ? 'yes'
          : 'no'
      }`,
      `cap ${settings.cap}`
    ].join(' | ');
  }

  function restartTimers() {
    if (!runtime.started) {
      return;
    }

    if (runtime.repairTimer) {
      clearInterval(
        runtime.repairTimer
      );
    }

    if (runtime.routeTimer) {
      clearInterval(
        runtime.routeTimer
      );
    }

    runtime.repairTimer =
      window.setInterval(() => {
        if (shouldPauseWork()) {
          return;
        }

        try {
          repair();
        } catch (error) {
          runtime.lastError =
            String(
              error?.message ||
              error
            );

          console.error(
            '[UltraWide] Repair failed:',
            error
          );
        }
      }, settings.repairIntervalMs);

    runtime.routeTimer =
      window.setInterval(() => {
        if (!shouldPauseWork()) {
          checkRoute();
        }
      }, settings.routePollMs);
  }

  function commit(
    message,
    restartRuntimeTimers = false
  ) {
    const saved = saveSettings();
    invalidateCssCache();
    applyStyles();
    syncSettingsModal();

    if (restartRuntimeTimers) {
      restartTimers();
    }

    if (runtime.started) {
      refreshMenus();
    }

    showToast(
      saved
        ? (message || getStatusText())
        : 'UltraWide updated, but settings could not be saved'
    );
  }

  function setOptions(patch) {
    if (
      !patch ||
      typeof patch !== 'object' ||
      Array.isArray(patch)
    ) {
      return false;
    }

    if (
      Object.prototype
        .hasOwnProperty.call(
          patch,
          'cap'
        ) &&
      !CAPS.includes(
        String(patch.cap)
      )
    ) {
      throw new Error(
        `Invalid cap: ${String(patch.cap)}`
      );
    }

    const previousRepair =
      settings.repairIntervalMs;

    const previousRoute =
      settings.routePollMs;

    Object.assign(
      settings,
      normalizeSettings({
        ...settings,
        ...patch
      })
    );

    const timersChanged =
      previousRepair !==
        settings.repairIntervalMs ||
      previousRoute !==
        settings.routePollMs;

    commit(
      getStatusText(),
      timersChanged
    );

    return true;
  }

  function resetSettings() {
    Object.assign(
      settings,
      DEFAULTS
    );

    commit(
      'UltraWide settings reset',
      true
    );
  }

  function cycleCap() {
    const index =
      CAPS.indexOf(settings.cap);

    settings.cap =
      CAPS[
        (index + 1) % CAPS.length
      ] || 'none';

    commit(
      `UltraWide cap: ${settings.cap}`
    );
  }

  function checkRoute() {
    if (
      runtime.href ===
      location.href
    ) {
      return false;
    }

    runtime.href =
      location.href;

    scheduleScan(true);
    return true;
  }

  function scheduleRouteCheck() {
    if (runtime.routeDelayTimer) {
      clearTimeout(
        runtime.routeDelayTimer
      );
    }

    runtime.routeDelayTimer =
      window.setTimeout(() => {
        runtime.routeDelayTimer = 0;
        checkRoute();
      }, CONFIG.routeDelayMs);
  }

  function wrapHistoryMethod(original) {
    return function wrappedHistoryMethod(
      ...args
    ) {
      const result =
        original.apply(
          this,
          args
        );

      scheduleRouteCheck();
      return result;
    };
  }

  function installHistoryHooks() {
    try {
      runtime.originalPushState ||=
        history.pushState;

      runtime.originalReplaceState ||=
        history.replaceState;

      if (
        history.pushState ===
        runtime.originalPushState
      ) {
        runtime.wrappedPushState =
          wrapHistoryMethod(
            runtime.originalPushState
          );

        history.pushState =
          runtime.wrappedPushState;
      }

      if (
        history.replaceState ===
        runtime.originalReplaceState
      ) {
        runtime.wrappedReplaceState =
          wrapHistoryMethod(
            runtime.originalReplaceState
          );

        history.replaceState =
          runtime.wrappedReplaceState;
      }
    } catch (_) {}
  }

  function restoreHistoryHooks() {
    try {
      if (
        runtime.originalPushState &&
        runtime.wrappedPushState &&
        history.pushState ===
          runtime.wrappedPushState
      ) {
        history.pushState =
          runtime.originalPushState;
      }

      if (
        runtime.originalReplaceState &&
        runtime.wrappedReplaceState &&
        history.replaceState ===
          runtime.wrappedReplaceState
      ) {
        history.replaceState =
          runtime.originalReplaceState;
      }
    } catch (_) {}

    runtime.wrappedPushState = null;
    runtime.wrappedReplaceState = null;
  }

  function nodeMayRequireScan(node) {
    if (!isElement(node)) {
      return false;
    }

    if (
      node.id === ID.style ||
      node.id === ID.uiStyle ||
      node.id === ID.modal ||
      node.id === ID.toast
    ) {
      return false;
    }

    try {
      if (
        node.matches(
          SELECTOR.preferredTurns
        ) ||
        node.matches(
          SELECTOR.fallbackMessages
        ) ||
        node.matches(
          SELECTOR.composerInput
        ) ||
        node.matches(
          SELECTOR.splitViewIndicators
        )
      ) {
        return true;
      }

      return Boolean(
        node.querySelector(
          [
            SELECTOR.preferredTurns,
            SELECTOR.fallbackMessages,
            SELECTOR.composerInput,
            SELECTOR.splitViewIndicators
          ].join(',')
        )
      );
    } catch (_) {
      return false;
    }
  }

  function mutationNeedsScan(records) {
    if (!records || records.length === 0) {
      return false;
    }

    const recordLimit = Math.min(
      records.length,
      CONFIG.maxMutationRecords
    );

    for (let recordIndex = 0; recordIndex < recordLimit; recordIndex += 1) {
      const record = records[recordIndex];
      const added = record.addedNodes;
      const removed = record.removedNodes;
      const addedLimit = Math.min(
        added?.length || 0,
        CONFIG.maxMutationNodes
      );
      const removedLimit = Math.min(
        removed?.length || 0,
        CONFIG.maxMutationNodes
      );

      for (let index = 0; index < addedLimit; index += 1) {
        if (nodeMayRequireScan(added[index])) {
          return true;
        }
      }

      for (let index = 0; index < removedLimit; index += 1) {
        if (nodeMayRequireScan(removed[index])) {
          return true;
        }
      }

      if (
        (added?.length || 0) > CONFIG.maxMutationNodes ||
        (removed?.length || 0) > CONFIG.maxMutationNodes
      ) {
        return true;
      }
    }

    return records.length > CONFIG.maxMutationRecords;
  }

  function onBodyMutations(records) {
    runtime.mutationBatchCount += 1;

    if (mutationNeedsScan(records)) {
      scheduleScan(false);
    }
  }

  function onHeadMutations() {
    if (
      !document.getElementById(
        ID.uiStyle
      )
    ) {
      ensureStyle(
        ID.uiStyle,
        getUiCss()
      );
    }

    if (
      settings.enabled &&
      !document.getElementById(
        ID.style
      )
    ) {
      ensureStyle(
        ID.style,
        getMainCss()
      );

      scheduleScan(true);
    }
  }

  function attachObservers() {
    const head = getHead();
    const body = getBody();

    if (
      head &&
      head !== runtime.observedHead
    ) {
      runtime.headObserver
        ?.disconnect();

      runtime.headObserver =
        new MutationObserver(
          onHeadMutations
        );

      runtime.headObserver.observe(
        head,
        {
          childList: true
        }
      );

      runtime.observedHead = head;
    }

    if (
      body &&
      body !== runtime.observedBody
    ) {
      runtime.bodyObserver
        ?.disconnect();

      runtime.bodyObserver =
        new MutationObserver(
          onBodyMutations
        );

      runtime.bodyObserver.observe(
        body,
        {
          childList: true,
          subtree: true
        }
      );

      runtime.observedBody = body;
    }

    return Boolean(
      runtime.observedHead &&
      runtime.observedBody
    );
  }

  function installObservers() {
    if (attachObservers()) {
      return;
    }

    const root = getRoot();

    if (!root) {
      return;
    }

    runtime.bootstrapObserver
      ?.disconnect();

    runtime.bootstrapObserver =
      new MutationObserver(() => {
        if (!attachObservers()) {
          return;
        }

        runtime.bootstrapObserver
          ?.disconnect();

        runtime.bootstrapObserver =
          null;

        scheduleScan(true);
      });

    runtime.bootstrapObserver.observe(
      root,
      {
        childList: true,
        subtree: true
      }
    );
  }

  function disconnectObservers() {
    runtime.bodyObserver
      ?.disconnect();

    runtime.headObserver
      ?.disconnect();

    runtime.bootstrapObserver
      ?.disconnect();

    runtime.bodyObserver = null;
    runtime.headObserver = null;
    runtime.bootstrapObserver = null;

    runtime.observedBody = null;
    runtime.observedHead = null;
  }

  function repair() {
    if (!runtime.started) {
      return;
    }

    attachObservers();

    if (!settings.enabled) {
      removeMainStyle();
      clearRootState();
      clearManagedMarkers();
      return;
    }

    if (!document.getElementById(ID.style)) {
      ensureStyle(ID.style, getMainCss());
    }

    if (!document.getElementById(ID.uiStyle)) {
      ensureStyle(ID.uiStyle, getUiCss());
    }

    checkRoute();

    if (shouldPauseWork()) {
      runtime.deferredScan = true;
      return;
    }

    const conversationMissing =
      runtime.lastTurnCount > 0 &&
      !hasConnectedMarker(ATTR.turn);

    const composerMissing =
      settings.widenComposer &&
      !hasConnectedMarker(ATTR.composer);

    if (
      hasDisconnectedMarkers() ||
      conversationMissing ||
      composerMissing
    ) {
      scheduleScan(false);
    }

    setRootState();
  }

  function isTypingTarget(target) {
    if (!target) {
      return false;
    }

    const element =
      target instanceof Element
        ? target
        : target.parentElement;

    return Boolean(
      element?.closest(
        [
          'input',
          'textarea',
          'select',
          '[contenteditable="true"]',
          '[role="textbox"]'
        ].join(',')
      )
    );
  }

  function exactShortcut(
    event,
    key
  ) {
    return (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      String(
        event.key || ''
      ).toLowerCase() === key
    );
  }

  function onKeydown(event) {
    if (
      !event ||
      event.defaultPrevented ||
      isTypingTarget(event.target)
    ) {
      return;
    }

    if (exactShortcut(event, 'o')) {
      event.preventDefault();

      settings.enabled =
        !settings.enabled;

      commit(
        `UltraWide script: ${
          settings.enabled
            ? 'on'
            : 'off'
        }`
      );

      return;
    }

    if (exactShortcut(event, 'u')) {
      event.preventDefault();

      settings.wide =
        !settings.wide;

      commit(
        `UltraWide mode: ${
          settings.wide
            ? 'on'
            : 'off'
        }`
      );

      return;
    }

    if (exactShortcut(event, 'l')) {
      event.preventDefault();

      settings.left =
        !settings.left;

      commit(
        `Left alignment: ${
          settings.left
            ? 'on'
            : 'off'
        }`
      );

      return;
    }

    if (exactShortcut(event, 'm')) {
      event.preventDefault();
      cycleCap();
      return;
    }

    if (exactShortcut(event, 'a')) {
      event.preventDefault();

      settings.auto =
        !settings.auto;

      commit(
        `Adaptive mode: ${
          settings.auto
            ? 'on'
            : 'off'
        }`
      );

      return;
    }

    if (exactShortcut(event, 'c')) {
      event.preventDefault();

      settings.canvasSafeMode =
        !settings.canvasSafeMode;

      commit(
        `Split-view safe mode: ${
          settings.canvasSafeMode
            ? 'on'
            : 'off'
        }`
      );

      return;
    }

    if (exactShortcut(event, 's')) {
      event.preventDefault();
      openSettings();
      return;
    }

    if (exactShortcut(event, 'r')) {
      event.preventDefault();
      resetSettings();
    }
  }

  function onEnvironmentChange() {
    setRootState();
    scheduleScan(false);
  }

  function bindEvents() {
    runtime.eventController
      ?.abort();

    runtime.eventController =
      new AbortController();

    const signal =
      runtime.eventController.signal;

    window.addEventListener(
      'keydown',
      onKeydown,
      {
        capture: true,
        signal
      }
    );

    window.addEventListener(
      'resize',
      onEnvironmentChange,
      {
        passive: true,
        signal
      }
    );

    window.addEventListener(
      'orientationchange',
      onEnvironmentChange,
      {
        passive: true,
        signal
      }
    );

    window.addEventListener(
      'pageshow',
      onEnvironmentChange,
      {
        passive: true,
        signal
      }
    );

    window.addEventListener(
      'focus',
      onEnvironmentChange,
      {
        passive: true,
        signal
      }
    );

    window.addEventListener(
      'popstate',
      scheduleRouteCheck,
      {
        passive: true,
        signal
      }
    );

    window.addEventListener(
      'hashchange',
      scheduleRouteCheck,
      {
        passive: true,
        signal
      }
    );

    try {
      if (
        window.navigation &&
        typeof window.navigation.addEventListener ===
          'function'
      ) {
        window.navigation.addEventListener(
          'navigate',
          scheduleRouteCheck,
          {
            signal
          }
        );
      }
    } catch (_) {}

    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) {
          if (runtime.deferredScan) {
            scheduleScan(true);
          } else {
            onEnvironmentChange();
          }
        }
      },
      {
        passive: true,
        signal
      }
    );
  }

  function unbindEvents() {
    runtime.eventController
      ?.abort();

    runtime.eventController =
      null;
  }

  function unregisterMenus() {
    for (const commandId of runtime.menuCommandIds.values()) {
      try {
        if (
          commandId !== undefined &&
          commandId !== null &&
          typeof GM_unregisterMenuCommand ===
            'function'
        ) {
          GM_unregisterMenuCommand(commandId);
        }
      } catch (_) {}
    }

    runtime.menuCommandIds.clear();
    runtime.menusRegistered = false;
  }

  function registerMenu(
    key,
    label,
    callback,
    accessKey
  ) {
    try {
      if (
        typeof GM_registerMenuCommand !==
        'function'
      ) {
        return null;
      }

      const commandId =
        GM_registerMenuCommand(
          label,
          callback,
          accessKey
        );

      runtime.menuCommandIds.set(
        key,
        commandId
      );

      return commandId;
    } catch (_) {
      return null;
    }
  }

  function menuStateLabel(
    icon,
    label,
    active,
    detail = ''
  ) {
    const state =
      active ? 'ON' : 'OFF';

    return `${icon} ${label}: ${state}${
      detail ? ` · ${detail}` : ''
    }`;
  }

  function toggleSetting(
    key,
    label,
    options = {}
  ) {
    settings[key] =
      !settings[key];

    commit(
      `${label}: ${
        settings[key]
          ? 'on'
          : 'off'
      }`,
      Boolean(options.restartTimers)
    );
  }

  function refreshMenus() {
    unregisterMenus();
    registerMenus();
  }

  function registerMenus() {
    if (runtime.menusRegistered) {
      return;
    }

    runtime.menusRegistered = true;

    registerMenu(
      'settings',
      `⚙️ Open UltraWide settings · v${VERSION}`,
      openSettings,
      's'
    );

    registerMenu(
      'enabled',
      menuStateLabel(
        '⏻',
        'Script',
        settings.enabled
      ),
      () => {
        toggleSetting(
          'enabled',
          'UltraWide script'
        );
      },
      'o'
    );

    registerMenu(
      'wide',
      menuStateLabel(
        '↔',
        'UltraWide',
        settings.wide,
        isWideActive()
          ? 'active'
          : 'inactive'
      ),
      () => {
        toggleSetting(
          'wide',
          'UltraWide mode'
        );
      },
      'u'
    );

    registerMenu(
      'left',
      menuStateLabel(
        '⇤',
        'Left alignment',
        settings.left
      ),
      () => {
        toggleSetting(
          'left',
          'Left alignment'
        );
      },
      'l'
    );

    registerMenu(
      'cap',
      `📏 Width cap: ${
        settings.cap === 'none'
          ? 'No limit'
          : `${settings.cap}px`
      } · cycle`,
      cycleCap,
      'm'
    );

    registerMenu(
      'auto',
      menuStateLabel(
        '⚡',
        'Adaptive mode',
        settings.auto,
        `${settings.autoMinWidth}px minimum`
      ),
      () => {
        toggleSetting(
          'auto',
          'Adaptive mode'
        );
      },
      'a'
    );

    registerMenu(
      'composer',
      menuStateLabel(
        '✍',
        'Wide composer',
        settings.widenComposer
      ),
      () => {
        toggleSetting(
          'widenComposer',
          'Wide composer'
        );
      }
    );

    registerMenu(
      'canvas',
      menuStateLabel(
        '▣',
        'Split-view safe mode',
        settings.canvasSafeMode,
        runtime.canvasDetected
          ? 'Canvas detected'
          : 'no Canvas'
      ),
      () => {
        toggleSetting(
          'canvasSafeMode',
          'Split-view safe mode'
        );
      },
      'c'
    );

    registerMenu(
      'media',
      menuStateLabel(
        '▧',
        'Safe media',
        settings.safeMedia
      ),
      () => {
        toggleSetting(
          'safeMedia',
          'Safe media constraints'
        );
      }
    );

    registerMenu(
      'pause-hidden',
      menuStateLabel(
        '⏸',
        'Pause in hidden tabs',
        settings.pauseWhenHidden,
        runtime.deferredScan
          ? 'scan deferred'
          : 'idle'
      ),
      () => {
        toggleSetting(
          'pauseWhenHidden',
          'Pause in hidden tabs'
        );
      }
    );

    registerMenu(
      'telemetry',
      menuStateLabel(
        '◷',
        'Performance telemetry',
        settings.performanceTelemetry,
        `${runtime.lastScanDurationMs.toFixed(1)} ms last scan`
      ),
      () => {
        toggleSetting(
          'performanceTelemetry',
          'Performance telemetry'
        );
      }
    );

    registerMenu(
      'scan',
      `🔄 Force layout scan · ${runtime.lastTurnCount} turns`,
      () => {
        scheduleScan(true);
        showToast(
          'UltraWide layout rescanned'
        );
        window.setTimeout(
          refreshMenus,
          0
        );
      }
    );

    registerMenu(
      'diagnostics',
      '🩺 Copy diagnostics',
      () => {
        void copyDiagnostics();
      }
    );

    registerMenu(
      'reset',
      '♻ Reset all settings',
      () => {
        if (
          window.confirm(
            'Reset every UltraWide setting to its default value?'
          )
        ) {
          resetSettings();
        }
      },
      'r'
    );
  }

  function createElement(
    tag,
    attributes = {},
    children = []
  ) {
    const element =
      document.createElement(tag);

    for (
      const [key, value] of
      Object.entries(attributes)
    ) {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'text') {
        element.textContent = value;
      } else if (key === 'dataset') {
        Object.assign(
          element.dataset,
          value
        );
      } else if (
        key.startsWith('on') &&
        typeof value === 'function'
      ) {
        element.addEventListener(
          key.slice(2).toLowerCase(),
          value
        );
      } else if (
        value !== null &&
        value !== undefined &&
        value !== false
      ) {
        element.setAttribute(
          key,
          String(value)
        );
      }
    }

    for (const child of children) {
      if (
        child === null ||
        child === undefined
      ) {
        continue;
      }

      element.appendChild(
        typeof child === 'string'
          ? document.createTextNode(child)
          : child
      );
    }

    return element;
  }

  function createCheckbox(
    key,
    label,
    hint = ''
  ) {
    const id =
      `uwc-${key}`;

    const input =
      createElement(
        'input',
        {
          id,
          type: 'checkbox',
          dataset: {
            setting: key
          }
        }
      );

    input.checked =
      Boolean(settings[key]);

    input.addEventListener(
      'change',
      () => {
        if (
          runtime.modalSyncing
        ) {
          return;
        }

        setOptions({
          [key]: input.checked
        });
      }
    );

    return createElement(
      'label',
      {
        className: 'uwc-check',
        for: id
      },
      [
        input,
        createElement(
          'span',
          {},
          [
            label,
            hint
              ? createElement(
                  'span',
                  {
                    className:
                      'uwc-hint',
                    text: ` ${hint}`
                  }
                )
              : null
          ]
        )
      ]
    );
  }

  function createNumberInput(
    key,
    label,
    hint = '',
    step = '1'
  ) {
    const id =
      `uwc-${key}`;

    const input =
      createElement(
        'input',
        {
          id,
          type: 'number',
          min: LIMITS[key]?.[0],
          max: LIMITS[key]?.[1],
          step,
          value: settings[key],
          dataset: {
            setting: key
          }
        }
      );

    input.addEventListener(
      'change',
      () => {
        if (
          runtime.modalSyncing
        ) {
          return;
        }

        setOptions({
          [key]: input.value
        });
      }
    );

    return createElement(
      'div',
      {
        className: 'uwc-field'
      },
      [
        createElement(
          'label',
          {
            for: id,
            text: label
          }
        ),
        input,
        hint
          ? createElement(
              'div',
              {
                className:
                  'uwc-hint',
                text: hint
              }
            )
          : null
      ]
    );
  }

  function createCapInput() {
    const select =
      createElement(
        'select',
        {
          id: 'uwc-cap',
          dataset: {
            setting: 'cap'
          }
        }
      );

    for (const cap of CAPS) {
      const option =
        createElement(
          'option',
          {
            value: cap,
            text:
              cap === 'none'
                ? 'No limit'
                : `${cap}px`
          }
        );

      option.selected =
        settings.cap === cap;

      select.appendChild(option);
    }

    select.addEventListener(
      'change',
      () => {
        if (
          runtime.modalSyncing
        ) {
          return;
        }

        setOptions({
          cap: select.value
        });
      }
    );

    return createElement(
      'div',
      {
        className: 'uwc-field'
      },
      [
        createElement(
          'label',
          {
            for: 'uwc-cap',
            text:
              'Maximum content width'
          }
        ),
        select,
        createElement(
          'div',
          {
            className: 'uwc-hint',
            text:
              'No limit uses the complete available chat-pane width.'
          }
        )
      ]
    );
  }

  function createSection(
    title,
    children
  ) {
    return createElement(
      'section',
      {
        className:
          'uwc-section'
      },
      [
        createElement(
          'h3',
          { text: title }
        ),
        ...children
      ]
    );
  }

  function syncSettingsModal() {
    const modal =
      document.getElementById(
        ID.modal
      );

    if (
      !modal ||
      runtime.modalSyncing
    ) {
      return;
    }

    runtime.modalSyncing = true;

    try {
      for (
        const element of
        modal.querySelectorAll(
          '[data-setting]'
        )
      ) {
        const key =
          element.dataset.setting;

        if (!(key in settings)) {
          continue;
        }

        if (
          element instanceof
          HTMLInputElement
        ) {
          if (
            element.type ===
            'checkbox'
          ) {
            element.checked =
              Boolean(settings[key]);
          } else {
            element.value =
              String(settings[key]);
          }
        } else if (
          element instanceof
          HTMLSelectElement
        ) {
          element.value =
            String(settings[key]);
        }
      }

      const statusTitle =
        modal.querySelector(
          '[data-role="status-title"]'
        );

      const statusDetail =
        modal.querySelector(
          '[data-role="status-detail"]'
        );

      if (statusTitle) {
        statusTitle.textContent =
          isWideActive()
            ? 'UltraWide is active'
            : 'UltraWide is inactive';
      }

      if (statusDetail) {
        statusDetail.textContent =
          ` ${getStatusText()}`;
      }
    } finally {
      runtime.modalSyncing = false;
    }
  }

  function closeSettings() {
    removeById(ID.modal);

    const returnFocus =
      runtime.modalReturnFocus;

    runtime.modalReturnFocus = null;

    if (
      isConnectedElement(returnFocus) &&
      typeof returnFocus.focus ===
        'function'
    ) {
      returnFocus.focus({
        preventScroll: true
      });
    }
  }

  function getFocusableElements(container) {
    if (!isConnectedElement(container)) {
      return [];
    }

    return Array.from(
      container.querySelectorAll(
        [
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          'a[href]',
          '[tabindex]:not([tabindex="-1"])'
        ].join(',')
      )
    ).filter((element) => {
      try {
        return (
          element.getClientRects().length > 0 &&
          element.getAttribute(
            'aria-hidden'
          ) !== 'true'
        );
      } catch (_) {
        return true;
      }
    });
  }

  function openSettings() {
    ensureStyle(
      ID.uiStyle,
      getUiCss()
    );

    const existing =
      document.getElementById(
        ID.modal
      );

    if (existing) {
      syncSettingsModal();

      existing.focus({
        preventScroll: true
      });

      return;
    }

    runtime.modalReturnFocus =
      isElement(document.activeElement)
        ? document.activeElement
        : null;

    const modal =
      createElement(
        'div',
        {
          id: ID.modal,
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby':
            'uwc-settings-title'
        },
        [
          createElement(
            'div',
            {
              className:
                'uwc-panel'
            },
            [
              createElement(
                'div',
                {
                  className:
                    'uwc-header'
                },
                [
                  createElement(
                    'div',
                    {},
                    [
                      createElement(
                        'h2',
                        {
                          id:
                            'uwc-settings-title',
                          className:
                            'uwc-title',
                          text:
                            'UltraWide ChatGPT'
                        }
                      ),
                      createElement(
                        'p',
                        {
                          className:
                            'uwc-subtitle',
                          text:
                            `Version ${VERSION} · Chat + Work adaptive layout`
                        }
                      )
                    ]
                  ),
                  createElement(
                    'button',
                    {
                      type: 'button',
                      className:
                        'uwc-close',
                      text: '×',
                      title: 'Close',
                      'aria-label':
                        'Close settings',
                      onclick:
                        closeSettings
                    }
                  )
                ]
              ),

              createElement(
                'div',
                {
                  className:
                    'uwc-body'
                },
                [
                  createElement(
                    'div',
                    {
                      className:
                        'uwc-status',
                      role: 'status',
                      'aria-live':
                        'polite'
                    },
                    [
                      createElement(
                        'strong',
                        {
                          dataset: {
                            role: 'status-title'
                          },
                          text:
                            isWideActive()
                              ? 'UltraWide is active'
                              : 'UltraWide is inactive'
                        }
                      ),
                      createElement(
                        'span',
                        {
                          dataset: {
                            role: 'status-detail'
                          },
                          text:
                            ` ${getStatusText()}`
                        }
                      )
                    ]
                  ),

                  createSection(
                    'UltraWide',
                    [
                      createElement(
                        'div',
                        {
                          className:
                            'uwc-grid'
                        },
                        [
                          createCheckbox(
                            'enabled',
                            'Enable script'
                          ),
                          createCheckbox(
                            'wide',
                            'Enable UltraWide'
                          ),
                          createCheckbox(
                            'left',
                            'Left-align content'
                          ),
                          createCapInput(),
                          createCheckbox(
                            'widenComposer',
                            'Widen message composer'
                          ),
                          createCheckbox(
                            'safeMedia',
                            'Safe media constraints'
                          ),
                          createCheckbox(
                            'canvasSafeMode',
                            'Chat/Work split-view safe mode'
                          ),
                          createCheckbox(
                            'toast',
                            'Show status messages'
                          )
                        ]
                      )
                    ]
                  ),

                  createSection(
                    'Adaptive mode',
                    [
                      createElement(
                        'div',
                        {
                          className:
                            'uwc-grid'
                        },
                        [
                          createCheckbox(
                            'auto',
                            'Enable adaptive mode'
                          ),
                          createCheckbox(
                            'disableOnTouch',
                            'Disable UltraWide on touch devices'
                          ),
                          createNumberInput(
                            'autoMinWidth',
                            'Minimum viewport width',
                            `${LIMITS.autoMinWidth[0]}–${LIMITS.autoMinWidth[1]} px`
                          ),
                          createNumberInput(
                            'disableBelowHeight',
                            'Minimum viewport height',
                            '0 disables this condition'
                          )
                        ]
                      )
                    ]
                  ),

                  createSection(
                    'Spacing',
                    [
                      createElement(
                        'div',
                        {
                          className:
                            'uwc-grid'
                        },
                        [
                          createNumberInput(
                            'gutterMin',
                            'Minimum side gutter'
                          ),
                          createNumberInput(
                            'gutterVw',
                            'Responsive gutter in vw',
                            '',
                            '0.1'
                          ),
                          createNumberInput(
                            'gutterMax',
                            'Maximum side gutter'
                          )
                        ]
                      )
                    ]
                  ),

                  createSection(
                    'Runtime',
                    [
                      createElement(
                        'div',
                        {
                          className:
                            'uwc-grid'
                        },
                        [
                          createNumberInput(
                            'scanDebounceMs',
                            'DOM scan debounce',
                            'Higher values reduce DOM activity'
                          ),
                          createNumberInput(
                            'repairIntervalMs',
                            'Repair interval',
                            'Lightweight integrity check'
                          ),
                          createNumberInput(
                            'routePollMs',
                            'SPA route fallback interval'
                          ),
                          createNumberInput(
                            'toastMs',
                            'Status-message duration'
                          ),
                          createCheckbox(
                            'pauseWhenHidden',
                            'Pause background work in hidden tabs'
                          ),
                          createCheckbox(
                            'performanceTelemetry',
                            'Collect lightweight scan timing'
                          ),
                          createCheckbox(
                            'closeSettingsOnBackdrop',
                            'Close settings on backdrop'
                          )
                        ]
                      )
                    ]
                  ),

                  createSection(
                    'Keyboard shortcuts',
                    [
                      createElement(
                        'div',
                        {
                          className:
                            'uwc-shortcuts'
                        },
                        [
                          createElement(
                            'span',
                            {
                              text:
                                'Alt+O Script'
                            }
                          ),
                          createElement(
                            'span',
                            {
                              text:
                                'Alt+U UltraWide'
                            }
                          ),
                          createElement(
                            'span',
                            {
                              text:
                                'Alt+L Align'
                            }
                          ),
                          createElement(
                            'span',
                            {
                              text:
                                'Alt+M Width'
                            }
                          ),
                          createElement(
                            'span',
                            {
                              text:
                                'Alt+A Adaptive'
                            }
                          ),
                          createElement(
                            'span',
                            {
                              text:
                                'Alt+C Canvas'
                            }
                          ),
                          createElement(
                            'span',
                            {
                              text:
                                'Alt+S Settings'
                            }
                          ),
                          createElement(
                            'span',
                            {
                              text:
                                'Alt+R Reset'
                            }
                          )
                        ]
                      )
                    ]
                  ),

                  createElement(
                    'div',
                    {
                      className:
                        'uwc-actions'
                    },
                    [
                      createElement(
                        'button',
                        {
                          type: 'button',
                          text:
                            'Force layout scan',
                          onclick: () => {
                            scheduleScan(true);

                            showToast(
                              'UltraWide layout rescanned'
                            );
                          }
                        }
                      ),
                      createElement(
                        'button',
                        {
                          type: 'button',
                          text:
                            'Copy diagnostics',
                          onclick: () => {
                            void copyDiagnostics();
                          }
                        }
                      ),
                      createElement(
                        'button',
                        {
                          type: 'button',
                          className:
                            'uwc-danger',
                          text: 'Reset',
                          onclick: () => {
                            if (
                              window.confirm(
                                'Reset every UltraWide setting to its default value?'
                              )
                            ) {
                              resetSettings();
                            }
                          }
                        }
                      ),
                      createElement(
                        'button',
                        {
                          type: 'button',
                          className:
                            'uwc-primary',
                          text: 'Close',
                          onclick:
                            closeSettings
                        }
                      )
                    ]
                  )
                ]
              )
            ]
          )
        ]
      );

    modal.tabIndex = -1;

    modal.addEventListener(
      'click',
      (event) => {
        if (
          settings.closeSettingsOnBackdrop &&
          event.target === modal
        ) {
          closeSettings();
        }
      }
    );

    modal.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeSettings();
          return;
        }

        if (event.key === 'Tab') {
          const focusable =
            getFocusableElements(modal);

          if (focusable.length === 0) {
            event.preventDefault();
            modal.focus({
              preventScroll: true
            });
            return;
          }

          const first =
            focusable[0];

          const last =
            focusable[
              focusable.length - 1
            ];

          if (
            event.shiftKey &&
            document.activeElement === first
          ) {
            event.preventDefault();
            last.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === last
          ) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    );

    const parent =
      getBody() ||
      getRoot();

    if (!parent) {
      return;
    }

    parent.appendChild(modal);

    const firstFocusable =
      getFocusableElements(modal)[0];

    (
      firstFocusable ||
      modal
    ).focus({
      preventScroll: true
    });
  }

  function getDiagnostics() {
    const state = getState();

    return {
      generatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth || 0,
        height: window.innerHeight || 0,
        devicePixelRatio:
          window.devicePixelRatio || 1
      },
      document: {
        hidden: document.hidden,
        readyState: document.readyState,
        url: location.href
      },
      state
    };
  }

  async function copyDiagnostics() {
    const output = JSON.stringify(
      getDiagnostics(),
      null,
      2
    );

    try {
      await navigator.clipboard.writeText(output);
      showToast('UltraWide diagnostics copied');
      return true;
    } catch (_) {}

    try {
      const textarea = document.createElement('textarea');
      textarea.value = output;
      textarea.readOnly = true;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';

      (getBody() || getRoot())?.appendChild(textarea);
      textarea.select();

      const copied = document.execCommand('copy');
      textarea.remove();

      if (copied) {
        showToast('UltraWide diagnostics copied');
        return true;
      }
    } catch (_) {}

    console.info('[UltraWide] Diagnostics:', getDiagnostics());
    showToast('Copy failed; diagnostics written to console');
    return false;
  }

  function getState() {
    return {
      version: VERSION,
      started: runtime.started,
      href: runtime.href,

      enabled: settings.enabled,
      wide: settings.wide,
      activeWide: isWideActive(),
      left: settings.left,
      cap: settings.cap,

      auto: settings.auto,
      autoMinWidth:
        settings.autoMinWidth,
      disableOnTouch:
        settings.disableOnTouch,
      disableBelowHeight:
        settings.disableBelowHeight,

      gutterMin:
        settings.gutterMin,
      gutterVw:
        settings.gutterVw,
      gutterMax:
        settings.gutterMax,

      widenComposer:
        settings.widenComposer,
      safeMedia:
        settings.safeMedia,
      canvasSafeMode:
        settings.canvasSafeMode,

      canvasDetected:
        runtime.canvasDetected,
      detectedTurns:
        runtime.lastTurnCount,
      lastScanAt:
        runtime.lastScanAt,
      lastScanDurationMs:
        runtime.lastScanDurationMs,
      scanCount:
        runtime.scanCount,
      mutationBatchCount:
        runtime.mutationBatchCount,
      deferredScan:
        runtime.deferredScan,
      pauseWhenHidden:
        settings.pauseWhenHidden,
      performanceTelemetry:
        settings.performanceTelemetry,
      lastError:
        runtime.lastError,
      storageAvailable:
        runtime.storageAvailable,
      lastSavedAt:
        runtime.lastSavedAt,
      instanceStartedAt:
        runtime.instanceStartedAt,

      markedTurns:
        runtime.marked
          .get(ATTR.turn)
          ?.size || 0,

      conversationRootFound:
        (
          runtime.marked
            .get(
              ATTR.conversationRoot
            )
            ?.size || 0
        ) > 0,

      composerFound:
        (
          runtime.marked
            .get(ATTR.composer)
            ?.size || 0
        ) > 0,

      styleMounted:
        Boolean(
          document.getElementById(
            ID.style
          )
        ),

      bodyObserverAttached:
        Boolean(
          runtime.bodyObserver
        ),

      headObserverAttached:
        Boolean(
          runtime.headObserver
        )
    };
  }

  function start() {
    if (runtime.started) {
      return;
    }

    cleanupLegacyArtifacts();
    loadSettings();

    runtime.started = true;
    runtime.instanceStartedAt = Date.now();
    runtime.href = location.href;

    installHistoryHooks();
    installObservers();
    bindEvents();
    registerMenus();
    restartTimers();

    ensureStyle(
      ID.uiStyle,
      getUiCss()
    );

    applyStyles();
  }

  function stop() {
    if (!runtime.started) {
      return;
    }

    runtime.started = false;

    cancelScheduledScan();

    if (runtime.repairTimer) {
      clearInterval(
        runtime.repairTimer
      );
    }

    if (runtime.routeTimer) {
      clearInterval(
        runtime.routeTimer
      );
    }

    if (runtime.routeDelayTimer) {
      clearTimeout(
        runtime.routeDelayTimer
      );
    }

    if (runtime.toastTimer) {
      clearTimeout(
        runtime.toastTimer
      );
    }

    runtime.repairTimer = 0;
    runtime.routeTimer = 0;
    runtime.routeDelayTimer = 0;
    runtime.toastTimer = 0;

    unbindEvents();
    disconnectObservers();
    restoreHistoryHooks();
    unregisterMenus();

    clearManagedMarkers();
    clearRootState();

    removeMainStyle();
    removeUiStyle();
    removeById(ID.toast);
    closeSettings();
  }

  function restart() {
    stop();
    start();
  }

  function installApi() {
    try {
      const previous =
        window.__mlUltraWide;

      if (
        previous &&
        previous.version !== VERSION &&
        typeof previous.stop === 'function'
      ) {
        try {
          previous.stop();
        } catch (_) {}
      }

      Object.defineProperty(
        window,
        '__mlUltraWide',
        {
          configurable: true,
          value: Object.freeze({
            version: VERSION,

            start,
            stop,
            restart,

            apply: applyStyles,
            scan: () =>
              scheduleScan(true),
            repair,

            set: setOptions,
            reset: resetSettings,
            state: getState,
            diagnostics: getDiagnostics,
            copyDiagnostics,

            caps: () => [
              ...CAPS
            ],

            openSettings,
            closeSettings
          })
        }
      );
    } catch (_) {}
  }

  installApi();
  start();
})();
