const assert = require("assert");

const settingsInfoEl = { innerHTML: "", textContent: "" };

global.window = {
  __MODE__: "test",
  location: { href: "http://localhost/", protocol: "http:", hostname: "localhost" },
  visualViewport: null,
  addEventListener() {},
  isSecureContext: true,
};
global.location = global.window.location;
global.document = {
  documentElement: { style: { setProperty() {} } },
  getElementById(id) {
    if (id === "settingsInfo") return settingsInfoEl;
    return null;
  },
  querySelectorAll() { return []; },
};
global.navigator = {};
global.performance = { now: () => 0 };
global.Image = function Image() { this.src = ""; };
global.URL = URL;
global.setInterval = () => 0;
global.localStorage = {
  _store: {},
  getItem(key) { return Object.prototype.hasOwnProperty.call(this._store, key) ? this._store[key] : null; },
  setItem(key, value) { this._store[key] = String(value); },
  removeItem(key) { delete this._store[key]; },
};

global.fetch = async (url) => {
  fetchCalls.push(String(url));
  if (String(url).includes("setting.json")) {
    return {
      ok: true,
      async text() {
        return `{
  // comment line
  "timeline": {
    "transitionWindowMinutes": 45
  },
  "demo": {
    "transitionSpeedMultiplier": 300,
    "holdSeconds": 1
  },
  "performance": {
    "preloadAllImages": true
  }
}`;
      },
    };
  }
  throw new Error(`unexpected fetch ${url}`);
};

assert.doesNotThrow(() => require("./script.js"), "script should load without throwing in test mode");

const fetchCalls = [];
const hooks = global.window.__BIGSUR_TIMELINE_TEST_HOOKS__;

assert.ok(hooks, "expected __BIGSUR_TIMELINE_TEST_HOOKS__ to exist");
assert.ok(typeof hooks.parseSettingsText === "function", "expected parseSettingsText hook");
assert.ok(typeof hooks.mergeConfig === "function", "expected mergeConfig hook");
assert.ok(typeof hooks.applyRuntimeConfig === "function", "expected applyRuntimeConfig hook");
assert.ok(typeof hooks.getDemoConfig === "function", "expected getDemoConfig hook");
assert.ok(typeof hooks.getPerformanceConfig === "function", "expected getPerformanceConfig hook");
assert.ok(typeof hooks.resolvePerformanceConfig === "function", "expected resolvePerformanceConfig hook");
assert.strictEqual("tryWriteSettingsFile" in hooks, false, "should not expose file write hook");

const parsed = hooks.parseSettingsText(`{
  // comment line
  "timeline": {
    "transitionWindowMinutes": 45
  },
  "demo": {
    "transitionSpeedMultiplier": 300,
    "holdSeconds": 1
  },
  "performance": {
    "preloadAllImages": true
  }
}`);
assert.strictEqual(parsed.timeline.transitionWindowMinutes, 45, "should parse JSONC transition window");
assert.strictEqual(parsed.demo.transitionSpeedMultiplier, 300, "should parse JSONC demo speed");
assert.strictEqual(parsed.demo.holdSeconds, 1, "should parse JSONC demo hold seconds");
assert.strictEqual(parsed.performance.preloadAllImages, true, "should parse JSONC preload switch");

let parseFailed = false;
try {
  hooks.parseSettingsText("{ invalid json }");
} catch (_) {
  parseFailed = true;
}
assert.strictEqual(parseFailed, true, "invalid settings text should throw");

const demoConfig = hooks.getDemoConfig();
assert.strictEqual(demoConfig.transitionSpeedMultiplier, 300, "demo speed should default to 300x");
assert.strictEqual(demoConfig.holdSeconds, 1, "demo hold should default to 1s");

const perfDefault = hooks.getPerformanceConfig();
assert.strictEqual(perfDefault.preloadAllImages, false, "preload switch should default to false");

const perfFromFile = hooks.resolvePerformanceConfig({ performance: { preloadAllImages: true } }, null);
assert.strictEqual(perfFromFile.preloadAllImages, true, "setting.json should enable preload switch");

const perfFromStorage = hooks.resolvePerformanceConfig({ performance: { preloadAllImages: false } }, true);
assert.strictEqual(perfFromStorage.preloadAllImages, true, "localStorage should override setting.json preload switch");

