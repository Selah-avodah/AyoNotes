/*
  ============================================================
  JAR OF NOTES — settings and your own notes
  ============================================================

  1) FORM SETUP: paste your Supabase details below so friends can
     add notes through the form (share yoursite.vercel.app/add).
     Leave them empty and the form stays switched off.

  2) YOUR OWN NOTES (optional): you can also add notes here by hand.
     Each one gets a key on the keyboard. A note can have:
       from:  who it's from
       text:  a typed message (use backticks ` ` for multi-line)
       image: path to an image in the "notes" folder, e.g. "notes/sam.jpg"
       date:  optional, any text
     Notes sent through the form are stored in Supabase and appear
     automatically. You don't add those here.
*/

window.JAR_OF_NOTES = {
  title: "Birthday Notes for Ayolabi",
  subtitle: "Happy birthday, Labi! 🎉 - Here's your symphony :)) - AVDH",

  // ---- Note form (Supabase → Project Settings → API Keys) ----
  supabaseUrl: "https://hnihfyejckgkduiyassj.supabase.co",   // e.g. "https://abcdxyz.supabase.co"
  supabaseKey: "sb_publishable_29I7-iBAaE4iboMW1wBZtw_1UcCyVEL",   // the "publishable" (or "anon public") key, NOT the secret key
  requireApproval: false, // set true if you turned on approval (see README)

  // ---- Notes you add by hand (delete the examples) ----
  notes: []
};
