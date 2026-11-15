# Jar of Notes 🎹

A red, modular MIDI-style keyboard where **every white key holds a note from a friend**.
Press a key to hear it and read the note. Each black key is attached to the white key on its left,
so pressing either one opens the same note. The keyboard adds a new octave module every 7 notes.

- **Play a random note**: runs up the keys and lands on a note you haven't read yet
- **Vol / Tone / Echo knobs**: click to change volume, sound (E.Piano, Vibes, Bell, Soft) and echo
- **Oct − / Oct +**: scroll along the keyboard when it's wider than the screen
- **Computer keyboard**: A S D F G H J K L play the white keys you can see; W E T Y U O P play the black keys
- Unread notes have a glowing gold quaver and a lit LED. Read ones fade.
- Friends add notes at **`/add`** (a page you can share), or with the **+ Add a note** button

---

## The files

| File | What it is | Edit it? |
|---|---|---|
| `notes.js` | Title, subtitle, Supabase details, and notes you add by hand | **Yes** |
| `index.html`, `style.css`, `app.js` | The keyboard page | No |
| `add.html` | The shareable "leave a note" page (`/add`) | No |
| `sound.js` | The built-in synth (no sound files needed) | No |
| `form.js` | Sends notes and photos to Supabase | No |
| `supabase-setup.sql` | Creates the database (run once) | No |
| `backup/`, `scripts/`, `.github/` | Automatic backup so notes survive Supabase being down | No |
| `vercel.json` | Makes `/add` work without `.html` | No |
| `notes/` | Images for notes you add by hand | Optional |

---

## Step 1: Supabase (the database for friends' notes)

**Already set up Supabase for the cookie jar?** Skip this step and reuse the same URL and key.
The database is unchanged.

1. Go to **supabase.com → New project** and name it `jar-of-notes`. Use a separate project from Eden.
2. Open **SQL Editor → New query**, paste everything from `supabase-setup.sql`, then click **Run**.
3. Go to **Project Settings → API Keys** and copy the **Project URL** and the **publishable** key
   (or the **anon public** key on older projects).
4. Paste both into `notes.js`:
   ```js
   supabaseUrl: "https://abcdxyz.supabase.co",
   supabaseKey: "sb_publishable_…",
   ```
   Never use the *secret* / *service_role* key.

## Step 2: Put the files in their own folder

1. Extract the zip to `C:\Users\user\` so you get `C:\Users\user\jar-of-notes`.
   Check that `index.html` is **directly inside** that folder.
2. Keep it **outside** the Eden folder.

> **Updating the cookie-jar repo instead?** Open your `cookie-jar` folder in VS Code, delete all its
> files **except the hidden `.git` folder**, copy everything from `jar-of-notes` in, then skip to Step 5.

## Step 3: Create an empty repository on GitHub

1. Go to github.com, click **+ → New repository**, and name it `jar-of-notes`.
2. Leave **Add README, .gitignore and license unticked**.
3. Click **Create repository** and copy the URL (`https://github.com/YOURNAME/jar-of-notes.git`).

## Step 4: Open it in its own VS Code window

1. Use **File → New Window**, then **File → Open Folder…** and choose `C:\Users\user\jar-of-notes`.
2. Check that Explorer shows `index.html` and `notes.js` at the top level, and that there's **no branch name**
   at the bottom left. If you see `main` or `dev-cookie`, you're in the wrong folder.

## Step 5: Upload

Open **Terminal → New Terminal**. Check the prompt ends in `\jar-of-notes>` (or `\cookie-jar>` if you're updating that repo).

**New repository:**
```
git init
git add .
git commit -m "Jar of Notes"
git branch -M main
git remote add origin https://github.com/YOURNAME/jar-of-notes.git
git push -u origin main
```

**Updating the cookie-jar repository:**
```
git add -A
git commit -m "Turn the cookie jar into Jar of Notes"
git push
```

Run `git remote -v` to confirm it points to the right repository, not Eden.

## Step 6: Deploy on Vercel

- **New repository:** go to vercel.com, click **Add New… → Project**, import **jar-of-notes**,
  set Framework Preset to **Other**, then click **Deploy**.
- **Cookie-jar repository:** nothing to do. Vercel redeploys automatically when you push.
  You can rename the project in Vercel → Settings to change the link.

## Step 7: Turn on the backup

On GitHub, open the repository's **Actions** tab, click **Enable workflows** if asked,
then **Back up Jar of Notes → Run workflow**. A green tick means it worked.

## Step 8: Share it

- **Link for friends to add notes:** `https://your-site.vercel.app/add`
- **The keyboard itself:** `https://your-site.vercel.app`

---

## Managing notes

- **See / delete notes:** Supabase → **Table Editor → notes**. Photos are in **Storage → note-images**.
- **Approve notes before they appear:** in the SQL Editor run
  `alter table public.notes alter column approved set default false;`,
  set `requireApproval: true` in `notes.js`, then commit and push.
  New notes wait until you tick **approved** in the Table Editor.
- **Notes you add by hand:** edit the `notes` list in `notes.js`. Delete the three examples
  and `notes/sample-note.svg` when you're ready.
- **Changing the title or subtitle:** edit the top of `notes.js`.

## Backup (if Supabase goes down)

Every 6 hours, a GitHub task copies all notes and photos into `backup/`, and Vercel hosts that copy.
The keyboard shows the backup instantly, then switches to live notes once Supabase answers.
If Supabase is paused, everyone still sees every note up to the last backup.
Only adding new notes stops working until it's back.

The backups also keep Supabase active, which helps stop the free project from pausing.
If a backup run shows a red cross, open Supabase and click **Restore project**.

Because the backup task commits to your repository, click **Sync Changes** in VS Code before editing.

## Good to know

- Anyone with the link can read the notes and add one. Turn on approval if you share it widely.
- Sound starts after the first tap or click, because browsers block audio until then.
  Check the **Vol** knob isn't on "MUTED".
- Read notes and knob settings are remembered per browser.
