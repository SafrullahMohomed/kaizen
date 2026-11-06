# Kaizen

Small daily ideas on **leadership**, **learning** and **software engineering**, in the
spirit of Deepstash, with two things Deepstash lacks: spaced-repetition review so ideas
stick, and a “Try it” action plus journal so ideas turn into practice.

- **Today**: a daily goal of 3, 5, 10 or 15 ideas, a streak, a review reminder and today's actions.
- **Reader**: full-screen idea cards with generated art. Swipe up for the next one. Save, Try it, Reflect, Listen, Share.
- **Explore**: 31 books and sources, 169 ideas, and 11 guided journeys. Plus search.
- **Review**: flashcards on a spaced-repetition schedule, and a five-question quiz.
- **Library**: stashes (collections), reading history by day, your journal, and ideas you write yourself.
- **You**: streak, activity heatmap, stats, badges, settings, and backup and restore.

Everything runs in the browser and works offline. Your data stays on your iPhone.

## Put it online with GitHub Pages (about 3 minutes, no coding)

1. Sign in at [github.com](https://github.com) and create a **New repository** named `kaizen`.
   Make it **Public** (GitHub Pages is free for public repos) and click **Create repository**.
2. On the new repo page, click **uploading an existing file**. Unzip `kaizen.zip` on your
   computer, open the `kaizen` folder, select **everything inside it** (the `content`,
   `icons`, `js` and `tools` folders plus all the files) and drag it onto the page.
   Click **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**,
   branch **main**, folder **/ (root)**, then **Save**.
4. After a minute, your app is live at `https://<your-username>.github.io/kaizen/`.

## Install it on your iPhone

1. Open that address in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open Kaizen from the Home Screen icon and set it up there.

The Home Screen app keeps its own copy of your data, separate from Safari's, so do your
setup after opening it from the icon. Use **You → Back up your progress** now and then;
it saves a file you can keep in Files or iCloud Drive.

## Add new ideas later with Claude Code

No API key needed. Open this repository in Claude Code and ask, for example:

> Add 8 ideas from *An Elegant Puzzle* by Will Larson to the engineering pack.

`CLAUDE.md` tells Claude exactly how the content is structured, how to write ideas in
its own words, and how to validate and publish. After the push, open the app: it shows
“8 new ideas just arrived” and mixes them into your daily picks.

## Run it locally

```bash
python3 -m http.server 8000     # open http://localhost:8000
node tools/validate.mjs         # check the content files
```
