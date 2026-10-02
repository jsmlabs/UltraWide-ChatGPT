// ==UserScript==
// @name         UltraWide ChatGPT
// @namespace    https://www.instagram.com/jsm.ig/
// @version      2026.10.01.12
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
// @downloadURL https://update.greasyfork.org/scripts/557270/UltraWide%20ChatGPT.user.js
// @updateURL https://update.greasyfork.org/scripts/557270/UltraWide%20ChatGPT.meta.js
// ==/UserScript==

/*
  UltraWide ChatGPT
  Version: 2026.10.01.12

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
  - Same-version reinjection now cleanly stops the previous runtime
  - Attribute-aware DOM observation catches structural selector changes earlier
  - Split-view detection ignores hidden editor/artifact remnants
  - Repair verifies style contents, not only style element presence
  - Extended scan diagnostics with measured average/max duration and route/mutation timestamps
  - Clear ON/OFF state pills for every settings toggle, with redundant text + color cues
  - Free-plan/upgrade notices now participate in UltraWide width handling when detected outside conversation turns
  - October 2026 architecture refresh based on the live virtualized transcript DOM
  - Primary width control now overrides ChatGPT thread CSS variables instead of relying on individual turn wrappers
  - Supports data-thread-user-message-navigation-content transcript roots and data-thread-find-target conversation roots
  - Supports virtualized data-turn-key/data-content-search-turn-key turns and current assistant/user message markers
  - Composer width now follows the same thread variable chain through #thread-bottom-container and #prompt-textarea
  - Core width remains stable across React virtualization, remounts, scrolling, and SPA navigation
  - Accepts presence-only data-thread-user-message-navigation-content roots instead of requiring the literal value "true"
  - Promotes data-content-search-turn-key to a primary virtualized-turn selector
  - Adds a semantic main-level thread-variable fallback so width survives wrapper/class churn
  - Deduplicates nested virtualized turn markers so one logical turn is never counted or widened twice
  - Prioritizes the live #prompt-textarea/#thread-bottom-container composer path during candidate scoring
  - Makes free-plan notice detection choose the smallest relevant visible container instead of broad ancestors
  - Reduces avoidable notice scanning by preferring semantic status/note containers before generic div fallbacks
  - Adds structural-root mutation triggers so transcript/composer remounts are repaired earlier
  - Adds runtime integrity verification to diagnostics and the public console API
  - Removes duplicate mutation observer attributes and centralizes reusable scan selectors
  - Settings modal reloads the page on close when saved settings changed
  - Adaptive mode now uses the effective live chat-pane width instead of only the browser viewport
  - Adds a lifecycle-safe ResizeObserver for sidebar, split-view, and pane-size changes
  - Adds explicit DOM capability detection with strategy classification and compatibility health
  - Diagnostics now report pane geometry, selector health, compatibility issues, and observer state
  - Pane observation automatically follows React/SPA remounts and falls back safely when unavailable
  - Redesigns the userscript-manager menu with compact, consistent status labels and clearer runtime details

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
  - window.__mlUltraWide.capabilities()
  - window.__mlUltraWide.verify()
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

  const VERSION = '2026.10.01.12';
  const STORAGE_KEY = 'uwc.settings.v12';

  const ID = Object.freeze({
    style: 'uwc-style-v11',
    uiStyle: 'uwc-ui-style-v11',
    toast: 'uwc-toast-v11',
    modal: 'uwc-settings-v11'
  });

  const LEGACY_STYLE_IDS = Object.freeze([
    'uwc-style',
    'uwc-ui-style',
    'uwc-style-v8',
    'uwc-ui-style-v8',
    'uwc-style-v9',
    'uwc-ui-style-v9',
    'uwc-style-v10',
    'uwc-ui-style-v10'
  ]);

  const LEGACY_ELEMENT_IDS = Object.freeze([
    'uwc-toast',
    'uwc-settings-modal',
    'uwc-toast-v8',
    'uwc-settings-v8',
    'uwc-toast-v9',
    'uwc-settings-v9',
    'uwc-toast-v10',
    'uwc-settings-v10'
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
    composerPath: 'data-uwc-composer-path',

    planNotice: 'data-uwc-plan-notice',
    planNoticePath: 'data-uwc-plan-notice-path'
  });

  const MANAGED_MARKERS = Object.freeze([
    ATTR.conversationRoot,
    ATTR.conversationPath,
    ATTR.turn,
    ATTR.turnPath,
    ATTR.composer,
    ATTR.composerPath,
    ATTR.planNotice,
    ATTR.planNoticePath
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
    maxPlanNoticeCandidates: 900,
    maxConversationPathDepth: 12,
    maxTurnPathDepth: 6,
    maxComposerPathDepth: 7,
    maxPlanNoticePathDepth: 7,
    routeDelayMs: 100,
    idleTimeoutMs: 700,
    debugEventLimit: 50,
    invariantFailureThreshold: 3,
    reloadLoopWindowMs: 10000,
    reloadLoopMaxCount: 2,
    mutationAttributeFilter: Object.freeze([
      'data-testid',
      'data-turn-key',
      'data-content-search-turn-key',
      'data-thread-user-message-navigation-content',
      'data-message-author-role',
      'role',
      'contenteditable',
      'aria-modal',
      'aria-hidden',
      'hidden'
    ])
  });

  const SELECTOR = Object.freeze({
    preferredTurns: [
      '[data-turn-key]',
      '[data-content-search-turn-key]',
      '[data-testid="conversation-turn"]',
      '[data-testid^="conversation-turn-"]',
      'article[data-testid="conversation-turn"]',
      'article[data-testid^="conversation-turn-"]'
    ].join(','),

    fallbackMessages: [
      '[data-message-author-role]',
      '[data-message-id][data-message-author-role]',
      '[data-markdown-text-style="assistant-message"]',
      '[data-user-message-bubble="true"]',
      '[data-conversation-role="assistant"]'
    ].join(','),

    main: [
      'main',
      '[role="main"]',
      '[data-thread-user-message-navigation-content]',
      '[data-thread-find-target="conversation"]',
      '[data-testid="main-app"]',
      '[data-testid="chat-layout"]',
      '[data-testid="conversation"]',
      '[data-testid="thread"]'
    ].join(','),

    composerInput: [
      '#prompt-textarea',
      '[data-testid="prompt-textarea"]',
      '[data-testid="composer-input"]',
      '[data-testid="composer:input"]',
      'form[data-type="unified-composer"] textarea',
      'form[data-type="unified-composer"] [contenteditable="true"]',
      'form[data-type="unified-composer"] [role="textbox"]',
      'main form textarea',
      'main form [contenteditable="true"][role="textbox"]'
    ].join(','),

    composerShell: [
      '#thread-bottom-container',
      '#thread-bottom',
      '[data-testid="composer"]',
      '[data-testid="composer-shell"]',
      '[data-testid="composer-container"]',
      'form[data-type="unified-composer"]'
    ].join(','),

    excludedComposerAncestor: [
      '#uwc-settings-v11',
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
      '[data-testid*="artifact-panel"]',
      '[data-testid*="work-panel"]',
      '.monaco-editor',
      '.cm-editor',
      '.CodeMirror'
    ].join(','),

    structuralRoots: [
      '[data-thread-user-message-navigation-content]',
      '[data-thread-find-target="conversation"]',
      '#thread-bottom-container',
      '#prompt-textarea'
    ].join(','),

    turnContent: [
      '[data-markdown-text-style="assistant-message"]',
      '[data-user-message-bubble="true"]',
      '.markdown',
      '[class*="prose"]',
      '[data-message-author-role]'
    ].join(',')
  });

  const MANAGED_LAYOUT_SELECTOR = MANAGED_MARKERS
    .map((attribute) => `[${attribute}]`)
    .join(',');

  const SCAN_TRIGGER_SELECTOR = [
    SELECTOR.preferredTurns,
    SELECTOR.fallbackMessages,
    SELECTOR.composerInput,
    SELECTOR.splitViewIndicators,
    SELECTOR.structuralRoots
  ].join(',');

  const DIRTY = Object.freeze({
    conversation: 'conversation',
    composer: 'composer',
    notice: 'notice',
    split: 'split',
    root: 'root'
  });

  const ALL_DIRTY_REGIONS = Object.freeze([
    DIRTY.conversation,
    DIRTY.composer,
    DIRTY.notice,
    DIRTY.split,
    DIRTY.root
  ]);

  const RELOAD_GUARD_KEY = 'uwc.reload.guard.v1';

  const settings = {
    ...DEFAULTS
  };

  const runtime = {
    started: false,
    href: '',

    bodyObserver: null,
    headObserver: null,
    bootstrapObserver: null,
    paneResizeObserver: null,

    observedBody: null,
    observedHead: null,
    observedPane: null,

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
    modalSettingsSnapshot: '',

    canvasDetected: false,
    effectivePaneWidth: 0,
    effectivePaneHeight: 0,
    lastPaneResizeAt: 0,
    paneResizeCount: 0,
    lastCapabilities: null,
    lastCompatibility: null,
    lastTurnCount: 0,
    lastRawTurnCount: 0,
    lastPlanNoticeCandidateCount: 0,
    lastScanAt: 0,
    lastScanDurationMs: 0,
    totalScanDurationMs: 0,
    maxScanDurationMs: 0,
    measuredScanCount: 0,
    scanCount: 0,
    mutationBatchCount: 0,
    lastMutationAt: 0,
    lastRouteChangeAt: 0,
    deferredScan: false,
    pendingRepairReasons: new Set(),
    pendingDirtyRegions: new Set(),
    repairRequestCount: 0,
    repairPassCount: 0,
    coalescedRepairCount: 0,
    lastRepairAt: 0,
    lastRepairReasons: [],
    invariantFailureStreak: 0,
    lastInvariants: null,
    safeFallbackActive: false,
    safeFallbackReason: '',
    debugEvents: [],
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

  function isVisibleElement(element) {
    if (!isConnectedElement(element)) {
      return false;
    }

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
      'data-uwc-composer-path',
      'data-uwc-plan-notice',
      'data-uwc-plan-notice-path'
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

  function getVisibleRect(element) {
    if (!isConnectedElement(element)) {
      return null;
    }

    try {
      const rect = element.getBoundingClientRect();

      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return null;
      }

      return rect;
    } catch (_) {
      return null;
    }
  }

  function resolveActivePane() {
    const selectors = [
      '[data-thread-user-message-navigation-content]',
      '[data-thread-find-target="conversation"]',
      '#thread-bottom-container',
      '#prompt-textarea'
    ];

    for (const selector of selectors) {
      let anchor = null;

      try {
        anchor = Array.from(
          document.querySelectorAll(selector)
        ).find(isVisibleElement) || null;
      } catch (_) {}

      if (!anchor) {
        continue;
      }

      const main =
        nearestMain(anchor) ||
        anchor.closest?.('main,[role="main"]') ||
        null;

      if (getVisibleRect(main)) {
        return main;
      }

      let current = anchor;

      for (let depth = 0; current && depth < 8; depth += 1) {
        const rect = getVisibleRect(current);

        if (
          rect &&
          rect.width >= 320 &&
          rect.height >= 200
        ) {
          return current;
        }

        current = current.parentElement;
      }
    }

    try {
      return Array.from(
        document.querySelectorAll(
          'main,[role="main"]'
        )
      ).find(isVisibleElement) || null;
    } catch (_) {
      return null;
    }
  }

  function measureEffectivePane() {
    const pane =
      runtime.observedPane?.isConnected
        ? runtime.observedPane
        : resolveActivePane();

    const rect = getVisibleRect(pane);

    const width = rect
      ? Math.round(rect.width)
      : Math.max(0, Math.round(window.innerWidth || 0));

    const height = rect
      ? Math.round(rect.height)
      : Math.max(0, Math.round(window.innerHeight || 0));

    runtime.effectivePaneWidth = width;
    runtime.effectivePaneHeight = height;

    return {
      element: pane || null,
      width,
      height,
      source: rect ? 'pane' : 'viewport'
    };
  }

  function getAdaptiveWidth() {
    const measured =
      runtime.effectivePaneWidth > 0
        ? runtime.effectivePaneWidth
        : measureEffectivePane().width;

    return measured > 0
      ? measured
      : (window.innerWidth || 0);
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
      getAdaptiveWidth() >=
      settings.autoMinWidth
    );
  }

  function detectDomCapabilities() {
    const queryOne = (selector) => {
      try {
        return Boolean(
          document.querySelector(selector)
        );
      } catch (_) {
        return false;
      }
    };

    const queryCount = (selector) => {
      try {
        return document.querySelectorAll(
          selector
        ).length;
      } catch (_) {
        return 0;
      }
    };

    const virtualizedTurnCount =
      queryCount(
        '[data-turn-key],[data-content-search-turn-key]'
      );

    const fallbackTurnCount =
      queryCount(SELECTOR.fallbackMessages);

    const capabilities = {
      transcriptRoot:
        queryOne(
          '[data-thread-user-message-navigation-content]'
        ),
      conversationTarget:
        queryOne(
          '[data-thread-find-target="conversation"]'
        ),
      threadBottomContainer:
        queryOne('#thread-bottom-container'),
      promptTextarea:
        queryOne(
          '#prompt-textarea,[data-testid="prompt-textarea"]'
        ),
      virtualizedTurns:
        virtualizedTurnCount > 0,
      virtualizedTurnCount,
      fallbackTurns:
        fallbackTurnCount > 0,
      fallbackTurnCount,
      threadVariableWrappers:
        queryOne(
          '[class*="thread-content-max-width"],[class*="thread-body-max-width"]'
        ),
      splitView:
        runtime.canvasDetected,
      resizeObserver:
        typeof ResizeObserver === 'function'
    };

    let strategy = 'unknown';

    if (
      capabilities.transcriptRoot &&
      capabilities.virtualizedTurns
    ) {
      strategy = 'virtualized-thread';
    } else if (
      capabilities.conversationTarget &&
      (
        capabilities.virtualizedTurns ||
        capabilities.fallbackTurns
      )
    ) {
      strategy = 'conversation-target';
    } else if (
      capabilities.virtualizedTurns ||
      capabilities.fallbackTurns
    ) {
      strategy = 'turn-markers';
    }

    capabilities.strategy = strategy;
    runtime.lastCapabilities = capabilities;

    return capabilities;
  }

  function evaluateCompatibility(
    capabilities = detectDomCapabilities()
  ) {
    const issues = [];
    let score = 100;

    if (
      !capabilities.transcriptRoot &&
      !capabilities.conversationTarget
    ) {
      score -= 35;
      issues.push(
        'No current transcript/conversation root detected'
      );
    }

    if (
      !capabilities.virtualizedTurns &&
      !capabilities.fallbackTurns
    ) {
      score -= 35;
      issues.push('No conversation turns detected');
    }

    if (
      settings.widenComposer &&
      !capabilities.promptTextarea &&
      !capabilities.threadBottomContainer
    ) {
      score -= 20;
      issues.push('Composer root/input not detected');
    }

    if (
      capabilities.strategy === 'unknown'
    ) {
      score -= 10;
      issues.push('No supported layout strategy resolved');
    }

    score = Math.max(0, score);

    const status =
      score >= 90
        ? 'healthy'
        : score >= 60
          ? 'degraded'
          : 'unsupported';

    const result = {
      status,
      score,
      strategy: capabilities.strategy,
      issues
    };

    runtime.lastCompatibility = result;
    return result;
  }

  function onPaneResize(entries) {
    const entry = entries?.[0];

    if (!entry) {
      return;
    }

    const rect =
      entry.contentRect ||
      getVisibleRect(runtime.observedPane);

    if (!rect) {
      return;
    }

    const width =
      Math.max(0, Math.round(rect.width));

    const height =
      Math.max(0, Math.round(rect.height));

    const changed =
      width !== runtime.effectivePaneWidth ||
      height !== runtime.effectivePaneHeight;

    runtime.effectivePaneWidth = width;
    runtime.effectivePaneHeight = height;
    runtime.lastPaneResizeAt = Date.now();
    runtime.paneResizeCount += 1;

    if (!changed || !runtime.started) {
      return;
    }

    setRootState();
    syncSettingsModal();
    requestRepair(
      'pane-resize',
      [DIRTY.split, DIRTY.root]
    );
  }

  function attachPaneResizeObserver() {
    const pane = resolveActivePane();

    if (
      pane === runtime.observedPane &&
      runtime.paneResizeObserver
    ) {
      measureEffectivePane();
      return true;
    }

    runtime.paneResizeObserver?.disconnect();
    runtime.paneResizeObserver = null;
    runtime.observedPane = null;

    if (!pane) {
      measureEffectivePane();
      return false;
    }

    runtime.observedPane = pane;
    measureEffectivePane();

    if (typeof ResizeObserver !== 'function') {
      return false;
    }

    try {
      runtime.paneResizeObserver =
        new ResizeObserver(onPaneResize);

      runtime.paneResizeObserver.observe(pane);
      return true;
    } catch (_) {
      runtime.paneResizeObserver = null;
      return false;
    }
  }

  function disconnectPaneResizeObserver() {
    runtime.paneResizeObserver?.disconnect();
    runtime.paneResizeObserver = null;
    runtime.observedPane = null;
    runtime.effectivePaneWidth = 0;
    runtime.effectivePaneHeight = 0;
  }

  function detectCanvas() {
    try {
      runtime.canvasDetected = Array.from(
        document.querySelectorAll(
          SELECTOR.splitViewIndicators
        )
      ).some(isVisibleElement);
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

/*
 * Current ChatGPT (October 2026) owns the effective reading width at the
 * virtualized transcript root. The stable variable chain is:
 *
 *   --thread-content-responsive-max-width
 *     -> --thread-content-max-width
 *     -> --thread-body-max-width
 *     -> max-w-(--thread-body-max-width)
 *
 * Override that chain directly. This is the primary UltraWide mechanism;
 * per-turn markers below are now supplemental for alignment/media handling.
 */

