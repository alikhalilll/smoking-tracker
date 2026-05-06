# Liquid Glass Input — Specification

This is the source of truth for every interactive input in the app
that uses the Liquid Glass refraction effect (Switch, Segmented
Control, Button, etc.). It documents the state machine, spring
configurations, drag flow, filter parameters, and CSS state classes
that all such components must implement identically.

The spec is a faithful port of kube.io's reference implementation:
https://github.com/kube/kube.io/blob/main/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/Switch.tsx

`Toggle.vue` is the canonical implementation of this spec. Anything
in this doc that conflicts with `Toggle.vue` is a bug in this doc.

---

## 1. Concepts

### 1.1 Surfaces

Every Liquid Glass input has a **track** (the static visible bounds of
the control) and a **thumb** (the moving glass element). On a button
the "thumb" is the whole control; the track is implicit.

The thumb is the **glass surface**: `backdrop-filter` is applied to
the thumb, never the track. The track sits underneath and is what the
glass refracts through.

### 1.2 The `active` signal

A scalar in `[0, 1]` derived from pointer state:

```
active = (forceActive || pointerDown) ? 1 : 0
```

`forceActive` is an external boolean (e.g. driven by a "Force active"
demo toggle, or by a parent component's drag-in-progress state).
`pointerDown` is set during a press on the thumb.

`active` is the source of every visual change on press: thumb scale,
thumb opacity, track color, refraction intensity. Each derived value
is **independently spring-smoothed** (see §3) so the `active` flip is
never visible as a step.

### 1.3 The `considerChecked` signal

A scalar in `[0, 1]` representing the snap-target of the current
gesture. While not pressing it equals `checked`. While pressing it
follows the drag preview:

```
considerChecked = pressed
  ? (xDragRatio > 0.5 ? 1 : 0)         // binary switch
  : (xDragRatio > 0.5 ? 1 : 0)         // (already snapped if released)
  : checked                            // at rest
```

For an N-position segmented control:

```
considerChecked = pressed
  ? round(xDragRatio)                  // index in [0..N-1]
  : currentIndex
```

This drives any "active label / tinted track / aria-selected" affordance
so the user sees what they're about to commit to *during* the drag.

---

## 2. Geometry

### 2.1 Switch geometry (canonical proportions)

| Constant            | Value | Meaning                                    |
|---------------------|-------|--------------------------------------------|
| `SLIDER_WIDTH`      | 160   | track width in CSS px                      |
| `SLIDER_HEIGHT`     | 67    | track height                               |
| `THUMB_WIDTH`       | 146   | actual thumb box width (bigger than track) |
| `THUMB_HEIGHT`      | 92    | actual thumb box height (taller than track)|
| `THUMB_RADIUS`      | 46    | thumb corner radius (=THUMB_HEIGHT/2)      |
| `THUMB_REST_SCALE`  | 0.65  | CSS `transform: scale()` at rest           |
| `THUMB_ACTIVE_SCALE`| 0.9   | CSS `transform: scale()` while pressed     |

Why the thumb is bigger than its visible footprint: scaling DOWN at
rest keeps the bezel inside the track outline, and scaling UP toward
0.9 on press makes the bezel "splash" outward into the track edges
which exposes more of the refraction.

Derived constants:

```ts
THUMB_REST_OFFSET = ((1 - THUMB_REST_SCALE) * THUMB_WIDTH) / 2
                  = ((1 - 0.65) * 146) / 2 = 25.55

TRAVEL = SLIDER_WIDTH - SLIDER_HEIGHT
       - (THUMB_WIDTH - THUMB_HEIGHT) * THUMB_REST_SCALE
       = 160 - 67 - (146 - 92) * 0.65 = 57.9
```

`TRAVEL` is how far the visible thumb's centre moves between off and
on, in CSS px.

### 2.2 Thumb positioning math

```ts
// CSS position: top: SLIDER_HEIGHT/2; transform: translateY(-50%)
// horizontal margin shifts the bounding box so that the *visible*
// thumb (after the rest-scale) sits inside the track left edge:
marginLeft = -THUMB_REST_OFFSET +
             (SLIDER_HEIGHT - THUMB_HEIGHT * THUMB_REST_SCALE) / 2

// per-frame, drive a translateX from xRatio in [0..1]:
translateX = xRatio * TRAVEL
```

### 2.3 N-position segmented geometry

The same trick: actual thumb width is `tabWidth / THUMB_REST_SCALE`
so the visible thumb at rest equals one tab slot. `xRatio` is in
`[0..N-1]` and translateX is `xRatio * tabWidth`.

---

## 3. Springs (every animated value)

Every visible motion is **spring-driven** via the `useSpring`
composable in `src/composables/useSpring.ts`. No CSS transitions.

| Value             | Source                                                | Stiffness | Damping |
|-------------------|-------------------------------------------------------|-----------|---------|
| `xRatio`          | `pressed ? xDragRatio : (checked ? 1 : 0)`            | 1000      | 80      |
| `thumbScale`      | `0.65 + 0.25 * active`                                | 2000      | 80      |
| `thumbBgOpacity`  | `1 - 0.9 * active`                                    | 2000      | 80      |
| `considerChecked` | `pressed ? (xDragRatio > 0.5 ? 1 : 0) : (checked?1:0)`| 1000      | 80      |
| `filterScaleRatio`| `(0.4 + 0.5 * active) * refractionBase`               | default*  | default*|

\*  Default useSpring values used by motion/react. Our `useSpring`
treats undefined options as `{stiffness: 1000, damping: 80, mass: 1}`
which is the same family — slightly over-damped, fast (~50ms) settle,
no overshoot.

### 3.1 Why these particular values

- **xRatio** uses `1000/80` so the thumb has a barely-perceptible lag
  behind the finger during drag — feels physical but stays responsive.
- **thumbScale / thumbBgOpacity** use `2000/80` (twice as stiff) so
  press feedback is nearly instant — the user shouldn't wait for the
  scale to "catch up" with their press.
- **considerChecked** uses `1000/80` so the track-color crossfade is
  visibly smooth, not a snap.
- **filterScaleRatio** uses defaults so the refraction blooms in over
  ~50ms instead of stepping.

---

## 4. Filter parameters (verbatim)

These feed `<feDisplacementMap>` / specular layer / blur in the
liquid-glass directive.

| Parameter          | Value | Source                 |
|--------------------|-------|------------------------|
| `surface`          | `lip` | convex outside, concave middle (article §Switch) |
| `bezelWidth`       | 19    |                        |
| `glassThickness`   | 47    |                        |
| `refractiveIndex`  | 1.5   | window glass           |
| `blur` (stdDev)    | 0.2   | very subtle, lets the warp dominate |
| `specularOpacity`  | 0.5   |                        |
| `specularSaturation`| 6    | feeds `<feColorMatrix type="saturate" values="6">` |
| `refractionBase`   | 1     | scale multiplier; expose to demos as a slider |

`scaleStates: { idle: 0.4, hover: 0.4, active: 0.9 }` is how we feed
this through the directive's pointer-state machine, but the
**continuous formula** `(0.4 + 0.5 * active) * refractionBase` is the
canonical source — the directive must spring between idle and active
matching that formula.

---

## 5. Drag flow (state machine)

### 5.1 Refs

```ts
isPressed       // boolean — pointer is currently down on the thumb
isDragging      // boolean — pointer moved >4px since pointerdown
xDragRatio      // number  — raw drag position [0..1] with damped overflow
initialPointerX // number  — clientX captured at pointerdown
movedFlag       // boolean — set true once isDragging fires; consumed
                //           by the post-release click handler so a
                //           drag-release doesn't ALSO toggle on click
```

### 5.2 `startDrag(clientX)`

```ts
if (disabled) return
isPressed       = true
movedFlag       = false
initialPointerX = clientX
xDragRatio      = currentRatio   // baseline so the thumb stays put
                                 // until the finger actually moves
```

Trigger: `mousedown` / `touchstart` on the **thumb** (Switch) or on
the **root** (LiquidSegmented — see note in §5.6).

### 5.3 `processMove(clientX)` — runs on pointermove

```ts
if (!isPressed) return
const baseRatio = currentRatio
const dx        = clientX - initialPointerX

if (Math.abs(dx) > 4) {
  isDragging = true
  movedFlag  = true
}

const ratio        = baseRatio + dx / TRAVEL
const overflow     = ratio < 0 ? -ratio : ratio > 1 ? ratio - 1 : 0
const overflowSign = ratio < 0 ? -1 : 1
const dampedOverflow = (overflowSign * overflow) / 22
xDragRatio = clamp(ratio, 0, 1) + dampedOverflow
```

The `/22` is the rubber-band damping — feel it as "the further you
push past the end, the harder the resistance, but you can still
overshoot a little."

Move listeners are on **`window`** so the gesture doesn't get cut off
when the finger leaves the thumb's bounds.

### 5.4 `endDrag(clientX)` — runs on pointerup

```ts
if (!isPressed) return
const dx     = clientX - initialPointerX
const moved  = Math.abs(dx) > 4

if (moved) {
  // Snap to nearest endpoint (binary) or nearest index (N-position)
  const next = xDragRatio > 0.5            // binary
            // = round(xDragRatio)         // n-position
  if (next !== currentValue) {
    haptics.fire('tap')
    emit('update:modelValue', next)
  }
}
isPressed  = false
isDragging = false
```

### 5.5 `onTrackClick(e)` — fires AFTER mouseup

```ts
if (disabled) return
if (movedFlag) {
  movedFlag = false
  e.preventDefault()           // swallow the synthetic post-drag click
  return
}
haptics.fire('tap')
emit('update:modelValue', !currentValue)   // tap toggles
```

The 4px threshold is the bright line between "tap" and "drag":
- `dx ≤ 4`  → `endDrag` does nothing, click handler toggles
- `dx > 4`  → `endDrag` snaps, click handler swallows the synthetic click

### 5.6 Where pointerdown attaches

The article puts `mousedown`/`touchstart` on the **thumb** because the
thumb is 91% of the slider width — pressing anywhere on the visible
slider means pressing the thumb.

For controls where the thumb is small relative to the track
(LiquidSegmented, where the thumb is `1/N` of the track), attach the
listener to the **root** instead so a drag can start from any tab.

The trade-off: with root-mounted listeners, you have to also handle
the per-tab click separately for tap-to-select.

---

## 6. CSS state classes

| Class         | When                                       |
|---------------|--------------------------------------------|
| `is-on`       | bound model value is true                  |
| `is-pressed`  | `isPressed === true`                       |
| `is-dragging` | `isDragging === true` (after >4px movement)|
| `is-disabled` | `props.disabled === true`                  |

Inset shadows for the pressed look are applied **only while pressed**,
written from JS into `boxShadow` rather than via CSS state class so
they spring-fade with the rest of the press transition:

```ts
boxShadow = `0 4px 22px rgba(0,0,0,0.10)`
         + (isPressed
              ? `, inset 2px 7px 24px rgba(0,0,0,0.09),`
              + ` inset -2px -7px 24px rgba(255,255,255,0.09)`
              : ``)
```

The base drop shadow is constant across all states.

---

## 7. Track color (binary switch only)

```ts
trackBg = mixHex('#94949F77', '#3BBF4EEE', considerChecked.value)
```

8-char hex (`#RRGGBBAA`). The transparent grey crossfades into the
fully-opaque green as `considerChecked` springs from 0 to 1. Because
`considerChecked` updates **during** drag (when `xDragRatio > 0.5`),
the track previews the "if you let go now" color — no commit needed.

---

## 8. Accessibility

| Concern              | Implementation                                     |
|----------------------|----------------------------------------------------|
| Role                 | `role="switch"` (binary) or `role="tablist"` + `role="tab"` (segmented) |
| Checked state        | `aria-checked={isOn}` (binary) / `aria-selected={i === currentIndex}` |
| Keyboard tap         | Native `<button>` + `@click` already handles Enter/Space |
| Focus ring           | `:focus-visible` outline (`box-shadow: 0 0 0 3px var(--brand-soft)`) |
| Disabled             | `disabled` attribute, `is-disabled` class, opacity 0.5, `cursor: default` |
| Touch-action         | `pan-y` on the root so vertical page scroll still works while we own horizontal gestures |
| `prefers-reduced-motion` | Components SHOULD short-circuit springs to instant transitions when this media query is set (TODO — not yet enforced everywhere) |
| Haptics              | Fire `tap` on every state change, both drag-snap and tap-toggle |

---

## 9. Disabled state

`disabled` short-circuits at three points:

1. `startDrag()` — early return; never sets `isPressed` true.
2. `onTrackClick()` — early return; never emits.
3. CSS — `is-disabled` class applies `opacity: 0.5; cursor: default`.

The thumb keeps its rest geometry (no scale/opacity changes since
nothing toggles `active`). Refraction remains visible at the idle
filter scale (0.4) — this is intentional; the visual is "this is a
glass control, just not interactive right now."

---

## 10. The `useLiquidPress` composable

For inputs with **no drag** (regular buttons, list items, FABs), the
above state machine collapses to:

```
isPressed = mousedown ↦ true ; mouseup/cancel ↦ false
active    = isPressed ? 1 : 0
```

— and the same five spring values derive from `active` with the same
configs. `useLiquidPress` is the composable that exposes:

- `isPressed`, `active` (raw, computed)
- `thumbScale`, `thumbBgOpacity`, `filterScaleRatio` (springs)
- `lgOptions` (the `v-liquid-glass` options object with `forceActive`
  bound to `isPressed`)
- `bind` (the `@mousedown / @touchstart / @mouseup / @touchend / @mouseleave` handler set)

Usage:

```vue
<button v-liquid-glass="lgOptions" v-bind="bind" :style="pressStyle">
  ...
</button>
```

`<LiquidPress>` is the matching wrapper component for when you'd
rather not wire the bindings yourself.

---

## 11. Implementations in this codebase

| File                                              | Implements             |
|---------------------------------------------------|------------------------|
| `src/components/Toggle.vue`                       | Binary switch          |
| `src/components/LiquidSegmented.vue`              | N-position selector    |
| `src/components/LiquidPress.vue`                  | Generic press wrapper  |
| `src/composables/useSpring.ts`                    | Spring physics         |
| `src/composables/useLiquidPress.ts`               | Press state machine    |
| `src/lib/liquidGlass/directive.ts`                | `v-liquid-glass`        |
| `src/lib/liquidGlass/displacementMap.ts`          | Refraction map gen     |
| `src/lib/liquidGlass/specular.ts`                 | Specular highlight gen |
| `src/lib/liquidGlass/surfaceEquations.ts`         | convex / lip / concave |

When adding a new interactive surface, prefer composing
`useLiquidPress` (or the drag composable, when one is extracted) over
duplicating the state machine.
