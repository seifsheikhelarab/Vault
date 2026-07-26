# cuelume

Cuelume is a curated palette of 14 interaction sounds for the web, synthesized
live with Web Audio. Add an attribute, call `bind()`, done. Zero runtime
dependencies, no audio files, under 5 kB gzip. MIT licensed.

This page is the complete guide for AI agents adding cuelume to a project.

- npm: https://www.npmjs.com/package/cuelume
- repo: https://github.com/Danilaa1/cuelume

## Quickstart

Install with any package manager:

```sh
npm install cuelume
# or: yarn add cuelume · pnpm add cuelume · bun add cuelume
```

Then wire it up once and tag your markup:

```html
<button data-cuelume-press data-cuelume-release>Save</button>
```

```ts
import { bind } from "cuelume";
bind();
```

Cuelume is **ESM-only** (native `import` or any ESM bundler; no CommonJS
`require()`). It targets modern browsers. Importing on the server is a safe
no-op, so it works in SSR frameworks — playback simply only happens in the
browser.

## Two ways to use it

### 1. Declarative (preferred for UI chrome)

Add one data attribute per behavior, then call `bind()` once:

```html
<button data-cuelume-press data-cuelume-release>Save</button>
<a data-cuelume-hover="tick">Docs</a>
<button data-cuelume-toggle>Dark mode</button>
```

```ts
import { bind } from "cuelume";
bind();
```

| Attribute              | Fires on       | Default sound |
| ---------------------- | -------------- | ------------- |
| `data-cuelume-hover`   | `pointerenter` | `chime`       |
| `data-cuelume-press`   | `pointerdown`  | `press`       |
| `data-cuelume-release` | `pointerup`    | `release`     |
| `data-cuelume-toggle`  | `click`        | `toggle`      |

Leave the attribute value empty for the default, or set it to any sound name.
`bind()` uses delegated listeners: it is idempotent, covers elements added to
the DOM later, and needs no re-binding after route or component changes.

### 2. Imperative (for outcomes)

```ts
import { play } from "cuelume";

await navigator.clipboard.writeText(text);
play("success");
```

## Sound palette (pick semantically)

| Name      | Character                         | Use for                          |
| --------- | --------------------------------- | -------------------------------- |
| `chime`   | Soft two-note ascending bell      | Default hover                    |
| `sparkle` | Quick four-note twinkle           | Playful accents, easter eggs     |
| `droplet` | Single note gliding down          | Dismiss, collapse                |
| `bloom`   | Warm slow swell                   | Reveal, expand                   |
| `whisper` | Breathy quiet swell               | Dense lists, subtle feedback     |
| `tick`    | Crisp instant tick                | Nav and menu hover               |
| `press`   | Dull muted knock                  | Pointer down                     |
| `release` | Brighter springy tick             | Pointer up                       |
| `toggle`  | Mechanical click-clack            | Switches, tabs, segmented controls |
| `success` | Warm three-note confirmation      | Action succeeded (copy, save)    |
| `error`   | Soft knock, descending refusal    | Recoverable errors, blocked actions |
| `page`    | Papery flick with a glass tick    | Pagination, galleries, carousels |
| `loading` | Brief unresolved rising shimmer   | User-initiated work starting     |
| `ready`   | Focus tick with a harmonic bloom  | Content or image finished loading |

## API (complete)

```ts
import { play, bind, setEnabled, sounds, type SoundName } from "cuelume";
```

- `play(name?: SoundName)` — play a sound now. Defaults to `"chime"`.
- `bind(root?: ParentNode)` — delegate all `data-cuelume-*` interactions under
  `root` (default: whole document).
- `setEnabled(enabled: boolean)` — mute/unmute future playback. Does not
  persist the preference; your app owns the setting.
- `sounds` — array of all sound names.
- `SoundName` — union type of the 14 names.

## Framework recipes

React: call `bind()` once in a top-level `useEffect(() => { bind(); }, [])`.
Astro / plain HTML: `import { bind } from "cuelume"; bind();` in a client script.
Delegated listeners keep working when frameworks replace DOM under the root.

## Guarantees you can rely on

- Hover/press/release require a fine pointer (mouse); toggle follows native
  click activation, including keyboard and touch.
- Hover sounds are globally throttled (one per 150 ms) so menu sweeps stay quiet.
- One lazy shared `AudioContext`, created on first use; suspended contexts are
  resumed automatically when the browser allows it.
- Invalid names, blocked autoplay, or missing Web Audio make `play()` a silent
  no-op — never a thrown error.

## Guidance for good sound design

- Wire `hover` only on fine-pointer UI that benefits (nav, menus) — not on
  every element.
- Use `success`/`error` for outcomes the user caused, not background events.
- Give users a mute setting and pass it to `setEnabled()`; do not autoplay
  sounds before the user's first interaction.