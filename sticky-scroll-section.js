(function () {
  function init() {
    var reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    var mobileViewport = window.matchMedia(
      '(max-width: 767px)'
    );

    document.querySelectorAll('[data-scroll-section]').forEach(
      function (section) {
        function belongsToSection(element) {
          return element.closest('[data-scroll-section]') === section;
        }

        function findOwned(selector) {
          return Array.from(
            section.querySelectorAll(selector)
          ).find(belongsToSection);
        }

        var track = findOwned('[data-scroll-track]');
        var pin = findOwned('[data-scroll-pin]');

        var items = Array.from(
          section.querySelectorAll('[data-scroll-item]')
        ).filter(belongsToSection);

        var images = Array.from(
          section.querySelectorAll('[data-scroll-image]')
        ).filter(belongsToSection);

        var stickyElements = Array.from(
          section.querySelectorAll('[data-scroll-sticky]')
        ).filter(belongsToSection);

        if (!track || !pin || !items.length) return;

        function positiveNumber(attribute, fallback) {
          var value = Number(section.getAttribute(attribute));

          return Number.isFinite(value) && value > 0
            ? value
            : fallback;
        }

        function clamp(value, min, max) {
          return Math.min(Math.max(value, min), max);
        }

        var tabsEnabled =
          section.getAttribute('data-scroll-mode') === 'tabs';

        var hybridEnabled =
          section.getAttribute('data-scroll-timed-scroll') === 'true';

        var minWidth = positiveNumber(
          'data-scroll-min-width',
          0
        );

        // Below this width, use non-sticky tabs.
        // Missing, invalid, or zero keeps the configured behavior.
        var disableBelow = positiveNumber(
          'data-scroll-disable-below',
          0
        );

        // Autoplay requires a positive duration in milliseconds.
        var duration = positiveNumber(
          'data-scroll-duration',
          0
        );

        var scrollDistance = positiveNumber(
          'data-scroll-distance',
          300
        );

        // Mobile header height plus the desired clearance.
        var anchorOffset = positiveNumber(
          'data-scroll-anchor-offset',
          110
        );

        // Covers the 750ms CSS transition plus a settling period.
        var anchorDuration = 850;

        var hybridDistance = items.length > 1
          ? items.length * scrollDistance
          : 0;

        var breakpoint = window.matchMedia(
          '(min-width: ' + minWidth + 'px)'
        );

        var stickyBreakpoint = window.matchMedia(
          '(min-width: ' + disableBelow + 'px)'
        );

        var trackHeight = (
          section.getAttribute('data-scroll-track-height') || ''
        ).trim();

        if (trackHeight && CSS.supports('height', trackHeight)) {
          track.style.setProperty(
            '--scroll-track-height',
            trackHeight
          );
        }

        var triggers = items.map(function (item) {
          return item.querySelector('button');
        });

        var descriptions = items.map(function (item) {
          return item.querySelector('[data-scroll-description]');
        });

        var mode = null;
        var activeIndex = -1;
        var scrollFrame = null;
        var pendingManualScroll = false;

        var elapsed = 0;
        var lastTime = null;
        var timerFrame = null;
        var lastHybridHeight = null;

        var scrolling = false;
        var scrollEndTimeout = null;
        var lastObservedY = window.scrollY;

        var scrollIdleDelay = 120;

        var fallbackLayoutApplied = false;
        var savedLayoutStyles = [];

        var cancelItemAnchor = function () {};

        /* Non-sticky layout below the optional breakpoint */

        function overrideLayoutStyle(element, properties) {
          if (!element) return;

          Object.keys(properties).forEach(function (name) {
            savedLayoutStyles.push({
              element: element,
              name: name,
              value: element.style.getPropertyValue(name),
              priority: element.style.getPropertyPriority(name)
            });

            element.style.setProperty(
              name,
              properties[name],
              'important'
            );
          });
        }

        function applyFallbackLayout() {
          if (fallbackLayoutApplied) return;

          fallbackLayoutApplied = true;

          overrideLayoutStyle(track, {
            height: 'auto',
            'min-height': '0',
            'max-height': 'none'
          });

          overrideLayoutStyle(pin, {
            position: 'relative',
            top: 'auto',
            bottom: 'auto',
            height: 'auto',
            'min-height': '0',
            'max-height': 'none',
            'justify-content': 'flex-start'
          });

          stickyElements.forEach(function (element) {
            overrideLayoutStyle(element, {
              position: 'relative',
              top: 'auto',
              bottom: 'auto'
            });
          });
        }

        function restoreFallbackLayout() {
          if (!fallbackLayoutApplied) return;

          savedLayoutStyles.forEach(function (saved) {
            if (saved.value) {
              saved.element.style.setProperty(
                saved.name,
                saved.value,
                saved.priority
              );
            } else {
              saved.element.style.removeProperty(saved.name);
            }
          });

          savedLayoutStyles = [];
          fallbackLayoutApplied = false;
        }

        /* Description animation */

        function animateDescription(description, isOpen, immediate) {
          if (!description) return;

          description.toggleAttribute('inert', !isOpen);
          description.setAttribute(
            'aria-hidden',
            String(!isOpen)
          );

          if (window.gsap) {
            window.gsap.killTweensOf(description);
          }

          if (immediate || reducedMotion.matches || !window.gsap) {
            description.style.display = isOpen ? 'block' : 'none';
            description.style.height = isOpen ? 'auto' : '0px';
            description.style.visibility =
              isOpen ? 'visible' : 'hidden';
            return;
          }

          var currentHeight =
            description.getBoundingClientRect().height;

          var targetHeight = 0;

          if (isOpen) {
            description.style.display = 'block';
            description.style.height = 'auto';

            targetHeight =
              description.getBoundingClientRect().height;
          }

          window.gsap.set(description, {
            height: currentHeight,
            visibility: 'visible'
          });

          window.gsap.to(description, {
            height: targetHeight,
            duration: 0.35,
            ease: 'power2.out',
            overwrite: true,
            onComplete: function () {
              window.gsap.set(description, {
                display: isOpen ? 'block' : 'none',
                height: isOpen ? 'auto' : 0,
                visibility: isOpen ? 'visible' : 'hidden'
              });

              sizeHybridTrack();
            }
          });
        }

        function setActive(index, immediate) {
          if (index === activeIndex && !immediate) return;

          var previousIndex = activeIndex;
          var initial = previousIndex === -1;

          activeIndex = index;

          items.forEach(function (item, i) {
            var active = i === index;

            item.classList.toggle('is-active', active);

            if (triggers[i]) {
              if (active) {
                triggers[i].setAttribute('aria-current', 'true');
              } else {
                triggers[i].removeAttribute('aria-current');
              }
            }

            if (
              initial ||
              immediate ||
              i === previousIndex ||
              active
            ) {
              animateDescription(
                descriptions[i],
                active,
                initial || immediate
              );
            }
          });

          images.forEach(function (image, i) {
            image.classList.toggle('is-active', i === index);
          });

          sizeHybridTrack();
        }

        /* Track sizing and measurements */

        function sizeHybridTrack() {
          if (mode !== 'hybrid') return;

          var height = pin.offsetHeight + hybridDistance;

          if (height !== lastHybridHeight) {
            lastHybridHeight = height;

            track.style.setProperty(
              '--scroll-hybrid-height',
              height + 'px'
            );
          }
        }

        function getMetrics() {
          var rect = track.getBoundingClientRect();

          var stickyTop =
            parseFloat(window.getComputedStyle(pin).top) || 0;

          var start = window.scrollY + rect.top - stickyTop;

          var distance = mode === 'hybrid'
            ? hybridDistance
            : Math.max(
                track.offsetHeight - window.innerHeight + stickyTop,
                0
              );

          return {
            start: start,
            distance: distance,
            end: start + distance
          };
        }

        function isVisible() {
          var rect = pin.getBoundingClientRect();

          return rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            rect.right > 0 &&
            rect.left < window.innerWidth;
        }

        function isInsideTrack(metrics) {
          return metrics.distance > 0 &&
            window.scrollY >= metrics.start - 1 &&
            window.scrollY <= metrics.end + 1;
        }

        /* Scroll-driven mode */

        function updateScroll(immediate) {
          if (mode !== 'scroll') return;

          var metrics = getMetrics();

          var overall = metrics.distance > 0
            ? clamp(
                (window.scrollY - metrics.start) / metrics.distance,
                0,
                1
              )
            : 0;

          var raw = overall * items.length;

          var index = Math.min(
            Math.floor(raw),
            items.length - 1
          );

          var localProgress = overall >= 1
            ? 1
            : raw - index;

          items.forEach(function (item, i) {
            var progress = i < index
              ? 1
              : (i === index ? localProgress : 0);

            item.style.setProperty('--progress', progress);
          });

          setActive(index, immediate);
        }

        /* Timed progress */

        function renderTimedProgress() {
          items.forEach(function (item, i) {
            item.style.setProperty(
              '--progress',
              i === activeIndex && duration > 0
                ? clamp(elapsed / duration, 0, 1)
                : 0
            );
          });
        }

        function resetTimer() {
          elapsed = 0;
          lastTime = null;
        }

        function stopTimer() {
          if (timerFrame !== null) {
            window.cancelAnimationFrame(timerFrame);
            timerFrame = null;
          }

          lastTime = null;
        }

        function canPlay() {
          if (
            duration <= 0 ||
            (mode !== 'tabs' && mode !== 'hybrid') ||
            items.length < 2 ||
            document.hidden ||
            !isVisible()
          ) {
            return false;
          }

          if (mode === 'hybrid') {
            return !scrolling &&
              !pendingManualScroll &&
              isInsideTrack(getMetrics());
          }

          return true;
        }

        function syncPlayback() {
          if (!canPlay()) {
            stopTimer();
            return;
          }

          if (timerFrame === null) {
            lastTime = null;
            timerFrame = window.requestAnimationFrame(tick);
          }
        }

        function tick(time) {
          timerFrame = null;

          if (!canPlay()) {
            lastTime = null;
            return;
          }

          if (lastTime !== null) {
            elapsed += time - lastTime;
          }

          lastTime = time;

          if (elapsed >= duration) {
            selectTimedItem(
              (activeIndex + 1) % items.length,
              false
            );
            return;
          }

          renderTimedProgress();
          timerFrame = window.requestAnimationFrame(tick);
        }

        /* Clear pending scroll work before programmatic selection */

        function clearScrollActivity() {
          if (scrollEndTimeout !== null) {
            window.clearTimeout(scrollEndTimeout);
            scrollEndTimeout = null;
          }

          if (scrollFrame !== null) {
            window.cancelAnimationFrame(scrollFrame);
            scrollFrame = null;
          }

          scrolling = false;
          pendingManualScroll = false;
        }

        /* Mobile click anchoring */

        function anchorMobileItem(index) {
          cancelItemAnchor();

          if (mode !== 'tabs' || !mobileViewport.matches) {
            return;
          }

          var item = items[index];
          if (!item) return;

          // Capture this before changing the active item.
          var targetTop = Math.max(
            anchorOffset,
            item.getBoundingClientRect().top
          );

          var started = performance.now();
          var frame = null;
          var stopped = false;

          function stop() {
            if (stopped) return;

            stopped = true;

            if (frame !== null) {
              window.cancelAnimationFrame(frame);
              frame = null;
            }

            window.removeEventListener('touchstart', stop);
            window.removeEventListener('wheel', stop);
            window.removeEventListener('keydown', stop);
            window.removeEventListener('pointerdown', stop);
          }

          function update(time) {
            frame = null;

            if (
              stopped ||
              mode !== 'tabs' ||
              !mobileViewport.matches ||
              !item.isConnected ||
              document.hidden
            ) {
              stop();
              return;
            }

            var difference =
              item.getBoundingClientRect().top - targetTop;

            if (Math.abs(difference) > 0.5) {
              window.scrollTo({
                top: Math.max(
                  0,
                  window.scrollY + difference
                ),
                behavior: 'instant'
              });
            }

            if (time - started < anchorDuration) {
              frame = window.requestAnimationFrame(update);
            } else {
              stop();
            }
          }

          // Stop correcting as soon as the visitor takes over.
          window.addEventListener('touchstart', stop, {
            passive: true
          });

          window.addEventListener('wheel', stop, {
            passive: true
          });

          window.addEventListener('keydown', stop);

          window.addEventListener('pointerdown', stop, {
            passive: true
          });

          cancelItemAnchor = stop;
          frame = window.requestAnimationFrame(update);
        }

        /* Clicks and automatic changes */

        function selectTimedItem(index, manualSelection) {
          cancelItemAnchor();

          if (manualSelection && index !== activeIndex) {
            anchorMobileItem(index);
          }

          stopTimer();
          clearScrollActivity();
          resetTimer();

          setActive(index, false);
          renderTimedProgress();

          // Only hybrid mode explicitly scrolls to an item.
          // Mobile tabs use the anchoring correction above.
          if (mode === 'hybrid') {
            sizeHybridTrack();

            var metrics = getMetrics();

            if (metrics.distance > 0) {
              var target = Math.ceil(
                metrics.start + index * scrollDistance
              );

              window.scrollTo({
                top: Math.max(0, target),
                behavior: 'instant'
              });
            }
          }

          lastObservedY = window.scrollY;
          syncPlayback();
        }

        /* Hybrid mode: convert scroll position into elapsed time */

        function updateHybridScroll(immediate, followScroll) {
          var metrics = getMetrics();

          if (metrics.distance <= 0) {
            setActive(0, immediate);
            renderTimedProgress();
            syncPlayback();
            return;
          }

          var position = clamp(
            window.scrollY - metrics.start,
            0,
            metrics.distance
          );

          var index = Math.min(
            Math.floor(position / scrollDistance),
            items.length - 1
          );

          var progress = clamp(
            (position - index * scrollDistance) / scrollDistance,
            0,
            1
          );

          var changed = index !== activeIndex;

          setActive(index, immediate);

          // Manual scrolling controls elapsed time.
          // Ordinary refreshes preserve timed progress unless
          // the layout places the page in a different item.
          if (followScroll || immediate || changed) {
            elapsed = progress * duration;
            lastTime = null;
          }

          renderTimedProgress();
          syncPlayback();
        }

        /* Batch layout/scroll updates */

        function requestUpdate(manualScroll) {
          if (manualScroll) {
            pendingManualScroll = true;
          }

          if (scrollFrame !== null) return;

          scrollFrame = window.requestAnimationFrame(function () {
            scrollFrame = null;

            var followScroll = pendingManualScroll;
            pendingManualScroll = false;

            if (mode === 'scroll') {
              updateScroll(false);
            } else if (mode === 'hybrid') {
              updateHybridScroll(false, followScroll);
            } else {
              syncPlayback();
            }
          });
        }

        function handleScroll() {
          var currentY = window.scrollY;

          var moved =
            Math.abs(currentY - lastObservedY) > 0.01;

          lastObservedY = currentY;

          if (mode !== 'hybrid') {
            requestUpdate(false);
            return;
          }

          // Ignore the event from our own instant scrollTo().
          if (!moved) return;

          scrolling = true;
          stopTimer();

          if (scrollEndTimeout !== null) {
            window.clearTimeout(scrollEndTimeout);
          }

          requestUpdate(true);

          scrollEndTimeout = window.setTimeout(function () {
            scrollEndTimeout = null;

            if (mode !== 'hybrid') {
              scrolling = false;
              return;
            }

            // Apply the final scroll position before restarting time.
            if (scrollFrame !== null) {
              window.cancelAnimationFrame(scrollFrame);
              scrollFrame = null;
            }

            pendingManualScroll = false;
            updateHybridScroll(false, true);

            scrolling = false;
            syncPlayback();
          }, scrollIdleDelay);
        }

        /* Responsive mode selection */

        function applyMode() {
          var useFallbackTabs =
            disableBelow > 0 && !stickyBreakpoint.matches;

          var nextMode = 'scroll';

          if (useFallbackTabs) {
            nextMode = 'tabs';
          } else if (tabsEnabled && breakpoint.matches) {
            nextMode = hybridEnabled ? 'hybrid' : 'tabs';
          }

          var layoutChanged =
            useFallbackTabs !== fallbackLayoutApplied;

          if (layoutChanged || nextMode !== mode) {
            cancelItemAnchor();
          }

          // Update layout even if both sides use tabs.
          if (useFallbackTabs) {
            applyFallbackLayout();
          } else {
            restoreFallbackLayout();
          }

          if (nextMode === mode) return;

          stopTimer();
          clearScrollActivity();
          resetTimer();

          mode = nextMode;
          lastHybridHeight = null;

          section.setAttribute(
            'data-scroll-active-mode',
            mode
          );

          if (mode === 'scroll') {
            updateScroll(true);
          } else if (mode === 'hybrid') {
            sizeHybridTrack();
            updateHybridScroll(true, true);
          } else {
            setActive(
              activeIndex >= 0 ? activeIndex : 0,
              true
            );

            renderTimedProgress();
            syncPlayback();
          }

          lastObservedY = window.scrollY;
        }

        /* Item buttons */

        triggers.forEach(function (trigger, index) {
          if (!trigger) return;

          trigger.type = 'button';

          trigger.addEventListener('click', function () {
            if (mode === 'tabs' || mode === 'hybrid') {
              selectTimedItem(index, true);
              return;
            }

            var metrics = getMetrics();
            if (metrics.distance <= 0) return;

            var itemDistance =
              metrics.distance / items.length;

            var target =
              metrics.start + itemDistance * index;

            target += Math.min(1, itemDistance / 2);

            window.scrollTo({
              top: Math.max(0, target),
              behavior: reducedMotion.matches
                ? 'instant'
                : 'smooth'
            });
          });
        });

        /* Events */

        window.addEventListener('scroll', handleScroll, {
          passive: true
        });

        window.addEventListener('resize', function () {
          applyMode();
          sizeHybridTrack();
          requestUpdate(false);
        });

        window.addEventListener('load', function () {
          sizeHybridTrack();
          requestUpdate(false);
        });

        document.addEventListener('visibilitychange', function () {
          if (document.hidden) {
            cancelItemAnchor();
          }

          syncPlayback();
        });

        breakpoint.addEventListener('change', applyMode);

        stickyBreakpoint.addEventListener(
          'change',
          applyMode
        );

        mobileViewport.addEventListener('change', function () {
          cancelItemAnchor();
        });

        reducedMotion.addEventListener('change', function () {
          if (!reducedMotion.matches || activeIndex < 0) {
            return;
          }

          descriptions.forEach(function (description, i) {
            animateDescription(
              description,
              i === activeIndex,
              true
            );
          });

          sizeHybridTrack();
        });

        if ('IntersectionObserver' in window) {
          var visibilityObserver = new IntersectionObserver(
            function () {
              syncPlayback();
            }
          );

          visibilityObserver.observe(pin);
        }

        if ('ResizeObserver' in window) {
          var sizeObserver = new ResizeObserver(function () {
            sizeHybridTrack();
          });

          sizeObserver.observe(pin);
        }

        applyMode();
      }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {
      once: true
    });
  } else {
    init();
  }
})();
