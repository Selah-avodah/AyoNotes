/* Jar of Notes — shared "leave a note" form (used on index.html and add.html) */
window.NoteForm = (function () {
  "use strict";

  var BUCKET = "note-images";

  function client(cfg) {
    if (!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase && window.supabase.createClient)) return null;
    try {
      return window.supabase.createClient(cfg.supabaseUrl.trim(), cfg.supabaseKey.trim(), {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    } catch (e) { console.warn("Jar of Notes: couldn't connect to Supabase", e); return null; }
  }

  function publicUrl(sb, path) { return sb ? sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null; }

  function uid() {
    if (window.crypto && crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) {} }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (ch) {
      var r = Math.random() * 16 | 0; return (ch === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  // Shrink big phone photos before upload (max 1600px, JPEG)
  function preparePhoto(file) {
    if (file.type === "image/gif") {
      if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error("That GIF is too big (max 5 MB)."));
      return Promise.resolve({ blob: file, ext: "gif", type: "image/gif" });
    }
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight;
        var s = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement("canvas");
        cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        var g = cv.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) {
          if (b) resolve({ blob: b, ext: "jpg", type: "image/jpeg" });
          else reject(new Error("Couldn't process that photo. Try a screenshot of it instead."));
        }, "image/jpeg", 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("This browser can't read that photo format. Try a JPG or PNG, or a screenshot of it."));
      };
      img.src = url;
    });
  }

  /*
    root: element containing the form markup (data-f="…" hooks)
    opts: { cfg, sb, onAdded(note), onDone(live), onError() }
  */
  function init(root, opts) {
    var cfg = opts.cfg || {}, sb = opts.sb;
    var q = function (k) { return root.querySelector('[data-f="' + k + '"]'); };
    var form = q("form"), nameEl = q("name"), msgEl = q("msg"), photoEl = q("photo");
    var pick = q("pick"), preview = q("preview"), previewImg = q("previewImg");
    var errEl = q("error"), submitBtn = q("submit"), done = q("done"), doneMsg = q("doneMsg");
    var photoFile = null, photoUrl = null;
    var submitLabel = submitBtn.textContent;

    function setBusy(b) {
      submitBtn.disabled = b;
      submitBtn.textContent = b ? "Tuning up…" : submitLabel;
    }

    function clearPhoto() {
      photoFile = null; photoEl.value = "";
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = null; preview.hidden = true; pick.hidden = false;
    }

    function reset() {
      form.reset(); clearPhoto(); errEl.textContent = "";
      form.hidden = false; done.hidden = true; setBusy(false);
    }

    function fail(msg) {
      errEl.textContent = msg;
      if (opts.onError) opts.onError();
    }

    photoEl.addEventListener("change", function () {
      var f = photoEl.files && photoEl.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) {
        photoEl.value = ""; fail("That file isn't an image. Please choose a photo."); return;
      }
      errEl.textContent = "";
      photoFile = f; photoUrl = URL.createObjectURL(f);
      previewImg.src = photoUrl; preview.hidden = false; pick.hidden = true;
    });
    q("remove").addEventListener("click", clearPhoto);

    function finish(note, live) {
      if (live && note && opts.onAdded) opts.onAdded(note);
      form.hidden = true; done.hidden = false;
      doneMsg.textContent = live
        ? "Thanks for adding to the keyboard 💛"
        : "Thanks! It'll appear on the keyboard once it's been approved 💛";
      if (window.Sound) Sound.success();
      if (opts.onDone) opts.onDone(live);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (window.Sound) Sound.unlock();
      var name = nameEl.value.trim(), msg = msgEl.value.trim();
      errEl.textContent = "";
      if (!name) { nameEl.focus(); return fail("Please add your name."); }
      if (!msg && !photoFile) { msgEl.focus(); return fail("Write a message or add a photo (or both)."); }

      setBusy(true);

      // Preview/demo mode: no database, keep the note on this page only
      if (!sb) {
        var demo = function (img) {
          finish({ id: "demo-" + uid(), from: name, text: msg || null, image: img, created_at: new Date().toISOString() }, true);
        };
        if (photoFile) { var r = new FileReader(); r.onload = function () { demo(r.result); }; r.readAsDataURL(photoFile); }
        else demo(null);
        return;
      }

      var imagePath = null;
      var step = photoFile
        ? preparePhoto(photoFile).then(function (p) {
            imagePath = uid() + "." + p.ext;
            return sb.storage.from(BUCKET).upload(imagePath, p.blob, { contentType: p.type, upsert: false });
          }).then(function (res) { if (res.error) throw res.error; })
        : Promise.resolve();

      step
        .then(function () { return sb.from("notes").insert({ from_name: name, message: msg || null, image_path: imagePath }); })
        .then(function (res) {
          if (res.error) throw res.error;
          var live = !cfg.requireApproval;
          finish({
            id: "new-" + uid(), from: name, text: msg || null,
            image: imagePath ? publicUrl(sb, imagePath) : null,
            created_at: new Date().toISOString()
          }, live);
        })
        .catch(function (error) {
          console.error(error);
          setBusy(false);
          var m = (error && error.message) || "";
          fail(/too big|can't read|Couldn't process/.test(m) ? m
            : "Sorry, the keyboard couldn't be reached just now. Please try again in a little while.");
        });
    });

    var another = q("another");
    if (another) another.addEventListener("click", function () { reset(); nameEl.focus(); });

    return { reset: reset, focus: function () { nameEl.focus(); }, isDone: function () { return !done.hidden; } };
  }

  return { client: client, init: init, publicUrl: publicUrl };
})();
