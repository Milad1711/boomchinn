# Task 4-b — UI Components Work Record (STACK & SMASH)

**Agent:** 4-b (UI components)
**Date:** 2026-02-27
**Scope:** Only the 6 UI component files listed below + one generated asset. No files under `src/game/`, `src/app/`, `src/lib/store.ts` or config files were touched.

## Files created

| File | Description |
|---|---|
| `src/components/game/screens/MainMenu.tsx` | Full-screen gradient menu: floating tier-colored decorative blobs (framer-motion, mirror repeat), coins/stars chips, `/logo.png` (with `onError` fallback icon), title + Persian tagline, Play/Shop/Settings buttons wired to `setScreen`. |
| `src/components/game/screens/LevelSelect.tsx` | 10 level cards in responsive grid (`grid-cols-2 sm:3 md:4`), Persian numbers via `faNum`, star rows, lock rule `i===0 || stars[i-1]>0`, back button, coins chip, helper text. Scroll area uses `game-scroll` class + inline webkit scrollbar utilities (see Deviations). |
| `src/components/game/screens/SettingsScreen.tsx` | 4 toggle rows (sfx/music/haptics/shadows) with shadcn `Switch`, danger zone card with `AlertDialog` -> `resetProgress()` + `toast({title:'پیشرفت پاک شد'})` via `useToast`. |
| `src/components/game/screens/Shop.tsx` | Helper items section (owned badges, amber buy buttons, success/insufficient-coins toasts) + ball skins section (equipped/owned/buy states, `equipSkin`/`buySkin`). |
| `src/components/game/hud/Hud.tsx` | Click-through HUD: pause button, score chip, combo badge (re-pops via `key={combo}`), goal chip with `goalText` + LTR `current/target` fraction + emerald progress bar, shots chip, bomb/extra-shot round power buttons calling `engineRef.current?.toggleBomb()` and `useExtraShot()`+`grantShot()`, dismissible level-1 tutorial pills. All positioned with `env(safe-area-inset-*)` and logical inset properties. |
| `src/components/game/hud/Overlays.tsx` | Named exports `PauseOverlay` (quick sfx/music switches, resume/restart/quit), `WinOverlay` (spring-animated 3 stars, score, `+N سکه` LTR span, next/level-list/restart/quit), `LoseOverlay` (rose reason pill, restart/quit). Shared non-exported `OverlayShell` (teal-950/40 backdrop, spring card). |

## Asset generated
- `public/logo.png` (1024x1024, AI-generated: teal sphere + coral cube + gold star burst on mint background) — MainMenu's next/image target existed nowhere before; spec assumed it.

## API notes for next agents (GameShell / engine 4-a)
- `Hud` is self-contained: import default from `@/components/game/hud/Hud`, render inside the game screen. It reads live state from `useGameStore` (score, combo, shots, goalCurrent/Target, bombArmed, items, currentLevel, status) and calls `engineRef.current?.toggleBomb()` / `?.grantShot()`.
- `Overlays.tsx` exports `PauseOverlay`, `WinOverlay`, `LoseOverlay` (no default export). They render unconditionally; GameShell must conditionally mount by `status` (`'paused' | 'won' | 'lost'`).
- Screens are full-screen `fixed inset-0` overlays with `z-0`-ish stacking (HUD `z-20`, overlays `z-30`), so GameShell should render: canvas (z-0/10) → Hud → Overlays.
- Engine stub currently has `toggleBomb()`/`grantShot()` as no-ops — calls match the declared public surface.

## Deviations from spec (intentional)
1. `game-scroll` class does NOT exist in `globals.css` (could not verify/modify that file). I applied the class anyway AND added equivalent Tailwind arbitrary webkit-scrollbar utilities (`[&::-webkit-scrollbar]:w-2 ...`) inline in the 3 scrollable screens, so the look is correct regardless.
2. `public/logo.png` did not exist — generated it (asset above).
3. Used canonical lucide icon names `CirclePlus` (spec: `PlusCircle`) and `House` — identical glyphs; `PlusCircle` is a deprecated alias in lucide-react 0.525.
4. Last-level win primary button uses a `LayoutGrid` icon next to «فهرست مراحل» (spec left the icon unspecified for that branch).
5. Added `dir="ltr"` spans around `current/target` fraction and `+N` coins to keep bidi rendering correct in RTL.
6. Coins chip on LevelSelect/Shop headers marked `pointer-events-none` + `aria-label` (decorative duplicate of state).

## Lint result
`bun run lint` (project root): **exit 0 — 0 errors, 0 warnings** for the entire project including all 6 new files.

## Not done (out of scope)
- Did NOT touch `src/game/*`, `src/app/page.tsx`, `layout.tsx`, `globals.css`, `store.ts`, or GameShell — GameShell itself still needs to mount these components (presumably task 4-a or a later task).
