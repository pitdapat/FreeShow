# FreeShow Fork Instructions

## Project identity and purpose

This repository is the single maintainer's personal public fork of
[`ChurchApps/FreeShow`](https://github.com/ChurchApps/FreeShow). FreeShow is a
GPLv3 open-source church presentation and slideshow application built with
Electron, Svelte, TypeScript, Vite, and Node.js, with several native
dependencies.

Use this fork for personal development of custom FreeShow features while
continuing to receive official FreeShow updates. Do not describe the source or
fork as private; the GitHub fork is public.

The Git remotes must remain:

- `origin`: the personal fork, `https://github.com/pitdapat/FreeShow.git`
- `upstream`: the official repository, `https://github.com/ChurchApps/FreeShow.git`

## Branch and push policy

> This repository is maintained by a single user. Use `main` as the active development branch. Completed work should be committed and pushed to `origin/main`. Never push to `upstream`.

- Do not create a separate permanent `development` branch.
- Feature branches are optional, not mandatory. Unless the user requests
  otherwise, make ongoing changes on `main`.
- Never push to the official ChurchApps repository or seek write access to it.
- Never force-push unless the user explicitly overrides this rule.
- Do not rewrite published history or delete branches, tags, or files without
  explicit permission.
- Receive official updates with `git switch main`, `git fetch upstream`, and
  `git merge upstream/main`. Resolve every conflict individually, preserve
  custom work, test the merge, and then use `git push origin main`.

## Development environment

- Use npm and the committed `package-lock.json` (lockfile version 3). Do not
  replace the package manager, regenerate the lockfile unnecessarily, or make
  broad dependency upgrades during unrelated work.
- `package.json` requires Node.js `>=22.12.0`; CI uses Node.js 22. npm 10 or
  newer is appropriate for the currently locked tooling. Prefer Node.js
  22.22.2 or newer because some resolved npm tooling emits engine warnings on
  earlier Node.js 22 releases.
- Native modules require Python 3.12 with `setuptools`.
- On Windows, install Visual Studio 2022 with **Desktop development with C++**,
  including the MSVC x64/x86 toolset and Windows 10 SDK.
- On Linux, development requires `libfontconfig1-dev`.
- Normal development does not require a `.env` file. `NODE_ENV` is set by the
  npm scripts. Release-only credentials such as Azure signing secrets and the
  macOS `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` must
  never be committed.
- Workspace paths without spaces are safer for native `node-gyp` packages,
  although the current Windows setup has successfully installed and started
  from a path containing spaces.

## Confirmed commands

Run commands from the repository root.

```text
npm install                 Install dependencies and rebuild Electron native modules
npx playwright install chromium
                            Install the browser runtime required by Playwright
npm start                   Start Vite, server watchers, TypeScript watch, and Electron
npm run build               Create the production frontend, server, and Electron builds
npm run pack                Build an unpacked application package
npx electron-builder --config config/building/electron-builder-fork.cjs --dir --win --x64 --publish never
                            Build the unpacked everyday Windows fork copy
npm run pack:fork           Build the unsigned Windows fork installer without publishing
npm run release:fork        Build and publish Windows updater assets to pitdapat/FreeShow
npm run test:unit           Run colocated Vitest unit tests under src/**/*.test.ts
npm run test:component      Run Svelte Testing Library component tests in jsdom
npm run test:integration    Run integration scenarios, including cloud synchronization
npm run test:coverage       Run the critical V8 coverage gate
npm run test:mutation       Mutation-check critical persistence, IPC, cloud, and output logic
npm run test:ci             Run unit, component, integration, and coverage groups
npm run test:nightly        Run CI groups, mutation tests, and Electron workflows
npm run test:playwright     Run isolated production Electron Playwright workflows
npm run test:format         Check Prettier formatting for src and scripts
npm run test:svelte         Run svelte-check
npm test                    Run unit, component, integration, Playwright, formatting, and Svelte checks
npm run format:prettier     Rewrite src and scripts with Prettier
npm run lint                Run Electron, frontend, Svelte, and style lint tasks
```

The lint scripts include `--fix` for Electron, frontend, and Svelte sources;
inspect their resulting diff before keeping changes. Playwright launches the
production Electron entry point, so run the complete `npm run build` first when
build output is absent or stale. Do not trust an Electron run after only
`prebuild` or a partial production build.

Fork updater releases come only from `pitdapat/FreeShow`. Use fork-specific
versions such as `1.6.4-pitdapat.1`, commit the version change, then push a
matching tag such as `v1.6.4-pitdapat.1` to trigger
`.github/workflows/fork-release.yml`. Never use the ChurchApps signing or
publishing workflow for fork releases.

See `docs/FORK_WORKFLOW.md` for the distinction between development, the
unpacked everyday build, and installed releases; the complete fork release
process; and the upstream merge/conflict policy.

See `docs/TESTING.md` for the adversarial test rules, suite boundaries,
isolation requirements, coverage and mutation gates, CI qualification policy,
and current protected behaviors.

## Architecture orientation

- `src/electron/`: Electron main process, preload, IPC, persistence/data,
  output, capture, audio, cloud sync, NDI/Blackmagic integrations, WebRTC, and
  native-facing utilities.
- `src/frontend/`: Svelte renderer application, components, stores/values,
  show editing, media/audio handling, converters, frontend IPC, and UI helpers.
- `src/server/`: browser-facing remote, stage, controller, camera, and output
  stream applications built by Vite.
- `src/common/`: code shared across runtime areas, currently including
  scripture utilities.
- `src/types/`: shared TypeScript types and IPC contracts.
- `scripts/`: development orchestration, pre/post-build generation, server
  bundling/watch scripts, packaging cleanup, and platform-specific helpers.
- `config/typescript/`: TypeScript configurations for Electron, Svelte, and
  server builds.
- `config/building/`: Electron Builder, Vite server, Rollup, Snap, and packaging
  configuration.
- `config/testing/`: Unit, component, integration, mutation, coverage, and
  Playwright configuration plus deterministic test guards.
- `config/linting/` and `config/formatting/`: ESLint, Stylelint, and Prettier
  rules.
- Unit tests are colocated as `*.test.ts`; component tests use
  `*.component.test.ts`; cloud integration scenarios are routed through the
  integration config; Electron workflows are in `config/testing/start.test.ts`.

Generated output lives in `build/`, `dist/`, `public/build/`, and generated
public JavaScript/map files. `node_modules/`, packaged applications, test
output, and these build artifacts are ignored and must not be committed unless
the repository intentionally changes that policy.

## Change management

- Inspect the relevant implementation, types, configuration, and nearby tests
  before editing.
- Make focused changes; avoid unrelated refactoring and preserve the existing
  architecture, conventions, and GPLv3 licence/copyright notices.
- Do not change application behavior merely to conceal a machine or dependency
  setup problem.
- Never commit credentials, API keys, tokens, sensitive `.env` files, local
  paths, dependency folders, temporary files, or generated output.
- Before every commit, inspect `git status`, the complete `git diff`, and the
  staged diff. Stage only intended files and explain their purpose.
- Run the most relevant available checks for the change. Report failures and
  any checks that could not be run; do not claim unrun checks passed.
- Do not add happy-path-only, assertion-free, retry-dependent,
  mock-call-verification-only, or coverage-padding tests. Regression tests must
  fail against the buggy behavior or an equivalent deliberate fault and must
  inspect a meaningful resulting state.
- Tests must not access real FreeShow profiles, cloud accounts, credentials, or
  external services. Unexpected network access, console errors, unhandled
  promises, leaked processes, and residual temporary profiles are failures.
- Use clear, specific commit messages. Push completed, reviewed work to
  `origin/main` without force.
