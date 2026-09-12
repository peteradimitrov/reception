(() => {
  "use strict";

  const AUDIO_PATH =
    "https://cdn.prod.website-files.com/6292053974c40677f3ec8971/";

  const SETTINGS = {
    overlayFade: 0.4,
    cornerFade: 0.3,

    pickup: {
      soundFade: 0.8,
      popupFade: 0.6,
      trailFade: 0.35,
      phoneFade: 0.4
    },

    ambient: {
      delay: 0,
      videoFade: 1,
      volumeFade: 2,
      volume: 0.35,
      loop: true
    },

    backdrop: {
      blur: 34,
      fade: 0.2
    },

    steps: {
      delay: 0.15,
      enter: 0.5,
      exit: 0.3,
      stagger: 0.015,
      blur: 8,
      scale: 0.98,
      gap: 0.1,
      formDelay: 0.08,
      formFade: 0.35
    },

    wave: {
      fadeIn: 0.25,
      barStagger: 0.025,
      delay: 0.05,
      duration: 1.2,
      height: 56,
      hold: 0.1,
      fadeOut: 0.25,
      finalDelay: 0.1
    },

    phone: {
      delay: 4,
      revealDuration: 0.4,
      proximityRadius: 300,
      volumeFade: 0.18
    },

    counter: {
      minInterval: 0.15,
      maxInterval: 0.65,
      badgeMoveDown: 6,
      badgeDuration: 0.3
    },

    sound: {
      pingUrl:
        AUDIO_PATH +
        "6a9bc5637521c66b5c85d17d_Reception-Ping.mp3",
      pingVolume: 0.5,

      typingUrl:
        AUDIO_PATH +
        "6a9d71768425ed54cd3b20cb_Reception-Typing.mp3",
      typingVolume: 0.35,

      streetUrl:
        AUDIO_PATH +
        "6a9d7944f79d96f6c8c13b37_Reception-StreetNoise.mp3",
      streetVolume: 0.4,
      streetFadeDuration: 4,

      ringUrl:
        AUDIO_PATH +
        "6a9e6cc17058d12cadbd78fb_Reception-Ring.mp3",
      ringVolume: 0.6,

      ambientUrl:
        AUDIO_PATH +
        "6aa2631c7996b4480bad3d55_Reception-AmbientEnvironment.mp3"
    },

    trail: {
      minWidth: 992,
      moveDistance: 15,
      stopDuration: 800,
      trailLength: 8,
      enterDuration: 0.45,
      enterEase: "sine.out"
    },

    random: {
      initialDelay: 0.3,
      startInterval: 1.2,
      endInterval: 0.08,
      rampDuration: 5,
      acceleration: 1.5,
      timingVariation: 0.15,

      fadeDuration: 0.22,
      moveDuration: 0.45,
      moveUp: 16,

      edgePadding: 24,
      scatter: 0.7,

      // Mobile layout is selected when positions are first assigned.
      mobileBreakpoint: 768,

      // Minimum gap between measured mobile card rectangles.
      mobileGap: 24,

      // Lower values spread the collection across a larger field.
      mobileCoverage: 0.32,

      // Minimum mobile field width relative to its container.
      mobileFieldWidth: 1.4
    }
  };

  // Utilities

  const select = selector => document.querySelector(selector);

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  const randomBetween = (min, max) =>
    min + Math.random() * (max - min);

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
  }

  function readNumber(element, attribute, fallback, minimum = 0) {
    const raw = element?.getAttribute(attribute);

    if (raw == null || raw.trim() === "") return fallback;

    const value = Number(raw);

    return Number.isFinite(value) && value >= minimum
      ? value
      : fallback;
  }

  // Protected phone area

  function createPhoneZone(options) {
    const button = select(".phone-btn");

    const label =
      button?.parentElement?.querySelector(".phone-btn__label") ||
      select(".phone-btn__label");

    let cachedFrame = -1;
    let cachedRect = null;

    function invalidate() {
      cachedFrame = -1;
    }

    window.addEventListener("resize", invalidate, {
      passive: true
    });

    window.addEventListener("scroll", invalidate, {
      passive: true,
      capture: true
    });

    function getRect() {
      if (!button) return null;

      const frame = gsap.ticker.frame;

      if (cachedFrame === frame) return cachedRect;

      cachedFrame = frame;
      cachedRect = null;

      const rect = button.getBoundingClientRect();

      if (!rect.width || !rect.height) return null;

      const radius = readNumber(
        button,
        "data-phone-radius",
        options.proximityRadius,
        1
      );

      cachedRect = {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        label: label?.getBoundingClientRect(),

        clearance: readNumber(
          button,
          "data-phone-clearance",
          radius
        )
      };

      return cachedRect;
    }

    function overlaps(rect, zone = getRect()) {
      if (!zone) return false;

      const dx = Math.max(
        zone.left - rect.right,
        rect.left - zone.right,
        0
      );

      const dy = Math.max(
        zone.top - rect.bottom,
        rect.top - zone.bottom,
        0
      );

      const text = zone.label;

      const touchesLabel =
        text?.width > 0 &&
        text?.height > 0 &&
        rect.right > text.left - 12 &&
        rect.left < text.right + 12 &&
        rect.bottom > text.top - 12 &&
        rect.top < text.bottom + 12;

      return (
        Math.hypot(dx, dy) <= zone.clearance ||
        !!touchesLabel
      );
    }

    function getOrigin(list) {
      const rect = list.getBoundingClientRect();

      return {
        x: rect.left + list.clientLeft - list.scrollLeft,
        y: rect.top + list.clientTop - list.scrollTop
      };
    }

    function blocksPlacement(candidate, origin, zone, moveDown = 0) {
      return overlaps(
        {
          left: origin.x + candidate.x,
          top: origin.y + candidate.y,
          right: origin.x + candidate.x + candidate.width,
          bottom:
            origin.y +
            candidate.y +
            candidate.height +
            Math.max(0, moveDown)
        },
        zone
      );
    }

    return {
      getRect,
      overlaps,
      getOrigin,
      blocksPlacement
    };
  }

  // Audio

  function createSoundManager(options) {
    let context = null;
    let enabled = false;
    let typingRequested = false;

    let backgroundOutput = null;
    let masterOutput = null;
    let backgroundLevel = 1;

    let finished = false;
    let ambientSettings = null;
    let oldAudioTimer = null;
    let attemptId = 0;

    const pingSources = new Set();

    const assets = {
      ping: {
        url: options.pingUrl,
        volume: options.pingVolume
      },
      typing: {
        url: options.typingUrl,
        volume: options.typingVolume
      },
      street: {
        url: options.streetUrl,
        volume: options.streetVolume
      },
      ring: {
        url: options.ringUrl,
        volume: options.ringVolume
      },
      ambient: {
        url: options.ambientUrl,
        volume: 0
      }
    };

    function preload(asset) {
      if (!asset.bytesPromise) {
        asset.bytesPromise = fetch(asset.url)
          .then(response => {
            if (!response.ok) {
              throw new Error(
                `Audio request failed: ${response.status}`
              );
            }

            return response.arrayBuffer();
          })
          .catch(error => {
            asset.bytesPromise = null;
            console.warn("Could not load audio:", error);
            return null;
          });
      }

      return asset.bytesPromise;
    }

    function decode(asset) {
      if (asset.buffer) {
        return Promise.resolve(asset.buffer);
      }

      if (!asset.decodePromise) {
        asset.decodePromise = preload(asset)
          .then(bytes => {
            if (!bytes) return null;
            return context.decodeAudioData(bytes.slice(0));
          })
          .then(buffer => {
            asset.buffer = buffer;
            return buffer;
          })
          .catch(error => {
            console.warn("Could not decode audio:", error);
            return null;
          })
          .finally(() => {
            asset.decodePromise = null;
          });
      }

      return asset.decodePromise;
    }

    Object.values(assets).forEach(preload);

    function startLoop(asset, fadeDuration = 0) {
      if (
        !enabled ||
        !asset.buffer ||
        asset.source ||
        context?.state !== "running"
      ) {
        return;
      }

      const source = context.createBufferSource();

      source.buffer = asset.buffer;
      source.loop =
        asset === assets.ambient ? ambientSettings.loop : true;

      source.connect(asset.output);

      const now = context.currentTime;
      const volume = clamp(asset.volume, 0, 1);
      const fade = Math.max(0, fadeDuration);

      asset.output.gain.cancelScheduledValues(now);

      if (fade > 0) {
        asset.output.gain.setValueAtTime(0, now);
        asset.output.gain.linearRampToValueAtTime(
          volume,
          now + fade
        );
      } else {
        asset.output.gain.setValueAtTime(volume, now);
      }

      asset.source = source;

      source.onended = () => {
        source.disconnect();

        if (asset.source === source) {
          asset.source = null;
        }
      };

      source.start(now);
    }

    function startRequestedLoops() {
      if (!enabled || context?.state !== "running") return;

      if (finished) {
        if (ambientSettings) {
          startLoop(
            assets.ambient,
            ambientSettings.volumeFade
          );
        }

        return;
      }

      startLoop(assets.street, options.streetFadeDuration);

      if (typingRequested) {
        startLoop(assets.typing);
      }
    }

    function playRing() {
      const asset = assets.ring;

      if (
        finished ||
        !enabled ||
        !asset.buffer ||
        asset.source ||
        context?.state !== "running" ||
        document.hidden
      ) {
        return;
      }

      const source = context.createBufferSource();

      source.buffer = asset.buffer;
      source.loop = false;
      source.connect(asset.output);

      asset.output.gain.setValueAtTime(
        clamp(asset.volume, 0, 1),
        context.currentTime
      );

      asset.source = source;

      source.onended = () => {
        source.disconnect();

        if (asset.source === source) {
          asset.source = null;
        }
      };

      source.start();
    }

    function ping() {
      if (
        finished ||
        !enabled ||
        !assets.ping.buffer ||
        context?.state !== "running" ||
        document.hidden
      ) {
        return;
      }

      const source = context.createBufferSource();

      source.buffer = assets.ping.buffer;
      source.connect(assets.ping.output);

      pingSources.add(source);

      source.onended = () => {
        pingSources.delete(source);
        source.disconnect();
      };

      source.start();
    }

    function play(item, skipAppearancePing = false) {
      if (finished) return;

      if (item.classList.contains("chat")) {
        typingRequested = true;
        startRequestedLoops();
      }

      if (
        !skipAppearancePing &&
        item.getAttribute("data-random-sound") === "ping"
      ) {
        ping();
      }
    }

    function setBackgroundLevel(value, duration = 0.18) {
      const target = clamp(value, 0, 1);

      if (target === backgroundLevel) return;

      backgroundLevel = target;

      if (!context || !backgroundOutput) return;

      const gain = backgroundOutput.gain;
      const now = context.currentTime;
      const current = gain.value;

      if (typeof gain.cancelAndHoldAtTime === "function") {
        gain.cancelAndHoldAtTime(now);
      } else {
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(current, now);
      }

      gain.linearRampToValueAtTime(
        target,
        now + Math.max(0.01, duration)
      );
    }

    function ensureContext() {
      if (context) return true;

      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return false;

      context = new AudioContextClass();

      masterOutput = context.createGain();
      masterOutput.gain.value = finished ? 0 : 1;
      masterOutput.connect(context.destination);

      backgroundOutput = context.createGain();
      backgroundOutput.gain.value = backgroundLevel;
      backgroundOutput.connect(masterOutput);

      for (const asset of Object.values(assets)) {
        asset.output = context.createGain();

        asset.output.gain.value =
          asset === assets.street
            ? 0
            : clamp(asset.volume, 0, 1);

        asset.output.connect(
          asset === assets.ambient
            ? context.destination
            : asset === assets.ring
              ? masterOutput
              : backgroundOutput
        );
      }

      context.addEventListener("statechange", () => {
        if (context.state === "running") {
          startRequestedLoops();
        }
      });

      return true;
    }

    function enable() {
      const currentAttempt = ++attemptId;

      try {
        if (!ensureContext()) {
          return Promise.resolve(false);
        }

        const resumed = context.resume();

        for (const asset of Object.values(assets)) {
          decode(asset).then(startRequestedLoops);
        }

        return new Promise(resolve => {
          let settled = false;
          let timeout = null;

          function finish(success) {
            if (settled) return;

            settled = true;
            clearTimeout(timeout);

            if (currentAttempt !== attemptId) {
              resolve(false);
              return;
            }

            enabled = success;

            if (enabled) {
              startRequestedLoops();
            }

            resolve(success);
          }

          if (context.state === "running") {
            finish(true);
          } else {
            timeout = window.setTimeout(() => {
              finish(context.state === "running");
            }, 1200);
          }

          resumed.then(
            () => finish(context.state === "running"),
            () => finish(false)
          );
        });
      } catch (error) {
        enabled = false;
        console.warn("Could not enable audio:", error);
        return Promise.resolve(false);
      }
    }

    function stopAsset(asset) {
      if (asset.source) {
        const source = asset.source;
        asset.source = null;
        source.stop();
      }

      if (context && asset.output) {
        asset.output.gain.cancelScheduledValues(
          context.currentTime
        );

        asset.output.gain.setValueAtTime(
          0,
          context.currentTime
        );
      }
    }

    function stopOldAudio() {
      clearTimeout(oldAudioTimer);
      oldAudioTimer = null;

      for (const source of pingSources) {
        source.stop();
      }

      pingSources.clear();

      [
        assets.typing,
        assets.street,
        assets.ring
      ].forEach(stopAsset);
    }

    function disable() {
      attemptId++;
      enabled = false;

      stopOldAudio();
      stopAsset(assets.ambient);
    }

    function fadeOutAll(duration) {
      if (finished) return;

      finished = true;

      if (!context) return;

      const now = context.currentTime;

      masterOutput.gain.cancelScheduledValues(now);
      masterOutput.gain.setValueAtTime(
        masterOutput.gain.value,
        now
      );

      if (context.state !== "running" || duration <= 0) {
        masterOutput.gain.setValueAtTime(0, now);
        stopOldAudio();
        return;
      }

      masterOutput.gain.linearRampToValueAtTime(
        0,
        now + duration
      );

      oldAudioTimer = window.setTimeout(
        stopOldAudio,
        duration * 1000 + 50
      );
    }

    function startAmbient(settings) {
      ambientSettings = settings;
      assets.ambient.volume = settings.volume;

      if (!finished || !enabled || !context) return;

      if (assets.ambient.buffer) {
        startRequestedLoops();
      } else {
        decode(assets.ambient).then(startRequestedLoops);
      }
    }

    return {
      enable,
      disable,
      fadeOutAll,
      startAmbient,
      play,
      ping,
      playRing,
      setBackgroundLevel,
      isEnabled: () =>
        enabled && context?.state === "running"
    };
  }

  // Optional badge counting

  function createBadgeCounters(
    items,
    options,
    sound,
    isAvailable
  ) {
    let stopped = false;
    let timer = null;
    let bag = [];

    const records = new Map();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const minInterval = Math.max(0.05, options.minInterval);
    const maxInterval = Math.max(
      minInterval,
      options.maxInterval
    );

    for (const item of items) {
      if (
        !item.classList.contains("notification-type") ||
        item.getAttribute("data-notification-count") !== "true"
      ) {
        continue;
      }

      const badge = item.querySelector(
        ".notification-type__badge"
      );

      if (!badge) continue;

      const raw = badge.textContent.trim();

      if (!/^\d+$/.test(raw)) continue;

      const target = Number(raw);

      if (!Number.isSafeInteger(target) || target < 0) {
        continue;
      }

      const walker = document.createTreeWalker(
        badge,
        NodeFilter.SHOW_TEXT
      );

      let textNode = null;
      let node;

      while ((node = walker.nextNode())) {
        if (node.nodeValue.trim() === raw) {
          textNode = node;
          break;
        }
      }

      if (!textNode) continue;

      const originalY =
        parseFloat(gsap.getProperty(badge, "y")) || 0;

      const record = {
        item,
        badge,
        originalY,
        revealed: false,
        target,
        current: 0,
        started: false,

        write(value) {
          textNode.nodeValue = String(value);
        }
      };

      const badgeWidth = getComputedStyle(badge).width;

      if (parseFloat(badgeWidth) > 0) {
        badge.style.minWidth = badgeWidth;
      }

      records.set(item, record);
      record.write(0);

      gsap.set(badge, {
        autoAlpha: 0,
        y:
          originalY +
          (reducedMotion ? 0 : options.badgeMoveDown)
      });
    }

    function reveal(record) {
      if (record.revealed) return;

      record.revealed = true;

      gsap.to(record.badge, {
        autoAlpha: 1,
        y: record.originalY,
        duration: reducedMotion ? 0 : options.badgeDuration,
        ease: "power2.out",
        overwrite: "auto"
      });
    }

    function isVisible(record) {
      if (
        !record.started ||
        record.current >= record.target ||
        !isAvailable(record.item)
      ) {
        return false;
      }

      const rect = record.item.getBoundingClientRect();

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth
      );
    }

    function hasPending() {
      return [...records.values()].some(
        record =>
          record.started &&
          record.current < record.target
      );
    }

    function schedule() {
      if (
        stopped ||
        document.hidden ||
        timer !== null ||
        !hasPending()
      ) {
        return;
      }

      timer = window.setTimeout(
        tick,
        randomBetween(minInterval, maxInterval) * 1000
      );
    }

    function tick() {
      timer = null;

      if (stopped) return;

      if (document.hidden) {
        schedule();
        return;
      }

      const eligible = [...records.values()].filter(isVisible);
      const eligibleSet = new Set(eligible);

      bag = bag.filter(record => eligibleSet.has(record));

      if (!bag.length) {
        bag = shuffle([...eligible]);
      }

      const record = bag.pop();

      if (record) {
        record.current++;
        record.write(record.current);

        reveal(record);
        sound.ping();
      }

      schedule();
    }

    document.addEventListener("visibilitychange", () => {
      clearTimeout(timer);
      timer = null;

      if (!document.hidden) {
        schedule();
      }
    });

    return {
      has(item) {
        return records.has(item);
      },

      start(item) {
        const record = records.get(item);

        if (stopped || !record || record.started) return;

        record.started = true;
        schedule();
      },

      stop() {
        stopped = true;
        clearTimeout(timer);
        timer = null;
        bag = [];
      }
    };
  }

  // Mouse trail

  function createTrail(options, phoneZone) {
    const wrapper = select("[data-trail-wrapper]");
    const list = wrapper?.querySelector("[data-trail-list]");

    if (!wrapper || !list) {
      return { start() {} };
    }

    const items = shuffle(
      Array.from(list.querySelectorAll("[data-trail-item]"))
    );

    if (!items.length) {
      return { start() {} };
    }

    const useScale =
      wrapper.getAttribute("data-trail-scale") === "true";

    const useFall =
      wrapper.getAttribute("data-trail-exit") === "fall";

    const density = readNumber(
      wrapper,
      "data-trail-density",
      1,
      Number.EPSILON
    );

    const stayValue = readNumber(
      wrapper,
      "data-trail-stay-every",
      0
    );

    const stayEvery = Number.isInteger(stayValue)
      ? stayValue
      : 0;

    let unlocked = false;
    let active = false;
    let interval = null;
    let last = null;
    let globalIndex = 0;
    let nextIndex = 0;
    let activeItems = [];

    const timestamps = new Map();
    const retained = new Set();
    const visibleItems = new Set();

    const maxLength = Math.max(
      1,
      Math.min(options.trailLength, items.length)
    );

    gsap.set(items, {
      autoAlpha: 0,
      ...(useScale ? { scale: 1 } : {}),
      ...(useFall ? { x: 0, y: 0, rotation: 0 } : {})
    });

    function nextItem() {
      for (let i = 0; i < items.length; i++) {
        const item = items[nextIndex];

        nextIndex = (nextIndex + 1) % items.length;

        if (!retained.has(item)) return item;
      }

      return null;
    }

    function hideImmediately(item) {
      gsap.killTweensOf(item);

      timestamps.delete(item);
      retained.delete(item);
      visibleItems.delete(item);

      activeItems = activeItems.filter(value => value !== item);

      gsap.set(item, {
        autoAlpha: 0,
        ...(useScale ? { scale: 1 } : {}),
        ...(useFall ? { x: 0, y: 0, rotation: 0 } : {})
      });
    }

    function clearPhoneArea() {
      const zone = phoneZone.getRect();

      if (!zone) return;

      for (const item of [...visibleItems]) {
        if (
          phoneZone.overlaps(
            item.getBoundingClientRect(),
            zone
          )
        ) {
          hideImmediately(item);
        }
      }
    }

    function exitItem(item) {
      if (!item || retained.has(item)) return;

      timestamps.delete(item);
      activeItems = activeItems.filter(value => value !== item);

      if (!useFall) {
        gsap.to(item, {
          autoAlpha: 0,
          ...(useScale ? { scale: 0.2 } : {}),
          duration: 0.8,
          ease: "expo.out",
          overwrite: true,

          onComplete() {
            visibleItems.delete(item);
          }
        });

        return;
      }

      gsap.killTweensOf(item);

      gsap.set(item, {
        autoAlpha: 1,
        ...(useScale ? { scale: 1 } : {})
      });

      const clearance =
        Math.hypot(item.offsetWidth, item.offsetHeight) / 2 + 24;

      const distance = Math.max(
        40,
        list.clientHeight - item.offsetTop + clearance
      );

      const duration = Math.sqrt((2 * distance) / 1800);

      gsap.to(item, {
        x: randomBetween(-45, 45) * duration,
        rotation: randomBetween(-12, 12) * duration,
        duration,
        ease: "none",
        overwrite: "auto"
      });

      gsap.to(item, {
        y: distance,
        duration,
        ease: "power1.in",
        overwrite: "auto",

        onUpdate() {
          if (phoneZone.overlaps(item.getBoundingClientRect())) {
            hideImmediately(item);
          }
        },

        onComplete() {
          visibleItems.delete(item);

          gsap.set(item, {
            autoAlpha: 0,
            x: 0,
            y: 0,
            rotation: 0
          });
        }
      });
    }

    function activate(item, x, y) {
      const candidate = {
        x: x - item.offsetWidth / 2,
        y: y - item.offsetHeight / 2,
        width: item.offsetWidth,
        height: item.offsetHeight
      };

      if (
        phoneZone.blocksPlacement(
          candidate,
          phoneZone.getOrigin(list),
          phoneZone.getRect()
        )
      ) {
        return false;
      }

      gsap.killTweensOf(item);

      if (useFall) {
        gsap.set(item, { x: 0, y: 0, rotation: 0 });
      }

      gsap.set(item, {
        left: candidate.x,
        top: candidate.y,
        zIndex: globalIndex + 1
      });

      timestamps.delete(item);
      activeItems = activeItems.filter(value => value !== item);
      visibleItems.add(item);

      const shouldStay =
        stayEvery > 0 &&
        (globalIndex + 1) % stayEvery === 0;

      if (shouldStay) {
        retained.add(item);
      } else {
        activeItems.push(item);
        timestamps.set(item, Date.now());
      }

      while (activeItems.length > maxLength) {
        exitItem(activeItems[0]);
      }

      gsap.fromTo(
        item,
        {
          autoAlpha: 0,
          ...(useScale ? { scale: 0.8 } : {})
        },
        {
          autoAlpha: 1,
          ...(useScale ? { scale: 1 } : {}),
          duration: options.enterDuration,
          ease: options.enterEase,
          overwrite: true
        }
      );

      return true;
    }

    function onMove(event) {
      if (!active) return;

      const origin = phoneZone.getOrigin(list);

      const x = event.clientX - origin.x;
      const y = event.clientY - origin.y;

      const distance = last
        ? Math.hypot(x - last.x, y - last.y)
        : Infinity;

      const threshold =
        window.innerWidth / options.moveDistance / density;

      if (distance <= threshold) return;

      last = { x, y };

      const item = nextItem();

      if (!item) return;

      if (activate(item, x, y)) {
        globalIndex++;
      }

      if (retained.size === items.length) {
        stop();
      }
    }

    function stop() {
      if (!active) return;

      active = false;
      last = null;

      wrapper.removeEventListener("mousemove", onMove);

      clearInterval(interval);
      interval = null;

      [...activeItems].forEach(exitItem);
      timestamps.clear();
    }

    function sync() {
      clearPhoneArea();

      const rect = wrapper.getBoundingClientRect();

      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight;

      const canRun =
        !document.hidden &&
        unlocked &&
        visible &&
        window.innerWidth >= options.minWidth &&
        retained.size < items.length;

      if (!canRun) {
        stop();
        return;
      }

      if (active) return;

      active = true;
      last = null;

      wrapper.addEventListener("mousemove", onMove);

      interval = window.setInterval(() => {
        clearPhoneArea();

        const now = Date.now();

        for (const [item, timestamp] of timestamps) {
          if (now - timestamp > options.stopDuration) {
            exitItem(item);
          }
        }
      }, 100);
    }

    const trigger = ScrollTrigger.create({
      trigger: wrapper,
      start: "top bottom",
      end: "bottom top",
      onToggle: sync,
      onRefresh: sync
    });

    document.addEventListener("visibilitychange", sync);
    window.addEventListener("resize", sync);

    window.addEventListener("scroll", clearPhoneArea, {
      passive: true,
      capture: true
    });

    return {
      start() {
        if (unlocked) return;

        unlocked = true;
        sync();
      },

      stop() {
        unlocked = false;
        stop();

        trigger.kill();

        document.removeEventListener("visibilitychange", sync);
        window.removeEventListener("resize", sync);
        window.removeEventListener("scroll", clearPhoneArea, true);

        gsap.killTweensOf(items);

        gsap.to(items, {
          autoAlpha: 0,
          duration: SETTINGS.pickup.trailFade,
          overwrite: true
        });

        activeItems = [];
        timestamps.clear();
        retained.clear();
        visibleItems.clear();
      }
    };
  }

  // Random notifications:
  // positions are generated once and never shuffled on resize.

  function createRandomNotifications(options, sound, phoneZone) {
    const wrapper = select("[data-random-wrapper]");
    const list = wrapper?.querySelector("[data-random-list]");

    if (!list) {
      return { start() {} };
    }

    const items = shuffle(
      Array.from(list.querySelectorAll("[data-random-item]"))
    );

    if (!items.length) {
      return { start() {} };
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const entranceMove = reducedMotion ? 0 : options.moveUp;

    let started = false;
    let stopped = false;
    let index = 0;
    let startedAt = null;
    let layoutFrame = null;
    let layoutReady = false;
    let popupTimer = null;
    let observer = null;

    let hiddenAt = document.hidden ? performance.now() : null;

    const placementsByItem = new Map();
    const shown = new Set();
    const entrances = new Map();
    const blocked = new Set();

    // Off-screen cards must not create a scrollable overflow area.
    wrapper.style.overflow = "clip";

    gsap.set(items, {
      autoAlpha: 0,
      y: 0
    });

    const counters = createBadgeCounters(
      items,
      SETTINGS.counter,
      sound,

      item =>
        shown.has(item) &&
        !blocked.has(item) &&
        !entrances.has(item) &&
        isOnScreen(item)
    );

    function schedulePopup(seconds) {
      popupTimer = gsap.delayedCall(seconds, showNext);

      if (document.hidden) {
        popupTimer.pause();
      }
    }

    function onVisibility() {
      if (document.hidden) {
        hiddenAt = performance.now();
        popupTimer?.pause();
      } else {
        if (hiddenAt !== null && startedAt !== null) {
          startedAt += performance.now() - hiddenAt;
        }

        hiddenAt = null;
        popupTimer?.resume();
        scheduleSafetyCheck();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);

    function createSlots(count, width, height) {
      const columns = Math.max(
        1,
        Math.round(Math.sqrt((count * width) / height))
      );

      const rows = Math.max(1, Math.ceil(count / columns));
      const slots = [];

      for (let row = 0; row < rows; row++) {
        const rowCount =
          Math.floor(((row + 1) * count) / rows) -
          Math.floor((row * count) / rows);

        for (let column = 0; column < rowCount; column++) {
          slots.push({
            x: (column + 0.5) / rowCount,
            y: (row + 0.5) / rows,
            width: 1 / rowCount,
            height: 1 / rows
          });
        }
      }

      return slots;
    }

    function orderSlots(slots) {
      const remaining = [...slots];
      const result = [];

      while (remaining.length) {
        const first = remaining.splice(
          Math.floor(Math.random() * remaining.length),
          1
        )[0];

        result.push(first);

        if (!remaining.length) break;

        let bestIndex = 0;
        let bestDistance = Infinity;

        remaining.forEach((slot, i) => {
          const distance =
            (slot.x - (1 - first.x)) ** 2 +
            (slot.y - (1 - first.y)) ** 2;

          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = i;
          }
        });

        result.push(remaining.splice(bestIndex, 1)[0]);
      }

      return result;
    }

    function getOverlap(candidate, placements) {
      let maximum = 0;
      let total = 0;

      for (const other of placements) {
        const width = Math.max(
          0,
          Math.min(
            candidate.x + candidate.width,
            other.x + other.width
          ) - Math.max(candidate.x, other.x)
        );

        const height = Math.max(
          0,
          Math.min(
            candidate.y + candidate.height,
            other.y + other.height
          ) - Math.max(candidate.y, other.y)
        );

        const smallerArea = Math.max(
          1,
          Math.min(
            candidate.width * candidate.height,
            other.width * other.height
          )
        );

        const ratio = (width * height) / smallerArea;

        maximum = Math.max(maximum, ratio);
        total += ratio;
      }

      return { maximum, total };
    }

    function isOnScreen(item) {
      const rect = item.getBoundingClientRect();
      const clip = wrapper.getBoundingClientRect();

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > Math.max(0, clip.left) &&
        rect.left < Math.min(window.innerWidth, clip.right) &&
        rect.bottom > Math.max(0, clip.top) &&
        rect.top < Math.min(window.innerHeight, clip.bottom)
      );
    }

    function buildMobileLayout(width, height, origin, zone, sizes) {
      const gap = Math.max(0, options.mobileGap);
      const coverage = clamp(options.mobileCoverage, 0.1, 0.8);

      const area = sizes.reduce(
        (sum, size) =>
          sum +
          (size.width + gap) *
            (size.height + entranceMove + gap),
        0
      );

      const expansion = Math.max(
        1,
        Math.sqrt(area / (width * height * coverage))
      );

      const fieldWidth =
        width * Math.max(options.mobileFieldWidth, expansion);

      const fieldHeight = height * expansion;

      const offsetX = (width - fieldWidth) / 2;
      const offsetY = (height - fieldHeight) / 2;

      const slots = createSlots(
        items.length,
        fieldWidth,
        fieldHeight
      );

      // Start near the viewport, then work outward.
      slots.sort(
        (a, b) =>
          Math.hypot(a.x - 0.5, a.y - 0.5) -
          Math.hypot(b.x - 0.5, b.y - 0.5)
      );

      // Pair each area with the opposite side for balance.
      const ordered = [];

      while (slots.length) {
        const first = slots.shift();
        ordered.push(first);

        if (!slots.length) break;

        let nearest = 0;

        slots.forEach((slot, i) => {
          const distance = value =>
            (value.x + first.x - 1) ** 2 +
            (value.y + first.y - 1) ** 2;

          if (distance(slot) < distance(slots[nearest])) {
            nearest = i;
          }
        });

        ordered.push(slots.splice(nearest, 1)[0]);
      }

      const placed = [];

      items.forEach((item, i) => {
        const size = sizes[i];

        if (!size.width || !size.height) {
          placementsByItem.set(item, null);
          return;
        }

        const slot = ordered[i];

        const targetX =
          offsetX + slot.x * fieldWidth - size.width / 2;

        const targetY =
          offsetY + slot.y * fieldHeight - size.height / 2;

        let best = null;
        let score = Infinity;

        function consider(x, y) {
          const candidate = { x, y, ...size };

          if (
            phoneZone.blocksPlacement(
              candidate,
              origin,
              zone,
              entranceMove
            )
          ) {
            return;
          }

          const collides = placed.some(other => !(
            x + size.width + gap <= other.x ||
            other.x + other.width + gap <= x ||
            y + size.height + entranceMove + gap <= other.y ||
            other.y + other.height + entranceMove + gap <= y
          ));

          if (collides) return;

          const distance = Math.hypot(
            x - targetX,
            y - targetY
          );

          if (distance < score) {
            best = candidate;
            score = distance;
          }
        }

        for (let attempt = 0; attempt < 100; attempt++) {
          const spread = attempt < 40 ? 0.7 : 2;

          consider(
            targetX +
              randomBetween(-0.5, 0.5) *
                slot.width *
                fieldWidth *
                spread,

            targetY +
              randomBetween(-0.5, 0.5) *
                slot.height *
                fieldHeight *
                spread
          );
        }

        if (!best) {
          // Expand outward rather than force an overlapping placement.
          const localLeft = zone
            ? zone.left - origin.x - zone.clearance
            : 0;

          const localRight = zone
            ? zone.right - origin.x + zone.clearance
            : width;

          const x = i % 2
            ? Math.min(
                offsetX,
                localLeft,
                ...placed.map(p => p.x)
              ) - size.width - gap - 1
            : Math.max(
                offsetX + fieldWidth,
                localRight,
                ...placed.map(p => p.x + p.width)
              ) + gap + 1;

          best = {
            x,
            y: targetY,
            ...size
          };
        }

        placed.push(best);
        placementsByItem.set(item, best);

        gsap.set(item, {
          left: best.x,
          top: best.y,
          zIndex: i + 1
        });
      });
    }

    function buildLayout() {
      const width = list.clientWidth;
      const height = list.clientHeight;

      if (!width || !height) return false;

      const origin = phoneZone.getOrigin(list);
      const zone = phoneZone.getRect();

      const paddingX = Math.min(
        options.edgePadding,
        width / 4
      );

      const paddingY = Math.min(
        Math.max(options.edgePadding, entranceMove),
        height / 4
      );

      const usableWidth = Math.max(1, width - paddingX * 2);
      const usableHeight = Math.max(1, height - paddingY * 2);

      const sizes = items.map(item => ({
        width: item.offsetWidth,
        height: item.offsetHeight
      }));

      if (window.innerWidth < options.mobileBreakpoint) {
        buildMobileLayout(
          width,
          height,
          origin,
          zone,
          sizes
        );

        layoutReady = true;
        return true;
      }

      // Desktop retains its original balanced placement strategy,
      // but this calculation runs only once.
      const slots = orderSlots(
        createSlots(items.length, usableWidth, usableHeight)
      );

      const totalArea = sizes.reduce(
        (sum, size) => sum + size.width * size.height,
        0
      );

      const density = clamp(
        totalArea / (usableWidth * usableHeight),
        0,
        1
      );

      const scatter = clamp(options.scatter, 0, 1);
      const placements = [];

      placementsByItem.clear();

      items.forEach((item, i) => {
        const slot = slots[i];
        const size = sizes[i];

        const progress = items.length > 1
          ? i / (items.length - 1)
          : 0;

        const allowedOverlap =
          0.05 + 0.45 * density * Math.pow(progress, 1.2);

        let best = null;
        let bestScore = Infinity;
        let acceptable = false;

        const availableX = width - size.width;
        const availableY = height - size.height - entranceMove;

        if (
          size.width > 0 &&
          size.height > 0 &&
          availableX >= 0 &&
          availableY >= 0
        ) {
          const minX = Math.min(paddingX, availableX / 2);
          const minY = Math.min(paddingY, availableY / 2);

          const maxX = availableX - minX;
          const maxY = availableY - minY;

          const centerX = paddingX + slot.x * usableWidth;
          const centerY = paddingY + slot.y * usableHeight;

          const jitterX = slot.width * usableWidth * scatter;
          const jitterY = slot.height * usableHeight * scatter;

          function consider(x, y) {
            const candidate = {
              x: clamp(x, minX, maxX),
              y: clamp(y, minY, maxY),
              width: size.width,
              height: size.height
            };

            if (
              phoneZone.blocksPlacement(
                candidate,
                origin,
                zone,
                entranceMove
              )
            ) {
              return;
            }

            const overlap = getOverlap(candidate, placements);

            const slotDistance = Math.hypot(
              (candidate.x + size.width / 2 - centerX) /
                usableWidth,
              (candidate.y + size.height / 2 - centerY) /
                usableHeight
            );

            const score =
              Math.max(0, overlap.maximum - allowedOverlap) * 20 +
              overlap.total +
              slotDistance * 0.35;

            if (score < bestScore) {
              best = candidate;
              bestScore = score;

              acceptable =
                overlap.maximum <= allowedOverlap &&
                overlap.total <= allowedOverlap * 2;
            }
          }

          for (
            let attempt = 0;
            attempt < 40 && !acceptable;
            attempt++
          ) {
            consider(
              centerX +
                randomBetween(-jitterX / 2, jitterX / 2) -
                size.width / 2,

              centerY +
                randomBetween(-jitterY / 2, jitterY / 2) -
                size.height / 2
            );
          }

          for (
            let attempt = 0;
            attempt < 64 && !acceptable;
            attempt++
          ) {
            consider(
              randomBetween(minX, maxX),
              randomBetween(minY, maxY)
            );
          }

          for (let row = 0; row <= 8 && !acceptable; row++) {
            for (
              let column = 0;
              column <= 8 && !acceptable;
              column++
            ) {
              consider(
                minX + ((maxX - minX) * column) / 8,
                minY + ((maxY - minY) * row) / 8
              );
            }
          }
        }

        placementsByItem.set(item, best);

        if (!best) {
          gsap.set(item, {
            autoAlpha: 0,
            y: 0
          });

          return;
        }

        placements.push(best);

        gsap.set(item, {
          left: best.x,
          top: best.y,
          zIndex: i + 1
        });
      });

      layoutReady = true;
      return true;
    }

    function animateIn(item) {
      if (reducedMotion) {
        gsap.set(item, {
          autoAlpha: 1,
          y: 0
        });

        return;
      }

      gsap.set(item, {
        autoAlpha: 0,
        y: entranceMove
      });

      const animation = gsap.timeline({
        onComplete() {
          entrances.delete(item);
        }
      });

      entrances.set(item, animation);

      animation.to(
        item,
        {
          autoAlpha: 1,
          duration: options.fadeDuration,
          ease: "power2.out"
        },
        0
      );

      animation.to(
        item,
        {
          y: 0,
          duration: options.moveDuration,
          ease: "power3.out"
        },
        0
      );
    }

    function nextDelay() {
      const elapsed = (performance.now() - startedAt) / 1000;

      const progress = clamp(
        elapsed / Math.max(0.1, options.rampDuration),
        0,
        1
      );

      const curve = Math.pow(
        progress,
        Math.max(0.01, options.acceleration)
      );

      const start = Math.max(0.05, options.startInterval);
      const end = clamp(options.endInterval, 0.05, start);
      const base = start * Math.pow(end / start, curve);
      const variation = clamp(options.timingVariation, 0, 0.5);

      return Math.max(
        reducedMotion ? 0.75 : 0.05,
        base * randomBetween(1 - variation, 1 + variation)
      );
    }

    function showNext() {
      if (!started || index >= items.length) return;

      if (!layoutReady) {
        if (!buildLayout()) {
          schedulePopup(0.25);
          return;
        }
      }

      while (
        index < items.length &&
        !placementsByItem.get(items[index])
      ) {
        index++;
      }

      if (index >= items.length) return;

      if (startedAt === null) {
        startedAt = performance.now();
      }

      const item = items[index];
      const candidate = placementsByItem.get(item);

      shown.add(item);

      if (
        phoneZone.blocksPlacement(
          {
            ...candidate,
            width: item.offsetWidth,
            height: item.offsetHeight
          },
          phoneZone.getOrigin(list),
          phoneZone.getRect(),
          entranceMove
        )
      ) {
        blocked.add(item);
      } else {
        animateIn(item);
      }

      // Do not play appearance sounds for entirely clipped cards.
      if (!blocked.has(item) && isOnScreen(item)) {
        sound.play(item, counters.has(item));
      }

      counters.start(item);

      index++;

      if (index < items.length) {
        schedulePopup(nextDelay());
      }
    }

    function checkPhoneArea() {
      layoutFrame = null;

      if (!started || stopped) return;

      const zone = phoneZone.getRect();
      const origin = phoneZone.getOrigin(list);

      for (const item of shown) {
        const saved = placementsByItem.get(item);

        if (!saved) continue;

        const collision = phoneZone.blocksPlacement(
          {
            ...saved,
            width: item.offsetWidth,
            height: item.offsetHeight
          },
          origin,
          zone,
          entranceMove
        );

        if (collision === blocked.has(item)) continue;

        if (collision) {
          blocked.add(item);
        } else {
          blocked.delete(item);
        }

        entrances.get(item)?.kill();
        entrances.delete(item);

        // Preserve left/top. Only visibility changes near the phone.
        gsap.to(item, {
          autoAlpha: collision ? 0 : 1,
          y: 0,
          duration: reducedMotion ? 0 : 0.2,
          overwrite: true,
          ease: "sine.out"
        });
      }
    }

    function scheduleSafetyCheck() {
      if (
        !started ||
        stopped ||
        document.hidden ||
        layoutFrame !== null
      ) {
        return;
      }

      // Scroll and resize never regenerate positions.
      layoutFrame = requestAnimationFrame(checkPhoneArea);
    }

    window.addEventListener("resize", scheduleSafetyCheck, {
      passive: true
    });

    window.addEventListener("scroll", scheduleSafetyCheck, {
      passive: true,
      capture: true
    });

    if (window.ResizeObserver) {
      observer = new ResizeObserver(scheduleSafetyCheck);

      observer.observe(list);
      items.forEach(item => observer.observe(item));

      const phone = select(".phone-btn");

      if (phone) {
        observer.observe(phone);
      }
    }

    return {
      start() {
        if (started || stopped) return;

        started = true;
        schedulePopup(options.initialDelay);
      },

      stop() {
        started = false;
        stopped = true;

        window.removeEventListener(
          "resize",
          scheduleSafetyCheck
        );

        window.removeEventListener(
          "scroll",
          scheduleSafetyCheck,
          true
        );

        document.removeEventListener(
          "visibilitychange",
          onVisibility
        );

        popupTimer?.kill();
        popupTimer = null;

        cancelAnimationFrame(layoutFrame);
        layoutFrame = null;

        observer?.disconnect();
        counters.stop();
      }
    };
  }

  // Phone reveal, ring synchronization, and proximity

  function createPhone(options, sound, onProximity) {
    const button = select(".phone-btn");

    if (!button) {
      return { start() {} };
    }

    const label =
      button.parentElement?.querySelector(".phone-btn__label") ||
      select(".phone-btn__label");

    const delay = readNumber(
      button,
      "data-phone-delay",
      options.delay
    );

    const radius = readNumber(
      button,
      "data-phone-radius",
      options.proximityRadius,
      1
    );

    const fade = readNumber(
      button,
      "data-phone-volume-fade",
      options.volumeFade
    );

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    let started = false;
    let visible = false;
    let pointer = null;
    let frame = null;
    let focused = false;
    let fallbackTimer = null;
    let revealTimer = null;

    const events = new AbortController();

    if (label) {
      gsap.set(label, { autoAlpha: 0 });
    }

    gsap.set(button, { autoAlpha: 0 });

    button.inert = true;
    button.setAttribute("aria-hidden", "true");
    button.classList.remove("is-ringing");

    function updateVolume() {
      frame = null;

      if (!visible) return;

      const rect = button.getBoundingClientRect();

      const onScreen =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth;

      const distance = pointer
        ? Math.hypot(
            Math.max(
              rect.left - pointer.x,
              0,
              pointer.x - rect.right
            ),
            Math.max(
              rect.top - pointer.y,
              0,
              pointer.y - rect.bottom
            )
          )
        : Infinity;

      const t = clamp(distance / radius, 0, 1);

      const proximity = !onScreen
        ? 0
        : focused
          ? 1
          : 1 - t * t * (3 - 2 * t);

      sound.setBackgroundLevel(1 - proximity, fade);
      onProximity(proximity);
    }

    function scheduleUpdate() {
      if (visible && frame === null) {
        frame = requestAnimationFrame(updateVolume);
      }
    }

    function onHaloPulse(event) {
      if (
        !visible ||
        motionPreference.matches ||
        event.target !== button ||
        event.animationName !== "phone-halo" ||
        event.pseudoElement !== "::before"
      ) {
        return;
      }

      sound.playRing();
    }

    button.addEventListener("animationstart", onHaloPulse, {
      signal: events.signal
    });

    button.addEventListener("animationiteration", onHaloPulse, {
      signal: events.signal
    });

    function haloDuration() {
      const raw = getComputedStyle(button)
        .getPropertyValue("--phone-halo-duration")
        .trim();

      const value = parseFloat(raw);

      if (!Number.isFinite(value) || value <= 0) {
        return 2.2;
      }

      return raw.endsWith("ms") ? value / 1000 : value;
    }

    function syncReducedMotionRinging() {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;

      if (!visible || !motionPreference.matches) return;

      function pulse() {
        if (!visible || !motionPreference.matches) return;

        sound.playRing();

        fallbackTimer = window.setTimeout(
          pulse,
          haloDuration() * 1000
        );
      }

      pulse();
    }

    motionPreference.addEventListener(
      "change",
      syncReducedMotionRinging,
      { signal: events.signal }
    );

    window.addEventListener(
      "pointermove",
      event => {
        if (event.pointerType === "touch") return;

        pointer = {
          x: event.clientX,
          y: event.clientY
        };

        scheduleUpdate();
      },
      {
        passive: true,
        signal: events.signal
      }
    );

    document.documentElement.addEventListener(
      "pointerleave",
      () => {
        pointer = null;
        scheduleUpdate();
      },
      { signal: events.signal }
    );

    window.addEventListener(
      "blur",
      () => {
        pointer = null;
        focused = false;
        scheduleUpdate();
      },
      { signal: events.signal }
    );

    window.addEventListener("resize", scheduleUpdate, {
      passive: true,
      signal: events.signal
    });

    window.addEventListener("scroll", scheduleUpdate, {
      passive: true,
      capture: true,
      signal: events.signal
    });

    button.addEventListener(
      "focusin",
      () => {
        focused = true;
        scheduleUpdate();
      },
      { signal: events.signal }
    );

    button.addEventListener(
      "focusout",
      event => {
        if (button.contains(event.relatedTarget)) return;

        focused = false;
        scheduleUpdate();
      },
      { signal: events.signal }
    );

    return {
      start() {
        if (started) return;

        started = true;

        revealTimer = gsap.delayedCall(delay, () => {
          button.inert = false;
          button.removeAttribute("aria-hidden");

          if (label) {
            gsap.to(label, {
              autoAlpha: 0.5,
              duration: motionPreference.matches
                ? 0
                : options.revealDuration,
              ease: "power2.out",
              overwrite: true
            });
          }

          gsap.to(button, {
            autoAlpha: 1,
            duration: motionPreference.matches
              ? 0
              : options.revealDuration,
            ease: "power2.out",
            overwrite: true,

            onComplete() {
              visible = true;
              updateVolume();

              button.classList.add("is-ringing");
              syncReducedMotionRinging();
            }
          });
        });
      },

      stop() {
        visible = false;

        events.abort();
        revealTimer?.kill();

        clearTimeout(fallbackTimer);
        cancelAnimationFrame(frame);

        const phoneGroup = button.closest("[data-phone-button]");
        const targets = label ? [button, label] : [button];

        gsap.killTweensOf(targets);
        button.inert = true;

        gsap.to(targets, {
          autoAlpha: 0,
          duration: motionPreference.matches
            ? 0
            : SETTINGS.pickup.phoneFade,
          ease: "power2.out",
          overwrite: true,

          onComplete() {
            button.classList.remove("is-ringing");
            phoneGroup?.setAttribute("data-phone-picked-up", "");
          }
        });
      }
    };
  }

  // Popup steps:
  // 1. Title and form
  // 2. SVG wave after successful submission
  // 3. Final title

  function createSteps(popup) {
    const items = Array.from(
      popup?.querySelectorAll(".genius-ambient-popup__step") || []
    );

    const [formStep, waveStep, finalStep] = items;

    const options = SETTINGS.steps;
    const wave = SETTINGS.wave;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const records = new Map();

    const formWrap = formStep?.querySelector(".w-form");
    const form = formWrap?.querySelector("form");
    const success = formWrap?.querySelector(".w-form-done");

    const formTarget =
      formWrap || formStep?.querySelector("form");

    let started = false;
    let ready = false;
    let submitted = false;
    let completed = false;
    let observer = null;

    const hidden = {
      autoAlpha: 0,
      filter: `blur(${reduced ? 0 : options.blur}px)`,
      scale: reduced ? 1 : options.scale
    };

    const stagger = {
      each: reduced ? 0 : options.stagger,
      from: "start"
    };

    function show(step, opacity = 1) {
      step.inert = false;
      step.removeAttribute("aria-hidden");
      step.classList.add("is-active");

      gsap.set(step, { autoAlpha: opacity });
    }

    function hide(step) {
      step.inert = true;
      step.setAttribute("aria-hidden", "true");
      step.classList.remove("is-active");

      gsap.set(step, { autoAlpha: 0 });
    }

    items.forEach(hide);

    if (formTarget) {
      gsap.set(formTarget, { autoAlpha: 0 });
      formTarget.inert = true;
    }

    function prepare(step) {
      if (records.has(step)) return records.get(step);

      const marked = Array.from(
        step.querySelectorAll("[data-step-title]")
      );

      const titles = (
        marked.length
          ? marked
          : Array.from(
              step.querySelectorAll("h1,h2,h3,h4,h5,h6")
            )
      ).filter(title => !title.closest(".w-form, form"));

      const splits = [];

      const chars = titles.flatMap(title => {
        if (!reduced && window.SplitText) {
          const split = new SplitText(title, {
            type: "words,chars",
            charsClass: "ambient-char",
            wordsClass: "ambient-word",
            aria: "auto"
          });

          splits.push(split);
          return split.chars;
        }

        return [title];
      });

      gsap.set(chars, {
        ...hidden,
        transformOrigin: "50% 60%"
      });

      const record = {
        step,
        splits,
        chars
      };

      records.set(step, record);

      return record;
    }

    function enter(timeline, record) {
      timeline.call(() => show(record.step));

      if (record.chars.length) {
        timeline.to(record.chars, {
          autoAlpha: 1,
          filter: "blur(0px)",
          scale: 1,
          duration: reduced ? 0.2 : options.enter,
          stagger,
          ease: "power2.out"
        });
      }
    }

    function exitText(timeline, record) {
      if (record.chars.length) {
        timeline.to(record.chars, {
          ...hidden,
          duration: reduced ? 0.2 : options.exit,
          stagger,
          ease: "power2.in"
        });
      }
    }

    function finishStep(record) {
      hide(record.step);
      record.splits.forEach(split => split.revert());
      records.delete(record.step);
    }

    function addWave(timeline) {
      const step = waveStep;
      const svg = step.querySelector("svg");

      const bars = Array.from(
        svg?.querySelectorAll("rect") || []
      ).sort(
        (a, b) =>
          Number(a.getAttribute("x") || 0) -
          Number(b.getAttribute("x") || 0)
      );

      const heights = bars.map(
        bar => Number(bar.getAttribute("height")) || 8
      );

      const centers = bars.map(
        (bar, i) =>
          Number(bar.getAttribute("y") || 0) +
          heights[i] / 2
      );

      const maximum = Math.max(wave.height, ...heights);

      if (svg && bars.length) {
        const box = svg.viewBox.baseVal;
        const top = Math.min(...centers) - maximum / 2 - 8;

        const height =
          Math.max(...centers) + maximum / 2 + 8 - top;

        svg.setAttribute(
          "viewBox",
          `${box.x} ${top} ${box.width || 200} ${height}`
        );

        svg.setAttribute("height", String(height));

        Object.assign(svg.style, {
          height: "auto",
          maxWidth: "100%",
          overflow: "visible"
        });

        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
      }

      gsap.set(bars, { opacity: 0 });

      timeline.call(() => show(step));

      if (bars.length) {
        timeline.to(bars, {
          opacity: 1,
          duration: reduced ? 0.2 : wave.fadeIn,
          stagger: {
            each: reduced ? 0 : wave.barStagger,
            from: "start"
          },
          ease: "power2.out"
        });
      }

      timeline.to({}, { duration: wave.delay });

      if (!reduced && bars.length) {
        const start = timeline.duration();
        const duration = Math.max(0.8, wave.duration);
        const rise = Math.min(0.28, duration * 0.25);
        const fall = Math.min(0.42, duration * 0.35);

        const spacing = bars.length > 1
          ? (duration - rise - fall) / (bars.length - 1)
          : 0;

        bars.forEach((bar, i) => {
          const progress = bars.length > 1
            ? i / (bars.length - 1)
            : 0.5;

          const strength =
            Math.pow(Math.sin(Math.PI * progress), 0.6) *
            (1 - progress * 0.55);

          const height =
            heights[i] + (maximum - heights[i]) * strength;

          timeline.to(
            bar,
            {
              attr: {
                height,
                y: centers[i] - height / 2
              },
              duration: rise,
              ease: "sine.inOut"
            },
            start + i * spacing
          );

          timeline.to(
            bar,
            {
              attr: {
                height: heights[i],
                y: centers[i] - heights[i] / 2
              },
              duration: fall,
              ease: "sine.inOut"
            },
            start + i * spacing + rise
          );
        });
      } else {
        timeline.to({}, { duration: 0.5 });
      }

      timeline.to({}, { duration: wave.hold });

      if (bars.length) {
        timeline.to(bars, {
          opacity: 0,
          duration: reduced ? 0.2 : wave.fadeOut,
          stagger: {
            each: reduced ? 0 : wave.barStagger,
            from: "start"
          },
          ease: "power2.inOut"
        });
      }

      timeline.call(() => hide(step));
    }

    function checkSuccess() {
      if (
        !ready ||
        !submitted ||
        completed ||
        getComputedStyle(success).display === "none"
      ) {
        return;
      }

      completed = true;

      observer.disconnect();
      form.removeEventListener("submit", onSubmit, true);

      formWrap.classList.add("is-success-exiting");

      if (formStep.contains(document.activeElement)) {
        document.activeElement.blur();
      }

      formStep.inert = true;

      if (!popup.hasAttribute("tabindex")) {
        popup.setAttribute("tabindex", "-1");
      }

      popup.focus({ preventScroll: true });

      const record = records.get(formStep);
      const timeline = gsap.timeline();

      exitText(timeline, record);

      timeline.to(formTarget, {
        autoAlpha: 0,
        duration: reduced ? 0.2 : options.formFade,
        ease: "power2.inOut"
      });

      timeline.call(() => {
        finishStep(record);
        formWrap.classList.remove("is-success-exiting");
      });

      timeline.to({}, { duration: options.gap });

      addWave(timeline);

      timeline.to({}, { duration: wave.finalDelay });

      enter(timeline, prepare(finalStep));

      timeline.call(() => {
        finalStep.setAttribute("tabindex", "-1");
        finalStep.focus({ preventScroll: true });
      });
    }

    function onSubmit() {
      submitted = true;
      queueMicrotask(checkSuccess);
    }

    if (form && success && waveStep && finalStep) {
      const display = getComputedStyle(form).display;

      formWrap.style.setProperty(
        "--reception-form-display",
        display === "none" ? "block" : display
      );

      formWrap.classList.add("reception-sequence-form");

      const style = document.createElement("style");

      style.textContent = `
        .reception-sequence-form > .w-form-done {
          position: absolute !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        .reception-sequence-form.is-success-exiting > form {
          display: var(--reception-form-display, block) !important;
        }
      `;

      document.head.appendChild(style);

      observer = new MutationObserver(checkSuccess);

      observer.observe(success, {
        attributes: true,
        attributeFilter: ["style", "class", "hidden"]
      });

      form.addEventListener("submit", onSubmit, true);
    }

    return {
      async start() {
        if (started || !items.length) return;

        started = true;

        if (document.fonts) {
          await document.fonts.ready;
        }

        const timeline = gsap.timeline({
          delay: options.delay
        });

        enter(timeline, prepare(formStep));

        if (formTarget) {
          timeline.to(
            formTarget,
            {
              autoAlpha: 1,
              duration: reduced ? 0.2 : options.formFade,
              ease: "power2.out",

              onComplete() {
                formTarget.inert = false;
                ready = true;

                if (observer) {
                  checkSuccess();
                }
              }
            },
            `+=${options.formDelay}`
          );
        }
      }
    };
  }

  // Main sequence

  function setupPage() {
    if (window.__receptionSequenceInitialized) return;

    if (!window.gsap || !window.ScrollTrigger) {
      console.warn(
        "This sequence requires GSAP and ScrollTrigger."
      );

      return;
    }

    window.__receptionSequenceInitialized = true;

    gsap.registerPlugin(ScrollTrigger);

    if (window.SplitText) {
      gsap.registerPlugin(SplitText);
    }

    const overlay = select(".sound-wrap");

    const mainButton = overlay?.querySelector(
      ".sound-wrap__btn:not(.sound-wrap__btn--corner)"
    );

    const cornerButton = select(".sound-wrap__btn--corner");
    const phoneButton = select(".phone-btn");
    const popup = select(".genius-ambient-popup");

    const steps = createSteps(popup);

    const backdrop = popup
      ? document.createElement("div")
      : null;

    if (backdrop) {
      backdrop.className = "genius-ambient-backdrop";
      backdrop.setAttribute("aria-hidden", "true");

      popup.before(backdrop);

      gsap.set(backdrop, {
        autoAlpha: 0,
        "--ambient-blur": "0px"
      });
    }

    const videoWrap = popup?.querySelector(".video-wrap");

    const video = videoWrap?.matches("video")
      ? videoWrap
      : videoWrap?.querySelector("video");

    if (videoWrap) {
      gsap.set(videoWrap, { autoAlpha: 0 });
    }

    if (video) {
      video.muted = true;
      video.playsInline = true;
      video.autoplay = false;
      video.pause();
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const sound = createSoundManager(SETTINGS.sound);
    const phoneZone = createPhoneZone(SETTINGS.phone);

    const trail = createTrail(
      SETTINGS.trail,
      phoneZone
    );

    const random = createRandomNotifications(
      SETTINGS.random,
      sound,
      phoneZone
    );

    const phone = createPhone(
      SETTINGS.phone,
      sound,
      updateBackdrop
    );

    let transitioning = false;
    let experienceStarted = false;
    let soundPending = false;
    let timeout = null;
    let cornerShown = false;
    let pickedUp = false;
    let backdropProgress = 0;

    function updateBackdrop(progress) {
      if (
        !backdrop ||
        pickedUp ||
        Math.abs(progress - backdropProgress) < 0.001
      ) {
        return;
      }

      backdropProgress = progress;

      gsap.to(backdrop, {
        autoAlpha: progress,

        "--ambient-blur":
          `${SETTINGS.backdrop.blur * progress}px`,

        duration: reducedMotion
          ? 0
          : SETTINGS.backdrop.fade,

        ease: "power2.out",
        overwrite: true
      });
    }

    if (popup) {
      gsap.set(popup, { autoAlpha: 0 });

      popup.inert = true;
      popup.setAttribute("aria-hidden", "true");
      popup.classList.remove("is-open");
    }

    const cornerIcon = cornerButton?.querySelector(
      ".ri-volume-up-fill, .ri-volume-mute-fill"
    );

    if (cornerButton) {
      Object.assign(cornerButton.style, {
        zIndex: "10002",
        pointerEvents: "auto"
      });

      if (getComputedStyle(cornerButton).position === "static") {
        cornerButton.style.position = "relative";
      }

      gsap.set(cornerButton, { autoAlpha: 0 });

      cornerButton.disabled = true;
      cornerButton.setAttribute("aria-hidden", "true");
    }

    function updateCornerButton() {
      if (!cornerButton) return;

      const enabled = sound.isEnabled();
      const action = enabled ? "Mute sound" : "Enable sound";

      cornerButton.disabled = soundPending;
      cornerButton.setAttribute("aria-label", action);
      cornerButton.setAttribute("title", action);

      if (soundPending) {
        cornerButton.setAttribute("aria-busy", "true");
      } else {
        cornerButton.removeAttribute("aria-busy");
      }

      if (cornerIcon) {
        cornerIcon.classList.toggle(
          "ri-volume-mute-fill",
          enabled
        );

        cornerIcon.classList.toggle(
          "ri-volume-up-fill",
          !enabled
        );

        cornerIcon.setAttribute("aria-hidden", "true");
      }

      if (!experienceStarted) return;

      cornerButton.removeAttribute("aria-hidden");

      if (cornerShown) return;

      cornerShown = true;

      gsap.to(cornerButton, {
        autoAlpha: 1,
        duration: reducedMotion ? 0 : SETTINGS.cornerFade,
        ease: "power2.out",
        overwrite: true
      });
    }

    function requestSound() {
      if (soundPending || sound.isEnabled()) return;

      soundPending = true;
      updateCornerButton();

      sound.enable().then(() => {
        soundPending = false;
        updateCornerButton();
      });
    }

    function startEffects() {
      if (experienceStarted) return;

      experienceStarted = true;

      trail.start();
      random.start();
      phone.start();

      updateCornerButton();
    }

    function hideOverlayImmediately() {
      if (!overlay) return;

      overlay.inert = true;
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
    }

    function begin(withSound) {
      if (transitioning) return;

      transitioning = true;
      clearTimeout(timeout);

      if (mainButton) {
        mainButton.removeEventListener("click", onMainClick);
        mainButton.disabled = true;
      }

      if (withSound) {
        requestSound();
      } else {
        sound.disable();
      }

      if (!overlay) {
        startEffects();
        return;
      }

      if (overlay.contains(document.activeElement)) {
        document.activeElement.blur();
      }

      overlay.inert = true;

      gsap.to(overlay, {
        autoAlpha: 0,
        duration: reducedMotion ? 0 : SETTINGS.overlayFade,
        ease: "power2.out",
        overwrite: true,

        onComplete() {
          hideOverlayImmediately();
          startEffects();
        }
      });
    }

    function onMainClick(event) {
      event.preventDefault();
      begin(true);
    }

    function onCornerClick(event) {
      event.preventDefault();

      if (soundPending) return;

      if (sound.isEnabled()) {
        sound.disable();
        updateCornerButton();
      } else {
        requestSound();
      }
    }

    function onPickup(event) {
      event.preventDefault();

      if (!experienceStarted || pickedUp) return;

      if (!popup) {
        console.warn("Missing .genius-ambient-popup.");
        return;
      }

      pickedUp = true;

      phoneButton.removeEventListener("click", onPickup);

      trail.stop?.();
      random.stop?.();
      phone.stop?.();

      sound.fadeOutAll(SETTINGS.pickup.soundFade);
      updateCornerButton();

      popup.inert = false;
      popup.removeAttribute("aria-hidden");
      popup.classList.add("is-open");

      gsap.killTweensOf(backdrop);

      const transition = gsap.timeline();

      transition.to(
        backdrop,
        {
          autoAlpha: 1,
          "--ambient-blur": `${SETTINGS.backdrop.blur}px`,

          duration: reducedMotion
            ? 0
            : SETTINGS.pickup.popupFade,

          ease: "power2.out",
          overwrite: true
        },
        0
      );

      transition.to(
        popup,
        {
          autoAlpha: 1,

          duration: reducedMotion
            ? 0
            : SETTINGS.pickup.popupFade,

          ease: "power2.out",
          overwrite: true,

          onComplete() {
            if (!popup.hasAttribute("tabindex")) {
              popup.setAttribute("tabindex", "-1");
            }

            popup.focus({ preventScroll: true });
          }
        },
        0
      );

      const videoDelay = Math.max(
        0,
        SETTINGS.ambient.delay
      );

      transition.call(
        () => {
          if (video) {
            video.play()?.catch(error => {
              console.warn(
                "Background video could not play:",
                error
              );
            });
          }

          sound.startAmbient(SETTINGS.ambient);
        },
        [],
        videoDelay
      );

      if (videoWrap) {
        transition.to(
          videoWrap,
          {
            autoAlpha: 1,

            duration: reducedMotion
              ? 0
              : SETTINGS.ambient.videoFade,

            ease: "power2.inOut",
            overwrite: true
          },
          videoDelay
        );
      }

      transition.call(
        () => steps.start(),
        [],
        videoDelay
      );
    }

    phoneButton?.addEventListener("click", onPickup);
    cornerButton?.addEventListener("click", onCornerClick);

    if (!overlay) {
      begin(false);
      return;
    }

    gsap.set(overlay, { autoAlpha: 1 });

    overlay.inert = false;
    overlay.removeAttribute("aria-hidden");

    mainButton?.addEventListener("click", onMainClick);

    const waitSeconds = readNumber(
      overlay,
      "data-sound-wait",
      4
    );

    timeout = window.setTimeout(
      () => begin(false),
      waitSeconds * 1000
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      setupPage,
      { once: true }
    );
  } else {
    setupPage();
  }
})();
