# Kommunity design system

This file is the source of truth for Kommunity's visual language. It adapts the supplied Ollama design reference to a community product without copying brand-specific artwork.

## Principles

- Use a continuous, paper-like canvas with hierarchy created by spacing, type, and hairline borders.
- Keep the palette achromatic. Black is the primary action color; gray communicates hierarchy, not status.
- Use one inverted surface per view when a section needs exceptional emphasis.
- Prefer native, familiar controls. Interactive controls are pills; content containers are 12 px cards.
- Do not use gradients, drop shadows, glass effects, decorative depth, or ornamental color.

## Color tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#ffffff` | `#090909` | Page canvas |
| `--surface` | `#ffffff` | `#090909` | Default surface |
| `--surface-raised` | `#ffffff` | `#171717` | Dialogs and overlays |
| `--surface-soft` | `#fafafa` | `#171717` | Quiet selected and secondary areas |
| `--text` | `#000000` | `#ffffff` | Primary text |
| `--text-soft` | `#737373` | `#a3a3a3` | Secondary text |
| `--text-faint` | `#a3a3a3` | `#737373` | Tertiary metadata |
| `--line` | `#e5e5e5` | `#262626` | Hairline borders |
| `--line-strong` | `#d4d4d4` | `#404040` | Interactive borders |
| `--ink` | `#000000` | `#ffffff` | Primary actions |
| `--inverse` | `#171717` | `#f5f5f5` | Rare inverted emphasis |
| `--on-inverse` | `#ffffff` | `#000000` | Text on inverted surfaces |
| `--focus-ring` | `rgba(59, 130, 246, 0.5)` | same | Keyboard focus only |

Semantic states remain achromatic in the UI. State meaning must also be communicated with a label, icon, or placement rather than color alone.

## Typography

- Display and headings: `"SF Pro Rounded", ui-rounded, system-ui`.
- Body and controls: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Code: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.
- Display heading: 36 px / 1.12 / weight 500.
- Page section heading: 24 px / 1.25 / weight 600.
- Card heading: 20 px / 1.3 / weight 600.
- Body: 14–16 px / 1.55.
- Metadata: 12 px minimum. Uppercase labels use modest `0.06em` tracking.

## Shape and spacing

- Base spacing unit: 8 px.
- Common component gaps: 8, 16, 24, and 32 px.
- Major desktop section gap: 64–88 px where the page structure permits it.
- Content card radius: 12 px.
- Small inset radius: 6 px.
- Interactive controls: `9999px` pill radius.
- Buttons and search fields: 36 px tall.
- Text inputs: 40 px tall.
- Borders: 1 px.
- Elevation: none. Dialog separation comes from a dimmed backdrop and border.

## Components

### Buttons

- Primary: solid `--ink` with `--bg` text.
- Secondary: transparent/default surface with `--line-strong`.
- Ghost: no border, muted text.
- Disabled: preserve structure at 45% opacity.
- Hover changes color only; controls do not lift or scale.

### Cards

- Use `--surface`, a 1 px `--line` border, 12 px radius, and no shadow.
- Avoid nested cards. Use dividers or spacing inside a parent surface.
- Feature artwork is a flat inverted block without decorative shapes.

### Navigation

- Desktop sidebar uses the page canvas and a single right hairline.
- Active items use `--surface-soft` and medium-weight text.
- Navigation items, tabs, and account switchers use pill geometry.

### Forms

- Search and compact controls use pill geometry.
- Multiline fields and larger form groups use a 12 px radius.
- Focus uses the shared translucent blue focus ring with a 2 px offset.
- Every form field requires a persistent label or an accessible name.

### Avatars and roles

- Avatars are neutral gray or inverted black/white.
- Role assignment is expressed with text, icons, and borders; never color alone.
- A user may hold multiple roles. Platform and community scope must remain visible in copy.
- Root and maintainer accounts receive a floating role switcher. It changes the active permission view without mutating stored role assignments.

## Theme and responsive behavior

- Light and dark themes use paired tokens with equivalent contrast and hierarchy.
- At 768 px, multi-column layouts stack and feature padding reduces.
- At 640 px, display headings reduce to 28 px and page padding becomes compact.
- Bottom navigation replaces the sidebar on small screens.
- Interactive targets remain at least 36 px, with 44 px preferred for primary mobile actions.

## Accessibility checks

- Primary text and controls must meet WCAG AA contrast.
- Visible focus must never be removed.
- Controls require text or accessible labels; icon-only controls need an `aria-label`.
- Status and permissions must not rely on color.
- Reduced-motion preferences disable non-essential transitions and animations.

## Drift policy

New UI should use the tokens and patterns above. Raw colors are allowed only for the three macOS-style terminal dots, QR rendering, and the blue keyboard focus ring. Any new shadow, gradient, decorative color, or non-standard radius requires an explicit design-system update.
