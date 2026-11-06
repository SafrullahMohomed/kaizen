# Kaizen — notes for Claude Code

Kaizen is a personal, Deepstash-style microlearning web app (leadership, learning,
software engineering). It is a static PWA hosted on GitHub Pages and installed on an
iPhone with Share → Add to Home Screen. There is **no backend and no build step**:
plain HTML, CSS and ES modules. All personal data (progress, stashes, journal, reviews)
lives in the phone's localStorage; the repo only holds the app and the idea library.

The owner adds and updates ideas by asking Claude Code — no Claude API is involved.

## File map

```
index.html              app shell, iOS meta tags
styles.css              all styles (topic colors: .t-leadership / .t-learning / .t-engineering)
manifest.webmanifest    PWA manifest (relative paths — the site lives under /<repo>/)
sw.js                   service worker. VERSION must be bumped when app files change
js/app.js               boot, hash router, click delegation (data-act="…")
js/views.js             screens (Today, Explore, Source, Journey, Review, Library, You, onboarding)
js/reader.js            full-screen swipe reader
js/review.js            spaced-repetition flashcards + quick quiz
js/store.js             state in localStorage, streaks, badges, picks, stashes, actions, journal
js/content.js           loads /content, builds maps, chooses daily picks, search
js/srs.js               SM-2 style scheduler
js/art.js               generative card art per area + UI icons
js/sheets.js, js/ui.js  bottom sheets, toast, confirm
content/index.json      packs, topics, focus labels, contentVersion
content/packs/*.json    one pack per area: sources → ideas
content/journeys.json   guided paths (ordered idea ids)
tools/validate.mjs      content validator — run before every commit
```

## Content model

```jsonc
// content/packs/<area>.json
{
  "id": "engineering", "name": "Software engineering", "version": 1, "added": "2026-11-06",
  "sources": [{
    "id": "ddia",                         // kebab-case, unique across all packs, never renamed
    "title": "Designing Data-Intensive Applications",
    "author": "Martin Kleppmann", "year": 2017,
    "type": "book",                        // book | article | talk | letters | concept | podcast | course
    "focus": "systems",                    // a key from content/index.json "focus"
    "intro": "One-sentence hook shown on the source page.",
    "added": "2026-12-01",                 // optional; marks the source as new
    "ideas": [{
      "id": "dd-7",                        // <source prefix>-<n>, unique forever
      "title": "Punchy title, max ~9 words",
      "body": "Paragraph one.\n\nParagraph two.",   // 50–100 words, two short paragraphs
      "action": "One concrete thing to try today.",
      "q": "A recall question?",
      "a": "A short answer (one sentence).",
      "added": "2026-12-01"                // optional; defaults to source/pack date
    }]
  }]
}
```

### Writing rules (important)

- **Write every idea in your own words.** Summarize the concept; never copy passages
  from the book or article. A short, well-known phrase or framework name is fine
  (e.g. “disagree and commit”), but no quote longer than about ten words, and at most
  one per source.
- Attribute accurately. If a concept comes from someone other than the source author,
  say so in the body (e.g. “popularized by Gary Klein”). If unsure, leave it out.
- Body: 50–100 words, two short paragraphs separated by `\n\n`. Plain, concrete
  language. Use curly quotes “ ” inside text, not straight double quotes.
- `action`: something the owner (a software engineer growing into leadership) can do
  today at work, in one sentence.
- `q`/`a`: the question must be answerable from the card; the answer is one short
  sentence. Quiz distractors are drawn from other answers in the same area, so keep
  answers self-contained.
- Never change or reuse an existing idea `id` or source `id`: the phone stores progress
  by id. Editing text is fine. Deleting an idea is safe (the app skips missing ids) but
  rarely needed.

## How to add ideas (the usual request)

1. Read `content/index.json` and the relevant pack to see existing sources and ids.
2. Add the new source (or ideas to an existing source) in the right pack. Set
   `"added"` to today's date (YYYY-MM-DD) on each new source or idea.
3. Optionally add the new ids to a journey in `content/journeys.json`, or create a
   journey (`id`, `title`, `topic`, `blurb`, `learn` [3–4 short items], `ideas`).
4. Increment `contentVersion` in `content/index.json`.
5. Run `node tools/validate.mjs` and fix every error (warnings are advisory).
6. Commit and push to `main`. GitHub Pages redeploys in about a minute. The app
   fetches content network-first, shows “N new ideas just arrived”, marks them New and
   mixes them into the next daily picks. No service-worker bump needed for content.

## How to add a new area (e.g. “Product management”)

1. Add a topic to `content/index.json` → `topics`, a pack entry to `packs`, any new
   focus keys to `focus`, and create `content/packs/<id>.json`.
2. `styles.css`: add color variables and a `.t-<id>` rule like the existing three, plus
   a `.reader[data-topic="<id>"]` rule.
3. `js/art.js`: add a `PALETTE.<id>` entry and a drawing function in `DRAW` with a
   visual metaphor that fits the area.
4. Add the pack file to `CONTENT_FILES` in `sw.js`, bump `VERSION` (app files changed).
5. Validate, test, push.

## Changing app code

- Bump `VERSION` in `sw.js` (e.g. `kaizen-app-v2`) and `APP_VERSION` in `js/store.js`
  whenever any file outside `content/` changes; otherwise installed phones keep the
  cached copy. The app then shows “A new version of Kaizen is ready” with an Update button.
- If you add a new JS file, add it to `APP_FILES` in `sw.js`.
- Keep every path relative (`js/app.js`, not `/js/app.js`) — the site is served from
  `https://<user>.github.io/<repo>/`.
- No external CDNs, fonts or frameworks: the app must work offline.
- State shape changes must stay backward compatible (`load()` in `store.js` merges
  defaults); never wipe existing localStorage.

## Testing locally

```bash
python3 -m http.server 8000      # then open http://localhost:8000
node tools/validate.mjs
```

In the browser console, `window.__kaizen` exposes `{ S, C, render }` for debugging
(e.g. `__kaizen.S.state`).

## Example requests the owner might make

- “Add 8 ideas from *An Elegant Puzzle* by Will Larson to engineering.”
- “Create a journey called ‘Running great meetings’ from existing ideas.”
- “Add a new area for product management with 3 sources.”
- “Rewrite the Radical Candor ideas to be more practical for tech leads.”
