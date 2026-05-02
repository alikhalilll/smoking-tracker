# 🚬 Smoking Tracker

A minimal, mobile-first PWA for tracking daily cigarette consumption. Built with Vue 3 + Vite. Works fully offline.

## Features

- **Quick logging** — tap to log 1-10 cigarettes per session
- **7-day chart** — visual overview of your week
- **Daily history** — color-coded by consumption level
- **Stats** — daily average, total count, best day, days tracked
- **Dark mode** — automatic system theme detection
- **PWA** — install to home screen, works 100% offline
- **localStorage** — all data persists locally on your device

## Color coding

- 🟢 **Green** — 5 or fewer (good day)
- 🟡 **Amber** — 6-10 (moderate)
- 🔴 **Red** — 11+ (heavy day)

## Tech stack

- Vue 3 (Composition API)
- Vite
- vite-plugin-pwa (Workbox)
- localStorage
- IBM Plex Mono
- GitHub Pages

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

Pushes to `master` auto-deploy to GitHub Pages via the included workflow.

**Live:** [https://alikhalilll.github.io/smoking-tracker/](https://alikhalilll.github.io/smoking-tracker/)
