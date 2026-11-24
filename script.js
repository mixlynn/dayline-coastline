/* ============================================
   Dynamic Sunset Slideshow v3.2.5
   - Apple 风格低存在感设置按钮
   - 模式单选：系统 / 定格 / 演示 / 自定义
   - 演示模式：静止段停留 holdSeconds（默认1秒），窗口期 transitionSpeedMultiplier（默认300x）
   - 时间滑条支持窗口期标志 + 定位窗口期计算
   ============================================ */
(() => {
  "use strict";

  const DEFAULT_CONFIG = {
    location: {
      lat: null,
      lon: null,
      city: "岑溪市",
      source: "default",
    },
    timeline: {
      transitionWindowMinutes: 30,
      segments: {
        1: { name: "夜晚/深夜", startHour: 20.5, durationHours: 8.5 },
        2: { name: "晨曦", startHour: 5, durationHours: 1 },
        3: { name: "早晨", startHour: 6, durationHours: 3 },
        4: { name: "上午", startHour: 9, durationHours: 2.5 },
        5: { name: "正午", startHour: 11.5, durationHours: 3 },
        6: { name: "下午", startHour: 14.5, durationHours: 3 },
        7: { name: "傍晚", startHour: 17.5, durationHours: 1 },
        8: { name: "日暮", startHour: 18.5, durationHours: 2 },
      },
    },
    demo: {
      transitionSpeedMultiplier: 300,
      holdSeconds: 1,
    },
    performance: {
      preloadAllImages: false,
    },
  };

  const SEGMENT_FILES = {
    1: "Appearance Dynamic1.jpg",
    2: "Appearance Dynamic2.jpg",
    3: "Appearance Dynamic3.jpg",
    4: "Appearance Dynamic4.jpg",
    5: "Appearance Dynamic5.jpg",
    6: "Appearance Dynamic6.jpg",
    7: "Appearance Dynamic7.jpg",
    8: "Appearance Dynamic8.jpg",
  };

  const SEGMENT_META = {
    1: { name: "夜晚/深夜" },
    2: { name: "晨曦" },
    3: { name: "早晨" },
    4: { name: "上午" },
    5: { name: "正午" },
    6: { name: "下午" },
    7: { name: "傍晚" },
    8: { name: "日暮" },
  };

  const SEGMENT_MODEL = {
    1: { offsetFromSunsetMin: 150 },
    2: { offsetFromSunsetMin: -780 },
    3: { offsetFromSunsetMin: -720 },
    4: { offsetFromSunsetMin: -540 },
    5: { offsetFromSunsetMin: -390 },
    6: { offsetFromSunsetMin: -210 },
    7: { offsetFromSunsetMin: -30 },
    8: { offsetFromSunsetMin: 30 },
  };

  let SEGMENT_SEQUENCE = [2, 3, 4, 5, 6, 7, 8, 1];
  let MIX_WINDOW_MIN = DEFAULT_CONFIG.timeline.transitionWindowMinutes;
  const DEFAULT_COORDS = { lat: 22.9, lon: 110.9667 };
  const REFERENCE_SUNSET_MIN = 1080;
  const IP_GEO_TIMEOUT_MS = 4000;

  let demoHoldMs = DEFAULT_CONFIG.demo.holdSeconds * 1000;
  let demoTransitionMult = DEFAULT_CONFIG.demo.transitionSpeedMultiplier;

  const app = document.getElementById("app");
  const imgA = document.getElementById("imgA");
  const imgB = document.getElementById("imgB");
  const cinemaGrade = document.getElementById("cinemaGrade");
  const lumaGrade = document.getElementById("lumaGrade");

  const settingsFab = document.getElementById("settingsFab");
  const settingsPanel = document.getElementById("settingsPanel");
  const modeRadios = Array.from(document.querySelectorAll('input[name="timeMode"]'));
  const timeSlider = document.getElementById("timeSlider");
  const timeLabel = document.getElementById("timeLabel");
  const speedSlider = document.getElementById("speedSlider");
  const speedLabel = document.getElementById("speedLabel");
  const geoStatusEl = document.getElementById("geoStatus");
  const geoLocateBtn = document.getElementById("geoLocateBtn");
  const latInput = document.getElementById("latInput");
  const lonInput = document.getElementById("lonInput");
  const saveGeoBtn = document.getElementById("saveGeoBtn");
  const clearGeoBtn = document.getElementById("clearGeoBtn");
  const settingsInfo = document.getElementById("settingsInfo");
  const preloadToggle = document.getElementById("preloadToggle");
  const demoHoldHint = document.getElementById("demoHoldHint");
  const demoSpeedHint = document.getElementById("demoSpeedHint");

  const HAS_SETTINGS = !!(settingsFab && settingsPanel && modeRadios.length && timeSlider && timeLabel && speedSlider && speedLabel && geoStatusEl && geoLocateBtn && latInput && lonInput && saveGeoBtn && clearGeoBtn && preloadToggle && settingsInfo);


  let geo = { lat: DEFAULT_COORDS.lat, lon: DEFAULT_COORDS.lon };
  let sunsetMinute = REFERENCE_SUNSET_MIN;

  let geoStatusText = "正在初始化…";
  let geoEditVersion = 0;
  let runtimeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // mode: system | freeze | demo | custom
  let mode = "system";
  let speed = 1;

  let virtualMs = Date.now();
  let frozenMs = virtualMs;
  let lastPerf = performance.now();
  let demoHoldRemainMs = demoHoldMs;
  let demoPhase = "hold"; // hold | transition

  let lastDateKey = dateKey(new Date());
  let lastTzOffset = new Date().getTimezoneOffset();
  let lastWallMs = Date.now();
  let lastPerfMs = performance.now();

  const GRADE_KEYFRAMES = [
    { m: 0, warm: -0.48, bright: -0.16, sat: 0.84, vignette: 0.18 },
    { m: 3 * 60, warm: -0.40, bright: -0.13, sat: 0.86, vignette: 0.17 },
    { m: 5 * 60, warm: -0.16, bright: -0.07, sat: 0.91, vignette: 0.14 },
    { m: 7 * 60, warm: 0.22, bright: 0.0, sat: 1.0, vignette: 0.11 },
    { m: 9 * 60, warm: 0.09, bright: 0.07, sat: 1.02, vignette: 0.09 },
    { m: 12 * 60, warm: 0.0, bright: 0.10, sat: 1.01, vignette: 0.08 },
    { m: 15 * 60, warm: 0.11, bright: 0.07, sat: 1.03, vignette: 0.10 },
    { m: 17 * 60 + 30, warm: 0.48, bright: 0.02, sat: 1.08, vignette: 0.12 },
    { m: 18 * 60 + 45, warm: 0.58, bright: -0.01, sat: 1.10, vignette: 0.13 },
    { m: 19 * 60 + 30, warm: -0.04, bright: -0.06, sat: 0.95, vignette: 0.14 },
    { m: 21 * 60, warm: -0.25, bright: -0.10, sat: 0.90, vignette: 0.16 },
    { m: 24 * 60, warm: -0.48, bright: -0.16, sat: 0.84, vignette: 0.18 },
  ];

  const mod = (n, m) => ((n % m) + m) % m;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);
  const isValidLat = (v) => isFiniteNumber(v) && v >= -90 && v <= 90;
  const isValidLon = (v) => isFiniteNumber(v) && v >= -180 && v <= 180;
  const isValidLatLon = (lat, lon) => isValidLat(lat) && isValidLon(lon);

  function minuteOfDay(d) { return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
  function dateKey(d) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  function formatHHMM(d) { return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
  function fmtMinute(minute) {
    const m = mod(Math.round(minute), 1440);
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }
  function smoothstep01(t) { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function inRangeCircular(v, start, end) { return start <= end ? v >= start && v < end : v >= start || v < end; }
  function ratioInWindowCircular(v, start, end) {
    const span = mod(end - start, 1440);
    if (span === 0) return null;
    const pos = mod(v - start, 1440);
    return pos >= 0 && pos < span ? pos / span : null;
  }


  function stripJsonComments(text) {
    let out = "";
    let inString = false;
    let inLineComment = false;
    let inBlockComment = false;
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (inLineComment) {
        if (c === "\n") {
          inLineComment = false;
          out += c;
        }
        continue;
      }

      if (inBlockComment) {
        if (c === "*" && next === "/") {
          inBlockComment = false;
          i++;
        } else if (c === "\n") {
          out += c;
        }
        continue;
      }

      if (inString) {
        out += c;
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }

      if (c === '"') {
        inString = true;
        out += c;
        continue;
      }

      if (c === "/" && next === "/") {
        inLineComment = true;
        i++;
        continue;
      }

      if (c === "/" && next === "*") {
        inBlockComment = true;
        i++;
        continue;
      }

      out += c;
    }

    return out;
  }

  function parseSettingsText(text) {
    return JSON.parse(stripJsonComments(text));
  }

  function mergeConfig(base, incoming) {
    const merged = JSON.parse(JSON.stringify(base));
    if (incoming?.location) {
      if (incoming.location.lat === null) merged.location.lat = null;
      else if (isValidLat(incoming.location.lat)) merged.location.lat = incoming.location.lat;
      if (incoming.location.lon === null) merged.location.lon = null;
      else if (isValidLon(incoming.location.lon)) merged.location.lon = incoming.location.lon;
      if (typeof incoming.location.city === "string") merged.location.city = incoming.location.city;
      if (typeof incoming.location.source === "string") merged.location.source = incoming.location.source;
    }
    const windowMin = incoming?.timeline?.transitionWindowMinutes;
    if (isFiniteNumber(windowMin) && windowMin > 0 && windowMin <= 1440) merged.timeline.transitionWindowMinutes = windowMin;
    if (incoming?.timeline?.segments) {
      for (let seg = 1; seg <= 8; seg++) {
        const next = incoming.timeline.segments[seg] || incoming.timeline.segments[String(seg)];
        if (!next) continue;
        if (typeof next.name === "string" && next.name) merged.timeline.segments[seg].name = next.name;
        if (isFiniteNumber(next.startHour) && next.startHour >= 0 && next.startHour < 24) merged.timeline.segments[seg].startHour = next.startHour;
        if (isFiniteNumber(next.durationHours) && next.durationHours > 0) merged.timeline.segments[seg].durationHours = next.durationHours;
      }
    }
    if (incoming?.performance?.preloadAllImages !== undefined) merged.performance.preloadAllImages = !!incoming.performance.preloadAllImages;
    const demo = incoming?.demo;
    if (isFiniteNumber(demo?.holdSeconds) && demo.holdSeconds >= 0) merged.demo.holdSeconds = demo.holdSeconds;
    if (isFiniteNumber(demo?.transitionSpeedMultiplier) && demo.transitionSpeedMultiplier > 0) merged.demo.transitionSpeedMultiplier = demo.transitionSpeedMultiplier;
    return merged;
  }

  async function readTextFile(path) {
    try {
      const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.text();
    } catch (_) {
      return null;
    }
  }

  async function loadSettingsConfig() {
    const fileText = await readTextFile("./setting.json");
    if (!fileText) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    try {
      return mergeConfig(DEFAULT_CONFIG, parseSettingsText(fileText));
    } catch (err) {
      console.warn("[BigSur] setting.json 解析失败，已回退默认配置：", err);
      return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  }

  function applyRuntimeConfig(config) {
    runtimeConfig = mergeConfig(DEFAULT_CONFIG, config);
    MIX_WINDOW_MIN = runtimeConfig.timeline.transitionWindowMinutes;
    demoHoldMs = runtimeConfig.demo.holdSeconds * 1000;
    demoTransitionMult = runtimeConfig.demo.transitionSpeedMultiplier;
    demoHoldRemainMs = demoHoldMs;

    if (demoHoldHint) demoHoldHint.textContent = String(runtimeConfig.demo.holdSeconds);
    if (demoSpeedHint) demoSpeedHint.textContent = String(demoTransitionMult);

    const nextMeta = {};
    const nextModel = {};
    const sequence = [];
    for (let seg = 1; seg <= 8; seg++) {
      const item = runtimeConfig.timeline.segments[seg];
      const startMinute = mod(Math.round(item.startHour * 60), 1440);
      nextMeta[seg] = { name: item.name };
      nextModel[seg] = { offsetFromSunsetMin: startMinute - REFERENCE_SUNSET_MIN };
      sequence.push(seg);
    }

    const sorted = sequence.slice().sort((a, b) => nextModel[a].offsetFromSunsetMin - nextModel[b].offsetFromSunsetMin);

    for (let i = 0; i < sorted.length; i++) {
      const seg = sorted[i];
      const next = sorted[(i + 1) % sorted.length];
      const item = runtimeConfig.timeline.segments[seg];
      const nextItem = runtimeConfig.timeline.segments[next];
      if (nextModel[seg].offsetFromSunsetMin === nextModel[next].offsetFromSunsetMin) {
        console.warn(`[BigSur] 段 ${seg} 与段 ${next} 的 startHour 相同，时间线可能不完整。`);
      }
      if (isFiniteNumber(item.durationHours)) {
        const expectedEnd = mod(Math.round(item.startHour * 60) + Math.round(item.durationHours * 60), 1440);
        const actualEnd = mod(Math.round(nextItem.startHour * 60), 1440);
        if (expectedEnd !== actualEnd) {
          console.warn(`[BigSur] 段 ${seg} 的 startHour+durationHours 与段 ${next} 的 startHour 不一致；实际边界以 startHour 为准。`);
        }
      }
    }

    for (let seg = 1; seg <= 8; seg++) {
      SEGMENT_META[seg] = nextMeta[seg];
      SEGMENT_MODEL[seg] = nextModel[seg];
    }
    SEGMENT_SEQUENCE = sorted;
  }

  function getDemoConfig() {
    return {
      transitionSpeedMultiplier: demoTransitionMult,
      holdSeconds: demoHoldMs / 1000,
    };
  }

  function getPerformanceConfig() {
    return {
      preloadAllImages: !!runtimeConfig.performance?.preloadAllImages,
    };
  }

  function loadPreloadPreference() {
    try {
      const raw = localStorage.getItem("preloadAllImages");
      if (raw === null) return null;
      return raw === "true";
    } catch (_) {
      return null;
    }
  }

  function savePreloadPreference(value) {
    try {
      localStorage.setItem("preloadAllImages", String(!!value));
    } catch (_) {}
  }

  function resolvePerformanceConfig(fileConfig, storageValue) {
    return {
      preloadAllImages: storageValue === null ? !!fileConfig?.performance?.preloadAllImages : !!storageValue,
    };
  }

  function shouldPreloadAllImages() {
    return !!runtimeConfig.performance?.preloadAllImages;
  }

  const preloadedImages = new Map();

  function preloadImageForSegment(seg) {
    const file = SEGMENT_FILES[seg];
    if (!file || preloadedImages.has(seg)) return;
    const img = new Image();
    img.src = toSrc(file);
    preloadedImages.set(seg, img);
  }

  function loadLocalGeo() {
    try {
      const raw = localStorage.getItem("manualGeo");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (isValidLatLon(parsed.lat, parsed.lon)) return parsed;
      return null;
    } catch (_) {
      return null;
    }
  }

  function saveLocalGeo(lat, lon) {
    try {
      localStorage.setItem("manualGeo", JSON.stringify({ lat, lon }));
    } catch (_) {}
  }

  function clearLocalGeo() {
    try {
      localStorage.removeItem("manualGeo");
    } catch (_) {}
  }



  function getInterpolatedGrade(minute) {
    const m = mod(minute, 1440);
    let left = GRADE_KEYFRAMES[0], right = GRADE_KEYFRAMES[1];
    for (let i = 0; i < GRADE_KEYFRAMES.length - 1; i++) {
      if (m >= GRADE_KEYFRAMES[i].m && m <= GRADE_KEYFRAMES[i + 1].m) {
        left = GRADE_KEYFRAMES[i]; right = GRADE_KEYFRAMES[i + 1]; break;
      }
    }
    const t = smoothstep01((m - left.m) / Math.max(1e-6, right.m - left.m));
    return {
      warm: lerp(left.warm, right.warm, t),
      bright: lerp(left.bright, right.bright, t),
      sat: lerp(left.sat, right.sat, t),
      vignette: lerp(left.vignette, right.vignette, t),
    };
  }

  function applyCinematicGrade(now) {
    if (!cinemaGrade || !lumaGrade || !app) return;
    const g = getInterpolatedGrade(minuteOfDay(now));

    const warmTopAlpha = 0.10 + Math.max(0, g.warm) * 0.18;
    const warmBottomAlpha = 0.06 + Math.max(0, g.warm) * 0.12;
    const coolTopAlpha = 0.07 + Math.max(0, -g.warm) * 0.18;
    const coolBottomAlpha = 0.05 + Math.max(0, -g.warm) * 0.12;

    const top = g.warm >= 0 ? `rgba(255,190,118,${warmTopAlpha.toFixed(3)})` : `rgba(128,176,255,${coolTopAlpha.toFixed(3)})`;
    const bottom = g.warm >= 0 ? `rgba(255,129,92,${warmBottomAlpha.toFixed(3)})` : `rgba(58,106,198,${coolBottomAlpha.toFixed(3)})`;

    cinemaGrade.style.background = `linear-gradient(to bottom, ${top}, ${bottom})`;
    cinemaGrade.style.opacity = clamp(0.13 + Math.abs(g.warm) * 0.10, 0.11, 0.28).toFixed(3);

    lumaGrade.style.background = "radial-gradient(ellipse at center, rgba(0,0,0,0) 36%, rgba(0,0,0,0.42) 100%)";
    lumaGrade.style.opacity = clamp(g.vignette, 0.06, 0.22).toFixed(3);

    const brightness = clamp(1 + g.bright, 0.80, 1.15);
    const saturation = clamp(g.sat, 0.82, 1.16);
    const contrast = clamp(1 + Math.abs(g.warm) * 0.045, 1.00, 1.07);
    app.style.filter = `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)}) contrast(${contrast.toFixed(3)})`;
  }

  function julianDay(date) { return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000 + 2440587.5; }
  function julianCentury(jd) { return (jd - 2451545.0) / 36525.0; }
  function geomMeanLongSun(t) { return mod(280.46646 + t * (36000.76983 + t * 0.0003032), 360); }
  function geomMeanAnomalySun(t) { return 357.52911 + t * (35999.05029 - 0.0001537 * t); }
  function eccentricityEarthOrbit(t) { return 0.016708634 - t * (0.000042037 + 0.0000001267 * t); }
  function sunEqOfCenter(t) {
    const m = geomMeanAnomalySun(t), mr = toRad(m);
    return Math.sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * mr) * (0.019993 - 0.000101 * t) + Math.sin(3 * mr) * 0.000289;
  }
  function sunTrueLong(t) { return geomMeanLongSun(t) + sunEqOfCenter(t); }
  function sunAppLong(t) { const o = 125.04 - 1934.136 * t; return sunTrueLong(t) - 0.00569 - 0.00478 * Math.sin(toRad(o)); }
  function meanObliqEcliptic(t) {
    const sec = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
    return 23 + (26 + sec / 60) / 60;
  }
  function obliqCorr(t) { const e0 = meanObliqEcliptic(t), o = 125.04 - 1934.136 * t; return e0 + 0.00256 * Math.cos(toRad(o)); }
  function sunDeclination(t) {
    const e = obliqCorr(t), lambda = sunAppLong(t);
    return toDeg(Math.asin(Math.sin(toRad(e)) * Math.sin(toRad(lambda))));
  }
  function equationOfTime(t) {
    const epsilon = obliqCorr(t), l0 = geomMeanLongSun(t), e = eccentricityEarthOrbit(t), m = geomMeanAnomalySun(t);
    const y = Math.tan(toRad(epsilon) / 2), y2 = y * y;
    const etime = y2 * Math.sin(2 * toRad(l0)) - 2 * e * Math.sin(toRad(m)) + 4 * e * y2 * Math.sin(toRad(m)) * Math.cos(2 * toRad(l0)) - 0.5 * y2 * y2 * Math.sin(4 * toRad(l0)) - 1.25 * e * e * Math.sin(2 * toRad(m));
    return toDeg(etime) * 4;
  }
  function hourAngleSunset(lat, solarDec) {
    const latRad = toRad(lat), sdRad = toRad(solarDec);
    const haArg = Math.cos(toRad(90.833)) / (Math.cos(latRad) * Math.cos(sdRad)) - Math.tan(latRad) * Math.tan(sdRad);
    if (haArg <= -1) return Math.PI;
    if (haArg >= 1) return 0;
    return Math.acos(haArg);
  }
  function calcSunsetLocalMinute(date, lat, lon) {
    const jd = julianDay(date);
    let t = julianCentury(jd), eqTime = equationOfTime(t), solarDec = sunDeclination(t), ha = hourAngleSunset(lat, solarDec), haDeg = toDeg(ha);
    let sunsetUTC = 720 - 4 * (lon - haDeg) - eqTime;
    t = julianCentury(jd + sunsetUTC / 1440);
    eqTime = equationOfTime(t); solarDec = sunDeclination(t); ha = hourAngleSunset(lat, solarDec); haDeg = toDeg(ha);
    sunsetUTC = 720 - 4 * (lon - haDeg) - eqTime;
    return mod(Math.round(sunsetUTC - date.getTimezoneOffset()), 1440);
  }

  function refreshSunset(now) { sunsetMinute = calcSunsetLocalMinute(now, geo.lat, geo.lon); }

  function getSegmentBoundariesBySunset(sunsetMin) {
    const boundaries = {};
    for (let seg = 1; seg <= 8; seg++) {
      const model = SEGMENT_MODEL[seg] || { offsetFromSunsetMin: 0 };
      boundaries[seg] = mod(sunsetMin + model.offsetFromSunsetMin, 1440);
    }
    return boundaries;
  }

  function getDynamicStartsBySunset(sunsetMin) {
    return getSegmentBoundariesBySunset(sunsetMin);
  }

  function getDynamicWindowRangesBySunset(sunsetMin) {
    const boundaries = getSegmentBoundariesBySunset(sunsetMin);
    const ranges = {};
    const count = SEGMENT_SEQUENCE.length;
    for (let i = 0; i < count; i++) {
      const seg = SEGMENT_SEQUENCE[i];
      const prev = SEGMENT_SEQUENCE[(i - 1 + count) % count];
      const gap = mod(boundaries[seg] - boundaries[prev], 1440);
      const width = Math.max(0, Math.min(MIX_WINDOW_MIN, gap));
      ranges[seg] = {
        center: boundaries[seg],
        halfWidth: width,
        start: mod(boundaries[seg] - width, 1440),
        end: boundaries[seg],
      };
    }
    return ranges;
  }

  function getPrevSegment(seg) {
    const idx = SEGMENT_SEQUENCE.indexOf(seg);
    if (idx < 0) return 8;
    return SEGMENT_SEQUENCE[(idx - 1 + SEGMENT_SEQUENCE.length) % SEGMENT_SEQUENCE.length];
  }

  function getCoreSegment(minuteNow, starts) {
    for (let i = 0; i < SEGMENT_SEQUENCE.length; i++) {
      const seg = SEGMENT_SEQUENCE[i];
      const next = SEGMENT_SEQUENCE[(i + 1) % SEGMENT_SEQUENCE.length];
      if (inRangeCircular(minuteNow, starts[seg], starts[next])) return seg;
    }
    return 1;
  }

  function getCoreSegmentAtMinute(minute, sunsetMin) {
    const starts = getSegmentBoundariesBySunset(sunsetMin);
    return getCoreSegment(mod(minute, 1440), starts);
  }

  function getBlendStateAtMinute(minute, sunsetMin) {
    const n = mod(minute, 1440);
    const starts = getSegmentBoundariesBySunset(sunsetMin);
    const windows = getDynamicWindowRangesBySunset(sunsetMin);

    for (let seg = 1; seg <= 8; seg++) {
      const prev = getPrevSegment(seg);
      const wStart = windows[seg].start;
      const wEnd = windows[seg].end;
      const ratio = ratioInWindowCircular(n, wStart, wEnd);
      if (ratio !== null) {
        return { baseSeg: prev, overlaySeg: seg, alpha: smoothstep01(ratio), currentSeg: ratio < 0.5 ? prev : seg, wStart };
      }
    }

    const core = getCoreSegment(n, starts);
    return { baseSeg: core, overlaySeg: null, alpha: 0, currentSeg: core, wStart: null };
  }

  function getBlendState(now) {
    return getBlendStateAtMinute(minuteOfDay(now), sunsetMinute);
  }

  function toSrc(file) { return `./BgimgBigsur/${encodeURI(file)}`; }
  function toAbs(src) { return new URL(src, window.location.href).href; }
  function sameImage(el, src) { const cur = el.currentSrc || el.src || ""; return cur === toAbs(src); }

  function preloadAll() {
    if (!shouldPreloadAllImages()) return;
    Object.keys(SEGMENT_FILES).forEach((seg) => {
      preloadImageForSegment(Number(seg));
    });
  }

  function ensureUpcomingSegmentPreloaded(state) {
    if (shouldPreloadAllImages()) return;
    const currentSeg = state.currentSeg;
    const idx = SEGMENT_SEQUENCE.indexOf(currentSeg);
    if (idx < 0) return;
    preloadImageForSegment(currentSeg);
    preloadImageForSegment(SEGMENT_SEQUENCE[(idx + 1) % SEGMENT_SEQUENCE.length]);
    if (state.overlaySeg) preloadImageForSegment(state.overlaySeg);
  }

  function render(now) {
    const state = getBlendState(now);
    const baseSrc = toSrc(SEGMENT_FILES[state.baseSeg]);
    if (!sameImage(imgA, baseSrc)) imgA.src = baseSrc;
    imgA.classList.add("active");
    imgA.style.opacity = "1";

    if (state.overlaySeg && state.alpha > 0.001) {
      const overlaySrc = toSrc(SEGMENT_FILES[state.overlaySeg]);
      if (!sameImage(imgB, overlaySrc)) imgB.src = overlaySrc;
      imgB.classList.add("active");
      imgB.style.opacity = state.alpha.toFixed(4);
    } else {
      imgB.style.opacity = "0";
    }

    applyCinematicGrade(now);
    ensureUpcomingSegmentPreloaded(state);
    return state;
  }

  function minuteToMsOnDate(minute, baseDate) {
    const total = mod(Math.round(minute), 1440);
    const d = new Date(baseDate.getTime());
    d.setHours(Math.floor(total / 60), total % 60, 0, 0);
    return d.getTime();
  }

  function findNextTransitionStartMinute(minuteNow, includeNow = false) {
    const windows = getDynamicWindowRangesBySunset(sunsetMinute);
    let best = null;
    let bestDelta = Infinity;
    for (let seg = 1; seg <= 8; seg++) {
      const wStart = windows[seg].start;
      const delta = mod(wStart - minuteNow, 1440);
      if ((includeNow ? delta >= 0 : delta > 0) && delta < bestDelta) {
        bestDelta = delta;
        best = wStart;
      }
    }
    return best ?? 0;
  }

  function getModeNow() {
    if (mode === "freeze") return new Date(frozenMs);
    if (mode === "system") return new Date();
    return new Date(virtualMs);
  }

  function advanceVirtualClock() {
    const nowPerf = performance.now();
    const elapsed = Math.max(0, nowPerf - lastPerf);
    lastPerf = nowPerf;

    if (mode === "system") return new Date();
    if (mode === "freeze") return new Date(frozenMs);

    if (mode === "custom") {
      virtualMs += elapsed * speed;
      return new Date(virtualMs);
    }

    // demo mode: hold(demoHoldMs) -> transition(demoTransitionMult) -> hold...
    const currentDate = new Date(virtualMs);
    const currentState = getBlendState(currentDate);
    const inTransition = currentState.overlaySeg !== null;

    if (demoPhase === "hold") {
      if (inTransition) {
        demoPhase = "transition";
      } else if (demoHoldRemainMs > 0) {
        demoHoldRemainMs -= elapsed;
        if (demoHoldRemainMs < 0) demoHoldRemainMs = 0;
        return new Date(virtualMs);
      } else {
        const curMinute = currentDate.getHours() * 60 + currentDate.getMinutes();
        const nextStart = Math.round(findNextTransitionStartMinute(curMinute, true));
        let target = nextStart === curMinute ? currentDate.getTime() : minuteToMsOnDate(nextStart, currentDate);
        if (nextStart !== curMinute && target <= currentDate.getTime()) target += 24 * 60 * 60 * 1000;
        virtualMs = target + 1000; // 避免正好卡在边界 alpha=0
        demoPhase = "transition";
        return new Date(virtualMs);
      }
    }

    if (demoPhase === "transition") {
      virtualMs += elapsed * demoTransitionMult;
      const nextDate = new Date(virtualMs);
      const nextState = getBlendState(nextDate);
      if (nextState.overlaySeg === null) {
        demoPhase = "hold";
        demoHoldRemainMs = demoHoldMs;
      }
      return nextDate;
    }

    return new Date(virtualMs);
  }

  function updateTimeSliderMarks() {
    if (!HAS_SETTINGS) return;
    const windowsMap = getDynamicWindowRangesBySunset(sunsetMinute);
    const bands = [];
    for (let seg = 1; seg <= 8; seg++) {
      const start = windowsMap[seg].start;
      const end = windowsMap[seg].end;
      if (start <= end) {
        bands.push([start, end]);
      } else {
        bands.push([start, 1439], [0, end]);
      }
    }

    const stops = ["#5aafff 0%", "#ffd27b 50%", "#ff9468 100%"];
    for (const [a, b] of bands) {
      const p1 = (a / 1439) * 100;
      const p2 = (b / 1439) * 100;
      stops.push(`rgba(255,255,255,0.18) ${p1.toFixed(2)}%`, `rgba(255,255,255,0.18) ${p2.toFixed(2)}%`);
      stops.push(`rgba(255,255,255,0.55) ${p1.toFixed(2)}%`, `rgba(255,255,255,0.55) ${(p1 + 0.2).toFixed(2)}%`);
      stops.push(`rgba(255,255,255,0.55) ${(p2 - 0.2).toFixed(2)}%`, `rgba(255,255,255,0.55) ${p2.toFixed(2)}%`);
    }

    timeSlider.style.background = `linear-gradient(90deg, ${stops.join(",")})`;
  }

  function syncSliderInteractivity() {
    if (!HAS_SETTINGS) return;
    const canDrag = mode === "custom";
    timeSlider.disabled = !canDrag;
    speedSlider.disabled = !canDrag;
    timeSlider.style.opacity = canDrag ? "1" : "0.55";
    speedSlider.style.opacity = canDrag ? "1" : "0.55";
  }

  function getSegmentRangeText(seg, boundaries) {
    const idx = SEGMENT_SEQUENCE.indexOf(seg);
    if (idx < 0) return "--";
    const next = SEGMENT_SEQUENCE[(idx + 1) % SEGMENT_SEQUENCE.length];
    return `${fmtMinute(boundaries[seg])}-${fmtMinute(boundaries[next])}`;
  }

  function getPanelInfoStateAtMinute(minute, sunsetMin) {
    const currentSegmentId = getCoreSegmentAtMinute(minute, sunsetMin);
    const currentMeta = SEGMENT_META[currentSegmentId] || { name: "未知时段" };
    const boundaries = getSegmentBoundariesBySunset(sunsetMin);
    const windows = getDynamicWindowRangesBySunset(sunsetMin);
    const activeBlend = getBlendStateAtMinute(minute, sunsetMin);
    const currentRangeText = getSegmentRangeText(currentSegmentId, boundaries);

    if (activeBlend.overlaySeg !== null) {
      const fromSeg = activeBlend.baseSeg;
      const toSeg = activeBlend.overlaySeg;
      return {
        currentSegment: currentSegmentId,
        currentName: currentMeta.name,
        currentRangeText,
        activeTransition: {
          fromSeg,
          toSeg,
          fromName: SEGMENT_META[fromSeg]?.name || "未知时段",
          toName: SEGMENT_META[toSeg]?.name || "未知时段",
          rangeText: `${fmtMinute(windows[toSeg].start)}-${fmtMinute(windows[toSeg].end)}`,
          progress: activeBlend.alpha,
        },
        nextTransition: null,
      };
    }

    let nextTransition = null;
    let bestDelta = Infinity;
    for (let i = 0; i < SEGMENT_SEQUENCE.length; i++) {
      const fromSeg = SEGMENT_SEQUENCE[i];
      const toSeg = SEGMENT_SEQUENCE[(i + 1) % SEGMENT_SEQUENCE.length];
      const boundary = boundaries[toSeg];
      const delta = mod(boundary - minute, 1440);
      if (delta > 0 && delta < bestDelta) {
        bestDelta = delta;
        nextTransition = {
          fromSeg,
          toSeg,
          fromName: SEGMENT_META[fromSeg]?.name || "未知时段",
          toName: SEGMENT_META[toSeg]?.name || "未知时段",
          rangeText: `${fmtMinute(windows[toSeg].start)}-${fmtMinute(windows[toSeg].end)}`,
        };
      }
    }

    return {
      currentSegment: currentSegmentId,
      currentName: currentMeta.name,
      currentRangeText,
      activeTransition: null,
      nextTransition,
    };
  }

  function updateSettingsUI(now) {
    if (!HAS_SETTINGS) return;
    const panelState = getPanelInfoStateAtMinute(minuteOfDay(now), sunsetMinute);
    const minsToSunset = Math.round(mod(sunsetMinute - minuteOfDay(now), 1440));
    const sunsetH = String(Math.floor(sunsetMinute / 60)).padStart(2, "0");
    const sunsetM = String(sunsetMinute % 60).padStart(2, "0");
    const modeTextMap = {
      system: "系统",
      freeze: "定格",
      demo: "演示",
      custom: "自定义"
    };

    timeLabel.textContent = formatHHMM(now);
    speedLabel.textContent = `${speed.toFixed(1)}x`;
    const minute = now.getHours() * 60 + now.getMinutes();
    timeSlider.value = String(minute);

    geoStatusEl.textContent = `定位：${geoStatusText}`;

    const nextTransitionText = panelState.nextTransition
      ? `下一次过渡：${panelState.nextTransition.fromName} → ${panelState.nextTransition.toName}（${panelState.nextTransition.rangeText}）`
      : "下一次过渡：—";
    const transitionText = panelState.activeTransition
      ? `当前过渡：${panelState.activeTransition.fromName} → ${panelState.activeTransition.toName}（${panelState.activeTransition.rangeText}）\n混合进度：${Math.round(panelState.activeTransition.progress * 100)}%`
      : `当前过渡：无\n${nextTransitionText}`;
    const preloadText = shouldPreloadAllImages() ? "全量（8张原图）" : "按需（当前/下一张）";

    const infoLines = [
      `当前时段：${panelState.currentName}（${panelState.currentRangeText}）`,
      `当前：${formatHHMM(now)} · 模式：${modeTextMap[mode] || mode}`,
      `日落：${sunsetH}:${sunsetM}（约 ${minsToSunset} 分钟后）`,
      `演示模式：非过渡停留 ${demoHoldMs / 1000}s · 过渡区 ${demoTransitionMult}x`,
      `图片预加载：${preloadText}`,
      ...transitionText.split("\n"),
    ];
    settingsInfo.textContent = infoLines.join("\n");

    syncSliderInteractivity();
  }

  function applyGeo(lat, lon, statusText) {
    geo = { lat, lon };
    geoStatusText = statusText;
    if (HAS_SETTINGS && document.activeElement !== latInput && document.activeElement !== lonInput) {
      latInput.value = lat.toFixed(4);
      lonInput.value = lon.toFixed(4);
    }
    const now = getModeNow();
    refreshSunset(now);
    updateTimeSliderMarks();
    render(now);
    updateSettingsUI(now);
  }

  async function resolveStartupGeo() {
    const startVersion = geoEditVersion;
    const ip = await tryIpGeo();
    if (startVersion !== geoEditVersion) return;
    if (ip.ok) {
      applyGeo(ip.lat, ip.lon, `IP粗定位：${ip.lat.toFixed(2)}, ${ip.lon.toFixed(2)}${ip.cityText ? `（${ip.cityText}）` : ""}`);
    } else {
      applyGeo(DEFAULT_COORDS.lat, DEFAULT_COORDS.lon, `IP 粗定位失败，已回退内置默认坐标（${DEFAULT_CONFIG.location.city}）`);
    }
  }

  function tick() {
    const now = advanceVirtualClock();

    const key = dateKey(now);
    const tz = now.getTimezoneOffset();

    const wallMs = Date.now();
    const perfMs = performance.now();
    const wallDelta = wallMs - lastWallMs;
    const perfDelta = perfMs - lastPerfMs;
    const clockChanged = Math.abs(wallDelta - perfDelta) > 5000 || Math.abs(wallDelta) > 60 * 1000;
    lastWallMs = wallMs;
    lastPerfMs = perfMs;

    if (key !== lastDateKey || tz !== lastTzOffset || clockChanged) {
      refreshSunset(now);
      updateTimeSliderMarks();
      lastDateKey = key;
      lastTzOffset = tz;
    }

    render(now);
    updateSettingsUI(now);
  }

  function bindEvents() {
    if (!HAS_SETTINGS) return;

    settingsFab.addEventListener("click", () => {
      settingsPanel.classList.toggle("hidden");
      const expanded = !settingsPanel.classList.contains("hidden");
      settingsFab.setAttribute("aria-expanded", String(expanded));
      settingsFab.setAttribute("aria-label", expanded ? "隐藏设置" : "显示设置");
    });

    modeRadios.forEach((r) => {
      r.addEventListener("change", () => {
        const prevMode = mode;
        const next = modeRadios.find((x) => x.checked)?.value || "system";

        const referenceMs = prevMode === "system" ? Date.now() : (prevMode === "freeze" ? frozenMs : virtualMs);
        mode = next;

        if (mode === "system") {
          // ensure system mode always tracks wall clock
          virtualMs = Date.now();
          speed = 1;
          speedSlider.value = "1";
          speedLabel.textContent = "1.0x";
        } else if (mode === "freeze") {
          frozenMs = referenceMs;
        } else if (mode === "demo") {
          virtualMs = referenceMs;
          demoHoldRemainMs = demoHoldMs;
          demoPhase = "hold";
        } else if (mode === "custom") {
          virtualMs = referenceMs;
          speed = clamp(parseFloat(speedSlider.value) || 1, 1, 800);
        }

        lastPerf = performance.now();
        updateSettingsUI(getModeNow());
      });
    });

    timeSlider.addEventListener("input", () => {
      if (mode !== "custom") return;
      const minute = clamp(parseInt(timeSlider.value, 10) || 0, 0, 1439);
      const base = new Date(virtualMs);
      virtualMs = minuteToMsOnDate(minute, base);
      lastPerf = performance.now();
      const n = new Date(virtualMs);
      render(n);
      updateSettingsUI(n);
    });

    speedSlider.addEventListener("input", () => {
      if (mode !== "custom") return;
      speed = clamp(parseFloat(speedSlider.value) || 1, 1, 800);
      lastPerf = performance.now();
      speedLabel.textContent = `${speed.toFixed(1)}x`;
    });

    preloadToggle.checked = shouldPreloadAllImages();

    preloadToggle.addEventListener("change", () => {
      runtimeConfig.performance.preloadAllImages = preloadToggle.checked;
      savePreloadPreference(preloadToggle.checked);
      if (preloadToggle.checked) {
        preloadAll();
      } else {
        preloadedImages.clear();
        ensureUpcomingSegmentPreloaded(getBlendState(getModeNow()));
      }
      updateSettingsUI(getModeNow());
    });

    geoLocateBtn.addEventListener("click", async () => {
      const editVersion = ++geoEditVersion;
      geoStatusText = "请求权限中…";
      updateSettingsUI(getModeNow());

      const res = await tryGeo();
      if (editVersion !== geoEditVersion) return;

      if (res.ok) {
        saveLocalGeo(res.lat, res.lon);
        applyGeo(res.lat, res.lon, `已定位 ${res.lat.toFixed(2)}, ${res.lon.toFixed(2)}（已写入本地缓存）`);
        return;
      }

      geoStatusText = `${getGeoReasonText(res.reason)}，正在尝试 IP 粗定位…`;
      updateSettingsUI(getModeNow());
      const ip = await tryIpGeo();
      if (editVersion !== geoEditVersion) return;

      if (ip.ok) {
        applyGeo(ip.lat, ip.lon, `IP粗定位：${ip.lat.toFixed(2)}, ${ip.lon.toFixed(2)}${ip.cityText ? `（${ip.cityText}）` : ""}`);
      } else {
        geoStatusText = `${getGeoReasonText(res.reason)}，IP 粗定位也失败，继续使用当前坐标`;
        updateSettingsUI(getModeNow());
      }
    });

    saveGeoBtn.addEventListener("click", () => {
      const lat = parseFloat(latInput.value.trim());
      const lon = parseFloat(lonInput.value.trim());
      if (!isValidLatLon(lat, lon)) {
        geoStatusText = "请输入合法的经纬度（纬度 -90~90，经度 -180~180）";
        updateSettingsUI(getModeNow());
        return;
      }
      geoEditVersion++;
      saveLocalGeo(lat, lon);
      applyGeo(lat, lon, `已保存手动经纬度 ${lat.toFixed(2)}, ${lon.toFixed(2)}（已写入本地缓存）`);
    });

    clearGeoBtn.addEventListener("click", async () => {
      const editVersion = ++geoEditVersion;
      latInput.value = "";
      lonInput.value = "";
      clearLocalGeo();
      geoStatusText = "已清空本地缓存，正在 IP 粗定位…";
      updateSettingsUI(getModeNow());

      const ip = await tryIpGeo();
      if (editVersion !== geoEditVersion) return;

      if (ip.ok) {
        applyGeo(ip.lat, ip.lon, `IP粗定位：${ip.lat.toFixed(2)}, ${ip.lon.toFixed(2)}${ip.cityText ? `（${ip.cityText}）` : ""}`);
      } else if (isValidLatLon(runtimeConfig.location.lat, runtimeConfig.location.lon)) {
        applyGeo(runtimeConfig.location.lat, runtimeConfig.location.lon, `IP 粗定位失败，已回退配置文件坐标：${runtimeConfig.location.lat.toFixed(2)}, ${runtimeConfig.location.lon.toFixed(2)}`);
      } else {
        applyGeo(DEFAULT_COORDS.lat, DEFAULT_COORDS.lon, `IP 粗定位失败，已回退内置默认坐标（${DEFAULT_CONFIG.location.city}）`);
      }
    });
  }

  function getGeoReasonText(reason) {
    if (reason === "unsupported") return "浏览器不支持定位";
    if (reason === "denied") return "定位权限被拒绝";
    if (reason === "unavailable") return "定位服务不可用";
    if (reason === "timeout") return "定位超时";
    if (reason === "insecure") return "当前非 HTTPS，浏览器可能阻止定位";
    return "定位失败";
  }

  async function tryIpGeo() {
    // City-level approximate location by IP (HTTPS, no API key).
    // 4s timeout so a blocked network never stalls startup.
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), IP_GEO_TIMEOUT_MS);
    try {
      const res = await fetch("https://ipwho.is/?fields=success,message,city,region,country,latitude,longitude", { cache: "no-store", signal: controller?.signal });
      if (!res.ok) return { ok: false, reason: "ip_failed" };
      const j = await res.json();
      if (j?.success === false) return { ok: false, reason: "ip_failed" };
      if (!isValidLatLon(j?.latitude, j?.longitude)) return { ok: false, reason: "ip_failed" };
      const cityText = [j.city, j.region, j.country].filter(Boolean).join(" · ");
      return { ok: true, lat: j.latitude, lon: j.longitude, cityText };
    } catch (_) {
      return { ok: false, reason: "ip_failed" };
    } finally {
      clearTimeout(timer);
    }
  }

  // NOTE: locationinfo.json is no longer read/written; manual coords live in localStorage.

  function tryGeo() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ ok: false, reason: "unsupported" });

      // Don't pre-block on isSecureContext.
      // Some hosts (e.g. Lively Wallpaper / embedded webviews) report isSecureContext=false even when
      // user granted permission. Let the platform decide and handle errors from the API.
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({ ok: true, lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        (err) => {
          const map = { 1: "denied", 2: "unavailable", 3: "timeout" };
          resolve({ ok: false, reason: map[err?.code] || "failed" });
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 10 * 60 * 1000 }
      );
    });
  }

  function updateBottomAvoid() {
    // Avoid UI overlays (taskbar/pinned bars/on-screen keyboard) when VisualViewport is available.
    // Additionally reserve ~9.5% screen height as Windows taskbar safe area.
    // This is best-effort; browsers differ.
    try {
      const vv = window.visualViewport;
      const baseline = clamp(Math.round(window.innerHeight * 0.028), 0, 120);

      let avoid = baseline;
      if (vv) {
        // When browser UI reduces visual viewport height, push controls up a bit.
        // Also covers mobile address bar/keyboard cases.
        const delta = window.innerHeight - vv.height - (vv.offsetTop || 0);
        avoid = Math.max(avoid, clamp(delta, 0, 200));
      }

      // Final clamp to avoid excessive jump on very tall screens.
      avoid = clamp(avoid, 0, 220);
      document.documentElement.style.setProperty("--oc-bottom-avoid", `${avoid}px`);
    } catch (_) {}
  }


  if (window.__MODE__ === "test") {
    window.__BIGSUR_TIMELINE_TEST_HOOKS__ = {
      getSegmentBoundariesBySunset,
      getDynamicStartsBySunset,
      getDynamicWindowRangesBySunset,
      getCoreSegmentAtMinute,
      getBlendStateAtMinute,
      getPanelInfoStateAtMinute,
      parseSettingsText,
      mergeConfig,
      applyRuntimeConfig,
      getDemoConfig,
      getPerformanceConfig,
      resolvePerformanceConfig,
    };
  }

  async function init() {
    runtimeConfig = await loadSettingsConfig();
    const preloadPref = loadPreloadPreference();
    runtimeConfig.performance = resolvePerformanceConfig(runtimeConfig, preloadPref);
    applyRuntimeConfig(runtimeConfig);

    bindEvents();
    preloadAll();

    // 读取优先级：localStorage 手动保存 > setting.json location > IP 粗定位 > 内置默认坐标
    const storedGeo = loadLocalGeo();
    let needsIpGeo = false;
    if (storedGeo) {
      geo = { lat: storedGeo.lat, lon: storedGeo.lon };
      geoStatusText = `本地缓存坐标：${geo.lat.toFixed(2)}, ${geo.lon.toFixed(2)}`;
    } else if (isValidLatLon(runtimeConfig.location.lat, runtimeConfig.location.lon)) {
      geo = { lat: runtimeConfig.location.lat, lon: runtimeConfig.location.lon };
      geoStatusText = `配置文件坐标：${geo.lat.toFixed(2)}, ${geo.lon.toFixed(2)}`;
    } else {
      geo = { lat: DEFAULT_COORDS.lat, lon: DEFAULT_COORDS.lon };
      geoStatusText = "IP 粗定位中…";
      needsIpGeo = true;
    }

    if (HAS_SETTINGS) {
      latInput.value = geo.lat.toFixed(4);
      lonInput.value = geo.lon.toFixed(4);
    }

    const now = new Date();
    virtualMs = now.getTime();
    frozenMs = now.getTime();
    lastPerf = performance.now();

    updateBottomAvoid();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateBottomAvoid);
      window.visualViewport.addEventListener("scroll", updateBottomAvoid);
    }
    window.addEventListener("resize", updateBottomAvoid);

    refreshSunset(now);
    updateTimeSliderMarks();
    render(now);
    updateSettingsUI(now);

    setInterval(tick, 80);

    if (needsIpGeo) void resolveStartupGeo();
  }

  if (window.__MODE__ !== "test") {
    init();
  }
})();