# FTS — Figma Tokens Sync

A Figma plugin that extracts design tokens and icons from UBS/UDS Figma files and synchronises them to the `@uwr/ubs-themes` GitLab repository via a merge request.

---

## Table of contents

- [User guide](#user-guide)
  - [Supported files](#supported-files)
  - [Modes](#modes)
  - [Tokens mode](#tokens-mode)
  - [Icons mode](#icons-mode)
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

### Modes

#### Tokens mode

Extracts design token variables and syncs them to the token JSON file in `@uwr/ubs-themes`. The exported collections depend on the active Figma file:

**UDS Styles & Variables**

- Typography
- Spacing
- Border
- UBS Theme
- NOVA PB (WIP)
- NOVA GWM (WIP)
- IB Theme
- Component Web App 2.0 (WIP)

**UBS Color Library**

- Primitive UBS Color Tokens

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
- Detects the active mode (tokens / icons) from the Figma file name.
- Extracts local variable collections, resolves aliases, converts values to hex/rgba.
- Traverses the icon page tree and exports SVG strings.
- Sends data to the UI via `figma.ui.postMessage`.
- Handles `create_mr` and `create_mr_icons` messages from the UI by calling the GENE backend API.

**`ui.html`** — plugin UI:
- Receives data from the sandbox via `onmessage`.
- Renders token tables with collapsible collection headers.
- Renders icon grids grouped by size.
- Posts user actions (`create_mr`, `create_mr_icons`) back to the sandbox.

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
