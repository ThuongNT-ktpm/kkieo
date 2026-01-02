/* curtain.js
   Minimal JS to activate the curtain open animation and remove the overlay.
   - Click/tap anywhere on the overlay to open
   - Also accepts Enter / Space on keyboard when overlay focused
   - After animation finishes, the overlay is removed and page becomes interactive
*/
(function () {
  // Find overlay and panels
  var overlay = document.getElementById("curtain-overlay");
  if (!overlay) return; // nothing to do

  var left = overlay.querySelector(".curtain-left");
  var right = overlay.querySelector(".curtain-right");
  var centerText = overlay.querySelector(".curtain-center-text");

  // Content entrance targets and state
  var entryTargets = [];
  var entryPrepared = false;

  // Default entrance configuration. Overridable by setting window.curtainEntranceConfig = { duration, easing, stagger, distanceVW, mobileDistanceVW }
  var entranceConfig = {
    duration: 1.6, // seconds (slower)
    easing: "cubic-bezier(.22,.9,.28,1)",
    stagger: 0.1, // seconds between each element's delay (slower)
    distanceVW: 18, // vw units for start offset
    mobileDistanceVW: 24, // vw units for mobiles
  };

  try {
    if (
      window.curtainEntranceConfig &&
      typeof window.curtainEntranceConfig === "object"
    ) {
      Object.assign(entranceConfig, window.curtainEntranceConfig);
    }
  } catch (e) {}

  // Apply config to CSS custom properties so CSS rules pick them up
  function applyEntranceVars() {
    try {
      document.documentElement.style.setProperty(
        "--curtain-entry-duration",
        entranceConfig.duration + "s"
      );
      document.documentElement.style.setProperty(
        "--curtain-entry-easing",
        entranceConfig.easing
      );
      document.documentElement.style.setProperty(
        "--curtain-entry-distance-vw",
        entranceConfig.distanceVW + "vw"
      );
      document.documentElement.style.setProperty(
        "--curtain-entry-stagger",
        entranceConfig.stagger + "s"
      );
      document.documentElement.style.setProperty(
        "--curtain-entry-distance-mobile-vw",
        entranceConfig.mobileDistanceVW + "vw"
      );
    } catch (e) {}
  }

  // Allow runtime updates
  window.updateCurtainEntranceConfig = function (cfg) {
    try {
      Object.assign(entranceConfig, cfg || {});
      applyEntranceVars();
    } catch (e) {}
  };

  applyEntranceVars();

  // Find common textual containers to animate. Use .pageview if present, else body.
  function prepareEntrance() {
    if (entryPrepared) return;
    entryPrepared = true;

    // Honor reduced-motion preference: skip animated entrance if user prefers reduced motion
    try {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        // Make content visible immediately
        document.body.classList.add("content-entrance");
        return;
      }
    } catch (e) {}

    var root = document.querySelector(".pageview") || document.body;
    // Select meaningful text blocks (conservative selector to avoid altering UI widgets)
    var els = root.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,li,section,article,div.section-container,div.section-wrapper,div.com-section,.text-block-css"
    );
    var dir = 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      // skip elements inside the overlay itself
      if (overlay.contains(el)) continue;
      // skip hidden or empty elements
      if (!el.offsetParent && el.offsetParent !== null) continue;
      // skip the music toggle or any ancestor that contains it so fixed controls don't get moved
      try {
        var musicToggle = document.getElementById("music-toggle");
        if (musicToggle && (el === musicToggle || el.contains(musicToggle)))
          continue;
      } catch (e) {}
      var txt = (el.textContent || el.innerText || "").trim();
      if (!txt) continue;
      el.classList.add("pre-entry");
      var side = dir % 2 === 0 ? "entry-left" : "entry-right";
      el.classList.add(side);
      // set transition properties per config (staggered)
      try {
        el.style.transitionProperty = "transform, opacity";
        el.style.transitionDuration = entranceConfig.duration + "s";
        el.style.transitionTimingFunction = entranceConfig.easing;
        el.style.transitionDelay = i * entranceConfig.stagger + "s";
      } catch (e) {}
      entryTargets.push(el);
      dir++;
    }
  }

  function startEntrance() {
    // Ensure prepared
    prepareEntrance();
    // small delay to allow reflow after overlay removed; account for some stagger so the first items feel timely
    setTimeout(function () {
      document.body.classList.add("content-entrance");
    }, 80 + Math.round(entranceConfig.stagger * 100));
  }

  // Prepare entrance immediately so content stays hidden while curtain visible
  prepareEntrance();

  // Prevent the underlying page from scrolling while overlay is visible
  document.documentElement.classList.add("curtain-active");
  document.body.classList.add("curtain-active");

  function openCurtain() {
    if (overlay.classList.contains("open")) return;

    // add class that triggers CSS transforms/animations
    overlay.classList.add("open");

    // provide a11y updates
    overlay.setAttribute("aria-hidden", "true");

    // After animation finishes (duration = 1.7s in CSS), remove overlay so page is interactive
    // Use a small safety timeout as well
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;

      // restore scrolling
      document.documentElement.classList.remove("curtain-active");
      document.body.classList.remove("curtain-active");

      // hide and then remove from DOM (keeps things clean)
      try {
        overlay.style.display = "none";
        overlay.parentNode && overlay.parentNode.removeChild(overlay);
      } catch (e) {}

      // remove event listeners
      overlay.removeEventListener("click", clickHandler);
      overlay.removeEventListener("keydown", keyHandler);
      left.removeEventListener("transitionend", panelTransitionEnd);
      right.removeEventListener("transitionend", panelTransitionEnd);

      // Start the content entrance animation (text sliding in from sides)
      try {
        startEntrance();
      } catch (e) {}

      // === SIGNAL TO THE HOST APP THAT THE CURTAIN IS OPENED ===
      // 1) Dispatch a CustomEvent 'curtainOpened' on window so any script can listen:
      //    window.addEventListener('curtainOpened', function(e){ /* start app */ });
      try {
        var ev = new CustomEvent("curtainOpened", {
          detail: { time: Date.now() },
        });
        window.dispatchEvent(ev);
      } catch (e) {
        // ignore if CustomEvent not supported
      }

      // 2) Call an optional global callback if provided: window.onCurtainOpened = function(){...}
      try {
        if (typeof window.onCurtainOpened === "function") {
          window.onCurtainOpened();
        }
      } catch (e) {}

      // 3) Mark the document so styles or scripts can check: document.documentElement.dataset.curtainOpened = 'true'
      try {
        document.documentElement.setAttribute("data-curtain-opened", "true");
      } catch (e) {}
    }

    // transitionend handler: run finish after both panels have reported a transform transition
    var panelsToFinish = 2;
    function panelTransitionEnd(e) {
      if (e && e.propertyName !== "transform") return; // only react to transform
      panelsToFinish -= 1;
      if (panelsToFinish <= 0) finish();
    }

    left.addEventListener("transitionend", panelTransitionEnd);
    right.addEventListener("transitionend", panelTransitionEnd);

    // Fallback in case transitionend doesn't fire for any reason
    setTimeout(finish, 2300);
  }

  function clickHandler(e) {
    // Two-step: preopen (text + clone slide left) then open curtains.
    if (
      overlay.classList.contains("preopen") ||
      overlay.classList.contains("open")
    )
      return;

    // Respect reduced-motion preference: skip preopen and open immediately
    try {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        openCurtain();
        return;
      }
    } catch (e) {}

    // start preopen
    overlay.classList.add("preopen");

    var preopenDone = false;
    function finishPreopen() {
      if (preopenDone) return;
      preopenDone = true;
      // hide the visual clone, emblem and center text (clean before curtains move)
      try {
        var clone = overlay.querySelector(".overlay-music-clone");
        if (clone) clone.style.display = "none";
      } catch (e) {}
      try {
        var c = overlay.querySelector(".curtain-center-text");
        if (c) c.style.display = "none";
      } catch (e) {}
      try {
        var emblem = overlay.querySelector(".emblem");
        if (emblem) emblem.style.display = "none";
      } catch (e) {}
      // now open curtains
      openCurtain();
    }

    // Listen for transitionend on the clone or one of the text halves
    var t =
      overlay.querySelector(".overlay-music-clone") ||
      overlay.querySelector(".curtain-center-text .text-half.left");
    if (t) {
      var handler = function (ev) {
        if (
          ev &&
          (ev.propertyName === "transform" || ev.propertyName === "opacity")
        ) {
          t.removeEventListener("transitionend", handler);
          finishPreopen();
        }
      };
      t.addEventListener("transitionend", handler);
    }

    // safety fallback
    setTimeout(finishPreopen, 950);
  }

  function keyHandler(e) {
    // allow Enter or Space to open when overlay has focus
    if (e.key === "Enter" || e.key === " " || e.code === "Space") {
      e.preventDefault();
      openCurtain();
    }
  }

  // Make overlay focusable for keyboard users
  overlay.setAttribute("tabindex", "0");
  overlay.addEventListener("click", clickHandler);
  overlay.addEventListener("keydown", keyHandler);

  // Also make the small center text a focus target and clickable
  if (centerText) {
    centerText.setAttribute("role", "button");
    centerText.setAttribute("tabindex", "0");
    centerText.addEventListener("click", clickHandler);
    centerText.addEventListener("keydown", keyHandler);
  }
})();