const perfFallback = hooks.resolvePerformanceConfig({}, null);
assert.strictEqual(perfFallback.preloadAllImages, false, "missing preload switch should fall back to false");

const sunset = 18 * 60;
const boundaries = hooks.getSegmentBoundariesBySunset(sunset);

assert.strictEqual(boundaries[2], 5 * 60, "seg2 should start at 05:00");
assert.strictEqual(boundaries[3], 6 * 60, "seg3 should start at 06:00");
assert.strictEqual(boundaries[4], 9 * 60, "seg4 should start at 09:00");
assert.strictEqual(boundaries[5], 11 * 60 + 30, "seg5 should start at 11:30");
assert.strictEqual(boundaries[6], 14 * 60 + 30, "seg6 should start at 14:30");
assert.strictEqual(boundaries[7], 17 * 60 + 30, "seg7 should start at 17:30");
assert.strictEqual(boundaries[8], 18 * 60 + 30, "seg8 should start at 18:30");
assert.strictEqual(boundaries[1], 20 * 60 + 30, "seg1 should start at 20:30");

const orderCheck = [
  { minute: 4 * 60 + 29, expected: 1 },
  { minute: 5 * 60, expected: 2 },
  { minute: 6 * 60, expected: 3 },
  { minute: 9 * 60, expected: 4 },
  { minute: 11 * 60 + 30, expected: 5 },
  { minute: 14 * 60 + 30, expected: 6 },
  { minute: 17 * 60 + 30, expected: 7 },
  { minute: 18 * 60 + 30, expected: 8 },
  { minute: 21 * 60, expected: 1 },
];

for (const { minute, expected } of orderCheck) {
  const seg = hooks.getCoreSegmentAtMinute(minute, sunset);
  assert.strictEqual(seg, expected, `minute=${minute} expected seg=${expected}`);
}

const windows = hooks.getDynamicWindowRangesBySunset(sunset);
assert.strictEqual(windows[2].start, 4 * 60 + 30, "night -> sunrise mix should start at 04:30");
assert.strictEqual(windows[2].end, 5 * 60, "night -> sunrise mix should end at 05:00");
assert.strictEqual(windows[8].start, 18 * 60, "evening -> dusk mix should start at 18:00");
assert.strictEqual(windows[8].end, 18 * 60 + 30, "evening -> dusk mix should end at 18:30");

const preBoundaryBlend = hooks.getBlendStateAtMinute(4 * 60 + 45, sunset);
assert.strictEqual(preBoundaryBlend.baseSeg, 1, "04:45 should still fade from seg1");
assert.strictEqual(preBoundaryBlend.overlaySeg, 2, "04:45 should blend into seg2");
assert.ok(preBoundaryBlend.alpha > 0 && preBoundaryBlend.alpha < 1, "04:45 alpha should be between 0 and 1");

const boundaryBlend = hooks.getBlendStateAtMinute(5 * 60, sunset);
assert.strictEqual(boundaryBlend.baseSeg, 2, "05:00 should be fully seg2");
assert.strictEqual(boundaryBlend.overlaySeg, null, "05:00 should finish the blend");
assert.strictEqual(boundaryBlend.alpha, 0, "05:00 should have no overlay alpha");

const activePanelState = hooks.getPanelInfoStateAtMinute(4 * 60 + 45, sunset);
assert.strictEqual(activePanelState.currentSegment, 1, "panel state should report seg1 during pre-boundary blend");
assert.strictEqual(activePanelState.activeTransition.fromSeg, 1, "active transition should start from seg1");
assert.strictEqual(activePanelState.activeTransition.toSeg, 2, "active transition should end at seg2");
assert.strictEqual(activePanelState.activeTransition.rangeText, "04:30-05:00", "active transition text should match mix window");
assert.strictEqual(activePanelState.nextTransition, null, "active transition state should not expose next transition");

const idlePanelState = hooks.getPanelInfoStateAtMinute(10 * 60, sunset);
assert.strictEqual(idlePanelState.currentSegment, 4, "10:00 should be in seg4");
assert.strictEqual(idlePanelState.currentRangeText, "09:00-11:30", "seg4 range text should match configured slot");
assert.strictEqual(idlePanelState.activeTransition, null, "idle state should not expose active transition");
assert.strictEqual(idlePanelState.nextTransition.fromSeg, 4, "next transition should start from seg4");
assert.strictEqual(idlePanelState.nextTransition.toSeg, 5, "next transition should target seg5");
assert.strictEqual(idlePanelState.nextTransition.rangeText, "11:00-11:30", "next transition should report upcoming mix window");

