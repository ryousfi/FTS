# FTS — Figma Tokens Sync

A Figma plugin that extracts design tokens, icons, and component modes from UBS/UDS Figma files and synchronises them to the `@uwr/ubs-themes` GitLab repository via a merge request.

---

## Table of contents

- [User guide](#user-guide)
  - [Supported files](#supported-files)
  - [Modes](#modes)
  - [Tokens mode](#tokens-mode)
  - [Icons mode](#icons-mode)
  - [Component modes](#component-modes)
- [Developer guide](#developer-guide)
  - [Prerequisites](#prerequisites)
  - [Project structure](#project-structure)
  - [Setup](#setup)
  - [Build](#build)
  - [Lint](#lint)
  - [Architecture](#architecture)
  - [Publishing a new version](#publishing-a-new-version)

---

## User guide

### Supported files

The plugin detects the active Figma file automatically and switches to the appropriate mode:

| Figma file | Mode activated |
|---|---|
| `UDS Styles & Variables` | Tokens |
| `UBS Color Library` | Tokens |
| `UBS Icon Library` | Icons |
| Any other file | Component modes |

### Modes

#### Tokens mode

Extracts design token variables from the following collections and syncs them to the token JSON file in `@uwr/ubs-themes`:

- Typography
- Spacing
- Border
- UBS Theme
- NOVA PB (WIP)
- NOVA GWM (WIP)
- IB Theme
- Component Web App 2.0 (WIP)

**Note:** Mobile-specific tokens (containing `-mobile`, `mobile-`, `-ios`, `-android`, `android-`, or `ios-` in their name) are automatically excluded from the export.

**How to use:**

1. Open the plugin from the Figma plugin menu.
2. Wait for the token collections to finish loading.
3. Expand any collection to review its tokens before syncing.
4. Click **Sync to GitLab** to create a merge request on `@uwr/ubs-themes` with the updated token file.
5. A confirmation page will display a link to the newly created merge request.

#### Icons mode

Extracts all SVG icons from the `Icons` page (sizes `24px`, `16px`, and `12px`) and syncs them to the GitLab repository.

**How to use:**

1. Open the plugin from the Figma plugin menu.
2. Wait for the icons to load — they are displayed grouped by size for review.
3. Click **Sync to GitLab** to create a merge request with the updated icon files.

#### Component modes

Allows switching the explicit variable mode applied to a selected component (e.g. switching a Component Web App node between available themes).

**How to use:**

1. Select one or more component nodes on the canvas.
2. Open the plugin — available modes are listed automatically.
3. Select the desired mode from the list.
4. Click **Apply selected mode** to apply it to the selected nodes.

---

## Developer guide

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [TypeScript](https://www.typescriptlang.org/) (installed as a dev dependency)
- A Figma desktop app account with access to the target files

### Project structure

```
FTS/
├── code.ts          # Plugin backend — runs in the Figma sandbox
├── code.js          # Compiled output of code.ts (committed, loaded by Figma)
├── ui.html          # Plugin UI — self-contained HTML/CSS/JS panel
├── manifest.json    # Figma plugin manifest
├── package.json
└── tsconfig.json
```

### Setup

```bash
npm install
```

### Build

Compile `code.ts` to `code.js` once:

```bash
npm run build
```

Watch for changes and recompile automatically:

```bash
npm run watch
```

### Lint

```bash
npm run lint          # check
npm run lint:fix      # auto-fix
```

### Architecture

The plugin follows the standard Figma two-process model:

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Figma sandbox (code.ts)    │        │  UI iframe (ui.html)         │
│                             │        │                              │
│  • Reads variables/SVGs     │◄──────►│  • Renders token tables      │
│  • Detects mode             │        │  • Collection expand/collapse │
│  • Calls GitLab API         │        │  • Sync / Apply mode buttons │
└─────────────────────────────┘        └──────────────────────────────┘
        figma.ui.postMessage                  parent.postMessage
```

**`code.ts`** — plugin backend:
- Detects the active mode (tokens / icons / modes) from the Figma file name.
- Extracts local variable collections, resolves aliases, converts values to hex/rgba.
- Traverses the icon page tree and exports SVG strings.
- Sends data to the UI via `figma.ui.postMessage`.
- Handles `create_mr`, `create_mr_icons`, and `apply_selected_mode` messages from the UI by calling the GENE backend API.

**`ui.html`** — plugin UI:
- Receives data from the sandbox via `onmessage`.
- Renders token tables with collapsible collection headers.
- Renders icon grids grouped by size.
- Renders radio buttons for component mode selection.
- Posts user actions (`create_mr`, `apply_selected_mode`, etc.) back to the sandbox.

**GENE backend endpoints:**

| Endpoint | Used for |
|---|---|
| `POST /update-uwr/` | Sync token JSON to GitLab |
| `POST /update-uwr-icons/` | Sync icon SVGs to GitLab |

### Publishing a new version

1. Make your changes in `code.ts` and/or `ui.html`.
2. Run `npm run build` to compile.
3. In the Figma desktop app, open **Plugins → Development → FTS**.
4. To publish to the Figma organisation, go to **Plugins → Manage plugins → FTS → Publish new version**.
