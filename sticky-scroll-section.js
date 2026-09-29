(function () {
  function init() {
    var reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    document.querySelectorAll('[data-scroll-section]').forEach(
      function (section) {
        var track = section.querySelector('[data-scroll-track]');
        var pin = section.querySelector('[data-scroll-pin]');

        function belongsToSection(element) {
          return element.closest('[data-scroll-section]') === section;
        }

        var items = Array.from(
          section.querySelectorAll('[data-scroll-item]')
        ).filter(belongsToSection);

        var images = Array.from(
          section.querySelectorAll('[data-scroll-image]')
        ).filter(belongsToSection);

        if (!track || !pin || !items.length) return;

        var tabsEnabled =
          section.getAttribute('data-scroll-mode') === 'tabs';

        var configuredMinWidth = Number(
          section.getAttribute('data-scroll-min-width')
        );

        var minWidth =
          Number.isFinite(configuredMinWidth) && configuredMinWidth >= 0
            ? configuredMinWidth
            : 0;

        var breakpoint = window.matchMedia(
          '(min-width: ' + minWidth + 'px)'
        );

        var configuredDuration = Number(
          section.getAttribute('data-scroll-duration')
        );

        var duration =
          Number.isFinite(configuredDuration) && configuredDuration > 0
            ? configuredDuration
            : 5000;

        var triggers = items.map(function (item) {
          return item.querySelector('button');
        });

        var descriptions = items.map(function (item) {
          return item.querySelector('[data-scroll-description]');
        });

        var activeIndex = -1;
        var mode = null;
        var scrollFrame = null;

        var elapsed = 0;
        var lastTime = null;
        var timerFrame = null;

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
        }

        /* Scroll-driven mode */

        function getMetrics() {
          var rect = track.getBoundingClientRect();
          var stickyTop =
            parseFloat(window.getComputedStyle(pin).top) || 0;

          return {
            start: window.scrollY + rect.top - stickyTop,
            distance: Math.max(
              track.offsetHeight - window.innerHeight + stickyTop,
              0
            )
          };
        }

        function updateScroll(immediate) {
          if (mode !== 'scroll') return;

          var metrics = getMetrics();
          var scrolled = window.scrollY - metrics.start;

          var overall = metrics.distance > 0
            ? Math.min(Math.max(scrolled / metrics.distance, 0), 1)
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

        function requestScrollUpdate() {
          if (mode !== 'scroll' || scrollFrame !== null) return;

          scrollFrame = window.requestAnimationFrame(function () {
            scrollFrame = null;
            updateScroll(false);
          });
        }

        /* Timed mode */

        function isVisible() {
          var rect = pin.getBoundingClientRect();

          return rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            rect.right > 0 &&
            rect.left < window.innerWidth;
        }

        function canPlay() {
          return mode === 'tabs' &&
            items.length > 1 &&
            !document.hidden &&
            isVisible();
        }

        function stopTimer() {
          if (timerFrame !== null) {
            window.cancelAnimationFrame(timerFrame);
            timerFrame = null;
          }

          lastTime = null;
        }

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
            elapsed = 0;
            setActive((activeIndex + 1) % items.length, false);
          }

          renderTimedProgress();
          timerFrame = window.requestAnimationFrame(tick);
        }

        function selectTimedItem(index) {
          elapsed = 0;
          lastTime = null;

          setActive(index, false);
          renderTimedProgress();
          syncPlayback();
        }

        /* Switch modes when the breakpoint changes */

        function applyMode() {
          var nextMode =
            tabsEnabled && breakpoint.matches ? 'tabs' : 'scroll';

          if (nextMode === mode) return;

          stopTimer();

          if (scrollFrame !== null) {
            window.cancelAnimationFrame(scrollFrame);
            scrollFrame = null;
          }

          mode = nextMode;
          elapsed = 0;

          // CSS reads this attribute to enable/disable sticky layout.
          section.setAttribute('data-scroll-active-mode', mode);

          if (mode === 'tabs') {
            // Keep the current item when entering timed mode.
            setActive(activeIndex >= 0 ? activeIndex : 0, true);
            renderTimedProgress();
            syncPlayback();
          } else {
            // In scroll mode, the current scroll position selects the item.
            updateScroll(true);
          }
        }

        /* Item clicks */

        triggers.forEach(function (trigger, index) {
          if (!trigger) return;

          trigger.type = 'button';

          trigger.addEventListener('click', function () {
            if (mode === 'tabs') {
              selectTimedItem(index);
              return;
            }

            var metrics = getMetrics();
            if (metrics.distance <= 0) return;

            var itemDistance = metrics.distance / items.length;
            var target = metrics.start + itemDistance * index;

            // Avoid rounding into the previous item's interval.
            target += Math.min(1, itemDistance / 2);

            window.scrollTo({
              top: Math.max(0, target),
              behavior: reducedMotion.matches ? 'instant' : 'smooth'
            });
          });
        });

        /* Shared events */

        window.addEventListener('scroll', function () {
          if (mode === 'tabs') {
            syncPlayback();
          } else {
            requestScrollUpdate();
          }
        }, { passive: true });

        window.addEventListener('resize', function () {
          applyMode();

          if (mode === 'tabs') {
            syncPlayback();
          } else {
            requestScrollUpdate();
          }
        });

        window.addEventListener('load', function () {
          if (mode === 'tabs') {
            syncPlayback();
          } else {
            requestScrollUpdate();
          }
        });

        document.addEventListener('visibilitychange', syncPlayback);
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
        });

        // Detect visibility changes caused by surrounding layout changes.
        if ('IntersectionObserver' in window) {
          var observer = new IntersectionObserver(function () {
            if (mode === 'tabs') syncPlayback();
          });

          observer.observe(pin);
        }

        applyMode();
      }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