// --- JSONC parsing: trailing and block comments, and // inside strings ---
const parsedComments = hooks.parseSettingsText(`{
  "timeline": { "transitionWindowMinutes": 45 }, // trailing comment
  /* block comment */
  "demo": { "holdSeconds": 2 }
}`);
assert.strictEqual(parsedComments.timeline.transitionWindowMinutes, 45, "should parse trailing // comments");
assert.strictEqual(parsedComments.demo.holdSeconds, 2, "should parse block comments");
const parsedString = hooks.parseSettingsText(`{"location":{"city":"http://example.com//path"}}`);
assert.strictEqual(parsedString.location.city, "http://example.com//path", "should not strip // inside strings");

// --- mergeConfig: demo speed + location validation ---
const mergeBase = {
  location: { lat: 20, lon: 100, city: "base", source: "manual" },
  timeline: { transitionWindowMinutes: 30, segments: {} },
  performance: {},
  demo: { transitionSpeedMultiplier: 300, holdSeconds: 1 },
};
const mergedDemo = hooks.mergeConfig(mergeBase, { demo: { transitionSpeedMultiplier: 600, holdSeconds: 2 } });
assert.strictEqual(mergedDemo.demo.transitionSpeedMultiplier, 600, "should merge demo.transitionSpeedMultiplier");
assert.strictEqual(mergedDemo.demo.holdSeconds, 2, "should merge demo.holdSeconds");
assert.strictEqual(hooks.mergeConfig(mergeBase, { location: { lat: null, lon: null } }).location.lat, null, "null should clear configured lat");
assert.strictEqual(hooks.mergeConfig(mergeBase, { location: { lat: 100, lon: 200 } }).location.lat, 20, "out-of-range coords should be ignored");
assert.strictEqual(hooks.mergeConfig(mergeBase, { location: { lat: 30, lon: 110 } }).location.lon, 110, "valid coords should be merged");

hooks.applyRuntimeConfig({ demo: { transitionSpeedMultiplier: 600, holdSeconds: 0.5 } });
const appliedDemo = hooks.getDemoConfig();
assert.strictEqual(appliedDemo.transitionSpeedMultiplier, 600, "applyRuntimeConfig should apply demo speed");
assert.strictEqual(appliedDemo.holdSeconds, 0.5, "applyRuntimeConfig should apply demo hold seconds");

// --- transition windows must not overlap when MIX_WINDOW_MIN is large ---
hooks.applyRuntimeConfig({ timeline: { transitionWindowMinutes: 90 } });
const wideWindows = hooks.getDynamicWindowRangesBySunset(1080);
assert.strictEqual(wideWindows[8].start, 17 * 60 + 30, "seg8 window should be clamped to the seg7 boundary");
assert.strictEqual(wideWindows[8].end, 18 * 60 + 30, "seg8 window should still end at its boundary");
const wideBlend = hooks.getBlendStateAtMinute(17 * 60 + 10, 1080);
assert.strictEqual(wideBlend.baseSeg, 6, "17:10 wide-window blend should start from seg6");
assert.strictEqual(wideBlend.overlaySeg, 7, "17:10 wide-window blend should target seg7, not seg8");

// --- durationHours must not lie about the real range ---
hooks.applyRuntimeConfig({ timeline: { segments: { 4: { startHour: 9, durationHours: 4 } } } });
const durationPanel = hooks.getPanelInfoStateAtMinute(10 * 60, 1080);
assert.strictEqual(durationPanel.currentRangeText, "09:00-11:30", "range text should use the real next boundary, not durationHours");

// --- displayed range follows the sunset shift ---
hooks.applyRuntimeConfig({});
const shiftedPanel = hooks.getPanelInfoStateAtMinute(14 * 60 + 40, 1070);
assert.strictEqual(shiftedPanel.currentSegment, 6, "14:40 with sunset 17:50 should be in seg6");
assert.strictEqual(shiftedPanel.currentRangeText, "14:20-17:20", "range text should reflect sunset-anchored boundaries");

console.log("PASS timeline-model.test.js");
