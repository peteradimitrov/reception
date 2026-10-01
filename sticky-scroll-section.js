(function () {
  function init() {
    var reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
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

        if (!track || !pin || !items.length) return;

        function positiveNumber(attribute, fallback) {
          var value = Number(section.getAttribute(attribute));

          return Number.isFinite(value) && value > 0
            ? value
            : fallback;
        }

        var tabsEnabled =
          section.getAttribute('data-scroll-mode') === 'tabs';

        var hybridEnabled =
          section.getAttribute('data-scroll-timed-scroll') === 'true';

        var minWidth = positiveNumber('data-scroll-min-width', 0);
        var duration = positiveNumber('data-scroll-duration', 5000);
        var scrollDistance = positiveNumber('data-scroll-distance', 300);

        var hybridDistance = Math.max(
          0,
          (items.length - 1) * scrollDistance
        );

        var breakpoint = window.matchMedia(
          '(min-width: ' + minWidth + 'px)'
        );

        var trackHeight = (
          section.getAttribute('data-scroll-track-height') || ''
        ).trim();

        if (trackHeight && CSS.supports('height', trackHeight)) {
          track.style.setProperty('--scroll-track-height', trackHeight);
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

        var elapsed = 0;
        var lastTime = null;
        var timerFrame = null;

        var accumulatedScroll = 0;
        var lastScrollY = window.scrollY;
        var lastViewportWidth = window.innerWidth;
        var lastHybridHeight = null;

        function clamp(value, min, max) {
          return Math.min(Math.max(value, min), max);
        }

        /* Description animation */

        function animateDescription(description, isOpen, immediate) {
          if (!description) return;

          description.toggleAttribute('inert', !isOpen);
          description.setAttribute('aria-hidden', String(!isOpen));

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

            if (initial || immediate || i === previousIndex || active) {
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

        /* Automatic track height for combined mode */

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

        /* Track measurements */

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

        function isInsideTrack(metrics, scrollY) {
          return metrics.distance > 0 &&
            scrollY >= metrics.start - 1 &&
            scrollY <= metrics.end + 1;
        }

        /* Original scroll-driven mode */

        function updateScroll(immediate) {
          if (mode !== 'scroll') return;

          var metrics = getMetrics();
          var scrolled = window.scrollY - metrics.start;

          var overall = metrics.distance > 0
            ? clamp(scrolled / metrics.distance, 0, 1)
            : 0;

          var raw = overall * items.length;
          var index = Math.min(Math.floor(raw), items.length - 1);
          var localProgress = overall >= 1 ? 1 : raw - index;

          items.forEach(function (item, i) {
            var progress = i < index
              ? 1
              : (i === index ? localProgress : 0);

            item.style.setProperty('--progress', progress);
          });

          setActive(index, immediate);
        }

        /* Shared timer */

        function renderTimedProgress() {
          items.forEach(function (item, i) {
            item.style.setProperty(
              '--progress',
              i === activeIndex
                ? Math.min(elapsed / duration, 1)
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
            mode === 'scroll' ||
            !mode ||
            items.length < 2 ||
            document.hidden ||
            !isVisible()
          ) {
            return false;
          }

          if (mode === 'hybrid') {
            return isInsideTrack(getMetrics(), window.scrollY);
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
            var nextIndex = (activeIndex + 1) % items.length;

            // Synchronize the selected item and scroll position
            // in hybrid mode, including last-to-first looping.
            selectTimedItem(nextIndex);

            // selectTimedItem schedules the next frame.
            return;
          }

          renderTimedProgress();
          timerFrame = window.requestAnimationFrame(tick);
        }

        /* Click and automatic selection */

        function selectTimedItem(index) {
          stopTimer();
          resetTimer();
          accumulatedScroll = 0;

          setActive(index, false);
          renderTimedProgress();

          if (mode === 'hybrid') {
            sizeHybridTrack();

            var metrics = getMetrics();

            if (metrics.distance > 0) {
              var target =
                metrics.start + index * scrollDistance;

              window.scrollTo({
                top: Math.max(0, target),
                behavior: 'instant'
              });
            }
          }

          // Do not count this programmatic move as user scrolling.
          lastScrollY = window.scrollY;

          syncPlayback();
        }

        /* Combined mode: scroll distance changes items */

        function updateHybridScroll() {
          var currentY = window.scrollY;
          var previousY = lastScrollY;

          lastScrollY = currentY;

          var metrics = getMetrics();

          if (metrics.distance <= 0) {
            accumulatedScroll = 0;
            syncPlayback();
            return;
          }

          // Include movement through the track's boundaries.
          var delta =
            clamp(currentY, metrics.start, metrics.end) -
            clamp(previousY, metrics.start, metrics.end);

          if (delta !== 0) {
            if (
              accumulatedScroll !== 0 &&
              Math.sign(delta) !== Math.sign(accumulatedScroll)
            ) {
              accumulatedScroll = 0;
            }

            accumulatedScroll += delta;

            var direction = Math.sign(accumulatedScroll);

            var stepCount = Math.floor(
              (Math.abs(accumulatedScroll) + 0.5) / scrollDistance
            );

            if (stepCount > 0) {
              accumulatedScroll = direction * Math.max(
                0,
                Math.abs(accumulatedScroll) -
                  stepCount * scrollDistance
              );

              var nextIndex = clamp(
                activeIndex + direction * stepCount,
                0,
                items.length - 1
              );

              if (nextIndex !== activeIndex) {
                resetTimer();
                setActive(nextIndex, false);
                renderTimedProgress();
              }
            }
          }

          if (!isInsideTrack(metrics, currentY)) {
            accumulatedScroll = 0;
          }

          syncPlayback();
        }

        /* Process scrolling once per frame */

        function requestScrollUpdate() {
          if (scrollFrame !== null) return;

          scrollFrame = window.requestAnimationFrame(function () {
            scrollFrame = null;

            if (mode === 'scroll') {
              updateScroll(false);
            } else if (mode === 'hybrid') {
              updateHybridScroll();
            } else {
              syncPlayback();
            }
          });
        }

        /* Responsive mode selection */

        function applyMode() {
          var nextMode = 'scroll';

          if (tabsEnabled && breakpoint.matches) {
            nextMode = hybridEnabled ? 'hybrid' : 'tabs';
          }

          if (nextMode === mode) return;

          stopTimer();

          if (scrollFrame !== null) {
            window.cancelAnimationFrame(scrollFrame);
            scrollFrame = null;
          }

          mode = nextMode;
          resetTimer();
          accumulatedScroll = 0;
          lastHybridHeight = null;

          section.setAttribute('data-scroll-active-mode', mode);

          if (mode === 'scroll') {
            updateScroll(true);
          } else {
            setActive(activeIndex >= 0 ? activeIndex : 0, true);
            renderTimedProgress();
            sizeHybridTrack();
          }

          lastScrollY = window.scrollY;
          syncPlayback();
        }

        /* Item buttons */

        triggers.forEach(function (trigger, index) {
          if (!trigger) return;

          trigger.type = 'button';

          trigger.addEventListener('click', function () {
            if (mode === 'tabs' || mode === 'hybrid') {
              selectTimedItem(index);
              return;
            }

            var metrics = getMetrics();
            if (metrics.distance <= 0) return;

            var itemDistance = metrics.distance / items.length;
            var target = metrics.start + itemDistance * index;

            target += Math.min(1, itemDistance / 2);

            window.scrollTo({
              top: Math.max(0, target),
              behavior: reducedMotion.matches ? 'instant' : 'smooth'
            });
          });
        });

        /* Events */

        window.addEventListener('scroll', requestScrollUpdate, {
          passive: true
        });

        window.addEventListener('resize', function () {
          applyMode();
          sizeHybridTrack();

          if (window.innerWidth !== lastViewportWidth) {
            lastViewportWidth = window.innerWidth;
            accumulatedScroll = 0;
            lastScrollY = window.scrollY;
          }

          requestScrollUpdate();
        });

        window.addEventListener('load', function () {
          sizeHybridTrack();
          lastScrollY = window.scrollY;
          requestScrollUpdate();
        });

        document.addEventListener('visibilitychange', function () {
          lastScrollY = window.scrollY;
          syncPlayback();
        });

        breakpoint.addEventListener('change', applyMode);

        reducedMotion.addEventListener('change', function () {
          if (!reducedMotion.matches || activeIndex < 0) return;

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
