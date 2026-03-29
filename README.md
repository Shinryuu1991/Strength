# Iron Log

A progressive web app (PWA) for tracking your 3:1 loading cycle training programme. Installable on iOS and Android directly from the browser — no app store required.

## Features

- **Session logging** — kg, reps, and feel (Easy / Moderate / Hard / Failed) per set
- **Day-aware** — auto-loads today's session based on day of week
- **Cycle & week tracker** — tap the badge to set your current position (C1W1 etc.)
- **Deload mode** — automatically reduces to 2 sets and shows a reminder on W4
- **PR detection** — flags personal records inline as you log
- **Progress chart** — line chart per lift across all cycles
- **Programme editor** — add, remove, rename exercises and training days
- **Offline support** — works without internet after first load
- **Dark mode** — follows system preference

## Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `ironlog`)
2. Push all files to the `main` branch
3. Go to **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` → `/root`
4. Your app will be live at `https://yourusername.github.io/ironlog`

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOURUSERNAME/ironlog.git
git push -u origin main
```

## Install on iPhone (iOS)

1. Open the GitHub Pages URL in **Safari**
2. Tap the **Share** button (box with arrow)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add**

The app will appear on your home screen and open fullscreen like a native app.

## Install on Android

1. Open the GitHub Pages URL in **Chrome**
2. Tap the **three-dot menu**
3. Tap **Add to Home Screen** or **Install App**
4. Tap **Install**

## Local development

```bash
# Serve locally (Python)
python3 -m http.server 8080

# Then open http://localhost:8080
```

> Note: The service worker requires HTTPS or localhost to register. GitHub Pages provides HTTPS automatically.

## Data storage

All session data is stored in your browser's `localStorage`. It persists across sessions on the same device and browser. It is not synced to the cloud.