/* Semantic fallback: current ChatGPT width utilities inherit these variables.
   Applying them at main keeps sizing pane-relative and resilient when React
   changes intermediate wrappers or utility-class names. */
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"] main{
  --thread-content-responsive-max-width:var(--uwc-content-width)!important;
  --thread-content-max-width:var(--uwc-content-width)!important;
  --thread-body-max-width:calc(
    var(--thread-content-max-width) +
    (var(--thread-body-inline-padding,0px) * 2)
  )!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[data-thread-user-message-navigation-content]{
  --thread-content-responsive-max-width:var(--uwc-content-width)!important;
  --thread-content-max-width:var(--uwc-content-width)!important;
  --thread-body-max-width:calc(
    var(--thread-content-max-width) +
    (var(--thread-body-inline-padding,0px) * 2)
  )!important;
  width:100%!important;
  max-width:var(--thread-body-max-width)!important;
  min-width:0!important;
  margin-inline:auto!important;
  box-sizing:border-box!important;
}

/* Conversation content inherits the transcript variables even when React
   virtualizes and remounts individual turns. */
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[data-thread-find-target="conversation"]{
  --thread-content-responsive-max-width:var(--uwc-content-width)!important;
  --thread-content-max-width:var(--uwc-content-width)!important;
  --thread-body-max-width:calc(
    var(--thread-content-max-width) +
    (var(--thread-body-inline-padding,0px) * 2)
  )!important;
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
}

