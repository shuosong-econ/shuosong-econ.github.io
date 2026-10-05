"use strict";

(() => {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [
    ...scope.querySelectorAll(selector),
  ];
  const root = document.documentElement;
  const body = document.body;
  const app = $("#app");
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  const mobileLayout = matchMedia("(max-width: 680px)");
  const storage = {
    get(key) {
      try {
        return localStorage.getItem(`ss-archive:${key}`);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`ss-archive:${key}`, value);
      } catch {
        /* Optional preferences only. */
      }
    },
  };
  let paused = motionPreference.matches || storage.get("motion") === "paused";
  let phase = "sealed";
  let view = "archive";
  let busy = false;
  let selectedSlab = 0;
  let visitorName = "";
  let entryReady = false;
  let visitorClockTimer = 0;
  let locationRequest = null;
  let arrivalVersion = 0;
  let discovered = false;
  let currentPhoto = 0;
  let displayedPhoto = 0;
  let photoRequest = 0;
  let photoAnimations = [];
  let filteredPhotos = [];
  let bootTimers = [];
  let bootVersion = 0;
  let frame = 0;
  let lastFrame = 0;
  let reliefTime = 0;
  let reliefDirty = true;
  let ambientVisible = true;
  const names = {
    archive: "The collection",
    intro: "Intro",
    research: "Research",
    journal: "Journal",
    library: "Library",
    gallery: "Elsewhere",
  };
  const aliases = {
    overview: "archive",
    hero: "archive",
    profile: "intro",
    essai: "journal",
  };
  const readingOrder = ["intro", "research", "journal", "library"];
  const duration = (ms) => (paused ? 0 : ms);
  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, duration(ms)));
  const ease = "cubic-bezier(.22,1,.36,1)";
  async function animate(element, keyframes, options = {}) {
    if (!element) return;
    const { persist = false, ...timing } = options;
    const animation = element.animate(keyframes, {
      easing: ease,
      fill: "forwards",
      ...timing,
      duration: duration(options.duration ?? 500),
    });
    try {
      await animation.finished;
      if (persist) animation.commitStyles();
    } catch {
      /* A new state can supersede an animation. */
    }
    animation.cancel();
  }
  function setPhase(next) {
    phase = next;
    body.dataset.phase = next;
    reliefDirty = true;
    scheduleRelief();
  }
  function setBusy(value) {
    busy = value;
    body.classList.toggle("busy", value);
    app.inert = value || phase !== "ready";
  }
  function setMotion() {
    root.classList.toggle("no-motion", paused);
    $("#motion-toggle").setAttribute("aria-pressed", String(paused));
    $("#motion-toggle").setAttribute(
      "aria-label",
      paused ? "Resume ambient motion" : "Pause ambient motion",
    );
    $("#motion-toggle").innerHTML =
      `<span aria-hidden="true">${paused ? "▷" : "Ⅱ"}</span>`;
    reliefDirty = true;
    scheduleRelief();
    atmosphereDirty = true;
    scheduleAtmosphere();
  }
  const papers = [
    {
      title:
        "Nonstationary Intelligence Demand, Data Flywheel, and the Strategic Release of Large Language Models.",
      field: "Generative AI · Industrial organization",
      code: "R–001",
      keywords: "LLM intelligence demand data flywheel models research",
    },
    {
      title: "Who Snatched Your Deal: AI Race and Memory Device Market.",
      field: "Semiconductors · Industrial organization",
      code: "R–002",
      keywords: "AI memory device market chips infrastructure research",
    },
  ];
  const photos = [
    {
      file: "Toulouse.jpg",
      title: "La Garonne, Toulouse",
      location: "Toulouse, France",
      category: "france",
    },
    {
      file: "Najac.jpg",
      title: "Najac",
      location: "Aveyron, France",
      category: "france",
    },
    {
      file: "xmas.jpg",
      title: "Le Capitole, Toulouse",
      location: "Toulouse, France",
      category: "france",
    },
    {
      file: "TSE.jpg",
      title: "Toulouse School of Economics",
      location: "Toulouse, France",
      category: "france",
    },
    {
      file: "Qingdao.JPG",
      title: "Tsingtao",
      location: "Qingdao, China",
      category: "china",
    },
    {
      file: "westlake.jpg",
      title: "West Lake, Hangzhou",
      location: "Hangzhou, China",
      category: "china",
    },
    {
      file: "yuewang.jpg",
      title: "Yuewang Temple, Hangzhou",
      location: "Hangzhou, China",
      category: "china",
    },
    {
      file: "wukong.jpg",
      title: "Black Myth: Wukong",
      location: "Virtual worlds",
      category: "other",
    },
    {
      file: "albi.jpg",
      title: "Cathédrale Sainte-Cécile d’Albi",
      location: "Albi, France",
      category: "france",
    },
    {
      file: "nice.jpg",
      title: "Nice",
      location: "French Riviera, France",
      category: "france",
    },
    {
      file: "antibes.jpg",
      title: "Antibes",
      location: "French Riviera, France",
      category: "france",
    },
    {
      file: "monaco.jpg",
      title: "Monaco",
      location: "Monaco",
      category: "other",
    },
    {
      file: "cannes.jpg",
      title: "Cannes",
      location: "French Riviera, France",
      category: "france",
    },
    {
      file: "collioure.jpg",
      title: "Collioure",
      location: "Pyrénées-Orientales, France",
      category: "france",
    },
    {
      file: "xmu.jpeg",
      title: "Xiamen University",
      location: "Xiamen, China",
      category: "china",
    },
    {
      file: "plane.jpg",
      title: "Light Painting",
      location: "Light studies",
      category: "other",
    },
  ].map((photo, index) => ({
    ...photo,
    index,
    stem: photo.file.replace(/\.[^.]+$/, "").toLowerCase(),
  }));
  filteredPhotos = photos;

  // Dialogs close visually before returning keyboard focus to their trigger.
  const dialogTriggers = new WeakMap();
  async function openDialog(dialog) {
    if (dialog.open) return;
    dialogTriggers.set(dialog, document.activeElement);
    dialog.showModal();
    await animate(
      dialog,
      [
        { opacity: 0, transform: "translateY(18px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 480 },
    );
  }
  async function closeDialog(dialog) {
    if (!dialog.open || dialog.dataset.closing) return;
    dialog.dataset.closing = "true";
    await animate(
      dialog,
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(8px)" },
      ],
      { duration: 240 },
    );
    dialog.close();
    delete dialog.dataset.closing;
    const trigger = dialogTriggers.get(dialog);
    if (trigger?.isConnected && trigger.getClientRects().length)
      trigger.focus({ preventScroll: true });
  }
  $$("dialog:not(#entry)").forEach((dialog) => {
    $("[data-close]", dialog).addEventListener("click", () =>
      closeDialog(dialog),
    );
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog(dialog);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        closeDialog(dialog);
    });
  });

  function selectSlab(index, keyboard = false) {
    selectedSlab = (index + 4) % 4;
    $("#archive-deck").style.setProperty("--selected", selectedSlab);
    $$("[data-slab]").forEach((slab, i) => {
      slab.classList.toggle("selected", i === selectedSlab);
      slab.classList.toggle("neighbor", Math.abs(i - selectedSlab) === 1);
      // The other records remain reachable through their explicit mobile selectors.
      slab.tabIndex = mobileLayout.matches && i !== selectedSlab ? -1 : 0;
      slab.setAttribute(
        "aria-hidden",
        String(mobileLayout.matches && i !== selectedSlab),
      );
    });
    $$("[data-select]").forEach((button, i) =>
      button.setAttribute("aria-pressed", String(i === selectedSlab)),
    );
    if (keyboard)
      $(`[data-select="${selectedSlab}"]`).focus({ preventScroll: true });
    reliefDirty = true;
    scheduleRelief();
  }
  $$("[data-select]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!busy) selectSlab(Number(button.dataset.select));
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        selectSlab(selectedSlab + (event.key === "ArrowLeft" ? -1 : 1), true);
      }
    });
  });
  mobileLayout.addEventListener("change", () => selectSlab(selectedSlab));

  function normalizeRoute(hash) {
    const raw = hash.replace(/^#/, "");
    return aliases[raw] || (Object.hasOwn(names, raw) ? raw : "archive");
  }
  function setView(next) {
    view = next;
    body.dataset.view = next;
    $("#archive").hidden = next !== "archive";
    $("#archive").inert = next !== "archive";
    $("#reading-room").hidden = !readingOrder.includes(next);
    $("#reading-room").inert = !readingOrder.includes(next);
    $("#gallery").hidden = next !== "gallery";
    $("#gallery").inert = next !== "gallery";
    $$(".reader").forEach((reader) => {
      reader.classList.toggle("active", reader.id === next);
      reader.inert = reader.id !== next;
    });
    $$(".reading-toolbar a").forEach((link) => {
      if (link.hash === `#${next}`) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    $("#route-indicator").textContent =
      next === "archive"
        ? "COLLECTION / 01—04"
        : `RECORD / ${String(readingOrder.indexOf(next) + 1).padStart(2, "0")}`;
    document.title = `${next === "archive" ? "An Open Archive" : names[next]} — Shuo Song`;
    $('meta[name="theme-color"]').content =
      next === "gallery" ? "#151715" : "#f1f2ee";
    window.scrollTo({ top: 0, behavior: "instant" });
    scheduleAtmosphere();
    reliefDirty = true;
    scheduleRelief();
  }
  function writeHash(next, replace = false) {
    if (location.hash !== `#${next}`)
      history[replace ? "replaceState" : "pushState"](
        { archiveView: next },
        "",
        `#${next}`,
      );
  }
  function focusView() {
    const heading = $(`#${view}-title`);
    heading?.focus({ preventScroll: true });
  }
  async function crossLight(next, historyChange) {
    if (paused) {
      setView(next);
      if (!historyChange) writeHash(next);
      return;
    }
    const light = $("#light-transition");
    const bloom = $(".light-bloom", light);
    const wash = $(".light-wash", light);
    const rays = $$(".light-filament", light);
    const outward = next === "gallery";
    const leak = $("#light-leak").getBoundingClientRect();
    light.style.setProperty(
      "--light-x",
      `${outward ? leak.left + leak.width / 2 : innerWidth * 0.82}px`,
    );
    light.style.setProperty(
      "--light-y",
      `${outward ? leak.top + leak.height / 2 : innerHeight * 0.62}px`,
    );
    light.classList.add("active");
    const rise = outward ? 1850 : 1050;
    await Promise.all([
      animate(
        bloom,
        [
          { opacity: 0, transform: "scale(.01,.08) rotate(-19deg)" },
          { opacity: 1, transform: "scale(1.5,1.4) rotate(-4deg)" },
        ],
        { duration: rise, persist: true, easing: "cubic-bezier(.45,0,.2,1)" },
      ),
      ...rays.map((ray, i) =>
        animate(
          ray,
          [
            { opacity: 0, transform: `rotate(${i ? 31 : -22}deg) scaleY(.04)` },
            {
              opacity: 0.9,
              transform: `rotate(${i ? 18 : -12}deg) scaleY(1.5)`,
            },
          ],
          { duration: rise, persist: true },
        ),
      ),
      animate(
        wash,
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.3 },
          { opacity: 1, offset: 1 },
        ],
        { duration: rise, persist: true },
      ),
      animate(
        app,
        [
          { filter: "brightness(1) blur(0px)" },
          { filter: "brightness(2.6) blur(8px)" },
        ],
        { duration: rise, persist: true },
      ),
    ]);
    setView(next);
    if (!historyChange) writeHash(next);
    app.style.filter = "";
    await wait(100);
    await Promise.all([
      animate(wash, [{ opacity: 1 }, { opacity: 0 }], {
        duration: outward ? 1600 : 2000,
        persist: true,
      }),
      animate(
        bloom,
        [
          { opacity: 1, transform: "scale(1.5,1.4) rotate(-4deg)" },
          {
            opacity: 0,
            transform: outward
              ? "scale(1.9,1.8) rotate(7deg)"
              : "scale(.015,.12) rotate(-19deg)",
          },
        ],
        { duration: outward ? 2100 : 2300, persist: true },
      ),
      ...rays.map((ray, i) =>
        animate(
          ray,
          [
            { opacity: 0.9 },
            { opacity: 0, transform: `rotate(${i ? 31 : -22}deg) scaleY(.02)` },
          ],
          { duration: 1900, persist: true },
        ),
      ),
    ]);
  }
  // Isolate an extracted object before moving it; only one transition can own the scene.
  async function navigate(next, { historyChange = false, source = null } = {}) {
    if (phase !== "ready" || busy) return;
    if (next === view) {
      window.scrollTo({ top: 0, behavior: paused ? "instant" : "smooth" });
      return;
    }
    setBusy(true);
    const previous = view;
    const veil = $("#transition-veil");
    const plate = $("#transition-plate");
    const portal = next === "gallery" || previous === "gallery";
    veil.style.pointerEvents = "auto";
    try {
      if (next === "gallery") {
        discovered = true;
        await preparePhoto(currentPhoto);
      }
      if (portal) {
        await crossLight(next, historyChange);
        return;
      }
      if (source && !paused) {
        const original = $(".slab-body", source);
        const rect = original.getBoundingClientRect();
        const clone = original.cloneNode(true);
        $("canvas", clone)
          ?.getContext("2d")
          ?.drawImage($("canvas", original), 0, 0);
        plate.replaceChildren(clone);
        Object.assign(plate.style, {
          display: "block",
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        source.classList.add("extracting");
        // Clear typography and neighbouring objects while the selected plate holds still.
        await animate(
          app,
          [
            { opacity: 1, filter: "blur(0px)" },
            { opacity: 0.035, filter: "blur(10px)" },
          ],
          { duration: 420, persist: true },
        );
        const dx = innerWidth / 2 - rect.left - rect.width / 2;
        const dy = innerHeight / 2 - rect.top - rect.height / 2;
        await animate(
          plate,
          [
            { transform: "translate(0,0) scale(1)", opacity: 1 },
            { transform: `translate(${dx}px,${dy}px) scale(1.1)`, opacity: 1 },
          ],
          { duration: 850, persist: true },
        );
      }
      await animate(veil, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 400,
        persist: true,
      });
      plate.style.display = "none";
      setView(next);
      if (!historyChange) writeHash(next);
      app.style.opacity = "";
      app.style.filter = "";
      await animate(veil, [{ opacity: 1 }, { opacity: 0 }], {
        duration: 750,
        persist: true,
      });
    } finally {
      source?.classList.remove("extracting");
      plate.replaceChildren();
      plate.removeAttribute("style");
      veil.removeAttribute("style");
      app.style.opacity = "";
      app.style.filter = "";
      const light = $("#light-transition");
      light.classList.remove("active");
      $$(".light-bloom,.light-wash,.light-filament", light).forEach((el) =>
        el.removeAttribute("style"),
      );
      setBusy(false);
      focusView();
    }
  }
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (
      !link ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (link.hash === "#main") {
      event.preventDefault();
      $("#main").focus({ preventScroll: true });
      return;
    }
    event.preventDefault();
    navigate(normalizeRoute(link.hash), {
      source: link.classList.contains("archive-slab") ? link : null,
    });
  });
  window.addEventListener("popstate", () => {
    if (phase !== "ready" || busy) {
      writeHash(view, true);
      return;
    }
    navigate(normalizeRoute(location.hash), { historyChange: true });
  });
  window.addEventListener("hashchange", () => {
    if (phase === "ready" && !busy)
      navigate(normalizeRoute(location.hash), { historyChange: true });
  });
  $("#light-leak").addEventListener("click", () => navigate("gallery"));

  // Admission deliberately has no remembered "visited" flag. Every reload is a new arrival.
  function clearBoot() {
    bootVersion++;
    bootTimers.forEach(clearTimeout);
    bootTimers = [];
  }
  function setProtocol(step, message) {
    $("#entry-protocol").dataset.step = String(step);
    $$(".protocol-steps li").forEach((row, index) => {
      row.dataset.state =
        index < step ? "done" : index === step ? "active" : "pending";
      $(".protocol-state", row).textContent =
        index < step
          ? "CONFIRMED"
          : index > step && index < 2
            ? "STANDBY"
            : ["LISTENING", "CONNECTING", "OPTIONAL"][index];
    });
    const line = $("#entry-message");
    if (line.textContent !== message) {
      line.textContent = message;
      animate(
        line,
        [
          { opacity: 0, transform: "translateY(4px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 450 },
      );
    }
  }
  function syncEntryActions() {
    const hasName = $("#visitor-name").value.trim().length > 0;
    $("#enter-archive").disabled = !entryReady || !hasName || busy;
    $("#enter-anonymously").disabled = !entryReady || busy;
    if (!entryReady || busy) return;
    $("#identity-step").textContent = hasName
      ? "Identity received"
      : "Awaiting your identity";
    setProtocol(
      2,
      hasName ? "Your passage is ready." : "A name, or simply your presence.",
    );
    $(".protocol-steps li:last-child .protocol-state").textContent = hasName
      ? "RECEIVED"
      : "OPTIONAL";
  }
  function readyEntry() {
    if (busy) return;
    clearBoot();
    entryReady = true;
    syncEntryActions();
    $("#skip-loading").disabled = true;
  }
  function showEntry() {
    if (busy) return;
    clearBoot();
    arrivalVersion++;
    locationRequest?.abort();
    clearInterval(visitorClockTimer);
    $$("dialog[open]").forEach((dialog) => dialog.close());
    setPhase("sealed");
    setView("archive");
    document.title = "Beyond this point.";
    selectSlab(0);
    visitorName = "";
    entryReady = false;
    $("#visitor-name").value = "";
    $("#visitor-name").readOnly = false;
    $("#identity-step").textContent = "Awaiting your identity";
    $("#session-label").textContent = "VISITOR / —";
    $(".visitor-context").open = false;
    setProtocol(0, "Listening for a signal.");
    syncEntryActions();
    $("#skip-loading").disabled = false;
    app.inert = true;
    $("#entry").showModal();
    $("#entry-title").focus({ preventScroll: true });
    if (paused) {
      readyEntry();
      return;
    }
    const version = bootVersion;
    for (const [delay, action] of [
      [1500, () => setProtocol(1, "A signal received. Establishing contact.")],
      [3300, () => setProtocol(2, "Channel open. Preparing your passage.")],
      [4800, readyEntry],
    ]) {
      bootTimers.push(
        setTimeout(() => {
          if (version === bootVersion) action();
        }, delay),
      );
    }
  }

  function updateVisitorClock() {
    const now = new Date();
    $("#visitor-clock").dateTime = now.toISOString();
    $("#visitor-clock").textContent = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now);
  }
  async function locateVisitor(version) {
    locationRequest?.abort();
    const controller = new AbortController();
    locationRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    $("#visitor-location").textContent = "Locating your signal…";
    try {
      // No identity, cookies, coordinates or referrer are sent. The service sees
      // the public IP of this one request; only its approximate place is used.
      const response = await fetch("https://api.ipapi.is/", {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error("Location unavailable");
      const data = await response.json();
      if (data.error || data.is_bogon) throw new Error("Location unavailable");
      const place = data.location || data;
      const clean = (value) =>
        typeof value === "string" ? value.trim().slice(0, 80) : "";
      const city = clean(place.city) || clean(place.region);
      const country = clean(place.country);
      const label = [...new Set([city, country].filter(Boolean))].join(", ");
      if (!label) throw new Error("Location unavailable");
      if (version === arrivalVersion)
        $("#visitor-location").textContent = label;
    } catch {
      if (version === arrivalVersion)
        $("#visitor-location").textContent = "Somewhere on Earth";
    } finally {
      clearTimeout(timeout);
      if (locationRequest === controller) locationRequest = null;
    }
  }
  function welcomeVisitor() {
    $("#visitor-greeting").textContent = visitorName
      ? `Welcome, ${visitorName}.`
      : "Welcome, traveller.";
    $("#visitor-pass").textContent =
      `V—${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
    $("#session-label").textContent = visitorName
      ? `VISITOR / ${visitorName}`
      : "VISITOR / ANONYMOUS";
    updateVisitorClock();
    clearInterval(visitorClockTimer);
    visitorClockTimer = setInterval(() => {
      if (!document.hidden) updateVisitorClock();
    }, 15000);
    // Independent of admission: an offline/limited lookup never delays the reveal.
    void locateVisitor(arrivalVersion);
  }

  // A minimum-jerk curve has zero velocity AND acceleration at both ends.
  // Sample at 60 Hz, with linear WAAPI timing: never ease an already eased path.
  const smoothTravel = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function motionFrames(sample, count = 150) {
    return Array.from({ length: count + 1 }, (_, index) => {
      const t = index / count;
      return { offset: t, ...sample(t) };
    });
  }
  async function unfoldArchive() {
    const slabs = $$(".archive-slab");
    const starts = slabs.map((slab) =>
      new DOMMatrix(getComputedStyle(slab).transform).toFloat64Array(),
    );
    setPhase("unfolding");
    const targets = slabs.map((slab) => ({
      matrix: new DOMMatrix(getComputedStyle(slab).transform).toFloat64Array(),
      opacity: Number(getComputedStyle(slab).opacity),
    }));
    await Promise.all(
      slabs.map((slab, index) => {
        const from = starts[index],
          to = targets[index];
        const spread = Math.abs(index - 1.5);
        return animate(
          slab,
          motionFrames((t) => {
            const p = smoothTravel(1 - Math.pow(1 - t, 1.3));
            const arc = Math.pow(Math.sin(Math.PI * p), 2);
            const matrix = Array.from(
              from,
              (value, i) => value + (to.matrix[i] - value) * p,
            );
            // The lift is normal to the plane: panes separate before fanning sideways.
            const lift = -(mobileLayout.matches ? 24 : 40 + spread * 16) * arc;
            const depth = 45 * arc;
            const bank = (index - 1.5) * 2.5 * arc;
            return {
              transform: `translate3d(0, ${lift}px, ${depth}px) rotateZ(${bank}deg) matrix3d(${matrix.join(",")})`,
              opacity: 1 + (to.opacity - 1) * p,
            };
          }),
          { duration: 2700, delay: index * 85, easing: "linear", fill: "both" },
        );
      }),
    );
  }
  async function revealArchive() {
    const deck = $("#archive-deck");
    const distance = Math.max(innerHeight * 0.95, 600);
    setPhase("falling");
    const falling = animate(
      deck,
      motionFrames((t) => {
        const p = smoothTravel(1 - Math.pow(1 - t, 1.7));
        const drift = Math.pow(Math.sin(Math.PI * t), 2);
        const y = -distance * (1 - p);
        return {
          transform: `translate3d(${-20 * (1 - p) + 5 * drift}px, ${y}px, 0) rotateZ(${-11 * (1 - p) - 1.8 * drift}deg) rotateX(${18 * (1 - p)}deg) scale(${0.91 + 0.09 * p})`,
          opacity: smoothTravel(Math.min(1, t / 0.24)),
        };
      }),
      { duration: 2600, easing: "linear" },
    );
    const shadow = animate(
      $(".landing-shadow"),
      motionFrames((t) => {
        const p = smoothTravel(1 - Math.pow(1 - (t * 1850) / 2600, 1.7));
        return {
          opacity: 0.13 * Math.pow(p, 3),
          transform: `translateX(-50%) scale(${0.3 + p * 0.5})`,
        };
      }),
      { duration: 1850, easing: "linear", persist: true },
    );
    // Unfold while the last trace of descent is still settling, so there is no
    // stop/restart seam between gravity and the room's suspended equilibrium.
    await shadow;
    setPhase("landed");
    await Promise.all([
      falling,
      unfoldArchive(),
      animate(
        $(".landing-shadow"),
        [
          { opacity: getComputedStyle($(".landing-shadow")).opacity },
          { opacity: 0 },
        ],
        { duration: 3000, easing: "linear" },
      ),
    ]);
    $(".landing-shadow").style.opacity = "";
    $(".landing-shadow").style.transform = "";
  }
  async function enterArchive(anonymous = false) {
    const button = $(anonymous ? "#enter-anonymously" : "#enter-archive");
    if (button.disabled || busy || !entryReady) return;
    const name = $("#visitor-name").value.trim().slice(0, 48);
    if (!anonymous && !name) return;
    // No storage, URL or HTML interpolation: this name is only an in-memory greeting.
    visitorName = anonymous ? "" : name;
    clearBoot();
    setBusy(true);
    syncEntryActions();
    $("#skip-loading").disabled = true;
    $("#visitor-name").readOnly = true;
    welcomeVisitor();
    try {
      $("#identity-step").textContent = anonymous
        ? "Anonymous passage"
        : "Identity received";
      setProtocol(
        3,
        anonymous
          ? "No name needed. You are welcome here."
          : `Welcome, ${visitorName}.`,
      );
      await wait(950);
      setProtocol(3, "Guest access granted. Beyond, now.");
      await wait(650);
      await animate($("#entry"), [{ opacity: 1 }, { opacity: 0 }], {
        duration: 900,
        persist: true,
      });
      $("#entry").close();
      $("#entry").style.opacity = "";
      if (!paused) await revealArchive();
      setPhase("ready");
      document.title = "An Open Archive — Shuo Song";
      writeHash("archive", true);
      await wait(700);
    } finally {
      if (!$("#entry").open) setPhase("ready");
      setBusy(false);
      focusView();
    }
  }
  $("#visitor-name").addEventListener("input", syncEntryActions);
  $("#skip-loading").addEventListener("click", readyEntry);
  $("#entry-form").addEventListener("submit", (event) => {
    event.preventDefault();
    enterArchive(false);
  });
  $("#enter-anonymously").addEventListener("click", () => enterArchive(true));
  $("#entry").addEventListener("cancel", (event) => {
    event.preventDefault();
    readyEntry();
    $("#enter-anonymously").focus();
  });
  $("#replay-intro").addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    const veil = $("#transition-veil");
    await animate(veil, [{ opacity: 0 }, { opacity: 1 }], {
      duration: 650,
      persist: true,
    });
    setBusy(false);
    showEntry();
    veil.style.opacity = "0";
  });
  // BFCache restores are arrivals too, but internal hash navigation never restarts the protocol.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) showEntry();
  });
  $("#motion-toggle").addEventListener("click", () => {
    paused = !paused;
    storage.set("motion", paused ? "paused" : "active");
    setMotion();
  });
  motionPreference.addEventListener("change", () => {
    paused = motionPreference.matches || storage.get("motion") === "paused";
    setMotion();
  });

  function openPaper(index) {
    const paper = papers[index];
    $("#record-title").textContent = paper.title;
    $("#record-field").textContent = paper.field;
    $("#record-code").textContent = `RESEARCH RECORD / ${paper.code}`;
    $("#record-contact").href =
      `mailto:shuo.song@tse-fr.eu?subject=${encodeURIComponent(`Research enquiry: ${paper.title}`)}`;
    openDialog($("#record-dialog"));
  }
  $$("[data-paper]").forEach((button) =>
    button.addEventListener("click", () =>
      openPaper(Number(button.dataset.paper)),
    ),
  );

  // Six colours sampled from the photograph become a slowly flowing atmosphere.
  // A small canvas keeps this inexpensive; CSS supplies the final optical softness.
  const atmosphere = $("#ambient-field");
  const atmosphereContext = atmosphere.getContext("2d");
  let atmosphereFrame = 0,
    atmosphereLast = 0,
    atmosphereTime = 0;
  let atmosphereDirty = true;
  let atmosphereColours = [
    [40, 73, 139],
    [122, 91, 96],
    [207, 142, 72],
    [51, 62, 131],
    [76, 96, 142],
    [193, 142, 98],
  ];
  let atmosphereTarget = atmosphereColours.map((colour) => [...colour]);
  function updateAtmosphere(image) {
    const sampler = document.createElement("canvas");
    sampler.width = 40;
    sampler.height = 32;
    const ctx = sampler.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    try {
      ctx.drawImage(image, 0, 0, 40, 32);
      const pixels = ctx.getImageData(0, 0, 40, 32).data;
      const buckets = new Map();
      for (let i = 0; i < pixels.length; i += 4) {
        const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
        const hi = Math.max(...rgb),
          lo = Math.min(...rgb);
        if (hi < 28 || lo > 225) continue;
        const key = rgb.map((v) => Math.floor(v / 40)).join(",");
        const bucket = buckets.get(key) || {
          sum: [0, 0, 0],
          count: 0,
          weight: 0,
        };
        rgb.forEach((v, j) => (bucket.sum[j] += v));
        bucket.count++;
        bucket.weight += 0.35 + (hi - lo) / 180;
        buckets.set(key, bucket);
      }
      const candidates = [...buckets.values()]
        .sort((a, b) => b.weight - a.weight)
        .map((b) => b.sum.map((v) => v / b.count));
      const selected = [];
      for (const colour of candidates) {
        if (
          selected.every(
            (other) =>
              colour.reduce((sum, v, i) => sum + (v - other[i]) ** 2, 0) > 3300,
          )
        )
          selected.push(colour);
        if (selected.length === 6) break;
      }
      if (selected.length) {
        while (selected.length < 6)
          selected.push([
            ...selected[selected.length % Math.min(selected.length, 3)],
          ]);
        atmosphereTarget = selected;
      }
    } catch {
      /* Keep the preceding palette if an image cannot be sampled. */
    }
    if (paused) atmosphereColours = atmosphereTarget.map((c) => [...c]);
    atmosphereDirty = true;
    scheduleAtmosphere();
  }
  function scheduleAtmosphere() {
    if (!atmosphereFrame && view === "gallery" && !document.hidden)
      atmosphereFrame = requestAnimationFrame(drawAtmosphere);
  }
  function drawAtmosphere(timestamp) {
    atmosphereFrame = 0;
    if (view !== "gallery" || document.hidden || !atmosphereContext) return;
    if (paused && !atmosphereDirty) return;
    const interval = 1000 / (mobileLayout.matches ? 12 : 18);
    if (!paused && timestamp - atmosphereLast < interval) {
      scheduleAtmosphere();
      return;
    }
    const dt = Math.min((timestamp - atmosphereLast) / 1000 || 0.05, 0.12);
    atmosphereLast = timestamp;
    if (!paused) atmosphereTime += dt;
    const w = Math.min(720, Math.ceil(innerWidth / 2)),
      h = Math.min(580, Math.ceil(innerHeight / 2));
    if (atmosphere.width !== w || atmosphere.height !== h) {
      atmosphere.width = w;
      atmosphere.height = h;
    }
    const ctx = atmosphereContext,
      t = atmosphereTime;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#0c1523";
    ctx.fillRect(0, 0, w, h);
    const blend = paused ? 1 : 1 - Math.exp(-dt * 1.25);
    atmosphereColours = atmosphereColours.map((colour, i) =>
      colour.map((v, j) => v + (atmosphereTarget[i][j] - v) * blend),
    );
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 6; i++) {
      const x = w * (0.5 + 0.48 * Math.sin(t * (0.13 + i * 0.009) + i * 1.73));
      const y = h * (0.5 + 0.48 * Math.cos(t * (0.105 + i * 0.008) + i * 1.37));
      const radius = Math.max(w, h) * (0.42 + 0.11 * Math.sin(t * 0.09 + i));
      const rgb = atmosphereColours[i].map(Math.round).join(",");
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${rgb},.8)`);
      gradient.addColorStop(0.38, `rgba(${rgb},.46)`);
      gradient.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = "source-over";
    atmosphereDirty = false;
    if (!paused) scheduleAtmosphere();
  }
  window.addEventListener("resize", () => {
    atmosphereDirty = true;
    scheduleAtmosphere();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      atmosphereDirty = true;
      scheduleAtmosphere();
    }
  });

  // Photograph changes use a last-request-wins token, so rapid navigation never shows an old caption.
  const imageCache = new Map();
  function preparePhoto(index) {
    if (imageCache.has(index)) return imageCache.get(index);
    const image = new Image();
    image.src = `assets/photos/${photos[index].stem}-large.webp`;
    const ready = image
      .decode()
      .then(() => image)
      .catch(() => null);
    imageCache.set(index, ready);
    return ready;
  }
  async function choosePhoto(index, instant = false) {
    currentPhoto = (index + photos.length) % photos.length;
    const request = ++photoRequest;
    const photo = photos[currentPhoto];
    const prepared = await preparePhoto(currentPhoto);
    if (request !== photoRequest) return;
    photoAnimations.forEach((animation) => animation.cancel());
    photoAnimations = [];
    const image = $("#exhibit-image");
    if (!instant && !paused) {
      const fade = image.animate(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(1.015)" },
        ],
        { duration: 220, fill: "forwards", easing: ease },
      );
      photoAnimations.push(fade);
      try {
        await fade.finished;
      } catch {
        return;
      }
      if (request !== photoRequest) return;
    }
    image.src = prepared?.src || `figures/${photo.file}`;
    displayedPhoto = currentPhoto;
    image.alt = photo.title;
    $("#photo-title").textContent = photo.title;
    $("#photo-location").textContent = photo.location.toUpperCase();
    $("#photo-counter").textContent = String(currentPhoto + 1).padStart(2, "0");
    if (prepared) updateAtmosphere(prepared);
    $("#enlarge-photo").setAttribute(
      "aria-label",
      `Enlarge photograph: ${photo.title}`,
    );
    $$(".film-frame").forEach((button, i) => {
      if (i === currentPhoto) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    const activeThumb = $(`[data-photo="${currentPhoto}"]`, $("#filmstrip"));
    if (view === "gallery" && activeThumb) {
      const strip = $("#filmstrip");
      strip.scrollTo({
        left:
          activeThumb.offsetLeft -
          strip.offsetLeft -
          strip.clientWidth / 2 +
          activeThumb.offsetWidth / 2,
        behavior: paused ? "instant" : "smooth",
      });
    }
    photoAnimations.forEach((animation) => animation.cancel());
    photoAnimations = [];
    if (!instant && !paused) {
      const reveal = image.animate(
        [
          { opacity: 0, transform: "scale(1.025)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        { duration: 800, fill: "forwards", easing: ease },
      );
      photoAnimations.push(reveal);
      try {
        await reveal.finished;
      } catch {
        return;
      }
      if (request === photoRequest) {
        reveal.cancel();
        photoAnimations = [];
      }
    }
    preparePhoto((currentPhoto + 1) % photos.length);
  }
  photos.forEach((photo) => {
    const button = document.createElement("button");
    button.className = "film-frame";
    button.dataset.photo = photo.index;
    button.setAttribute("aria-label", `Show ${photo.title}`);
    const image = document.createElement("img");
    image.src = `assets/photos/${photo.stem}.webp`;
    image.alt = "";
    image.loading = "lazy";
    image.width = 100;
    image.height = 75;
    button.append(image);
    button.addEventListener("click", () => choosePhoto(photo.index));
    $("#filmstrip").append(button);
  });
  function movePhoto(direction) {
    choosePhoto(currentPhoto + direction);
  }
  $("#previous-photo").addEventListener("click", () => movePhoto(-1));
  $("#next-photo").addEventListener("click", () => movePhoto(1));
  $("#enlarge-photo").addEventListener("click", () => {
    const photo = photos[displayedPhoto];
    $("#lightbox-image").src = `assets/photos/${photo.stem}-large.webp`;
    $("#lightbox-image").alt = photo.title;
    openDialog($("#lightbox"));
  });
  let touch = null;
  $("#exhibition").addEventListener(
    "touchstart",
    (event) => {
      touch =
        event.touches.length === 1
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : null;
    },
    { passive: true },
  );
  $("#exhibition").addEventListener(
    "touchend",
    (event) => {
      if (!touch) return;
      const x = event.changedTouches[0].clientX - touch.x,
        y = event.changedTouches[0].clientY - touch.y;
      if (Math.abs(x) > 50 && Math.abs(x) > Math.abs(y) * 1.5)
        movePhoto(x < 0 ? 1 : -1);
      touch = null;
    },
    { passive: true },
  );
  function renderGallery(category = "all") {
    filteredPhotos =
      category === "all"
        ? photos
        : photos.filter((photo) => photo.category === category);
    $("#gallery-grid").replaceChildren();
    filteredPhotos.forEach((photo) => {
      const button = document.createElement("button");
      button.className = "gallery-item";
      button.setAttribute("aria-label", `View photograph: ${photo.title}`);
      const image = document.createElement("img");
      image.src = `assets/photos/${photo.stem}.webp`;
      image.alt = photo.title;
      image.loading = "lazy";
      image.width = 400;
      image.height = 300;
      const caption = document.createElement("span");
      caption.textContent = photo.title;
      button.append(image, caption);
      button.addEventListener("click", async () => {
        await closeDialog($("#contact-sheet"));
        choosePhoto(photo.index);
      });
      $("#gallery-grid").append(button);
    });
    $("#gallery-count").textContent =
      `${String(filteredPhotos.length).padStart(2, "0")} MOMENTS`;
  }
  $("#open-contact-sheet").addEventListener("click", () =>
    openDialog($("#contact-sheet")),
  );
  $$("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      $$("[data-filter]").forEach((filter) =>
        filter.setAttribute("aria-pressed", String(filter === button)),
      );
      renderGallery(button.dataset.filter);
    }),
  );
  renderGallery();

  function searchEntries() {
    const entries = [
      ...readingOrder.map((key) => ({
        title:
          key === "intro"
            ? "Shuo Song — The person behind the work"
            : names[key],
        type: "COLLECTION",
        keywords:
          key === "intro"
            ? "intro profile biography education Toulouse Xiamen contact"
            : key,
        action: () => navigate(key),
      })),
      ...papers.map((paper, index) => ({
        ...paper,
        type: "RESEARCH",
        action: () => openPaper(index),
      })),
      {
        title: "稼轩词编年笺注 — Xin Qiji",
        type: "LIBRARY",
        keywords: "poetry book 辛弃疾 邓广铭 reading",
        action: () => navigate("library"),
      },
    ];
    // The unlisted collection only joins the index after the visitor has found it.
    if (discovered)
      entries.push(
        ...photos.map((photo) => ({
          title: photo.title,
          type: "ELSEWHERE",
          keywords: photo.location,
          action: async () => {
            await choosePhoto(photo.index, true);
            await navigate("gallery");
          },
        })),
      );
    return entries;
  }
  function renderSearch() {
    const query = $("#archive-search").value.trim().toLocaleLowerCase();
    const results = searchEntries().filter(
      (entry) =>
        !query ||
        `${entry.title} ${entry.keywords}`.toLocaleLowerCase().includes(query),
    );
    $("#search-results").replaceChildren();
    $("#search-summary").textContent =
      `${results.length} RECORD${results.length === 1 ? "" : "S"}`;
    if (!results.length) {
      const empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent =
        "No matching records. Try “AI”, “Intro”, or “poetry”.";
      $("#search-results").append(empty);
    }
    results.forEach((entry) => {
      const button = document.createElement("button");
      button.className = "search-result";
      button.append(document.createTextNode(entry.title));
      const type = document.createElement("span");
      type.textContent = entry.type;
      button.append(type);
      button.addEventListener("click", async () => {
        await closeDialog($("#search-dialog"));
        entry.action();
      });
      $("#search-results").append(button);
    });
  }
  async function openSearch() {
    if (busy || phase !== "ready" || $("dialog[open]")) return;
    $("#archive-search").value = "";
    renderSearch();
    await openDialog($("#search-dialog"));
    $("#archive-search").focus();
  }
  $("#open-index").addEventListener("click", openSearch);
  $("#archive-search").addEventListener("input", renderSearch);
  if (!/Mac|iPhone|iPad/.test(navigator.userAgent))
    $("#open-index kbd").textContent = "Ctrl K";
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if ($("#search-dialog").open) closeDialog($("#search-dialog"));
      else openSearch();
    }
    if (
      phase !== "ready" ||
      busy ||
      $("dialog[open]") ||
      event.target.closest("input,textarea")
    )
      return;
    if (
      view === "gallery" &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      event.preventDefault();
      movePhoto(event.key === "ArrowLeft" ? -1 : 1);
    }
    if (event.key === "Escape" && view !== "archive") navigate("archive");
  });

  // Original optical reliefs: layered incisions, interference, and discontinuous strata.
  // The plates themselves are the navigation objects; there is no unrelated decorative orbit.
  const reliefs = $$(".relief").map((canvas) => ({
    canvas,
    context: canvas.getContext("2d"),
    type: Number(canvas.dataset.pattern),
  }));
  function scheduleRelief() {
    if (!frame) frame = requestAnimationFrame(drawReliefs);
  }
  function drawReliefs(timestamp) {
    frame = 0;
    if (document.hidden || view !== "archive" || !ambientVisible) return;
    if (paused && !reliefDirty) return;
    if (!paused && timestamp - lastFrame < 1000 / 24) {
      scheduleRelief();
      return;
    }
    if (!paused)
      reliefTime += Math.min((timestamp - lastFrame) / 1000 || 0, 0.06);
    lastFrame = timestamp;
    for (const { canvas, context: ctx, type } of reliefs) {
      if (!ctx) continue;
      if (mobileLayout.matches && phase === "ready" && type !== selectedSlab)
        continue;
      const w = canvas.width,
        h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const t = reliefTime * 0.15;
      // A softly shaded, milled surface; its boundaries echo the layers of the archive.
      const gradient = ctx.createLinearGradient(
        w * 0.18,
        h * 0.22,
        w * 0.88,
        h * 0.82,
      );
      gradient.addColorStop(0, "#eff3e880");
      gradient.addColorStop(0.5, "#a4b39120");
      gradient.addColorStop(1, "#e4ecda30");
      ctx.fillStyle = gradient;
      ctx.fillRect(w * 0.12, h * 0.22, w * 0.76, h * 0.58);
      ctx.save();
      ctx.beginPath();
      ctx.rect(w * 0.13, h * 0.23, w * 0.75, h * 0.56);
      ctx.clip();
      if (type === 0) {
        for (let line = 0; line < 64; line++) {
          const baseY = h * 0.24 + line * 5.6;
          ctx.beginPath();
          for (let step = 0; step <= 100; step++) {
            const x = w * (0.1 + (step / 100) * 0.85);
            const fold = Math.exp(-Math.pow((x / w - 0.55) * 4.2, 2));
            const wave = Math.sin(line * 0.09 + t + (x / w) * 2.2) * 54 * fold;
            const y = baseY + wave;
            step ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.strokeStyle = line % 7 === 0 ? "#64794e95" : "#84937665";
          ctx.lineWidth = line % 7 === 0 ? 1.5 : 0.8;
          ctx.stroke();
        }
      } else if (type === 1) {
        for (let line = 0; line < 75; line++) {
          ctx.beginPath();
          for (let step = 0; step <= 75; step++) {
            const x = w * (0.12 + (step / 75) * 0.8),
              y = h * 0.22 + line * 4.8;
            const ridge =
              Math.exp(-Math.pow((x / w - 0.5) * 7, 2)) *
              Math.sin(line / 14 + t) *
              95;
            const px = x + Math.sin(line * 0.05 + t) * 12;
            step ? ctx.lineTo(px, y + ridge) : ctx.moveTo(px, y + ridge);
          }
          ctx.strokeStyle = line % 9 === 0 ? "#7d93626e" : "#717e6260";
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        ctx.strokeStyle = "#71805844";
        ctx.lineWidth = 0.7;
        for (let x = 0.22; x < 0.85; x += 0.08) {
          ctx.beginPath();
          ctx.moveTo(w * x, h * 0.25);
          ctx.lineTo(w * x, h * 0.77);
          ctx.stroke();
        }
      } else if (type === 2) {
        for (let line = 0; line < 75; line++) {
          const y = h * 0.23 + line * 4.8;
          const indentation = 20 + Math.sin(line * 0.14 + t) * 15;
          const cut = w * (0.55 + 0.06 * Math.sin(line * 0.18 + t));
          ctx.strokeStyle = line % 6 === 0 ? "#778967a0" : "#a2af915f";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(w * 0.17 + indentation, y);
          ctx.lineTo(cut - 16, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cut + 13, y + 15);
          ctx.lineTo(w * 0.87 - indentation, y + 15);
          ctx.stroke();
        }
      } else {
        for (let line = 0; line < 85; line++) {
          const x = w * 0.12 + line * 4.4;
          const cut = h * (0.51 + 0.04 * Math.sin(line * 0.06 + t));
          ctx.strokeStyle = line % 11 === 0 ? "#6d7e52a0" : "#82906a65";
          ctx.lineWidth = line % 5 === 0 ? 1.6 : 0.7;
          ctx.beginPath();
          ctx.moveTo(x, h * 0.24 + Math.sin(line * 0.08) * 16);
          ctx.lineTo(x + 16, cut - 12);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + 23, cut + 8);
          ctx.lineTo(x + 42, h * 0.8);
          ctx.stroke();
        }
      }
      // Thin diagnostic cuts give each translucent plate a distinct internal construction.
      ctx.fillStyle = "#f4f6ec77";
      ctx.fillRect(w * 0.17, h * 0.58, w * 0.69, 2);
      ctx.strokeStyle = "#75816460";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(w * 0.19, h * 0.28, w * 0.6, h * 0.44);
      ctx.restore();
    }
    reliefDirty = false;
    if (!paused) scheduleRelief();
  }
  new IntersectionObserver(
    (entries) => {
      ambientVisible = entries[0].isIntersecting;
      if (ambientVisible) {
        reliefDirty = true;
        scheduleRelief();
      }
    },
    { threshold: 0.05 },
  ).observe($("#room-stage"));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      reliefDirty = true;
      scheduleRelief();
    }
  });

  root.classList.add("js");
  // Store only motion preferences. Never reuse visitor admission from the previous design.
  setMotion();
  selectSlab(0);
  choosePhoto(0, true);
  showEntry();
})();
