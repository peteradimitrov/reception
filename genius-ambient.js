(() => {
  "use strict";

  // SETTINGS
  const IMAGE_URL = "https://cdn.prod.website-files.com/6292053974c40677f3ec8971/6a9fc2e1ed75bab1ee180a43_Genius%20(1).webp";
  const SPEED = 1.5;
  const INTENSITY = 1;

  function start() {
    document.querySelectorAll(".genius-ambient-popup").forEach(popup => {
      if (popup.dataset.geniusAmbientInitialized === "true") return;
      if (!IMAGE_URL || IMAGE_URL.includes("PASTE_WEBFLOW")) return;

      popup.dataset.geniusAmbientInitialized = "true";
      createBackground(popup);
    });
  }

  function createBackground(popup) {
    // Preserve existing fixed, absolute, or sticky positioning.
    if (getComputedStyle(popup).position === "static") {
      popup.style.position = "relative";
    }

    const background = document.createElement("div");
    background.className = "genius-popup-background";
    background.setAttribute("aria-hidden", "true");

    const staticImage = document.createElement("img");
    staticImage.alt = "";
    staticImage.decoding = "async";

    const canvas = document.createElement("canvas");

    background.append(staticImage, canvas);
    popup.prepend(background);

    const reducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    let gl;
    let program;
    let uniforms;

    let ready = false;
    let initializing = false;
    let failed = false;
    let disposed = false;
    let imageRequested = false;

    let inViewport = false;
    let visible = false;
    let hasSize = false;

    let frame = 0;
    let lastFrame = 0;
    let lastVisibilityCheck = 0;
    let time = 0;

    function isVisible() {
      if (!popup.isConnected || document.hidden) return false;

      const rect = popup.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) return false;

      for (
        let element = popup;
        element && element.nodeType === 1;
        element = element.parentElement
      ) {
        const style = getComputedStyle(element);

        if (
          element.hidden ||
          element.getAttribute("aria-hidden") === "true" ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.visibility === "collapse" ||
          style.contentVisibility === "hidden" ||
          parseFloat(style.opacity) === 0
        ) {
          return false;
        }
      }

      return true;
    }

    function canAnimate() {
      return (
        ready &&
        !failed &&
        !disposed &&
        visible &&
        inViewport &&
        hasSize &&
        !document.hidden &&
        !reducedMotion.matches
      );
    }

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
    }

    function schedule() {
      if (!canAnimate()) {
        stop();
        return;
      }

      if (!frame) {
        lastFrame = 0;
        frame = requestAnimationFrame(tick);
      }
    }

    function refresh() {
      if (disposed) return;

      if (!popup.isConnected) {
        cleanup();
        return;
      }

      visible = isVisible();

      // Defer image loading and WebGL setup until the popup is visible.
      if (visible && inViewport) {
        if (!imageRequested) {
          imageRequested = true;
          staticImage.src = IMAGE_URL;
        }

        if (
          !ready &&
          !initializing &&
          !failed &&
          !reducedMotion.matches
        ) {
          initializeWebGL();
        }
      }

      resize();
      schedule();
    }

    function resize() {
      const rect = background.getBoundingClientRect();
      hasSize = rect.width > 0 && rect.height > 0;

      if (!ready || failed || !hasSize) return;

      const pixelRatio = Math.min(
        devicePixelRatio || 1,
        1.5,
        1920 / rect.width,
        1440 / rect.height
      );

      const width = Math.max(
        1,
        Math.round(rect.width * pixelRatio)
      );

      const height = Math.max(
        1,
        Math.round(rect.height * pixelRatio)
      );

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      gl.uniform2f(uniforms.resolution, width, height);

      draw();
    }

    function draw() {
      if (!ready || failed || !hasSize) return;

      gl.uniform1f(uniforms.time, time);

      gl.uniform1f(
        uniforms.amount,
        reducedMotion.matches ? 0 : INTENSITY * 0.16
      );

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function tick(now) {
      frame = 0;

      if (!popup.isConnected) {
        cleanup();
        return;
      }

      // Also catch visibility changes driven by CSS animations.
      if (now - lastVisibilityCheck >= 250) {
        lastVisibilityCheck = now;
        visible = isVisible();
      }

      if (!canAnimate()) {
        lastFrame = 0;
        return;
      }

      // Approximately 30fps is sufficient for this slow background.
      if (lastFrame && now - lastFrame < 1000 / 30) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const delta = lastFrame
        ? Math.min((now - lastFrame) / 1000, 0.1)
        : 0;

      lastFrame = now;
      time += delta * SPEED;

      draw();
      frame = requestAnimationFrame(tick);
    }

    function fail(error) {
      failed = true;
      initializing = false;

      stop();
      canvas.classList.remove("is-ready");

      // The original image remains as a static fallback.
      console.warn("Genius background: static fallback.", error);
    }

    function initializeWebGL() {
      initializing = true;

      try {
        gl = canvas.getContext("webgl", {
          alpha: false,
          antialias: false,
          depth: false,
          powerPreference: "low-power"
        });

        if (!gl) throw new Error("WebGL unavailable");

        function compile(type, source) {
          const shader = gl.createShader(type);

          gl.shaderSource(shader, source);
          gl.compileShader(shader);

          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
          }

          return shader;
        }

        const vertexShader = compile(
          gl.VERTEX_SHADER,
          `
            attribute vec2 position;
            varying vec2 uv;

            void main() {
              uv = position * 0.5 + 0.5;
              gl_Position = vec4(position, 0.0, 1.0);
            }
          `
        );

        const fragmentShader = compile(
          gl.FRAGMENT_SHADER,
          `
            #ifdef GL_FRAGMENT_PRECISION_HIGH
              precision highp float;
            #else
              precision mediump float;
            #endif

            varying vec2 uv;

            uniform sampler2D image;
            uniform vec2 resolution;
            uniform float imageAspect;
            uniform float time;
            uniform float amount;

            void main() {
              float screenAspect = resolution.x / resolution.y;

              vec2 cover = vec2(
                min(screenAspect / imageAspect, 1.0),
                min(imageAspect / screenAspect, 1.0)
              );

              vec2 p = (uv - 0.5) * cover + 0.5;
              float t = time * 0.13;

              vec2 flow = vec2(
                sin(p.y * 5.0 + t) * 0.62 +
                sin(p.x * 3.7 - t * 0.61) * 0.38,

                cos(p.x * 4.0 - t * 0.73) * 0.6 +
                sin(p.y * 4.8 + t * 0.47) * 0.4
              );

              vec2 initial = vec2(
                sin(p.y * 5.0) * 0.62 +
                sin(p.x * 3.7) * 0.38,

                cos(p.x * 4.0) * 0.6 +
                sin(p.y * 4.8) * 0.4
              );

              vec2 edge = sin(p * 3.14159265);

              p += (flow - initial) * amount * edge * edge;

              gl_FragColor = texture2D(
                image,
                clamp(p, vec2(0.001), vec2(0.999))
              );
            }
          `
        );

        program = gl.createProgram();

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(program));
        }

        gl.useProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        const buffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 3, -1, -1, 3]),
          gl.STATIC_DRAW
        );

        const position = gl.getAttribLocation(
          program,
          "position"
        );

        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(
          position,
          2,
          gl.FLOAT,
          false,
          0,
          0
        );

        uniforms = {};

        ["resolution", "time", "amount", "imageAspect"].forEach(
          key => {
            uniforms[key] = gl.getUniformLocation(program, key);
          }
        );

        gl.uniform1i(
          gl.getUniformLocation(program, "image"),
          0
        );

        const textureImage = new Image();
        textureImage.crossOrigin = "anonymous";

        textureImage.onload = () => {
          if (disposed || failed) return;

          try {
            const texture = gl.createTexture();

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              gl.RGB,
              gl.RGB,
              gl.UNSIGNED_BYTE,
              textureImage
            );

            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_MIN_FILTER,
              gl.LINEAR
            );

            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_MAG_FILTER,
              gl.LINEAR
            );

            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_WRAP_S,
              gl.CLAMP_TO_EDGE
            );

            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_WRAP_T,
              gl.CLAMP_TO_EDGE
            );

            if (gl.getError() !== gl.NO_ERROR) {
              throw new Error("Texture upload failed");
            }

            gl.uniform1f(
              uniforms.imageAspect,
              textureImage.naturalWidth /
                textureImage.naturalHeight
            );

            ready = true;
            initializing = false;

            refresh();
            canvas.classList.add("is-ready");
          } catch (error) {
            fail(error);
          }
        };

        textureImage.onerror = () => {
          fail("Unable to load image as a WebGL texture.");
        };

        textureImage.src = IMAGE_URL;
      } catch (error) {
        fail(error);
      }
    }

    const resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(background);

    const intersectionObserver = new IntersectionObserver(entries => {
      inViewport = entries[0].isIntersecting;
      refresh();
    });

    intersectionObserver.observe(popup);

    const visibilityObserver = new MutationObserver(refresh);
    const ancestors = [];

    // Webflow may toggle visibility on the popup or an outer wrapper.
    for (
      let element = popup;
      element && element.nodeType === 1;
      element = element.parentElement
    ) {
      ancestors.push(element);

      visibilityObserver.observe(element, {
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          "hidden",
          "aria-hidden",
          "open"
        ]
      });

      element.addEventListener("transitionend", refresh);
      element.addEventListener("animationend", refresh);
    }

    document.addEventListener("visibilitychange", refresh);
    reducedMotion.addEventListener("change", refresh);

    canvas.addEventListener("webglcontextlost", event => {
      event.preventDefault();
      fail("Graphics context lost.");
    });

    function cleanup() {
      disposed = true;
      stop();

      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      visibilityObserver.disconnect();

      ancestors.forEach(element => {
        element.removeEventListener("transitionend", refresh);
        element.removeEventListener("animationend", refresh);
      });

      document.removeEventListener("visibilitychange", refresh);
      reducedMotion.removeEventListener("change", refresh);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true
    });
  } else {
    start();
  }
})();