/* Any current width wrapper that redefines the same variables is normalized
   back to the UltraWide width. Variable names are stable semantic anchors and
   avoid dependency on generated hash classes. */
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[data-thread-user-message-navigation-content] [class*="thread-content-max-width"],
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[data-thread-user-message-navigation-content] [class*="thread-body-max-width"]{
  --thread-content-responsive-max-width:var(--uwc-content-width)!important;
  --thread-content-max-width:var(--uwc-content-width)!important;
  --thread-body-max-width:calc(
    var(--thread-content-max-width) +
    (var(--thread-body-inline-padding,0px) * 2)
  )!important;
}

/* Current composer uses the same thread-variable system. Keep the bottom
   container structurally full width and let its inner responsive wrapper use
   the configured UltraWide width. */
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
#thread-bottom-container{
  --thread-content-responsive-max-width:var(--uwc-content-width)!important;
  --thread-content-max-width:var(--uwc-content-width)!important;
  --thread-body-max-width:calc(
    var(--thread-content-max-width) +
    (var(--thread-body-inline-padding,0px) * 2)
  )!important;
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
#thread-bottom-container [class*="thread-content-max-width"],
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
#thread-bottom-container [class*="thread-body-max-width"]{
  --thread-content-responsive-max-width:var(--uwc-content-width)!important;
  --thread-content-max-width:var(--uwc-content-width)!important;
  --thread-body-max-width:calc(
    var(--thread-content-max-width) +
    (var(--thread-body-inline-padding,0px) * 2)
  )!important;
  width:var(--uwc-content-width)!important;
  max-width:var(--thread-body-max-width)!important;
  min-width:0!important;
  margin-inline:auto!important;
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

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.planNoticePath}="1"]{
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  box-sizing:border-box!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[${ATTR.planNotice}="1"]{
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

/* When the current virtualized transcript root is present, it owns the
   configured width. Turn markers inside it must stay full-width so nested
   percentages cannot compound and shrink the conversation. */
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[data-thread-user-message-navigation-content] [${ATTR.turn}="1"]{
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  margin-inline:0!important;
}

/* The current composer root is structural. Keep it full-width and let the
   inner thread-variable wrapper carry the configured UltraWide width. */
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
#thread-bottom-container[${ATTR.composer}="1"]{
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  margin-inline:0!important;
}

/* Current virtualized assistant/user message markers. */
:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[data-markdown-text-style="assistant-message"]{
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  box-sizing:border-box!important;
}

:root[${ATTR.enabled}="1"][${ATTR.left}="1"]
[data-markdown-text-style="assistant-message"]{
  text-align:left!important;
}

:root[${ATTR.enabled}="1"][${ATTR.wide}="1"]
[data-user-message-bubble="true"]{
  max-width:min(var(--user-chat-width,80%),var(--uwc-content-width))!important;
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
  --uwc-ui-bg:var(--main-surface-primary,Canvas);
  --uwc-ui-text:var(--text-primary,CanvasText);
  position:fixed!important;
  right:20px!important;
  bottom:20px!important;
  z-index:2147483647!important;
  max-width:min(420px,calc(100vw - 40px))!important;
  padding:11px 14px!important;
  border:1px solid var(--border-light,color-mix(in srgb,var(--uwc-ui-text) 12%,transparent))!important;
  border-radius:14px!important;
  background:var(--uwc-ui-bg)!important;
  color:var(--uwc-ui-text)!important;
  box-shadow:0 12px 34px rgba(0,0,0,.22)!important;
  font:13px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
  pointer-events:none!important;
  backdrop-filter:blur(14px)!important;
}

#${ID.modal}{
  --uwc-accent:#10a37f;
  --uwc-danger:#ef4444;
  --uwc-ui-bg:var(--main-surface-primary,Canvas);
  --uwc-ui-bg-secondary:var(--main-surface-secondary,color-mix(in srgb,CanvasText 4%,Canvas));
  --uwc-ui-bg-tertiary:var(--main-surface-tertiary,color-mix(in srgb,CanvasText 7%,Canvas));
  --uwc-ui-text:var(--text-primary,CanvasText);
  --uwc-ui-muted:var(--text-secondary,color-mix(in srgb,CanvasText 62%,transparent));
  --uwc-ui-border:var(--border-light,color-mix(in srgb,CanvasText 12%,transparent));
  --uwc-ui-border-strong:var(--border-medium,color-mix(in srgb,CanvasText 18%,transparent));
  position:fixed!important;
  inset:0!important;
  z-index:2147483646!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  padding:24px!important;
  background:rgba(0,0,0,.56)!important;
  color:var(--uwc-ui-text)!important;
  font:14px/1.45 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
  backdrop-filter:blur(3px)!important;
}

#${ID.modal} *{
  box-sizing:border-box!important;
}

#${ID.modal} .uwc-panel{
  width:min(860px,100%)!important;
  max-height:min(90vh,920px)!important;
  overflow:auto!important;
  overscroll-behavior:contain!important;
  scrollbar-gutter:stable!important;
  border:1px solid var(--uwc-ui-border)!important;
  border-radius:18px!important;
  background:var(--uwc-ui-bg)!important;
  color:var(--uwc-ui-text)!important;
  box-shadow:
    0 24px 80px rgba(0,0,0,.38),
    0 2px 10px rgba(0,0,0,.14)!important;
}

#${ID.modal} .uwc-header{
  position:sticky!important;
  top:0!important;
  z-index:3!important;
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:18px!important;
  padding:18px 20px!important;
  border-bottom:1px solid var(--uwc-ui-border)!important;
  background:color-mix(in srgb,var(--uwc-ui-bg) 94%,transparent)!important;
  backdrop-filter:blur(18px)!important;
}

#${ID.modal} .uwc-header-copy{
  min-width:0!important;
}

#${ID.modal} .uwc-title-row{
  display:flex!important;
  align-items:center!important;
  flex-wrap:wrap!important;
  gap:9px!important;
}

#${ID.modal} .uwc-title{
  margin:0!important;
  font-size:18px!important;
  line-height:1.25!important;
  font-weight:650!important;
  letter-spacing:-.015em!important;
}

