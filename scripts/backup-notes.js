// Copies every approved note (and its photo) from Supabase into backup/
// so the website keeps working even if Supabase is paused or down.
// Run automatically by .github/workflows/backup-notes.yml — you don't need to run it yourself.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.join(__dirname, "..");
const BACKUP_DIR = path.join(ROOT, "backup");
const IMG_DIR = path.join(BACKUP_DIR, "images");
const SAFE_NAME = /^[a-z0-9-]+\.(jpg|png|webp|gif)$/;

// Read the Supabase details from notes.js (or from env vars if set)
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "notes.js"), "utf8"), ctx);
const cfg = ctx.window.JAR_OF_NOTES || ctx.window.COOKIE_JAR || {};
const url = (process.env.SUPABASE_URL || cfg.supabaseUrl || "").trim();
const key = (process.env.SUPABASE_KEY || cfg.supabaseKey || "").trim();

if (!url || !key) {
  console.log("Supabase isn't set up in notes.js yet, so there's nothing to back up.");
  process.exit(0);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  const { data, error } = await sb
    .from("notes")
    .select("id, created_at, from_name, message, image_path")
    .order("created_at", { ascending: true })
    .limit(5000);

  if (error) {
    // Fail loudly (GitHub emails you) and leave the existing backup untouched.
    console.error("Couldn't reach Supabase. Is the project paused? " + error.message);
    process.exit(1);
  }

  fs.mkdirSync(IMG_DIR, { recursive: true });
  const keep = new Set([".gitkeep"]);
  const out = [];

  for (const r of data) {
    let image = null;
    if (r.image_path && SAFE_NAME.test(r.image_path)) {
      const file = path.join(IMG_DIR, r.image_path);
      try {
        if (!fs.existsSync(file)) {
          const pub = sb.storage.from("note-images").getPublicUrl(r.image_path).data.publicUrl;
          const res = await fetch(pub);
          if (!res.ok) throw new Error("HTTP " + res.status);
          fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        }
        keep.add(r.image_path);
        image = "backup/images/" + r.image_path;
      } catch (e) {
        console.warn(`Couldn't download photo for note ${r.id}: ${e.message}`);
      }
    }
    out.push({
      id: r.id,
      created_at: r.created_at,
      from_name: r.from_name,
      message: r.message,
      image
    });
  }

  // Remove photos of notes you've deleted in Supabase
  for (const f of fs.readdirSync(IMG_DIR)) {
    if (!keep.has(f)) fs.unlinkSync(path.join(IMG_DIR, f));
  }

  fs.writeFileSync(path.join(BACKUP_DIR, "notes.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`Backed up ${out.length} note(s).`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
