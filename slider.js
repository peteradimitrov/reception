function initGlobalSliders() {
  (function () {
    function numberWithZero(n) {
      return n < 10 ? "0" + n : String(n);
    }

    function clamp01(x) {
      return x < 0 ? 0 : (x > 1 ? 1 : x);
    }

    // Focus renderer: horizontal LTR, equal responsive slide widths, Swiper 11.
    function configureFocus(root, el, config, savedIndex) {
      const wrapper = el.querySelector(".swiper-wrapper");
      const slides = Array.from(wrapper.children).filter(s =>
        s.classList.contains("swiper-slide")
      );

      const ratio = Math.min(
        1,
        Math.max(0.1, parseFloat(root.getAttribute("data-focus-ratio")) || 416 / 610)
      );
      const aspect = Math.max(
        0.1,
        parseFloat(root.getAttribute("data-focus-aspect")) || 610 / 696
      );

      // Webflow supplies an average slot width, e.g. calc(100% / 3).
      const viewport = el.clientWidth;
      const base =
        (slides[0] && parseFloat(getComputedStyle(slides[0]).width)) ||
        viewport ||
        1;

      const capacity = Math.max(1, viewport / base);
      const large = viewport / (1 + (capacity - 1) * ratio);
      const small = large * ratio;

      const breakpointValue = Number(
        root.getAttribute("data-focus-mobile-breakpoint") ?? 767
      );
      const mobileBreakpoint =
        Number.isFinite(breakpointValue) && breakpointValue >= 0
          ? breakpointValue
          : 767;

      const mobileText =
        typeof window !== "undefined" &&
        window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches;

      // Mobile: active text matches Webflow. Desktop: side text matches Webflow.
      const textBase = mobileText ? large : small;

      slides.forEach(slide => {
        slide.style.width = `${large}px`;
      });

      const layoutWidths = new WeakMap();

      // Only the text scales. The card background and clipping frame do not.
      slides.forEach(slide => {
        const card = slide.querySelector(
          ":scope > :is(.card--benefit, .card_new--benefit)"
        );
        if (!card) return;

        card.style.setProperty("transform", "none", "important");

        const body = card.querySelector(
          ":scope > :is(.card-body, .card-body_new)"
        );
        if (body) {
          body.style.setProperty("width", `${textBase}px`, "important");
          body.style.setProperty("height", `${textBase / aspect}px`, "important");
          layoutWidths.set(
            body,
            parseFloat(getComputedStyle(body).width) || textBase
          );
        }
      });

      const slotWidth =
        (slides[0] && parseFloat(getComputedStyle(slides[0]).width)) || large;

      const fits = large + (slides.length - 1) * small <= el.clientWidth + 2;
      const visibleSlots = Math.floor(viewport / Math.max(1, large)) + 1;
      const requiredForLoop = Math.max(
        visibleSlots + Math.ceil(visibleSlots / 2),
        Math.ceil(capacity - 0.01) + 2
      );

      const canLoop = !fits && config.loop && slides.length >= requiredForLoop;
      const initial = fits
        ? Math.floor((slides.length - 1) / 2)
        : Math.min(savedIndex ?? 1, slides.length - 1);

      root.dataset.focusVersion = "10";
      root.dataset.focusTextBaseline = mobileText ? "active" : "side";
      root.dataset.focusState = fits ? "static" : canLoop ? "loop" : "finite";
      el.style.setProperty("--focus-height", `${large / aspect}px`);

      // In a looping focus slider, handle taps with next/previous steps.
      // A direct jump to the clicked logical index can relocate a visible card.
      const stepOnTap = Boolean(canLoop && config.slideToClickedSlide);
      if (stepOnTap) config.slideToClickedSlide = false;

      Object.assign(config, {
        effect: "slide",
        slidesPerView: "auto",
        slidesPerGroup: 1,
        centeredSlides: true,
        centeredSlidesBounds: false,
        spaceBetween: 0,
        watchSlidesProgress: true,
        watchOverflow: false,
        loop: canLoop,
        loopAddBlankSlides: false,
        rewind: false,
        initialSlide: Math.max(0, initial),
        enabled: !fits,
        allowTouchMove: !fits && root.getAttribute("data-drag") !== "false",
        autoplay: fits ? false : config.autoplay,
        resizeObserver: false,
        updateOnWindowResize: false
      });

      let raf = 0, until = 0, disposed = false;
      let inView = true, visibilityObserver = null, liveSwiper = null;

      const pageVisible = () =>
        typeof document === "undefined" || !document.hidden;

      const resume = () => {
        if (liveSwiper && pageVisible()) wake(liveSwiper);
      };

      function draw(swiper) {
        if (!swiper || swiper.destroyed || disposed) return;

        const items = Array.from(wrapper.children).filter(s =>
          s.classList.contains("swiper-slide")
        );
        if (!items.length) return;

        const viewportRect = el.getBoundingClientRect();
        const rects = items.map(slide => slide.getBoundingClientRect());
        const parentScale = rects[0].width / slotWidth;
        if (!(parentScale > 0) || !(small > 0)) return;

        const viewportLeft = viewportRect.left + el.clientLeft * parentScale;
        const centers = rects.map(rect =>
          (rect.left + rect.width / 2 - viewportLeft) / parentScale
        );

        const mid = el.clientWidth / 2;
        let q = initial;

        if (!fits && items.length > 1) {
          let k = 0;
          while (k < items.length - 2 && centers[k + 1] < mid) k++;
          q = k + (mid - centers[k]) / Math.max(1, centers[k + 1] - centers[k]);
        }

        const widths = items.map((_, i) =>
          small + (large - small) * Math.max(0, 1 - Math.abs(i - q))
        );

        const lefts = [];
        let total = 0;
        widths.forEach(w => {
          lefts.push(total);
          total += w;
        });

        let origin;
        if (fits) {
          origin = (el.clientWidth - total) / 2;
        } else if (items.length === 1) {
          origin = mid - widths[0] / 2;
        } else {
          const k = Math.max(0, Math.min(items.length - 2, Math.floor(q)));
          const t = q - k;
          const a = lefts[k] + widths[k] / 2;
          const b = lefts[k + 1] + widths[k + 1] / 2;
          origin = mid - (a + (b - a) * t);
        }

        // Neighboring cards share one array of pixel-aligned edges.
        const browserWindow = typeof window === "undefined" ? null : window;
        const visualViewport = browserWindow?.visualViewport;
        const pixelRatio = Math.max(
          0.1,
          (browserWindow?.devicePixelRatio || 1) * (visualViewport?.scale || 1)
        );
        const viewportOffset = visualViewport?.offsetLeft || 0;
        const snap = value =>
          Math.round((value - viewportOffset) * pixelRatio) / pixelRatio + viewportOffset;

        const edges = [...lefts, total].map(x =>
          snap(viewportLeft + (origin + x) * parentScale)
        );

        items.forEach((slide, i) => {
          const card = slide.querySelector(
            ":scope > :is(.card--benefit, .card_new--benefit)"
          );
          if (!card) return;

          const w = widths[i], h = w / aspect;
          const renderedWidth = (edges[i + 1] - edges[i]) / parentScale;
          const x = (edges[i] - rects[i].left) / parentScale;

          const set = (property, value) => {
            if (card.style.getPropertyValue(property) !== value) {
              card.style.setProperty(property, value, "important");
            }
          };

          set("left", `${x}px`);
          set("top", `${(large / aspect - h) / 2}px`);
          set("width", `${renderedWidth}px`);
          set("height", `${h}px`);

          const body = card.querySelector(
            ":scope > :is(.card-body, .card-body_new)"
          );
          if (body) {
            const scaleX = renderedWidth / (layoutWidths.get(body) || textBase);
            const nextTransform = `scale(${scaleX}, ${w / textBase})`;
            if (body.style.transform !== nextTransform) {
              body.style.transform = nextTransform;
            }
          }
        });
      }

      function wake(swiper) {
        if (disposed || raf || !pageVisible()) return;

        raf = requestAnimationFrame(function frame() {
          raf = 0;
          draw(swiper);

          if (
            !disposed &&
            !swiper.destroyed &&
            pageVisible() &&
            (inView || performance.now() < until ||
             swiper.animating || swiper.touchEventsData?.isTouched)
          ) {
            raf = requestAnimationFrame(frame);
          }
        });
      }

      // Click handling for looping focus sliders.
      let clickRoute = null, clickFrame = 0, stepping = false;

      function stopClickRoute() {
        clickRoute = null;
        if (clickFrame) cancelAnimationFrame(clickFrame);
        clickFrame = 0;
      }

      function scheduleStep(swiper) {
        if (!clickRoute || clickFrame || disposed) return;
        clickFrame = requestAnimationFrame(() => {
          clickFrame = 0;
          takeStep(swiper);
        });
      }

      function takeStep(swiper) {
        if (!clickRoute || stepping || swiper.animating) return;

        if (
          disposed ||
          swiper.destroyed ||
          !swiper.enabled ||
          swiper.slides[swiper.activeIndex] === clickRoute.target ||
          clickRoute.remaining <= 0
        ) {
          stopClickRoute();
          return;
        }

        const before = swiper.realIndex;
        const direction = clickRoute.direction;
        clickRoute.remaining--;
        stepping = true;

        try {
          if (direction > 0) swiper.slideNext();
          else swiper.slidePrev();
        } finally {
          stepping = false;
        }

        if (
          !clickRoute ||
          swiper.realIndex === before ||
          swiper.slides[swiper.activeIndex] === clickRoute.target
        ) {
          stopClickRoute();
        } else if (!swiper.animating) {
          scheduleStep(swiper);
        }
      }

      function onFocusTap(swiper, event) {
        if (!stepOnTap || !swiper.enabled || swiper.animating || !swiper.allowClick) return;

        // Leave links, buttons, and native video controls usable inside cards.
        if (event?.target?.closest?.(
          'a,button,input,textarea,select,video[controls],[role="button"],[contenteditable="true"]'
        )) return;

        const target = swiper.clickedSlide;
        if (!target || target.parentNode !== wrapper) return;

        const index = Array.from(swiper.slides).indexOf(target);
        const distance = index - swiper.activeIndex;
        if (index < 0 || !distance) return;

        stopClickRoute();
        clickRoute = {
          target,
          direction: Math.sign(distance),
          remaining: Math.abs(distance)
        };
        takeStep(swiper);
      }

      config.on = {
        init(swiper) {
          liveSwiper = swiper;
          draw(swiper);
          wake(swiper);

          if (!visibilityObserver && typeof IntersectionObserver !== "undefined") {
            visibilityObserver = new IntersectionObserver(entries => {
              inView = entries.some(entry => entry.isIntersecting);
              if (inView) resume();
            }, { rootMargin: "200px" });

            visibilityObserver.observe(el);
            document.addEventListener("visibilitychange", resume);
            window.addEventListener("pageshow", resume);
          }
        },
        setTranslate(swiper) { wake(swiper); },
        setTransition(swiper, duration) {
          until = performance.now() + duration + 80;
          wake(swiper);
        },
        loopFix(swiper) { draw(swiper); wake(swiper); },
        update(swiper) { wake(swiper); },
        observerUpdate(swiper) { wake(swiper); },
        slidesUpdated(swiper) { wake(swiper); },
        tap: onFocusTap,
        touchStart(swiper) {
          stopClickRoute();
          wake(swiper);
        },
        touchEnd(swiper) {
          until = performance.now() + swiper.params.speed + 80;
          wake(swiper);
        },
        transitionEnd(swiper) {
          wake(swiper);
          if (!stepping) scheduleStep(swiper);
        },
        destroy() {
          disposed = true;
          stopClickRoute();
          cancelAnimationFrame(raf);

          if (visibilityObserver) {
            visibilityObserver.disconnect();
            document.removeEventListener("visibilitychange", resume);
            window.removeEventListener("pageshow", resume);
          }

          liveSwiper = null;
          slides.forEach(slide => slide.style.removeProperty("width"));
        }
      };

      return { fits };
    }

    $(".swiper-slider").each(function () {
      const $root = $(this);
      let currentInstance = null, currentThumbs = null;
      const isFocusRoot = ($root.attr("data-effect") || "").toLowerCase() === "focus";

      function build(savedIndex) {
        const mainEl = $root.find(".swiper").not(".swiper_new--thumbs")[0];
        const thumbsEl = $root.find(".swiper_new--thumbs")[0];
        if (!mainEl) return;

        // Per-slider Webflow attributes.
        const loopMode = $root.attr("loop-mode") === "true";
        const sliderDuration = $root.attr("slider-duration") !== undefined
          ? +$root.attr("slider-duration") : 300;
        const isZeroSpeed = sliderDuration <= 0;

        const clickToSlide =
          ($root.attr("data-click-to-slide") ?? "false").trim().toLowerCase() === "true";
        const mousewheelEnabled =
          ($root.attr("data-mousewheel") ?? "true").trim().toLowerCase() !== "false";

        const paginationType =
          ($root.attr("data-pagination-type") || "progressbar").toLowerCase();
        const autoplayEnabled =
          ($root.attr("data-autoplay") || "false").toLowerCase() === "true";
        const autoplayDelay = $root.attr("data-autoplay-delay") !== undefined
          ? +$root.attr("data-autoplay-delay") : 4000;
        const pauseOnHover =
          ($root.attr("data-autoplay-pause-hover") || "false").toLowerCase() === "true";

        const effect = ($root.attr("data-effect") || "slide").toLowerCase();
        const crossFade =
          ($root.attr("data-effect-crossfade") || "true").toLowerCase() === "true";

        const bulletProgress =
          ($root.attr("data-bullet-progress") || "false").toLowerCase() === "true";
        const thumbsEnabled =
          ($root.attr("data-thumbs") || "false").toLowerCase() === "true";
        const rewindEnabled =
          ($root.attr("data-rewind") || "false").toLowerCase() === "true";

        const scaleAnimEnabled =
          ($root.attr("data-scale-anim") || "false").toLowerCase() === "true";
        const scaleTargetSel = $root.attr("data-scale-target") || ".swiper-scale-target";
        const scaleFrom = parseFloat($root.attr("data-scale-from") || "1");
        const scaleTo = parseFloat($root.attr("data-scale-to") || "1.05");

        // Counts.
        const totalSlides = numberWithZero($(mainEl).find(".swiper-slide").length);
        $root.find(".swiper-slider__count--total").text(totalSlides);

        // Pagination.
        let paginationConfig = false;

        if (paginationType === "progressbar") {
          const el = $root.find(".swiper-pagination-progressbar")[0];
          if (el) paginationConfig = {
            el,
            type: "progressbar",
            clickable: true,
            bulletClass: "swiper-bullet",
            bulletActiveClass: "is-active",
            bulletElement: "button"
          };
        } else if (paginationType === "bullets") {
          const el = $root.find(".swiper-pagination, .swiper-bullets, .swiper-bullet-wrapper").get(0);
          if (el) {
            paginationConfig = {
              el,
              type: "bullets",
              clickable: true,
              bulletClass: "swiper-bullet",
              bulletActiveClass: "is-active",
              bulletElement: "button",
              ...(bulletProgress ? {
                renderBullet: (i, className) =>
                  `<button class="${className}" aria-label="Go to slide ${i + 1}">
                    <span class="swiper-bullet__progress"></span>
                  </button>`
              } : {})
            };
          }
        } else if (paginationType === "fraction") {
          const el = $root.find(".swiper-pagination-fraction")[0];
          if (el) paginationConfig = {
            el,
            type: "fraction",
            formatFractionCurrent: n => numberWithZero(n),
            formatFractionTotal: n => numberWithZero(n)
          };
        }

        // Main Swiper configuration.
        const config = {
          speed: Math.max(0, sliderDuration),
          loop: loopMode,
          autoHeight: false,
          centeredSlides: loopMode,
          followFinger: true,
          freeMode: false,
          slideToClickedSlide: clickToSlide,
          slidesPerView: "auto",
          rewind: !loopMode && rewindEnabled,

          autoplay: autoplayEnabled ? {
            delay: autoplayDelay,
            disableOnInteraction: false,
            pauseOnMouseEnter: pauseOnHover,
            waitForTransition: !isZeroSpeed
          } : false,

          mousewheel: mousewheelEnabled
            ? { enabled: true, forceToAxis: true }
            : false,

          keyboard: { enabled: true, onlyInViewport: true },
          pagination: paginationConfig,

          navigation: {
            nextEl: $root.find(".swiper-slider__arrow--next")[0],
            prevEl: $root.find(".swiper-slider__arrow--prev")[0],
            disabledClass: "is-disabled"
          },

          scrollbar: {
            el: $root.find(".swiper-drag-wrapper")[0],
            draggable: true,
            dragClass: "swiper-drag",
            snapOnRelease: true
          },

          slideActiveClass: "is-active",
          slideDuplicateActiveClass: "is-active"
        };

        if (effect === "fade") {
          Object.assign(config, {
            effect: "fade",
            slidesPerView: 1,
            spaceBetween: 0,
            centeredSlides: false,
            fadeEffect: { crossFade }
          });
        } else {
          Object.assign(config, { effect: "slide" });
        }

        // Click-only thumbnails.
        let thumbsSwiper = null;
        if (thumbsEnabled && thumbsEl) {
          thumbsSwiper = new Swiper(thumbsEl, {
            loop: false,
            slidesPerView: "auto",
            watchSlidesProgress: true,
            slideToClickedSlide: true,
            allowTouchMove: false,
            mousewheel: false,
            keyboard: { enabled: false }
          });
          config.thumbs = { swiper: thumbsSwiper };
        }

        const focus = effect === "focus"
          ? configureFocus($root[0], mainEl, config, savedIndex)
          : null;

        const swiper = new Swiper(mainEl, config);
        currentInstance = swiper;
        currentThumbs = thumbsSwiper;

        // Current counter.
        const updateCurrent = () => {
          $root.find(".swiper-slider__count--current").text(numberWithZero(swiper.realIndex + 1));
        };
        swiper.on("slideChange", updateCurrent);
        updateCurrent();

        // Story-style bullet progress.
        if (paginationType === "bullets" && bulletProgress && autoplayEnabled) {
          const bullets = Array.from($root.find(".swiper-bullet"));
          const fills = bullets.map(b => b.querySelector(".swiper-bullet__progress"));

          const setCumulative = target => {
            for (let i = 0; i < fills.length; i++) {
              const f = fills[i];
              if (!f) continue;
              f.style.transform = i < target ? "scaleX(1)" : "scaleX(0)";
            }
          };

          setCumulative(swiper.realIndex);
          swiper.on("slideChange", () => setCumulative(swiper.realIndex));

          let lastIdx = -1, lastVal = -1;
          swiper.on("autoplayTimeLeft", (_s, timeLeftMs) => {
            const idx = swiper.realIndex;
            const f = fills[idx];
            if (!f) return;

            const val = clamp01(1 - (timeLeftMs / autoplayDelay));
            if (idx !== lastIdx) {
              lastIdx = idx;
              lastVal = -1;
            }
            if (Math.abs(val - lastVal) > 0.002) {
              f.style.transform = `scaleX(${val})`;
              lastVal = val;
            }
          });

          swiper.on("autoplayStop", () => {
            const f = fills[swiper.realIndex];
            if (f) f.style.transform = "scaleX(1)";
          });
        }

        // Per-slide autoplay progress.
        (function setupPerSlideProgress() {
          const slideEls = Array.from(mainEl.querySelectorAll(".swiper-slide"));
          const hasReal = slideEls.some(s => s.hasAttribute("data-swiper-slide-index"));
          const barsByKey = new Map();
          const allWraps = [];

          for (let i = 0; i < slideEls.length; i++) {
            const slide = slideEls[i];
            const key = hasReal ? +slide.getAttribute("data-swiper-slide-index") : i;
            const wrap = slide.querySelector(".swiper-progress");
            const bar = slide.querySelector(".swiper-progress__bar");

            if (wrap) allWraps.push(wrap);
            if (!bar) continue;

            if (!barsByKey.has(key)) barsByKey.set(key, []);
            barsByKey.get(key).push(bar);
          }

          if (!autoplayEnabled) {
            for (let i = 0; i < allWraps.length; i++) {
              allWraps[i].style.display = "none";
            }
            return;
          } else {
            for (let i = 0; i < allWraps.length; i++) {
              allWraps[i].style.display = "";
            }
          }

          const realTotal =
            mainEl.querySelectorAll(".swiper-slide:not(.swiper-slide-duplicate)").length ||
            slideEls.length;

          const setBarsScale = (key, val) => {
            const arr = barsByKey.get(key) || [];
            for (let i = 0; i < arr.length; i++) {
              const el = arr[i];
              el.style.transformOrigin = "left";
              el.style.transform = `scaleX(${val})`;
            }
          };

          const resetAllBars = () => {
            for (const key of barsByKey.keys()) setBarsScale(key, 0);
          };

          for (const key of barsByKey.keys()) setBarsScale(key, 0);

          let prevReal = swiper.realIndex;
          setBarsScale(prevReal, 0);

          const isForward = (prev, curr) => curr === (prev + 1) % realTotal;
          const isRewindJump = (prev, curr) => {
            if (!rewindEnabled) return false;
            return (prev === realTotal - 1 && curr === 0) ||
                   (prev === 0 && curr === realTotal - 1);
          };

          swiper.on("slideChange", () => {
            const curr = swiper.realIndex;
            const prev = prevReal;

            if (isRewindJump(prev, curr)) {
              resetAllBars();
              setBarsScale(curr, 0);
              prevReal = curr;
              return;
            }

            setBarsScale(curr, 0);
            if (isForward(prev, curr)) {
              setBarsScale(prev, 1);
            } else {
              setBarsScale(prev, 0);
            }
            prevReal = curr;
          });

          swiper.on("autoplayTimeLeft", (_s, timeLeftMs) => {
            const curr = swiper.realIndex;
            const partial = clamp01(1 - (timeLeftMs / autoplayDelay));
            setBarsScale(curr, partial);
          });

          swiper.on("autoplayStop", () => {
            const curr = swiper.realIndex;
            setBarsScale(curr, 1);
          });
        })();

        // Image scale synced to autoplay.
        if (scaleAnimEnabled && autoplayEnabled) {
          const qAll = el => el ? el.querySelectorAll(scaleTargetSel) : [];
          const setScale = (nodes, s) => {
            nodes.forEach(t => { t.style.transform = `scale(${s})`; });
          };

          $(mainEl).find(".swiper-slide").each((_, el) => setScale(qAll(el), scaleFrom));
          setScale(qAll(swiper.slides[swiper.activeIndex]), scaleFrom);

          swiper.on("slideChange", () => {
            const currEl = swiper.slides[swiper.activeIndex];
            if (currEl) setScale(qAll(currEl), scaleFrom);
          });

          const endReset = () => {
            $(mainEl).find(".swiper-slide").each((_, el) => {
              if (!el.classList.contains(swiper.params.slideActiveClass)) {
                setScale(qAll(el), scaleFrom);
              }
            });
          };

          if (isZeroSpeed) {
            swiper.on("slideChange", endReset);
          } else {
            swiper.on("slideChangeTransitionEnd", endReset);
          }

          swiper.on("autoplayTimeLeft", (_s, timeLeftMs) => {
            const p = clamp01(1 - (timeLeftMs / autoplayDelay));
            const currEl = swiper.slides[swiper.activeIndex];
            if (!currEl) return;
            const value = scaleFrom + (scaleTo - scaleFrom) * p;
            qAll(currEl).forEach(t => { t.style.transform = `scale(${value})`; });
          });

          swiper.on("autoplayStop", () => {
            const currEl = swiper.slides[swiper.activeIndex];
            if (currEl) setScale(qAll(currEl), scaleTo);
          });
        }

        // Pause/resume autoplay when entering or leaving the viewport.
        if (autoplayEnabled && swiper.autoplay && !(focus && focus.fits)) {
          let hasStarted = false;

          const startOrResume = () => {
            try {
              if (!hasStarted) {
                swiper.autoplay.start();
                hasStarted = true;
              } else {
                swiper.autoplay.resume();
              }
            } catch (e) {}
          };

          const pauseAutoplay = () => {
            try {
              swiper.autoplay.pause();
            } catch (e) {}
          };

          try { swiper.autoplay.stop(); } catch (e) {}

          const io = new IntersectionObserver(entries => {
            for (let i = 0; i < entries.length; i++) {
              const entry = entries[i];
              if (entry.isIntersecting) {
                startOrResume();
              } else {
                pauseAutoplay();
              }
            }
          }, { threshold: 0.25 });

          io.observe($root[0]);
          swiper.on("destroy", () => io.disconnect());
        }
      }

      build();

      if (isFocusRoot) {
        const viewportEl = $root.find(".swiper").not(".swiper_new--thumbs")[0];
        let timer, previousWidth = viewportEl.clientWidth;
        let previousWindowWidth = window.innerWidth;

        const refresh = () => {
          const width = viewportEl.clientWidth;
          if (Math.abs(width - previousWidth) < 0.5 &&
              window.innerWidth === previousWindowWidth) return;

          previousWidth = width;
          previousWindowWidth = window.innerWidth;
          clearTimeout(timer);

          timer = setTimeout(() => {
            const index = currentInstance && !currentInstance.destroyed
              ? currentInstance.realIndex : 1;

            if (currentInstance && !currentInstance.destroyed) {
              currentInstance.destroy(true, true);
            }
            if (currentThumbs && !currentThumbs.destroyed) {
              currentThumbs.destroy(true, true);
            }
            build(index);
          }, 150);
        };

        const observer = new ResizeObserver(refresh);
        observer.observe(viewportEl);
        window.addEventListener("resize", refresh);

        // Optional cleanup for a page-transition system.
        $root[0].destroyGlobalSlider = () => {
          clearTimeout(timer);
          observer.disconnect();
          window.removeEventListener("resize", refresh);

          if (currentInstance && !currentInstance.destroyed) {
            currentInstance.destroy(true, true);
          }
          if (currentThumbs && !currentThumbs.destroyed) {
            currentThumbs.destroy(true, true);
          }
        };
      }
    });
  })();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGlobalSliders);
} else {
  initGlobalSliders();
}
