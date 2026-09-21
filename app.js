/* ARCADE STUDIO — public preview.
   Particle spheres, staggered reveals, sliding pills, and a working
   model of the console. All state is local; nothing generates here. */

(function () {
  "use strict";

  /* ---------------- gate ---------------- */
  var GATE_HASH = "60d194c6f504e1f2140a8df17fd37d0a3d9c44b1a75917096502ad166d6d6748";
  var GATE_KEY = "arcade-gate";
  var gateForm = document.getElementById("gate-form");
  var gateInput = document.getElementById("gate-input");
  var gateErr = document.getElementById("gate-err");

  function sha256Hex(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }
  function unlock() {
    document.documentElement.classList.add("unlocked");
    try { localStorage.setItem(GATE_KEY, GATE_HASH); } catch (e) {}
    window.dispatchEvent(new Event("resize"));
    boot();
  }
  if (gateForm) gateForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var value = gateInput.value;
    if (!value) return;
    if (!(window.crypto && crypto.subtle)) {
      gateErr.hidden = false;
      gateErr.textContent = "This browser can't verify the password. Use HTTPS.";
      return;
    }
    sha256Hex(value).then(function (hex) {
      if (hex === GATE_HASH) {
        unlock();
      } else {
        gateErr.hidden = false;
        gateErr.textContent = "That's not it. Try again.";
        gateInput.select();
      }
    });
  });

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var motionOff = false;

  /* ---------------- toast ---------------- */
  var toastEl = document.getElementById("toast");
  var toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-on"); }, 3200);
  }

  /* ---------------- particle dot sphere ---------------- */
  function dotSphere(canvas, opts) {
    if (!canvas) return null;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var N = opts.count || 700;
    var pts = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2;
      var r = Math.sqrt(1 - y * y);
      var th = golden * i;
      pts.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r, tint: Math.random() });
    }
    var rot = 0, tiltTarget = 0, tilt = 0, raf = null, running = false;
    var W = 0, H = 0;

    function size() {
      var b = canvas.getBoundingClientRect();
      W = b.width; H = b.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function render() {
      ctx.clearRect(0, 0, W, H);
      var R = Math.min(W, H) * (opts.radius || 0.34);
      var cx = W * (opts.cx || 0.5), cy = H * (opts.cy || 0.5);
      rot += opts.speed || 0.0016;
      tilt += (tiltTarget - tilt) * 0.04;
      var st = Math.sin(tilt), ct = Math.cos(tilt);
      var sr = Math.sin(rot), cr = Math.cos(rot);
      for (var i = 0; i < N; i++) {
        var p = pts[i];
        var x = p.x * cr + p.z * sr;
        var z = -p.x * sr + p.z * cr;
        var y = p.y * ct - z * st;
        z = p.y * st + z * ct;
        var s = 1 / (1.9 - z * 0.75);
        var px = cx + x * R * s * 1.55;
        var py = cy + y * R * s * 1.55;
        var a = (z + 1) / 2;
        var rad = (opts.dot || 1.5) * s * (0.5 + a);
        if (p.tint > 0.93) {
          ctx.fillStyle = "rgba(255,77,0," + (0.12 + a * 0.5) + ")";
        } else if (p.tint > 0.86) {
          ctx.fillStyle = "rgba(143,123,255," + (0.12 + a * 0.5) + ")";
        } else {
          ctx.fillStyle = (opts.darkDots ? "rgba(255,255,255," : "rgba(11,11,15,") + (0.05 + a * (opts.alpha || 0.3)) + ")";
        }
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, 6.2832);
        ctx.fill();
      }
    }
    function frame() {
      render();
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (reduced || motionOff) { size(); render(); return; }
      if (running) return;
      running = true; size(); raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }
    window.addEventListener("resize", function () { size(); });
    if (opts.parallax) {
      window.addEventListener("pointermove", function (e) {
        tiltTarget = ((e.clientY / window.innerHeight) - 0.5) * 0.5;
      }, { passive: true });
    }
    return { start: start, stop: stop, size: size };
  }

  var heroSphere = dotSphere(document.getElementById("hero-canvas"), { count: 900, radius: 0.42, cy: 0.42, speed: 0.0014, dot: 1.4, alpha: 0.26, parallax: true });
  var finalSphere = dotSphere(document.getElementById("final-canvas"), { count: 550, radius: 0.5, cy: 0.5, speed: 0.001, dot: 1.3, alpha: 0.16 });
  var gateSphere = dotSphere(document.getElementById("gate-canvas"), { count: 700, radius: 0.4, speed: 0.0012, dot: 1.4, alpha: 0.22 });

  if (!document.documentElement.classList.contains("unlocked")) {
    if (gateSphere) gateSphere.start();
  }

  /* pause offscreen spheres */
  function watchSphere(id, sphere) {
    var el = document.getElementById(id);
    if (!el || !sphere || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (es) {
      es.forEach(function (en) { en.isIntersecting ? sphere.start() : sphere.stop(); });
    }, { rootMargin: "80px" }).observe(el);
  }

  /* ---------------- staggered reveals ---------------- */
  function initReveals() {
    var els = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window) || reduced) {
      els.forEach(function (el) { el.classList.add("is-shown"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-shown");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- number pop-in ---------------- */
  function popNumber(el, str) {
    el.classList.remove("is-animating");
    el.innerHTML = "";
    for (var i = 0; i < str.length; i++) {
      var s = document.createElement("span");
      s.className = "t-digit";
      if (i > 0) s.setAttribute("data-stagger", String(Math.min(i, 2)));
      s.textContent = str[i];
      el.appendChild(s);
    }
    void el.offsetWidth; /* reflow so the replay always fires */
    el.classList.add("is-animating");
  }

  /* ---------------- sliding pill tabs ---------------- */
  function initPills() {
    document.querySelectorAll(".t-tabs").forEach(function (group) {
      var pill = group.querySelector(".t-tabs-pill");
      var tabs = Array.prototype.slice.call(group.querySelectorAll(".t-tab"));
      function move(tab, instant) {
        if (!pill || !tab) return;
        var gb = group.getBoundingClientRect();
        var tb = tab.getBoundingClientRect();
        if (instant) pill.style.transition = "none";
        pill.style.width = tb.width + "px";
        pill.style.transform = "translateX(" + (tb.left - gb.left) + "px)";
        if (instant) { void pill.offsetWidth; pill.style.transition = ""; }
      }
      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          tabs.forEach(function (t) { t.setAttribute("aria-selected", t === tab ? "true" : "false"); });
          move(tab);
        });
      });
      function sync(instant) {
        var on = group.querySelector('.t-tab[aria-selected="true"]') || tabs[0];
        move(on, instant);
      }
      window.addEventListener("resize", function () { sync(true); });
      group._sync = sync;
      sync(true);
    });
  }

  /* ---------------- nav ---------------- */
  var nav = document.getElementById("nav");
  var burger = document.getElementById("nav-burger");
  window.addEventListener("scroll", function () {
    nav.classList.toggle("is-scrolled", window.scrollY > 20);
  }, { passive: true });
  burger.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    a.addEventListener("click", function () {
      nav.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    });
  });
  /* scroll spy */
  function initSpy() {
    var links = document.querySelectorAll(".nav-links a[data-spy]");
    var map = {};
    links.forEach(function (a) {
      var el = document.getElementById(a.getAttribute("data-spy"));
      if (el) map[a.getAttribute("data-spy")] = a;
    });
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) { a.classList.remove("is-on"); });
          var a = map[en.target.id];
          if (a) a.classList.add("is-on");
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  /* ---------------- waitlist ---------------- */
  document.querySelectorAll(".js-waitlist").forEach(function (b) {
    b.addEventListener("click", function () {
      toast("The waitlist opens with the Studio launch — this is the preview build.");
    });
  });

  /* ---------------- console ---------------- */
  var MODELS = [
    { id: "seedance", name: "Seedance", kind: "VIDEO", logo: "assets/model-logos/seed-bytedance-official.svg", desc: "Reference-led scenes and cinematic motion." },
    { id: "kling", name: "Kling", kind: "VIDEO", logo: "assets/model-logos/kling.svg", desc: "Expressive character performance and dynamic motion." },
    { id: "gpt-image", name: "ChatGPT Images", kind: "IMAGE", logo: "assets/model-logos/openai.svg", desc: "Images and key art with strong instruction following." },
    { id: "vidu", name: "Vidu", kind: "VIDEO", logo: "assets/model-logos/vidu.svg", desc: "Fast iteration for reference-driven video." },
    { id: "nano-banana", name: "Nano Banana", kind: "IMAGE", logo: "assets/model-logos/nano-banana-official.svg", desc: "Visual exploration and precise image edits." },
    { id: "veo", name: "Veo", kind: "VIDEO", logo: "assets/model-logos/veo-official.svg", desc: "Cinematic shots with native sound." }
  ];
  var modelRow = document.getElementById("console-model-row");
  var consoleModel = MODELS[0];
  MODELS.forEach(function (m, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "model-pill" + (i === 0 ? " is-on" : "");
    b.id = "model-" + m.id;
    b.innerHTML = '<img src="' + m.logo + '" alt="">' + m.name;
    b.addEventListener("click", function () {
      consoleModel = m;
      modelRow.querySelectorAll(".model-pill").forEach(function (p) { p.classList.remove("is-on"); });
      b.classList.add("is-on");
    });
    modelRow.appendChild(b);
  });

  var consoleInput = document.getElementById("console-input");
  var ghost = document.getElementById("console-ghost");
  var GHOSTS = {
    video: [
      "A courier crosses a frozen station at first light, camera low, steam everywhere…",
      "Recast the lead in my uploaded take. Keep the timing. Show me the plan first…",
      "A red pursuit vehicle through a cathedral city, one continuous shot…"
    ],
    image: [
      "Key art for a night-train thriller — silver case, sodium light, quiet menace…",
      "Product hero: a glass bottle on wet slate, dawn window light, no props…",
      "Character sheet, three angles, neon costume, consistent face…"
    ],
    story: [
      "Act one: a courier who can't remember what she's carrying…",
      "Outline a three-episode arc for my world — keep the cast small…",
      "Turn my draft script into a shot plan with the crew's notes…"
    ]
  };
  var medium = "video", ghostIdx = 0, ghostChar = 0, ghostTimer = null, ghostHold = 0;
  function ghostTick() {
    if (document.activeElement === consoleInput || consoleInput.value) { ghost.textContent = ""; ghostTimer = setTimeout(ghostTick, 500); return; }
    var lines = GHOSTS[medium];
    var line = lines[ghostIdx % lines.length];
    if (ghostChar <= line.length) {
      ghost.textContent = line.slice(0, ghostChar);
      ghostChar += 1;
      ghostTimer = setTimeout(ghostTick, 34);
    } else if (ghostHold < 46) {
      ghostHold += 1;
      ghostTimer = setTimeout(ghostTick, 50);
    } else {
      ghostHold = 0; ghostChar = 0; ghostIdx += 1;
      ghostTimer = setTimeout(ghostTick, 300);
    }
  }
  if (!reduced) ghostTick(); else ghost.textContent = GHOSTS.video[0];
  consoleInput.addEventListener("focus", function () { ghost.textContent = ""; });

  document.querySelectorAll('[data-tabs="medium"] .t-tab').forEach(function (t) {
    t.addEventListener("click", function () {
      medium = t.getAttribute("data-medium");
      ghostIdx = 0; ghostChar = 0; ghostHold = 0;
    });
  });
  document.querySelectorAll(".console-starts .chip[data-seed]").forEach(function (c) {
    c.addEventListener("click", function () {
      consoleInput.value = c.getAttribute("data-seed");
      consoleInput.focus();
    });
  });
  document.getElementById("console-go").addEventListener("click", function () {
    toast("Brief noted for " + consoleModel.name + ". Join the waitlist for Studio access — nothing generates in this preview.");
  });

  /* ---------------- hero reel: play when visible ---------------- */
  function autoplayWhenVisible(video) {
    if (!video || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting && !motionOff) { video.play().catch(function () {}); }
        else { video.pause(); }
      });
    }, { threshold: 0.35 }).observe(video);
  }
  autoplayWhenVisible(document.querySelector(".hero-reel-video"));

  /* ---------------- workflow film ---------------- */
  var filmVideo = document.getElementById("film-video");
  var filmToggle = document.getElementById("film-toggle");
  var filmSteps = document.querySelectorAll(".film-steps span");
  filmToggle.addEventListener("click", function () {
    if (filmVideo.paused) { filmVideo.play().catch(function () {}); filmToggle.textContent = "Pause motion"; }
    else { filmVideo.pause(); filmToggle.textContent = "Play walkthrough"; }
  });
  filmVideo.addEventListener("timeupdate", function () {
    if (!filmVideo.duration) return;
    var q = Math.min(3, Math.floor((filmVideo.currentTime / filmVideo.duration) * 4));
    filmSteps.forEach(function (s, i) { s.classList.toggle("is-on", i <= q); });
  });

  /* ---------------- image studio filters ---------------- */
  var grid = document.getElementById("image-grid");
  var countEl = document.getElementById("image-count");
  var catNames = { all: "All work", keyart: "Key art", products: "Products", characters: "Characters", worlds: "Worlds" };
  document.querySelectorAll("#image-filters .chip").forEach(function (c) {
    c.addEventListener("click", function () {
      document.querySelectorAll("#image-filters .chip").forEach(function (x) { x.classList.remove("is-on"); });
      c.classList.add("is-on");
      var cat = c.getAttribute("data-cat");
      var n = 0;
      grid.querySelectorAll("figure").forEach(function (f) {
        var show = cat === "all" || f.getAttribute("data-cat") === cat;
        f.classList.toggle("is-hidden", !show);
        if (show) n++;
      });
      countEl.textContent = n + " image" + (n === 1 ? "" : "s") + " · " + catNames[cat];
    });
  });

  /* ---------------- orbit ---------------- */
  var ring = document.getElementById("orbit-ring");
  var orbitEl = document.getElementById("orbit");
  var orbitNodes = [];
  var orbitAngle = 0;
  var detailKind = document.getElementById("model-kind");
  var detailName = document.getElementById("model-name");
  var detailDesc = document.getElementById("model-desc");
  var detailAdd = document.getElementById("model-add");
  var orbitSelected = 0;
  MODELS.forEach(function (m, i) {
    var n = document.createElement("button");
    n.type = "button";
    n.className = "orbit-node" + (i === 0 ? " is-on" : "");
    n.innerHTML = '<i><img src="' + m.logo + '" alt=""></i><span>' + m.name + "</span>";
    n.addEventListener("click", function () { selectModel(i); });
    ring.appendChild(n);
    orbitNodes.push(n);
  });
  function selectModel(i) {
    orbitSelected = i;
    var m = MODELS[i];
    orbitNodes.forEach(function (n, j) { n.classList.toggle("is-on", j === i); });
    detailKind.textContent = m.kind;
    detailName.textContent = m.name;
    detailDesc.textContent = m.desc;
    detailAdd.textContent = "Add " + m.name + " to my brief";
    popNumberLike(detailName);
  }
  function popNumberLike(el) {
    el.style.animation = "none"; void el.offsetWidth;
    el.style.animation = "t-digit-pop-in var(--digit-dur) var(--digit-ease) both";
  }
  detailAdd.addEventListener("click", function () {
    var m = MODELS[orbitSelected];
    consoleModel = m;
    modelRow.querySelectorAll(".model-pill").forEach(function (p) { p.classList.remove("is-on"); });
    var pill = document.getElementById("model-" + m.id);
    if (pill) pill.classList.add("is-on");
    toast(m.name + " added to your brief. The console is at the top.");
    document.getElementById("creator-prompt").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  });
  var orbitRaf = null;
  function orbitFrame() {
    orbitAngle += reduced || motionOff ? 0 : 0.0022;
    var b = orbitEl.getBoundingClientRect();
    var R = b.width * 0.41;
    orbitNodes.forEach(function (n, i) {
      var a = orbitAngle + (i / MODELS.length) * Math.PI * 2;
      var x = Math.cos(a) * R, y = Math.sin(a) * R * 0.92;
      n.style.transform = "translate(calc(-50% + " + x + "px), calc(-50% + " + y + "px))";
    });
    orbitRaf = requestAnimationFrame(orbitFrame);
  }
  var orbitSphere = dotSphere(document.getElementById("orbit-canvas"), { count: 420, radius: 0.46, speed: 0.001, dot: 1.1, alpha: 0.28, darkDots: true });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) {
          if (!orbitRaf) orbitRaf = requestAnimationFrame(orbitFrame);
          if (orbitSphere) orbitSphere.start();
        } else {
          cancelAnimationFrame(orbitRaf); orbitRaf = null;
          if (orbitSphere) orbitSphere.stop();
        }
      });
    }, { rootMargin: "60px" }).observe(orbitEl);
  } else {
    orbitRaf = requestAnimationFrame(orbitFrame);
  }

  /* ---------------- formats ---------------- */
  var FORMATS = {
    anime: { name: "Anime & manga", desc: "Character studies, graphic worlds, and stylized action. Develop a panel into a scene.", src: "assets/hd/clip-05.mp4", poster: "assets/hd/clip-05.jpg" },
    live: { name: "Live action", desc: "Grounded performances, real light, and believable places — directed like a shoot.", src: "assets/hd/clip-06.mp4", poster: "assets/hd/clip-06.jpg" },
    cinema: { name: "Cinema", desc: "Composed frames, deliberate camera movement, and scenes that earn their runtime.", src: "assets/hd/samurai-film.mp4", poster: "assets/hd/samurai-film.jpg" },
    game: { name: "Game worlds", desc: "Explorable environments, vehicles, and characters — the visual direction for a playable place.", src: "assets/hd/clip-07.mp4", poster: "assets/hd/clip-07.jpg" }
  };
  var formatVideo = document.getElementById("format-video");
  var formatName = document.getElementById("format-name");
  var formatDesc = document.getElementById("format-desc");
  document.querySelectorAll('[data-tabs="formats"] .t-tab').forEach(function (t) {
    t.addEventListener("click", function () {
      var f = FORMATS[t.getAttribute("data-format")];
      formatVideo.src = f.src; formatVideo.poster = f.poster;
      formatVideo.play().catch(function () {});
      formatName.innerHTML = f.name.replace("&", "&amp;");
      formatDesc.textContent = f.desc;
    });
  });
  autoplayWhenVisible(formatVideo);

  /* ---------------- flow ---------------- */
  var BRIEFS = {
    "mod-cast": "Recast the person in my uploaded video as my attached character. Preserve the performance, gesture timing, camera movement, scene composition, and background. Change only the character and their wardrobe. Show me the edit plan and generation cost before proceeding.",
    "mod-world": "Relocate my uploaded video to the attached environment reference. Preserve the performance, gesture timing, camera movement, and framing. Change only the location, set dressing, and ambient light. Show me the edit plan and generation cost before proceeding.",
    "mod-object": "Swap the highlighted element in my uploaded video for my attached item. Preserve the performance, gesture timing, camera movement, scene composition, and background. Change only that element and its reflections. Show me the edit plan and generation cost before proceeding."
  };
  var briefText = document.getElementById("edit-brief-text");
  ["mod-cast", "mod-world", "mod-object"].forEach(function (id) {
    document.getElementById(id).addEventListener("click", function () {
      ["mod-cast", "mod-world", "mod-object"].forEach(function (x) {
        document.getElementById(x).classList.toggle("is-on", x === id);
      });
      briefText.textContent = BRIEFS[id];
    });
  });
  document.getElementById("copy-brief").addEventListener("click", function () {
    var t = briefText.textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(t).then(function () { toast("Edit brief copied."); }, function () { toast("Couldn't copy — select the text instead."); });
    } else { toast("Couldn't copy — select the text instead."); }
  });
  autoplayWhenVisible(document.querySelector(".flow-video"));

  /* ---------------- collection rail: play in view ---------------- */
  document.querySelectorAll("#study-rail video").forEach(function (v) {
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting && !motionOff) v.play().catch(function () {});
        else v.pause();
      });
    }, { root: null, threshold: 0.4 }).observe(v);
  });

  /* ---------------- paths ---------------- */
  var PATHS = {
    drawing: { name: "The sketch is a starting point. Not a limit.", desc: "Bring a character drawing or visual reference. Develop its look, explore a world around it, then direct it in motion.", img: "assets/hd/stills/character-angles.webp" },
    script: { name: "The page already knows the tone.", desc: "Bring a script or a draft. The crew breaks it into scenes, casts it from your avatars, and plans the shots before anything generates.", img: "assets/hd/stills/interior-study.webp" },
    reference: { name: "One frame can carry a whole world.", desc: "Bring a still, a palette, or a film frame you love. Use it to hold the look while the story finds its shape.", img: "assets/hd/stills/world-atmosphere.webp" }
  };
  var pathName = document.getElementById("path-name");
  var pathDesc = document.getElementById("path-desc");
  var pathImg = document.getElementById("path-img");
  document.querySelectorAll('[data-tabs="paths"] .t-tab').forEach(function (t) {
    t.addEventListener("click", function () {
      var p = PATHS[t.getAttribute("data-path")];
      pathName.textContent = p.name;
      pathDesc.textContent = p.desc;
      pathImg.src = p.img;
    });
  });

  /* ---------------- agents ---------------- */
  var AGENTS = [
    { role: "Vera Kline · Director", line: "Protect the vision.", desc: "Find the tone, build the visual language, and give every scene a reason to exist.", io: "Creative direction → scene brief" },
    { role: "Min Park · Casting director", line: "Find the faces.", desc: "Match your avatars to the roles, keep every character consistent, and flag a miscast before it costs a take.", io: "Cast & avatars → character sheet" },
    { role: "Jules Mora · Script agent", line: "Guard the story.", desc: "Turn the idea into acts, scenes, and dialogue — and argue for the cut that makes the story stronger.", io: "Idea or draft → working script" },
    { role: "Rafi Okonkwo · DP", line: "Shape the light.", desc: "Choose the lens, the movement, and the light that carry the scene's intent into the frame.", io: "Scene brief → shot plan" },
    { role: "Helene Voss · Production designer", line: "Build the world.", desc: "Design the places, objects, and materials so every frame belongs to the same universe.", io: "World kit → set & props" }
  ];
  var agentRole = document.getElementById("agent-role");
  var agentLine = document.getElementById("agent-line");
  var agentDesc = document.getElementById("agent-desc");
  var agentIo = document.getElementById("agent-io");
  document.querySelectorAll(".agent-tab").forEach(function (t) {
    t.addEventListener("click", function () {
      var i = parseInt(t.getAttribute("data-agent"), 10);
      document.querySelectorAll(".agent-tab").forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
      var a = AGENTS[i];
      agentRole.textContent = a.role;
      agentLine.textContent = a.line;
      agentDesc.textContent = a.desc;
      agentIo.textContent = a.io;
      popNumberLike(agentLine);
    });
  });

  /* ---------------- voice player ---------------- */
  var audio = document.getElementById("voice-audio");
  var playBtn = document.getElementById("voice-play");
  var ticksEl = document.getElementById("voice-ticks");
  var timeEl = document.getElementById("voice-time");
  var TICKS = 46;
  for (var ti = 0; ti < TICKS; ti++) ticksEl.appendChild(document.createElement("i"));
  var tickEls = ticksEl.querySelectorAll("i");
  function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function renderTime() {
    var d = audio.duration && isFinite(audio.duration) ? audio.duration : 23;
    var q = (audio.currentTime || 0) / d;
    tickEls.forEach(function (t, i) { t.classList.toggle("is-past", i / TICKS <= q); });
    timeEl.textContent = fmt(audio.currentTime) + " / " + fmt(d);
    ticksEl.setAttribute("aria-valuenow", String(Math.floor(audio.currentTime || 0)));
  }
  playBtn.addEventListener("click", function () {
    if (audio.paused) { audio.play().catch(function () { toast("Audio couldn't start — tap again."); }); }
    else { audio.pause(); }
  });
  audio.addEventListener("play", function () { playBtn.classList.add("is-playing"); });
  audio.addEventListener("pause", function () { playBtn.classList.remove("is-playing"); });
  audio.addEventListener("timeupdate", renderTime);
  audio.addEventListener("ended", function () { audio.currentTime = 0; renderTime(); });
  function seekFromEvent(e) {
    var b = ticksEl.getBoundingClientRect();
    var q = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
    var d = audio.duration && isFinite(audio.duration) ? audio.duration : 23;
    audio.currentTime = q * d;
    renderTime();
  }
  ticksEl.addEventListener("click", seekFromEvent);
  ticksEl.addEventListener("keydown", function (e) {
    var d = audio.duration && isFinite(audio.duration) ? audio.duration : 23;
    if (e.key === "ArrowRight") { audio.currentTime = Math.min(d, audio.currentTime + 2); renderTime(); }
    if (e.key === "ArrowLeft") { audio.currentTime = Math.max(0, audio.currentTime - 2); renderTime(); }
  });
  renderTime();

  /* ---------------- assets tabs ---------------- */
  document.querySelectorAll('[data-tabs="assets"] .t-tab').forEach(function (t) {
    t.addEventListener("click", function () {
      var lib = t.getAttribute("data-lib");
      document.getElementById("assets-refs").hidden = lib !== "refs";
      document.getElementById("assets-creations").hidden = lib !== "creations";
    });
  });

  /* ---------------- pricing ---------------- */
  var amounts = document.querySelectorAll(".plan .amount");
  var bills = document.querySelectorAll(".plan-bill");
  function setBilling(mode, animate) {
    amounts.forEach(function (a) {
      var v = a.getAttribute(mode === "annual" ? "data-annual" : "data-monthly");
      if (animate) popNumber(a, v);
      else { a.textContent = v; }
    });
    bills.forEach(function (b) {
      b.textContent = b.getAttribute(mode === "annual" ? "data-a" : "data-m");
    });
  }
  document.querySelectorAll('[data-tabs="billing"] .t-tab').forEach(function (t) {
    t.addEventListener("click", function () {
      setBilling(t.getAttribute("data-billing"), !reduced);
    });
  });
  setBilling("monthly", false);

  /* ---------------- motion toggle ---------------- */
  var motionToggle = document.getElementById("motion-toggle");
  motionToggle.addEventListener("click", function () {
    motionOff = !motionOff;
    document.documentElement.classList.toggle("motion-off", motionOff);
    motionToggle.textContent = motionOff ? "Play motion" : "Pause motion";
    motionToggle.setAttribute("aria-pressed", motionOff ? "true" : "false");
    document.querySelectorAll("video").forEach(function (v) { if (motionOff) v.pause(); });
    if (motionOff) { heroSphere && heroSphere.stop(); finalSphere && finalSphere.stop(); orbitSphere && orbitSphere.stop(); }
    else { heroSphere && heroSphere.start(); }
  });

  /* ---------------- boot ---------------- */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    initPills();
    initReveals();
    initSpy();
    if (gateSphere) gateSphere.stop();
    if (heroSphere) { heroSphere.size(); watchSphere("cc-start", heroSphere); heroSphere.start(); }
    if (finalSphere) watchSphere("cc-final", finalSphere);
  }
  if (document.documentElement.classList.contains("unlocked")) boot();
})();
