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

        var timedMode =
          section.getAttribute('data-scroll-mode') === 'tabs';

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
        var updatePending = false;

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

        function setActive(index) {
          if (index === activeIndex) return;

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

            if (initial || i === previousIndex || active) {
              animateDescription(
                descriptions[i],
                active,
                initial
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

        function updateScroll() {
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

          setActive(index);
          updatePending = false;
        }

        function requestScrollUpdate() {
          if (updatePending) return;

          updatePending = true;
          window.requestAnimationFrame(updateScroll);
        }

        /* Timed mode */

        var elapsed = 0;
        var lastTime = null;
        var timerFrame = null;
        var inView = false;

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

        function canPlay() {
          return timedMode &&
            items.length > 1 &&
            inView &&
            !document.hidden;
        }

        function syncPlayback() {
          if (canPlay()) {
            if (timerFrame === null) {
              lastTime = null;
              timerFrame = window.requestAnimationFrame(tick);
            }
          } else {
            if (timerFrame !== null) {
              window.cancelAnimationFrame(timerFrame);
              timerFrame = null;
            }

            lastTime = null;
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
            setActive((activeIndex + 1) % items.length);
          }

          renderTimedProgress();
          timerFrame = window.requestAnimationFrame(tick);
        }

        function selectTimedItem(index) {
          elapsed = 0;
          lastTime = null;

          setActive(index);
          renderTimedProgress();
          syncPlayback();
        }

        /* Button clicks */

        triggers.forEach(function (trigger, index) {
          if (!trigger) return;

          trigger.type = 'button';

          trigger.addEventListener('click', function () {
            if (timedMode) {
              selectTimedItem(index);
              return;
            }

            var metrics = getMetrics();

            if (metrics.distance <= 0) return;

            var itemDistance = metrics.distance / items.length;
            var target = metrics.start + itemDistance * index;

            // Avoid landing before the boundary due to pixel rounding.
            target += Math.min(1, itemDistance / 2);

            window.scrollTo({
              top: Math.max(0, target),
              behavior: reducedMotion.matches ? 'instant' : 'smooth'
            });
          });
        });

        /* Apply reduced-motion changes to description animations. */

        reducedMotion.addEventListener('change', function () {
          if (!reducedMotion.matches) return;

          descriptions.forEach(function (description, i) {
            animateDescription(
              description,
              i === activeIndex,
              true
            );
          });
        });

        /* Initialize the selected mode. */

        if (timedMode) {
          setActive(0);
          renderTimedProgress();

          if (items.length > 1) {
            document.addEventListener(
              'visibilitychange',
              syncPlayback
            );

            if ('IntersectionObserver' in window) {
              var observer = new IntersectionObserver(
                function (entries) {
                  inView = entries[0].isIntersecting;
                  syncPlayback();
                },
                { threshold: 0 }
              );

              observer.observe(pin);
            } else {
              inView = true;
              syncPlayback();
            }
          }
        } else {
          window.addEventListener('scroll', requestScrollUpdate, {
            passive: true
          });

          window.addEventListener('resize', requestScrollUpdate);
          window.addEventListener('load', requestScrollUpdate);

          updateScroll();
        }
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