#${ID.modal} .uwc-version{
  display:inline-flex!important;
  align-items:center!important;
  min-height:22px!important;
  padding:2px 8px!important;
  border:1px solid var(--uwc-ui-border)!important;
  border-radius:999px!important;
  background:var(--uwc-ui-bg-secondary)!important;
  color:var(--uwc-ui-muted)!important;
  font:600 11px/1 ui-monospace,SFMono-Regular,Consolas,monospace!important;
}

#${ID.modal} .uwc-subtitle{
  margin:4px 0 0!important;
  color:var(--uwc-ui-muted)!important;
  font-size:12px!important;
}

#${ID.modal} .uwc-close{
  display:grid!important;
  place-items:center!important;
  width:34px!important;
  min-width:34px!important;
  height:34px!important;
  padding:0!important;
  border-color:transparent!important;
  border-radius:10px!important;
  background:transparent!important;
  color:var(--uwc-ui-muted)!important;
  font-size:20px!important;
  font-weight:400!important;
}

#${ID.modal} .uwc-close:hover{
  background:var(--uwc-ui-bg-secondary)!important;
  color:var(--uwc-ui-text)!important;
}

#${ID.modal} .uwc-body{
  padding:18px 20px 0!important;
}

#${ID.modal} .uwc-status{
  display:grid!important;
  grid-template-columns:auto minmax(0,1fr)!important;
  align-items:start!important;
  column-gap:10px!important;
  row-gap:2px!important;
  margin:0 0 16px!important;
  padding:13px 14px!important;
  border:1px solid color-mix(in srgb,var(--uwc-accent) 28%,var(--uwc-ui-border))!important;
  border-radius:14px!important;
  background:color-mix(in srgb,var(--uwc-accent) 7%,var(--uwc-ui-bg))!important;
  font-size:12px!important;
}

#${ID.modal} .uwc-status::before{
  content:""!important;
  width:8px!important;
  height:8px!important;
  margin-top:5px!important;
  border-radius:999px!important;
  background:var(--uwc-accent)!important;
  box-shadow:0 0 0 3px color-mix(in srgb,var(--uwc-accent) 14%,transparent)!important;
}

#${ID.modal} .uwc-status strong{
  grid-column:2!important;
  color:var(--uwc-ui-text)!important;
  font-weight:650!important;
}

#${ID.modal} .uwc-status span{
  grid-column:2!important;
  color:var(--uwc-ui-muted)!important;
}

#${ID.modal} .uwc-section{
  margin:0 0 14px!important;
  padding:15px!important;
  border:1px solid var(--uwc-ui-border)!important;
  border-radius:14px!important;
  background:var(--uwc-ui-bg-secondary)!important;
}

#${ID.modal} .uwc-section h3{
  margin:0 0 12px!important;
  color:var(--uwc-ui-muted)!important;
  font-size:11px!important;
  line-height:1.2!important;
  font-weight:650!important;
  text-transform:uppercase!important;
  letter-spacing:.075em!important;
}

#${ID.modal} .uwc-grid{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:9px!important;
}

#${ID.modal} .uwc-field{
  display:flex!important;
  flex-direction:column!important;
  justify-content:center!important;
  gap:6px!important;
  min-height:60px!important;
  padding:10px 11px!important;
  border:1px solid transparent!important;
  border-radius:12px!important;
  background:var(--uwc-ui-bg)!important;
}

#${ID.modal} .uwc-field:focus-within{
  border-color:color-mix(in srgb,var(--uwc-accent) 48%,var(--uwc-ui-border))!important;
}

#${ID.modal} .uwc-check{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto!important;
  grid-template-areas:"copy toggle"!important;
  align-items:center!important;
  gap:12px!important;
  min-height:60px!important;
  padding:10px 11px!important;
  border:1px solid transparent!important;
  border-radius:12px!important;
  background:var(--uwc-ui-bg)!important;
  cursor:pointer!important;
  transition:
    background-color .14s ease,
    border-color .14s ease!important;
}

#${ID.modal} .uwc-check:hover{
  border-color:var(--uwc-ui-border)!important;
  background:var(--uwc-ui-bg-tertiary)!important;
}

#${ID.modal} .uwc-check:has(input:focus-visible){
  border-color:color-mix(in srgb,var(--uwc-accent) 65%,var(--uwc-ui-border))!important;
  box-shadow:0 0 0 2px color-mix(in srgb,var(--uwc-accent) 18%,transparent)!important;
}

#${ID.modal} .uwc-check input[type="checkbox"]{
  position:absolute!important;
  width:1px!important;
  min-width:1px!important;
  height:1px!important;
  min-height:1px!important;
  margin:0!important;
  padding:0!important;
  opacity:0!important;
  pointer-events:none!important;
}

#${ID.modal} .uwc-check-copy{
  grid-area:copy!important;
  min-width:0!important;
  color:var(--uwc-ui-text)!important;
  font-weight:500!important;
}

#${ID.modal} .uwc-toggle-state{
  grid-area:toggle!important;
  position:relative!important;
  display:inline-flex!important;
  align-items:center!important;
  justify-content:flex-end!important;
  width:38px!important;
  min-width:38px!important;
  height:22px!important;
  padding:0!important;
  overflow:hidden!important;
  border:1px solid var(--uwc-ui-border-strong)!important;
  border-radius:999px!important;
  background:var(--uwc-ui-bg-tertiary)!important;
  color:transparent!important;
  font-size:0!important;
  transition:
    background-color .16s ease,
    border-color .16s ease!important;
}

#${ID.modal} .uwc-toggle-state::after{
  content:""!important;
  position:absolute!important;
  left:3px!important;
  top:3px!important;
  width:14px!important;
  height:14px!important;
  border-radius:999px!important;
  background:var(--uwc-ui-muted)!important;
  transition:
    transform .16s ease,
    background-color .16s ease!important;
}

#${ID.modal} .uwc-check input:checked ~ .uwc-toggle-state{
  border-color:var(--uwc-accent)!important;
  background:var(--uwc-accent)!important;
}

#${ID.modal} .uwc-check input:checked ~ .uwc-toggle-state::after{
  transform:translateX(16px)!important;
  background:#fff!important;
}

#${ID.modal} label{
  font-weight:500!important;
}

#${ID.modal} .uwc-hint{
  display:block!important;
  margin-top:2px!important;
  color:var(--uwc-ui-muted)!important;
  font-size:11px!important;
  line-height:1.35!important;
  font-weight:400!important;
}

#${ID.modal} input,
#${ID.modal} select,
#${ID.modal} textarea,
#${ID.modal} button{
  color:var(--uwc-ui-text)!important;
  font:13px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
}

#${ID.modal} input:not([type="checkbox"]),
#${ID.modal} select,
#${ID.modal} textarea{
  width:100%!important;
  min-height:36px!important;
  padding:7px 10px!important;
  border:1px solid var(--uwc-ui-border-strong)!important;
  border-radius:9px!important;
  outline:none!important;
  background:var(--uwc-ui-bg)!important;
}

#${ID.modal} select{
  cursor:pointer!important;
}

#${ID.modal} input:not([type="checkbox"]):hover,
#${ID.modal} select:hover,
#${ID.modal} textarea:hover{
  border-color:color-mix(in srgb,var(--uwc-ui-text) 25%,var(--uwc-ui-border))!important;
}

#${ID.modal} input:not([type="checkbox"]):focus,
#${ID.modal} select:focus,
#${ID.modal} textarea:focus{
  border-color:var(--uwc-accent)!important;
  box-shadow:0 0 0 2px color-mix(in srgb,var(--uwc-accent) 18%,transparent)!important;
}

#${ID.modal} button{
  min-height:36px!important;
  padding:7px 12px!important;
  border:1px solid var(--uwc-ui-border)!important;
  border-radius:9px!important;
  background:var(--uwc-ui-bg)!important;
  cursor:pointer!important;
  font-weight:550!important;
  transition:
    background-color .14s ease,
    border-color .14s ease,
    transform .08s ease!important;
}

#${ID.modal} button:hover{
  background:var(--uwc-ui-bg-tertiary)!important;
  border-color:var(--uwc-ui-border-strong)!important;
}

#${ID.modal} button:active{
  transform:scale(.985)!important;
}

#${ID.modal} button:focus-visible,
#${ID.modal} input:focus-visible,
#${ID.modal} select:focus-visible{
  outline:none!important;
}

#${ID.modal} .uwc-primary{
  border-color:var(--uwc-accent)!important;
  background:var(--uwc-accent)!important;
  color:#fff!important;
}

#${ID.modal} .uwc-primary:hover{
  border-color:color-mix(in srgb,var(--uwc-accent) 88%,#000)!important;
  background:color-mix(in srgb,var(--uwc-accent) 88%,#000)!important;
}

#${ID.modal} .uwc-danger{
  color:var(--uwc-danger)!important;
}

