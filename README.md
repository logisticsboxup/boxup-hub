# BoxUp Logistics Hub

Desktop program (Windows) that holds every BoxUp logistics app in one window.

## What is in it
- **Sign in with Google** (only logisticsboxup@gmail.com). Stays signed in, so Label Log and Delivery Tracker open logged in.
- **Home**: photo background, Orders / Google search, today's numbers from the Label Log, Apps, Recent activity.
- **Apps open as tabs** under the green top bar: Shipping Label Generator, Order Tracker, Gate Scanner, Gate System, Label Log, Delivery Tracker, WhatsApp, Google, plus any website you add. Each tab has a close (x).
- **+ button**: BoxUp apps, websites, programs on this PC (Excel, Word, Downloads, any .exe).
- **Settings**: Settings, Home screen (apps and widgets on/off, order, background), Updates, Connections, WhatsApp messages (used by Order Tracker's Share on WhatsApp), Label details (sender address, footer, festival tag such as DIWALI GIFT), Activity log (with Excel).
- **Downloads** (label PDFs, manifests, Excel) go to `Downloads\BoxUp`.
- **Updates**: the program checks `https://logisticsboxup.github.io/boxup-hub/latest.json`. When a newer version is there, a bell and pop-up appear; nothing changes until you press **Update now**. Roll back is in Settings > Updates.

## Folders
- `main.js`, `preload.js`: the program itself
- `ui/`: the screens (these are what updates replace)
- `latest.json`: the update feed (made by `node scripts/make-update.js`)

## Publishing an update (for Claude / developer)
1. Change files in `ui/`, raise the number in `ui/version.json`, write `release-notes.json`.
2. Run `node scripts/make-update.js`.
3. Commit and push this repo in GitHub Desktop.

## Building the installer (developer only)
`npm install` then `npm run dist` (needs Windows, or Linux with Wine).
