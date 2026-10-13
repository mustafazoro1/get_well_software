# Cute Monster — Get Well Soon 💗

A hand-crafted, personalized "get well" web app from **Zizi** (Karachi) to **Cute Monster** (Lahore), with Bablu the cat, Roblox MM2/Evade, Minecraft, and Monster Energy references.

## What's inside

- **Cute Monster Care Kit** — potion / shield / rest-check / letter modals
- **Bablu hug** — tap the kitty for a random purr note and floating hearts
- **Today's gentle-care list** — 5 daily tasks saved in `localStorage`, with a Care Meter progress bar and pink confetti on completion
- **Zizi's cozy arcade** — three touch-friendly mini-games:
  - *Evade the Fever* — drag/arrow-key basket, catch tea & soup, dodge fever clouds
  - *MM2 Mystery Cards* — flip rewards, avoid the Fever Murderer traps
  - *Minecraft Heart Craft* — memory-match pairs to light the Get-Well Beacon
- **Lo-fi music player** — loops `public/audio/zizi-lofi.mp3`, with mute
- **Soft / Gamer themes**, fully responsive mobile-first layout

## Run locally

```bash
pnpm install
pnpm --filter @workspace/get-well-cards run dev
```

`PORT` (default `3000`) and `BASE_PATH` (default `/`) are optional.

## Build

```bash
pnpm --filter @workspace/get-well-cards run build   # outputs to artifacts/get-well-cards/dist/public
pnpm --filter @workspace/get-well-cards run typecheck
```

## Deploy (Vercel)

The repo is a pnpm monorepo; only the app ships.

- **Root Directory:** `artifacts/get-well-cards`
- **Build Command:** `pnpm run build`
- **Output Directory:** `dist/public`

`artifacts/api-server` and `artifacts/mockup-sandbox` are dev leftovers — not deployed.
