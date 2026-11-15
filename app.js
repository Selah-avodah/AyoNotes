(function () {
  "use strict";

  var cfg = window.JAR_OF_NOTES || window.COOKIE_JAR || {};
  var $ = function (id) { return document.getElementById(id); };

  var synth = $("synth"), keybed = $("keybed"), wrap = $("keybedWrap");
  var lcd1 = $("lcd1"), lcd2 = $("lcd2"), statusEl = $("status");
  var noteDialog = $("noteDialog"), addDialog = $("addDialog"), fx = $("fx");

  var sb = NoteForm.client(cfg);
  var formEnabled = !!sb || !!cfg.demo;

  // ---------- titles ----------
  var title = cfg.title || "Jar of Notes";
  $("title").textContent = title;
  $("brandName").textContent = title;
  document.title = title;
  $("subtitle").textContent = cfg.subtitle || "";

  // ---------- notes ----------
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return "";
    if (Date.now() - d.getTime() < 60 * 1000) return "Just now";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  var localNotes = (cfg.notes || [])
    .filter(function (n) { return n && (n.text || n.image); })
    .map(function (n, i) {
      return { id: "local-" + i + "-" + (n.from || ""), from: n.from, text: n.text, image: n.image, alt: n.alt, date: n.date || "" };
    });
  var sessionNotes = [];
  var notes = localNotes.slice();

  function toNote(r) {
    return { id: r.id, from: r.from_name, text: r.message, image: r.image || null, date: fmtDate(r.created_at) };
  }

  function setRemote(rows) {
    rows = rows.slice().sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
    notes = localNotes.concat(rows.map(toNote), sessionNotes);
    render();
  }

  // ---------- played (read) notes, remembered per browser ----------
  var PLAYED = "jar-of-notes-played:" + title;
  var played = {};
  try { played = JSON.parse(localStorage.getItem(PLAYED) || "{}") || {}; } catch (e) { played = {}; }
  function savePlayed() { try { localStorage.setItem(PLAYED, JSON.stringify(played)); } catch (e) {} }
  function playedCount() { return notes.filter(function (n) { return played[n.id]; }).length; }

  // ---------- music theory for the keys ----------
  var WHITE_SEMIS = [0, 2, 4, 5, 7, 9, 11];
  var LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  var HAS_BLACK = [1, 1, 0, 1, 1, 1, 0];       // C# D# _ F# G# A# _
  function midiFor(i, black) { return 48 + (Math.floor(i / 7) % 3) * 12 + WHITE_SEMIS[i % 7] + (black ? 1 : 0); }
  function keyName(i, black) { return LETTERS[i % 7] + (black ? "#" : "") + (3 + Math.floor(i / 7) % 3); }

  // ---------- LCD ----------
  var lcdTimer = null;
  function lcd(a, b, hold) {
    lcd1.textContent = a || " ";
    lcd2.textContent = b || " ";
    clearTimeout(lcdTimer);
    if (hold) lcdTimer = setTimeout(lcdIdle, hold);
  }
  function lcdIdle() {
    if (synth.classList.contains("off")) return lcd("", "");
    if (!notes.length) return lcd("NO NOTES YET", formEnabled ? "PRESS + ADD A NOTE" : "");
    var mods = moduleCount();
    lcd(notes.length + " NOTE" + (notes.length === 1 ? "" : "S") + " · " + mods + " MODULE" + (mods === 1 ? "" : "S"),
        playedCount() + "/" + notes.length + " PLAYED");
  }

  // ---------- keyboard layout ----------
  var renderedModules = 0;
  function moduleCount() { return Math.max(1, Math.ceil(notes.length / 7)); }

  function sizeKeys() {
    var K = moduleCount() * 7, vw = window.innerWidth, w, h;
    if (vw < 620) { w = 44; h = 172; }
    else { w = K <= 7 ? 72 : K <= 14 ? 58 : 50; h = Math.round(Math.min(236, Math.max(180, w * 3.4))); }
    keybed.style.setProperty("--w", w + "px");
    keybed.style.setProperty("--h", h + "px");
    requestAnimationFrame(updateOct);
  }

  var quaverSVG = '<svg class="q" viewBox="0 0 24 32" aria-hidden="true"><use href="#quaver"/></svg>';

  function render() {
    var M = moduleCount();
    keybed.innerHTML = "";
    for (var m = 0; m < M; m++) {
      var mod = document.createElement("div");
      mod.className = "module" + (renderedModules && m >= renderedModules ? " new" : "");
      var tag = document.createElement("span");
      tag.className = "module-tag";
      tag.textContent = "MOD " + (m + 1);
      mod.appendChild(tag);

      for (var k = 0; k < 7; k++) {
        var i = m * 7 + k, n = notes[i];
        var w = document.createElement("button");
        w.type = "button";
        w.className = "wkey " + (n ? (played[n.id] ? "read" : "unread") : "empty");
        w.dataset.i = i;
        w.setAttribute("aria-label", n ? "Note from " + (n.from || "a friend") + ", key " + keyName(i) : "Empty key " + keyName(i));
        if (n) {
          var name = document.createElement("span");
          name.className = "kname";
          name.textContent = n.from || "A friend";
          w.appendChild(name);
          w.insertAdjacentHTML("beforeend", quaverSVG);
        }
        mod.appendChild(w);
      }
      // black keys, each one attached to the white key on its left
      for (k = 0; k < 7; k++) {
        if (!HAS_BLACK[k]) continue;
        i = m * 7 + k;
        var b = document.createElement("button");
        b.type = "button";
        b.className = "bkey";
        b.dataset.i = i;
        b.dataset.black = "1";
        b.tabIndex = -1;
        b.style.left = "calc(var(--w) * " + (k + 1) + ")";
        b.setAttribute("aria-label", notes[i] ? "Note from " + (notes[i].from || "a friend") + ", black key" : "Empty black key");
        mod.appendChild(b);
      }
      keybed.appendChild(mod);
    }
    renderedModules = M;
    sizeKeys();
    updateStatus();
    lcdIdle();
    $("randomBtn").disabled = !notes.length;
  }

  function updateStatus() {
    statusEl.textContent = notes.length
      ? playedCount() + " of " + notes.length + " note" + (notes.length === 1 ? "" : "s") + " played · press any key"
      : formEnabled ? "No notes yet. Be the first to add one!" : "No notes yet. Add some in notes.js.";
  }

  function keysFor(i) { return keybed.querySelectorAll('[data-i="' + i + '"]'); }
  function whiteKey(i) { return keybed.querySelector('.wkey[data-i="' + i + '"]'); }

  // ---------- power ----------
  function powerOn(withFanfare) {
    if (!synth.classList.contains("off")) return;
    synth.classList.remove("off");
    $("powerBtn").setAttribute("aria-pressed", "true");
    Sound.unlock();
    if (withFanfare) {
      Sound.powerOn();
      keybed.querySelectorAll(".wkey").forEach(function (el, j) {
        setTimeout(function () { el.classList.add("lit"); }, j * 28);
        setTimeout(function () { el.classList.remove("lit"); }, j * 28 + 220);
      });
      lcd("HELLO!", "WELCOME TO THE JAR", 1800);
    } else lcdIdle();
  }
  function powerOff() {
    synth.classList.add("off");
    $("powerBtn").setAttribute("aria-pressed", "false");
    Sound.powerOff();
    lcd("", "");
  }
  $("powerBtn").addEventListener("click", function () {
    synth.classList.contains("off") ? powerOn(true) : powerOff();
  });

  // ---------- playing keys ----------
  function nudgeWheel() {
    var r = $("modWheel").querySelector(".wheel-ridge");
    r.style.top = (25 + Math.random() * 55) + "%";
  }

  function floatQuaver(el) {
    var r = el.getBoundingClientRect();
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 32");
    s.innerHTML = '<use href="#quaver"/>';
    s.style.left = (r.left + r.width / 2 - 11) + "px";
    s.style.top = (r.top + r.height * 0.45) + "px";
    s.style.setProperty("--dx", (Math.random() * 60 - 30) + "px");
    s.style.setProperty("--rot", (Math.random() * 50 - 25) + "deg");
    fx.appendChild(s);
    setTimeout(function () { s.remove(); }, 1500);
  }

  function sound(i, black, vel) {
    Sound.play(midiFor(i, black), 0, vel == null ? 0.8 : vel);
    nudgeWheel();
  }

  function flash(i, ms) {
    keysFor(i).forEach(function (el) { el.classList.add("down"); });
    setTimeout(function () { keysFor(i).forEach(function (el) { el.classList.remove("down"); }); }, ms || 170);
  }

  function showKeyOnLcd(i, black) {
    var n = notes[i];
    if (n) lcd("KEY " + (i + 1) + " · " + keyName(i, black), "FROM " + (n.from || "A FRIEND"), 5000);
    else lcd("KEY " + (i + 1) + " · " + keyName(i, black), formEnabled ? "EMPTY · ADD A NOTE" : "EMPTY KEY", 2500);
  }

  // pointer: sound on press for a snappy, real-keyboard feel
  var held = null;
  keybed.addEventListener("pointerdown", function (e) {
    var el = e.target.closest("[data-i]");
    if (!el) return;
    powerOn(false);
    var i = +el.dataset.i, black = !!el.dataset.black;
    keysFor(i).forEach(function (k) { k.classList.add("down"); });
    held = i;
    sound(i, black);
    showKeyOnLcd(i, black);
  });
  function release() {
    if (held == null) return;
    keysFor(held).forEach(function (k) { k.classList.remove("down"); });
    held = null;
  }
  document.addEventListener("pointerup", release);
  document.addEventListener("pointercancel", release);

  keybed.addEventListener("click", function (e) {
    var el = e.target.closest("[data-i]");
    if (!el) return;
    var i = +el.dataset.i, black = !!el.dataset.black;
    if (e.detail === 0) { powerOn(false); flash(i); sound(i, black); showKeyOnLcd(i, black); } // keyboard (Enter/Space)
    if (notes[i]) {
      floatQuaver(whiteKey(i));
      setTimeout(function () { openNote(i); }, 180);
    }
  });

  // a black key and its white key light up together
  keybed.addEventListener("mouseover", function (e) {
    var el = e.target.closest("[data-i]");
    if (el) keysFor(el.dataset.i).forEach(function (k) { k.classList.add("pair-hover"); });
  });
  keybed.addEventListener("mouseout", function (e) {
    var el = e.target.closest("[data-i]");
    if (el) keysFor(el.dataset.i).forEach(function (k) { k.classList.remove("pair-hover"); });
  });

  // computer keyboard plays the visible keys: A S D F G H J K L ;  (W E T Y U O P = black keys)
  var WHITE_MAP = "asdfghjkl;", BLACK_MAP = { w: 0, e: 1, t: 3, y: 4, u: 5, o: 7, p: 8 };
  document.addEventListener("keydown", function (e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (noteDialog.open || addDialog.open) return;
    if (/input|textarea|select/i.test(document.activeElement && document.activeElement.tagName)) return;
    var key = e.key.toLowerCase(), offset = WHITE_MAP.indexOf(key), black = false;
    if (offset < 0 && key in BLACK_MAP) { offset = BLACK_MAP[key]; black = true; }
    if (offset < 0) return;
    var first = firstVisibleKey(), i = first + offset;
    if (black && !HAS_BLACK[i % 7]) return;
    if (!whiteKey(i)) return;
    powerOn(false);
    flash(i);
    sound(i, black);
    showKeyOnLcd(i, black);
  });

  function keyWidth() { var k = keybed.querySelector(".wkey"); return k ? k.getBoundingClientRect().width : 50; }
  function firstVisibleKey() { return Math.max(0, Math.round(wrap.scrollLeft / keyWidth())); }

  // ---------- panel controls ----------
  function updateOct() {
    var overflow = wrap.scrollWidth > wrap.clientWidth + 2;
    $("octDown").parentElement.hidden = !overflow;
  }
  $("octDown").addEventListener("click", function () { Sound.tick(); wrap.scrollBy({ left: -keyWidth() * 7 }); });
  $("octUp").addEventListener("click", function () { Sound.tick(); wrap.scrollBy({ left: keyWidth() * 7 }); });
  window.addEventListener("resize", sizeKeys);

  function setKnob(el, value, count) {
    var angle = -120 + (240 * value) / (count - 1);
    el.querySelector(".knob-cap").style.transform = "rotate(" + angle + "deg)";
  }
  function bar(v, max) { var s = ""; for (var j = 0; j < max - 1; j++) s += j < v ? "■" : "□"; return s; }
  function initKnobs() {
    var s = Sound.get();
    setKnob($("knobVol"), s.vol, Sound.counts.vol);
    setKnob($("knobTone"), s.tone, Sound.counts.tone);
    setKnob($("knobVerb"), s.verb, Sound.counts.verb);
  }
  $("knobVol").addEventListener("click", function () {
    powerOn(false);
    var s = Sound.cycle("vol");
    setKnob(this, s.vol, Sound.counts.vol);
    lcd("VOLUME", s.vol ? bar(s.vol, Sound.counts.vol) : "MUTED", 1500);
    Sound.play(60, 0, 0.6);
  });
  $("knobTone").addEventListener("click", function () {
    powerOn(false);
    var s = Sound.cycle("tone");
    setKnob(this, s.tone, Sound.counts.tone);
    lcd("TONE", s.toneName, 1500);
    Sound.play(60, 0, 0.7); Sound.play(64, 0.08, 0.6); Sound.play(67, 0.16, 0.6);
  });
  $("knobVerb").addEventListener("click", function () {
    powerOn(false);
    var s = Sound.cycle("verb");
    setKnob(this, s.verb, Sound.counts.verb);
    lcd("ECHO", s.verb ? bar(s.verb, Sound.counts.verb) : "OFF", 1500);
    Sound.play(67, 0, 0.7);
  });

  // ---------- random note: a quick run up the keys, landing on the chosen one ----------
  var running = false;
  $("randomBtn").addEventListener("click", function () {
    if (!notes.length || running) return;
    powerOn(false);
    var pool = notes.map(function (_, i) { return i; }).filter(function (i) { return !played[notes[i].id]; });
    if (!pool.length) pool = notes.map(function (_, i) { return i; });
    var target = pool[Math.floor(Math.random() * pool.length)];
    var start = Math.max(0, target - 9);
    var steps = target - start;
    running = true;
    lcd("SHUFFLING…", "", 0);
    var el = whiteKey(target);
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

    for (var s = 0; s <= steps; s++) {
      (function (s) {
        setTimeout(function () {
          var i = start + s, last = s === steps;
          flash(i, last ? 260 : 90);
          Sound.play(midiFor(i), 0, last ? 0.9 : 0.35, last ? 1 : 0.35);
          if (last) {
            showKeyOnLcd(i, false);
            floatQuaver(whiteKey(i));
            setTimeout(function () { running = false; openNote(i); }, 380);
          }
        }, s * 65);
      })(s);
    }
  });

  // ---------- reading a note ----------
  var current = 0;
  function openNote(i) {
    current = i;
    var n = notes[i];
    if (!n) return;
    $("noteKey").textContent = "Key " + (i + 1) + " · " + keyName(i);
    $("noteFrom").textContent = "From " + (n.from || "a friend");
    var body = $("noteBody");
    body.innerHTML = "";
    if (n.image) {
      var wrapImg = document.createElement("div");
      wrapImg.className = "note-img-wrap";
      var img = document.createElement("img");
      img.src = n.image;
      img.alt = n.alt || ("Note from " + (n.from || "a friend"));
      wrapImg.appendChild(img);
      body.appendChild(wrapImg);
    }
    if (n.text) {
      var p = document.createElement("p");
      p.textContent = n.text;
      body.appendChild(p);
    }
    $("noteDate").textContent = n.date || "";
    $("notePos").textContent = (i + 1) + " / " + notes.length;
    $("prevNote").disabled = i === 0;
    $("nextNote").disabled = i === notes.length - 1;
    if (!noteDialog.open) noteDialog.showModal();
    noteDialog.querySelector(".sheet").scrollTop = 0;

    if (!played[n.id]) {
      played[n.id] = 1;
      savePlayed();
      var w = whiteKey(i);
      if (w) { w.classList.remove("unread"); w.classList.add("read"); }
      updateStatus();
    }
  }
  function step(d) {
    var i = current + d;
    if (i < 0 || i >= notes.length) return;
    flash(i); sound(i, false, 0.7); showKeyOnLcd(i, false);
    openNote(i);
  }
  $("prevNote").addEventListener("click", function () { step(-1); });
  $("nextNote").addEventListener("click", function () { step(1); });
  noteDialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  noteDialog.addEventListener("close", lcdIdle);

  [noteDialog, addDialog].forEach(function (d) {
    d.addEventListener("click", function (e) {
      if (e.target === d || (e.target.closest && e.target.closest("[data-close]"))) d.close();
    });
  });

  // ---------- adding a note ----------
  var lastAdded = null;
  var form = NoteForm.init($("addRoot"), {
    cfg: cfg,
    sb: sb,
    onAdded: function (n) {
      n.date = "Just now";
      sessionNotes.push(n);
      notes.push(n);
      lastAdded = notes.length - 1;
      render();
    },
    onError: function () { Sound.error(); }
  });

  function openAdd() {
    if (form.isDone()) form.reset();
    Sound.unlock(); Sound.tick();
    if (!addDialog.open) addDialog.showModal();
    setTimeout(form.focus, 60);
  }

  $("seeKeys").addEventListener("click", function () {
    addDialog.close();
    powerOn(false);
    if (lastAdded == null) return;
    var el = whiteKey(lastAdded);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", inline: "center", block: "center" });
    var i = lastAdded;
    setTimeout(function () {
      flash(i, 400); sound(i, false); floatQuaver(el); showKeyOnLcd(i, false);
      el.classList.add("lit");
      setTimeout(function () { el.classList.remove("lit"); }, 1200);
    }, 450);
  });

  if (formEnabled) {
    $("addBtn").hidden = false;
    $("addBtn").addEventListener("click", openAdd);
    if (/[?&]add\b/.test(location.search)) openAdd();
  }

  // ---------- start ----------
  initKnobs();
  render();

  // Notes come from three places, best first:
  //   1. Supabase (live): newest, but may be paused or down
  //   2. backup/notes.json (hosted on Vercel): refreshed by the GitHub backup task
  //   3. this browser's copy of the last live load
  var CACHE = "jar-of-notes-cache:" + title;
  var cachedRows = [];
  try { cachedRows = JSON.parse(localStorage.getItem(CACHE) || "[]") || []; } catch (e) { cachedRows = []; }
  var backupById = {}, backupRows = [], liveLoaded = false;

  var backupReady = fetch("backup/notes.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (rows) {
      backupRows = Array.isArray(rows) ? rows : [];
      backupRows.forEach(function (r) { backupById[r.id] = r; });
    });

  backupReady.then(function () {
    if (liveLoaded) return;
    var seen = {}, rows = [];
    backupRows.forEach(function (r) { seen[r.id] = 1; rows.push(r); });
    cachedRows.forEach(function (r) { if (!seen[r.id]) rows.push(r); });
    if (rows.length) setRemote(rows);
  });

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error("Timed out reaching Supabase")); }, ms);
    })]);
  }

  if (sb) {
    withTimeout(
      sb.from("notes").select("id, created_at, from_name, message, image_path").order("created_at", { ascending: true }).limit(1000),
      8000
    )
      .then(function (res) {
        if (res.error) throw res.error;
        return backupReady.then(function () {
          liveLoaded = true;
          var rows = (res.data || []).map(function (r) {
            var saved = backupById[r.id];
            return {
              id: r.id, created_at: r.created_at, from_name: r.from_name, message: r.message,
              image: (saved && saved.image) || (r.image_path ? NoteForm.publicUrl(sb, r.image_path) : null)
            };
          });
          try { localStorage.setItem(CACHE, JSON.stringify(rows)); } catch (e) {}
          sessionNotes = [];
          setRemote(rows);
        });
      })
      .catch(function (e) { console.warn("Jar of Notes: live notes unavailable, showing the saved copy.", e); });
  }
})();