#${ID.modal} .uwc-danger:hover{
  border-color:color-mix(in srgb,var(--uwc-danger) 34%,var(--uwc-ui-border))!important;
  background:color-mix(in srgb,var(--uwc-danger) 7%,var(--uwc-ui-bg))!important;
}

#${ID.modal} .uwc-shortcuts{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:7px!important;
}

#${ID.modal} .uwc-shortcuts span{
  display:flex!important;
  align-items:center!important;
  min-height:34px!important;
  padding:7px 9px!important;
  border:1px solid var(--uwc-ui-border)!important;
  border-radius:9px!important;
  background:var(--uwc-ui-bg)!important;
  color:var(--uwc-ui-muted)!important;
  font:11px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace!important;
}

#${ID.modal} .uwc-actions{
  position:sticky!important;
  bottom:0!important;
  z-index:3!important;
  display:flex!important;
  flex-wrap:wrap!important;
  align-items:center!important;
  justify-content:flex-end!important;
  gap:8px!important;
  margin:18px -20px 0!important;
  padding:14px 20px!important;
  border-top:1px solid var(--uwc-ui-border)!important;
  background:color-mix(in srgb,var(--uwc-ui-bg) 94%,transparent)!important;
  backdrop-filter:blur(18px)!important;
}

#${ID.modal} .uwc-actions::before{
  content:"Changes are saved automatically and applied when settings are closed."!important;
  margin-right:auto!important;
  color:var(--uwc-ui-muted)!important;
  font-size:11px!important;
  line-height:1.35!important;
}

@media (max-width:700px){
  #${ID.modal}{
    align-items:stretch!important;
    padding:8px!important;
  }

  #${ID.modal} .uwc-panel{
    max-height:100%!important;
    border-radius:14px!important;
  }

  #${ID.modal} .uwc-header{
    padding:15px!important;
  }

  #${ID.modal} .uwc-body{
    padding:14px 15px 0!important;
  }

  #${ID.modal} .uwc-grid{
    grid-template-columns:1fr!important;
  }

  #${ID.modal} .uwc-shortcuts{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }

  #${ID.modal} .uwc-actions{
    margin:16px -15px 0!important;
    padding:12px 15px!important;
  }

  #${ID.modal} .uwc-actions::before{
    flex-basis:100%!important;
  }
}

