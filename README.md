````markdown name=README.md url=https://github.com/MN-ANIRBAN/MNDrive/blob/main/README.md
# MNCloudDrive (MNDrive)

A modern TypeScript Next.js file manager web app — a small cloud-drive UI that provides authentication, file browsing, upload/delete controls, and reusable UI components for building a drive-like experience.

## Stack
- Language(s): TypeScript (primary), CSS
- Framework / runtime: Next.js (App Router)
- Notable libraries / tools: React, Next.js, TypeScript, PostCSS (project has postcss.config), ESLint (eslint.config.mjs)

## Key features
- Sign-in / authentication flow (src/app/auth and middleware.ts)
- File manager UI with list/grid views and file actions (src/components/file-manager-view.tsx, delete-button.tsx)
- Reusable UI primitives and components (src/components/ui/*)
- Minimal server helpers in src/lib (client.ts, server.ts) for API requests / server-side helpers

## Repository layout
```text
MNCloudDrive/
  package.json                 # project manifest and scripts
  next.config.mjs              # Next.js configuration
  tsconfig.json                # TypeScript config
  postcss.config.mjs           # PostCSS config
  src/
    app/
      page.tsx                 # Home page
      layout.tsx               # App layout + global styles
      globals.css              # Global styles
      login/page.tsx           # Login page / auth UI
      auth/                    # Authentication route/components
    components/
      file-manager-view.tsx    # Main file manager UI
      delete-button.tsx        # File delete control
      ui/                      # Small UI primitives (button, card, input, etc.)
    lib/
      client.ts                # Client helpers for API calls
      server.ts                # Server helpers / API wrappers
      middleware.ts            # Middleware used by the app
    utils/                     # Utility helpers
  public/                      # Static assets and icons (next.svg, vercel.svg, etc.)
  components.json              # Component metadata
  LICENSE                      # License for the project
```

How it fits together:
- Next.js App Router renders pages from src/app. layout.tsx and globals.css provide the visual shell.
- The file manager UI (file-manager-view.tsx) uses UI primitives from src/components/ui and calls client/server helpers in src/lib to fetch and mutate file metadata.
- Middleware enforces authentication for protected routes and coordinates session checks.

## Getting started (local development)
Prerequisites:
- Node.js (16+ recommended) and npm or yarn.

Quick start:
```bash
# from the repository root
cd MNCloudDrive
npm install

# start the dev server
npm run dev
# or with yarn
# yarn dev
```

Build and run production:
```bash
npm run build
npm run start
```

Common npm scripts (defined in package.json)
- dev — runs Next.js in development mode
- build — builds the production output
- start — starts the production server
- lint — runs linting (if configured)

If your environment requires secrets (API endpoints, auth keys), create a `.env.local` file in the MNCloudDrive folder and add the required variables. Example placeholders:
```env
# Example placeholders — replace with real values used by your app
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
NEXTAUTH_URL=http://localhost:3000
```

(Inspect `next.config.mjs`, `src/lib/*`, and `src/app/auth` to identify the exact environment variables required.)

## Development notes & pointers
- UI components are in src/components/ui — good place to add design-system primitives.
- The main file manager logic and UI lives in src/components/file-manager-view.tsx — extend it to add features (pagination, folder navigation, upload progress).
- Server-side helpers are small and located in src/lib; use them to centralize API calls and authentication handling.
- Middleware at src/middleware.ts is used for route protection — update or extend for additional auth rules.

## Contributing
- Open an issue if you want a feature or find a bug.
- Fork, create a branch, and send a PR with a descriptive title and tests (where applicable).
- Follow existing code style (TypeScript + any lint rules in eslint.config.mjs).

## License
See the LICENSE file in the repository root for license details.

## Try asking
- How does authentication get validated end-to-end? (see src/app/auth and src/middleware.ts)
- Where are API endpoints implemented or proxied? (check src/lib/server.ts and next.config.mjs)
- How are uploads and file metadata handled in the UI? (see src/components/file-manager-view.tsx and src/components/delete-button.tsx)
````