@media (max-width:460px){
  #${ID.modal} .uwc-shortcuts{
    grid-template-columns:1fr!important;
  }

  #${ID.modal} .uwc-actions button{
    flex:1 1 calc(50% - 4px)!important;
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
      isWideActive() &&
        !runtime.safeFallbackActive
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

  function compactOutermostElements(elements, selector) {
    const unique = Array.from(
      new Set(
        elements.filter(isConnectedElement)
      )
    );

    return unique.filter((element) => {
      try {
        return !element.parentElement?.closest(selector);
      } catch (_) {
        return true;
      }
    });
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

    runtime.lastRawTurnCount =
      preferred.length;

    if (preferred.length > 0) {
      return compactOutermostElements(
        preferred,
        SELECTOR.preferredTurns
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

    runtime.lastRawTurnCount =
      fallbackMessages.length;

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

    const focused =
      document.activeElement;

    if (
      isElement(focused) &&
      candidates.includes(focused) &&
      !isExcluded(focused) &&
      isVisibleElement(focused)
    ) {
      return focused;
    }

    const scored = candidates
      .filter((element) =>
        !isExcluded(element) &&
        isVisibleElement(element)
      )
      .map((element, index) => {
        let score = index;

        try {
          if (element.id === 'prompt-textarea') {
            score += 1600;
          }

          if (
            element.matches(
              '[data-testid="prompt-textarea"],[data-testid="composer-input"],[data-testid="composer:input"]'
            )
          ) {
            score += 1200;
          }

          if (
            element.closest(
              '#thread-bottom-container'
            )
          ) {
            score += 800;
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

  function hasFreePlanNoticeText(element) {
    if (!isConnectedElement(element)) {
      return false;
    }

    try {
      const text = String(
        element.textContent || ''
      )
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      if (
        text.length < 8 ||
        text.length > 360
      ) {
        return false;
      }

      return (
        text.includes("you're on the free plan") ||
        text.includes('you’re on the free plan') ||
        text.includes('you are on the free plan') ||
        text.includes("you're on free") ||
        text.includes('you’re on free')
      );
    } catch (_) {
      return false;
    }
  }

  function findPlanNoticeCandidate(main) {
    const excludedSelector =
      `${SELECTOR.preferredTurns},${SELECTOR.fallbackMessages},${SELECTOR.excludedComposerAncestor}`;

    const chooseBest = (candidates) => {
      const matches = candidates.filter((element) => {
        if (
          !isVisibleElement(element) ||
          !hasFreePlanNoticeText(element)
        ) {
          return false;
        }

        try {
          return !element.closest(excludedSelector);
        } catch (_) {
          return true;
        }
      });

      matches.sort((a, b) => {
        if (a !== b) {
          if (a.contains(b)) {
            return 1;
          }

          if (b.contains(a)) {
            return -1;
          }
        }

        const aLength = String(a.textContent || '').length;
        const bLength = String(b.textContent || '').length;
        return aLength - bLength;
      });

      return matches[0] || null;
    };

    try {
      const semantic = Array.from(
        main.querySelectorAll(
          'aside,[role="status"],[role="note"],[aria-live],section'
        )
      );

      runtime.lastPlanNoticeCandidateCount =
        semantic.length;

      const semanticMatch =
        chooseBest(semantic);

      if (semanticMatch) {
        return semanticMatch;
      }

      const generic = Array.from(
        main.querySelectorAll('div')
      ).slice(-CONFIG.maxPlanNoticeCandidates);

      runtime.lastPlanNoticeCandidateCount +=
        generic.length;

      return chooseBest(generic);
    } catch (_) {
      runtime.lastPlanNoticeCandidateCount = 0;
      return null;
    }
  }

  function markPlanNotice(desired) {
    if (!isWideActive()) {
      runtime.lastPlanNoticeCandidateCount = 0;
      return;
    }

    const main = (() => {
      try {
        return Array.from(
          document.querySelectorAll(
            SELECTOR.main
          )
        ).find(isVisibleElement) || null;
      } catch (_) {
        return null;
      }
    })();

    if (!main) {
      runtime.lastPlanNoticeCandidateCount = 0;
      return;
    }

    const notice =
      findPlanNoticeCandidate(main);

    if (!notice) {
      return;
    }

    addDesiredMarker(
      desired,
      ATTR.planNotice,
      notice
    );

    addPath(
      desired,
      notice.parentElement,
      main,
      ATTR.planNoticePath,
      CONFIG.maxPlanNoticePathDepth
    );
  }

  function pushDebugEvent(type, details = null) {
    const event = {
      at: Date.now(),
      type: String(type || 'event')
    };

    if (details !== null && details !== undefined) {
      event.details = details;
    }

    runtime.debugEvents.push(event);

    if (runtime.debugEvents.length > CONFIG.debugEventLimit) {
      runtime.debugEvents.splice(
        0,
        runtime.debugEvents.length - CONFIG.debugEventLimit
      );
    }
  }

  function seedDesiredMarkers(desired, dirtyRegions) {
    const dirty = new Set(dirtyRegions);
    const groups = [
      [DIRTY.conversation, [
        ATTR.conversationRoot,
        ATTR.conversationPath,
        ATTR.turn,
        ATTR.turnPath
      ]],
      [DIRTY.composer, [
        ATTR.composer,
        ATTR.composerPath
      ]],
      [DIRTY.notice, [
        ATTR.planNotice,
        ATTR.planNoticePath
      ]]
    ];

    for (const [region, attributes] of groups) {
      if (dirty.has(region)) {
        continue;
      }

      for (const attribute of attributes) {
        const target = desired.get(attribute);
        const previous = runtime.marked.get(attribute);

        if (!target || !previous) {
          continue;
        }

        for (const element of previous) {
          if (isConnectedElement(element)) {
            target.add(element);
          }
        }
      }
    }
  }

  function evaluateLayoutInvariants() {
    const root = getRoot();
    const pane = resolveActivePane();
    const failures = [];

    if (!runtime.started) {
      failures.push('runtime-not-started');
    }

    if (settings.enabled) {
      if (!document.getElementById(ID.style)) {
        failures.push('main-style-missing');
      }

      if (root?.getAttribute(ATTR.enabled) !== '1') {
        failures.push('root-enabled-state');
      }
    }

    if (hasDisconnectedMarkers()) {
      failures.push('disconnected-markers');
    }

    if (
      runtime.lastTurnCount > 0 &&
      !hasConnectedMarker(ATTR.turn)
    ) {
      failures.push('turn-markers-missing');
    }

    if (
      settings.enabled &&
      settings.widenComposer &&
      document.querySelector(SELECTOR.composerInput) &&
      !hasConnectedMarker(ATTR.composer)
    ) {
      failures.push('composer-marker-missing');
    }

    if (
      settings.enabled &&
      isWideActive() &&
      !runtime.safeFallbackActive &&
      pane &&
      isVisibleElement(pane)
    ) {
      const paneRect = getVisibleRect(pane);
      const maxAllowedWidth =
        Math.max(0, Number(paneRect?.width || 0)) + 4;

      const representatives = [
        runtime.marked.get(ATTR.turn),
        runtime.marked.get(ATTR.composer)
      ];

      for (const elements of representatives) {
        const element = Array.from(elements || [])
          .find(isVisibleElement);

        if (!element || maxAllowedWidth <= 4) {
          continue;
        }

        const rect = getVisibleRect(element);

        if (
          rect &&
          rect.width > maxAllowedWidth
        ) {
          failures.push('managed-width-exceeds-pane');
          break;
        }
      }
    }

    const result = {
      ok: failures.length === 0,
      failures,
      checkedAt: Date.now()
    };

    runtime.lastInvariants = result;
    return result;
  }

  function activateSafeFallback(reason) {
    if (runtime.safeFallbackActive) {
      return false;
    }

    runtime.safeFallbackActive = true;
    runtime.safeFallbackReason = String(
      reason || 'layout-invariant-failure'
    );

    setRootState();
    pushDebugEvent('safe-fallback', {
      reason: runtime.safeFallbackReason
    });

    console.warn(
      '[UltraWide] Safe fallback activated:',
      runtime.safeFallbackReason
    );

    return true;
  }

  function clearSafeFallback(reason = 'manual-reset') {
    const wasActive = runtime.safeFallbackActive;

    runtime.safeFallbackActive = false;
    runtime.safeFallbackReason = '';
    runtime.invariantFailureStreak = 0;
    setRootState();

    if (wasActive) {
      pushDebugEvent('safe-fallback-cleared', {
        reason
      });
    }

    return wasActive;
  }

  function processInvariantResult(result) {
    if (result.ok) {
      runtime.invariantFailureStreak = 0;
      return;
    }

    runtime.invariantFailureStreak += 1;
    pushDebugEvent('invariant-failure', {
      streak: runtime.invariantFailureStreak,
      failures: result.failures
    });

    if (
      runtime.invariantFailureStreak >=
        CONFIG.invariantFailureThreshold
    ) {
      activateSafeFallback(
        result.failures.join(',')
      );
    }
  }

  function performScan(
    dirtyRegions = ALL_DIRTY_REGIONS,
    reasons = ['scan']
  ) {
    if (shouldPauseWork()) {
      runtime.deferredScan = true;
      return;
    }

    const dirty = new Set(
      dirtyRegions?.length
        ? dirtyRegions
        : ALL_DIRTY_REGIONS
    );

    const startedAt = nowMs();

    runtime.lastScanAt = Date.now();
    runtime.lastRepairAt = runtime.lastScanAt;
    runtime.lastRepairReasons = [...reasons];
    runtime.lastError = null;
    runtime.deferredScan = false;
    runtime.repairPassCount += 1;

    pushDebugEvent('repair-pass', {
      reasons: [...reasons],
      dirty: [...dirty]
    });

    try {
      const desired = createDesiredMarkers();
      seedDesiredMarkers(desired, dirty);

      if (dirty.has(DIRTY.split)) {
        detectCanvas();
      }

      if (dirty.has(DIRTY.conversation)) {
        markConversation(desired);
      }

      if (dirty.has(DIRTY.composer)) {
        markComposer(desired);
      }

      if (dirty.has(DIRTY.notice)) {
        markPlanNotice(desired);
      }

      applyMarkerDiff(desired);
      attachPaneResizeObserver();
      detectDomCapabilities();
      evaluateCompatibility(
        runtime.lastCapabilities
      );
      setRootState();
      runtime.scanCount += 1;

      processInvariantResult(
        evaluateLayoutInvariants()
      );
    } catch (error) {
      runtime.lastError = String(
        error?.message || error
      );

      pushDebugEvent('repair-error', {
        message: runtime.lastError
      });

      console.error(
        '[UltraWide] Layout scan failed:',
        error
      );
    } finally {
      if (settings.performanceTelemetry) {
        const duration = Math.max(
          0,
          nowMs() - startedAt
        );

        runtime.lastScanDurationMs = duration;
        runtime.totalScanDurationMs += duration;
        runtime.maxScanDurationMs = Math.max(
          runtime.maxScanDurationMs,
          duration
        );
        runtime.measuredScanCount += 1;
      }
    }
  }

  function cancelScheduledScan() {
    if (runtime.scanTimer) {
      clearTimeout(runtime.scanTimer);
      runtime.scanTimer = 0;
    }

    if (
      runtime.idleCallback &&
      typeof cancelIdleCallback === 'function'
    ) {
      cancelIdleCallback(runtime.idleCallback);
      runtime.idleCallback = 0;
    }

    if (runtime.animationFrame) {
      cancelAnimationFrame(runtime.animationFrame);
      runtime.animationFrame = 0;
    }
  }

  function requestRepair(
    reason = 'repair',
    dirtyRegions = ALL_DIRTY_REGIONS,
    force = false
  ) {
    if (!runtime.started && !force) {
      return false;
    }

    runtime.repairRequestCount += 1;
    runtime.pendingRepairReasons.add(
      String(reason || 'repair')
    );

    for (const region of dirtyRegions || []) {
      if (ALL_DIRTY_REGIONS.includes(region)) {
        runtime.pendingDirtyRegions.add(region);
      }
    }

    if (runtime.pendingDirtyRegions.size === 0) {
      ALL_DIRTY_REGIONS.forEach((region) =>
        runtime.pendingDirtyRegions.add(region)
      );
    }

    if (shouldPauseWork()) {
      runtime.deferredScan = true;
      pushDebugEvent('repair-deferred', {
        reason
      });
      return false;
    }

    const alreadyScheduled = Boolean(
      runtime.scanTimer ||
      runtime.idleCallback ||
      runtime.animationFrame
    );

    if (alreadyScheduled && !force) {
      runtime.coalescedRepairCount += 1;
      return true;
    }

    if (force) {
      cancelScheduledScan();
    }

    const run = () => {
      runtime.scanTimer = 0;
      runtime.idleCallback = 0;
      runtime.animationFrame = 0;

      const reasons = [
        ...runtime.pendingRepairReasons
      ];

      const dirty = [
        ...runtime.pendingDirtyRegions
      ];

      runtime.pendingRepairReasons.clear();
      runtime.pendingDirtyRegions.clear();

      if (runtime.started || force) {
        performScan(dirty, reasons);
      }
    };

    if (force) {
      runtime.animationFrame =
        requestAnimationFrame(run);
      return true;
    }

    runtime.scanTimer = window.setTimeout(() => {
      runtime.scanTimer = 0;

      if (
        typeof requestIdleCallback === 'function'
      ) {
        runtime.idleCallback =
          requestIdleCallback(run, {
            timeout: CONFIG.idleTimeoutMs
          });
      } else {
        run();
      }
    }, settings.scanDebounceMs);

    return true;
  }

  function scheduleScan(force = false) {
    return requestRepair(
      force ? 'forced-scan' : 'scan',
      ALL_DIRTY_REGIONS,
      force
    );
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

    attachPaneResizeObserver();
    setRootState();
    requestRepair(
      'apply-styles',
      ALL_DIRTY_REGIONS,
      true
    );
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
      `pane ${
        getAdaptiveWidth()
      }px`,
      `compat ${
        (
          runtime.lastCompatibility ||
          evaluateCompatibility()
        ).status
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
    runtime.lastRouteChangeAt = Date.now();
    clearSafeFallback('route-change');
    pushDebugEvent('route-change', {
      href: runtime.href
    });

    requestRepair(
      'route-change',
      ALL_DIRTY_REGIONS,
      true
    );
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
      if (node.matches(SCAN_TRIGGER_SELECTOR)) {
        return true;
      }

      return Boolean(
        node.querySelector(
          SCAN_TRIGGER_SELECTOR
        )
      );
    } catch (_) {
      return false;
    }
  }

  function isWithinManagedLayout(element) {
    if (!isElement(element)) {
      return false;
    }

    try {
      return Boolean(
        element.closest(
          MANAGED_LAYOUT_SELECTOR
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

      if (
        record.type === 'attributes' &&
        (
          nodeMayRequireScan(record.target) ||
          isWithinManagedLayout(record.target)
        )
      ) {
        return true;
      }

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

  function classifyMutationDirtyRegions(records) {
    const dirty = new Set();

    if (!records || records.length === 0) {
      return dirty;
    }

    const inspectNode = (node) => {
      if (!isElement(node)) {
        return;
      }

      try {
        if (
          node.matches(SELECTOR.preferredTurns) ||
          node.matches(SELECTOR.fallbackMessages) ||
          node.querySelector(SELECTOR.preferredTurns) ||
          node.querySelector(SELECTOR.fallbackMessages)
        ) {
          dirty.add(DIRTY.conversation);
        }

        if (
          node.matches(SELECTOR.composerInput) ||
          node.matches(SELECTOR.composerShell) ||
          node.querySelector(SELECTOR.composerInput) ||
          node.querySelector(SELECTOR.composerShell)
        ) {
          dirty.add(DIRTY.composer);
        }

        if (
          node.matches(SELECTOR.splitViewIndicators) ||
          node.querySelector(SELECTOR.splitViewIndicators)
        ) {
          dirty.add(DIRTY.split);
        }

        if (
          node.matches(SELECTOR.structuralRoots) ||
          node.querySelector(SELECTOR.structuralRoots)
        ) {
          dirty.add(DIRTY.root);
          dirty.add(DIRTY.conversation);
          dirty.add(DIRTY.composer);
        }
      } catch (_) {}
    };

    const limit = Math.min(
      records.length,
      CONFIG.maxMutationRecords
    );

    for (let index = 0; index < limit; index += 1) {
      const record = records[index];
      inspectNode(record.target);

      if (
        record.type === 'childList' &&
        isElement(record.target)
      ) {
        try {
          if (record.target.closest(SELECTOR.main)) {
            dirty.add(DIRTY.notice);
          }
        } catch (_) {}
      }

      const added = Array.from(record.addedNodes || [])
        .slice(0, CONFIG.maxMutationNodes);
      const removed = Array.from(record.removedNodes || [])
        .slice(0, CONFIG.maxMutationNodes);

      added.forEach(inspectNode);
      removed.forEach(inspectNode);

      if (
        (record.addedNodes?.length || 0) > CONFIG.maxMutationNodes ||
        (record.removedNodes?.length || 0) > CONFIG.maxMutationNodes
      ) {
        ALL_DIRTY_REGIONS.forEach((region) =>
          dirty.add(region)
        );
      }
    }

    if (
      records.length > CONFIG.maxMutationRecords
    ) {
      ALL_DIRTY_REGIONS.forEach((region) =>
        dirty.add(region)
      );
    }

    if (
      dirty.size === 0 &&
      mutationNeedsScan(records)
    ) {
      dirty.add(DIRTY.conversation);
      dirty.add(DIRTY.composer);
      dirty.add(DIRTY.notice);
    }

    return dirty;
  }

  function onBodyMutations(records) {
    runtime.mutationBatchCount += 1;
    runtime.lastMutationAt = Date.now();

    const dirty =
      classifyMutationDirtyRegions(records);

    if (dirty.size > 0) {
      requestRepair(
        'mutation',
        [...dirty]
      );
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

      requestRepair(
        'head-style-repair',
        [DIRTY.root],
        true
      );
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
          subtree: true,
          attributes: true,
          attributeFilter:
            CONFIG.mutationAttributeFilter
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

        requestRepair(
          'observer-bootstrap',
          ALL_DIRTY_REGIONS,
          true
        );
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

    disconnectPaneResizeObserver();
  }

  function repair() {
    if (!runtime.started) {
      return;
    }

    attachObservers();
    attachPaneResizeObserver();

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

    ensureStyle(
      ID.uiStyle,
      getUiCss()
    );

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

    const dirty = [];

    if (hasDisconnectedMarkers()) {
      dirty.push(
        DIRTY.conversation,
        DIRTY.composer,
        DIRTY.notice
      );
    }

    if (conversationMissing) {
      dirty.push(DIRTY.conversation);
    }

    if (composerMissing) {
      dirty.push(DIRTY.composer);
    }

    if (dirty.length > 0) {
      requestRepair(
        'periodic-repair',
        [...new Set(dirty)]
      );
    }

    processInvariantResult(
      evaluateLayoutInvariants()
    );
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
    attachPaneResizeObserver();
    measureEffectivePane();
    setRootState();
    syncSettingsModal();
    requestRepair(
      'environment-change',
      [DIRTY.split, DIRTY.root]
    );
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

  function menuToggleLabel(
    label,
    active,
    detail = ''
  ) {
    const marker =
      active ? '✓' : '○';

    return `${marker}  ${label}${
      detail ? ` · ${detail}` : ''
    }`;
  }

  function menuValueLabel(
    icon,
    label,
    value,
    detail = ''
  ) {
    return `${icon}  ${label} · ${value}${
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
      `⚙  Settings · v${VERSION}`,
      openSettings,
      's'
    );

    registerMenu(
      'enabled',
      menuToggleLabel(
        'Script',
        settings.enabled,
        settings.enabled
          ? 'enabled'
          : 'disabled'
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
      menuToggleLabel(
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
      menuToggleLabel(
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
      menuValueLabel(
        '⌗',
        'Width cap',
        settings.cap === 'none'
          ? 'Unlimited'
          : `${settings.cap}px`,
        'cycle'
      ),
      cycleCap,
      'm'
    );

    registerMenu(
      'auto',
      menuToggleLabel(
        'Adaptive width',
        settings.auto,
        `≥ ${settings.autoMinWidth}px`
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
      menuToggleLabel(
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
      menuToggleLabel(
        'Split-view safety',
        settings.canvasSafeMode,
        runtime.canvasDetected
          ? 'split view detected'
          : 'standby'
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
      menuToggleLabel(
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
      menuToggleLabel(
        'Pause hidden tabs',
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
      menuToggleLabel(
        'Performance telemetry',
        settings.performanceTelemetry,
        `${runtime.lastScanDurationMs.toFixed(1)} ms`
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
      menuValueLabel(
        '↻',
        'Rescan layout',
        `${runtime.lastTurnCount} turns`
      ),
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
      '⎘  Copy diagnostics',
      () => {
        void copyDiagnostics();
      }
    );

    registerMenu(
      'reset',
      '↺  Reset to defaults',
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
          {
            className:
              'uwc-check-copy'
          },
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
        ),
        createElement(
          'span',
          {
            className:
              'uwc-toggle-state',
            dataset: {
              toggleStateFor: key
            },
            text:
              input.checked ? 'ON' : 'OFF',
            'aria-hidden': 'true'
          }
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

            const statePill =
              modal.querySelector(
                `[data-toggle-state-for="${key}"]`
              );

            if (statePill) {
              statePill.textContent =
                element.checked ? 'ON' : 'OFF';
            }
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

  function getSettingsSnapshot() {
    try {
      return JSON.stringify(
        normalizeSettings({ ...settings })
      );
    } catch (_) {
      return '';
    }
  }

  function getReloadGuardState() {
    try {
      const raw = sessionStorage.getItem(
        RELOAD_GUARD_KEY
      );

      const parsed = raw
        ? JSON.parse(raw)
        : null;

      return parsed && typeof parsed === 'object'
        ? parsed
        : { timestamps: [] };
    } catch (_) {
      return { timestamps: [] };
    }
  }

  function requestGuardedReload(reason) {
    const now = Date.now();
    const state = getReloadGuardState();
    const timestamps = Array.isArray(state.timestamps)
      ? state.timestamps.filter(
          (timestamp) =>
            now - Number(timestamp) <
              CONFIG.reloadLoopWindowMs
        )
      : [];

    if (
      timestamps.length >=
        CONFIG.reloadLoopMaxCount
    ) {
      pushDebugEvent('reload-suppressed', {
        reason,
        recentReloads: timestamps.length
      });

      showToast(
        'Reload suppressed by loop protection'
      );
      return false;
    }

    timestamps.push(now);

    try {
      sessionStorage.setItem(
        RELOAD_GUARD_KEY,
        JSON.stringify({
          timestamps,
          reason: String(reason || 'reload')
        })
      );
    } catch (_) {}

    pushDebugEvent('reload-requested', {
      reason
    });

    window.setTimeout(() => {
      location.reload();
    }, 0);

    return true;
  }

  function closeSettings(options = {}) {
    const reloadIfChanged =
      options?.reloadIfChanged !== false;

    const modal =
      document.getElementById(ID.modal);

    const openedSnapshot =
      runtime.modalSettingsSnapshot;

    const currentSnapshot =
      getSettingsSnapshot();

    const settingsChanged = Boolean(
      modal &&
      openedSnapshot &&
      currentSnapshot &&
      openedSnapshot !== currentSnapshot
    );

    removeById(ID.modal);
    runtime.modalSettingsSnapshot = '';

    if (
      reloadIfChanged &&
      settingsChanged
    ) {
      requestGuardedReload(
        'settings-changed'
      );

      return;
    }

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

    runtime.modalSettingsSnapshot =
      getSettingsSnapshot();

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
                    {
                      className:
                        'uwc-header-copy'
                    },
                    [
                      createElement(
                        'div',
                        {
                          className:
                            'uwc-title-row'
                        },
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
                            'span',
                            {
                              className:
                                'uwc-version',
                              text:
                                `v${VERSION}`
                            }
                          )
                        ]
                      ),
                      createElement(
                        'p',
                        {
                          className:
                            'uwc-subtitle',
                          text:
                            'Layout and runtime preferences'
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
                    'Layout',
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
                            'Split-view safe mode'
                          ),
                          createCheckbox(
                            'toast',
                            'Show status notifications'
                          )
                        ]
                      )
                    ]
                  ),

                  createSection(
                    'Adaptive behavior',
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
                            'Minimum pane width',
                            `${LIMITS.autoMinWidth[0]}–${LIMITS.autoMinWidth[1]} px`
                          ),
                          createNumberInput(
                            'disableBelowHeight',
                            'Minimum window height',
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
                    'Shortcuts',
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
                            'Rescan layout',
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
                          text: 'Done',
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

  function verifyRuntime() {
    const mainStyle =
      document.getElementById(ID.style);
    const uiStyle =
      document.getElementById(ID.uiStyle);
    const root = getRoot();

    const checks = {
      started: runtime.started,
      rootVersion:
        !settings.enabled ||
        root?.getAttribute(ATTR.version) === VERSION,
      mainStyle:
        !settings.enabled ||
        mainStyle?.textContent === getMainCss(),
      uiStyle:
        uiStyle?.textContent === getUiCss(),
      bodyObserver:
        Boolean(runtime.bodyObserver),
      headObserver:
        Boolean(runtime.headObserver),
      paneObserver:
        typeof ResizeObserver !== 'function' ||
        Boolean(runtime.paneResizeObserver) ||
        !runtime.observedPane,
      paneConnected:
        !runtime.observedPane ||
        runtime.observedPane.isConnected,
      markersConnected:
        !hasDisconnectedMarkers(),
      rootEnabledState:
        !settings.enabled ||
        root?.getAttribute(ATTR.enabled) === '1',
      schedulerState:
        runtime.pendingRepairReasons instanceof Set &&
        runtime.pendingDirtyRegions instanceof Set,
      invariants:
        runtime.safeFallbackActive ||
        evaluateLayoutInvariants().ok
    };

    return {
      ok: Object.values(checks).every(Boolean),
      checks
    };
  }

  function getDiagnostics() {
    const pane = measureEffectivePane();
    const capabilities =
      detectDomCapabilities();
    const compatibility =
      evaluateCompatibility(capabilities);
    const state = getState();

    return {
      generatedAt: new Date().toISOString(),
      version: VERSION,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth || 0,
        height: window.innerHeight || 0,
        devicePixelRatio:
          window.devicePixelRatio || 1
      },
      pane: {
        width: pane.width,
        height: pane.height,
        source: pane.source,
        observed:
          Boolean(runtime.observedPane),
        connected:
          Boolean(
            runtime.observedPane?.isConnected
          ),
        resizeObserverAttached:
          Boolean(runtime.paneResizeObserver),
        resizeCount:
          runtime.paneResizeCount,
        lastResizeAt:
          runtime.lastPaneResizeAt
      },
      document: {
        hidden: document.hidden,
        readyState: document.readyState,
        url: location.href,
        language:
          document.documentElement?.lang || ''
      },
      capabilities: {
        browser: {
          navigationApi:
            Boolean(window.navigation),
          resizeObserver:
            typeof ResizeObserver === 'function',
          requestIdleCallback:
            typeof requestIdleCallback === 'function',
          gmStorage: hasGmStorage()
        },
        dom: capabilities
      },
      compatibility,
      health: verifyRuntime(),
      runtime: {
        repairRequests: runtime.repairRequestCount,
        repairPasses: runtime.repairPassCount,
        coalescedRepairs: runtime.coalescedRepairCount,
        lastRepairAt: runtime.lastRepairAt,
        lastRepairReasons: runtime.lastRepairReasons,
        pendingReasons: [...runtime.pendingRepairReasons],
        pendingDirtyRegions: [...runtime.pendingDirtyRegions],
        invariants: runtime.lastInvariants,
        invariantFailureStreak: runtime.invariantFailureStreak,
        safeFallbackActive: runtime.safeFallbackActive,
        safeFallbackReason: runtime.safeFallbackReason,
        debugEvents: [...runtime.debugEvents]
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

      effectivePaneWidth:
        getAdaptiveWidth(),
      effectivePaneHeight:
        runtime.effectivePaneHeight,
      paneObserved:
        Boolean(runtime.observedPane),
      paneResizeObserverAttached:
        Boolean(runtime.paneResizeObserver),
      paneResizeCount:
        runtime.paneResizeCount,
      lastPaneResizeAt:
        runtime.lastPaneResizeAt,

      compatibility:
        runtime.lastCompatibility ||
        evaluateCompatibility(),
      domCapabilities:
        runtime.lastCapabilities ||
        detectDomCapabilities(),

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
      transcriptRootDetected:
        Boolean(document.querySelector('[data-thread-user-message-navigation-content]')),
      conversationRootDetected:
        Boolean(document.querySelector('[data-thread-find-target="conversation"]')),
      composerRootDetected:
        Boolean(document.querySelector('#thread-bottom-container')),
      promptDetected:
        Boolean(document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"]')),
      detectedTurns:
        runtime.lastTurnCount,
      rawTurnCandidates:
        runtime.lastRawTurnCount,
      planNoticeCandidates:
        runtime.lastPlanNoticeCandidateCount,
      lastScanAt:
        runtime.lastScanAt,
      lastScanDurationMs:
        runtime.lastScanDurationMs,
      averageScanDurationMs:
        runtime.measuredScanCount > 0
          ? runtime.totalScanDurationMs /
            runtime.measuredScanCount
          : 0,
      maxScanDurationMs:
        runtime.maxScanDurationMs,
      measuredScanCount:
        runtime.measuredScanCount,
      scanCount:
        runtime.scanCount,
      repairRequestCount:
        runtime.repairRequestCount,
      repairPassCount:
        runtime.repairPassCount,
      coalescedRepairCount:
        runtime.coalescedRepairCount,
      lastRepairAt:
        runtime.lastRepairAt,
      lastRepairReasons:
        [...runtime.lastRepairReasons],
      invariantFailureStreak:
        runtime.invariantFailureStreak,
      invariants:
        runtime.lastInvariants,
      safeFallbackActive:
        runtime.safeFallbackActive,
      safeFallbackReason:
        runtime.safeFallbackReason,
      mutationBatchCount:
        runtime.mutationBatchCount,
      lastMutationAt:
        runtime.lastMutationAt,
      lastRouteChangeAt:
        runtime.lastRouteChangeAt,
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
    runtime.safeFallbackActive = false;
    runtime.safeFallbackReason = '';
    runtime.invariantFailureStreak = 0;
    pushDebugEvent('runtime-start', {
      href: runtime.href
    });

    installHistoryHooks();
    installObservers();
    attachPaneResizeObserver();
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

    pushDebugEvent('runtime-stop');
    runtime.started = false;

    cancelScheduledScan();
    runtime.pendingRepairReasons.clear();
    runtime.pendingDirtyRegions.clear();

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
    closeSettings({
      reloadIfChanged: false
    });
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
            capabilities: detectDomCapabilities,
            verify: verifyRuntime,
            invariants: evaluateLayoutInvariants,
            debugEvents: () => [
              ...runtime.debugEvents
            ],
            clearSafeFallback: () => {
              const cleared =
                clearSafeFallback('api');

              requestRepair(
                'safe-fallback-clear',
                ALL_DIRTY_REGIONS,
                true
              );

              return cleared;
            },
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
