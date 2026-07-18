# Reliable and Adversarial Testing

FreeShow uses Vitest, Svelte Testing Library, Playwright, V8 coverage, and
Stryker mutation testing. The suite is risk-first: a test is valuable when it
can detect data loss, corrupted state, invalid boundary input, lifecycle
failures, or a regression that previously reached users.

Coverage numbers are a guardrail, not a substitute for behavioral assertions
or mutation resistance.

## Install and build prerequisites

Run commands from the repository root. Install the normal development
dependencies first:

```powershell
npm install
```

The Electron Playwright suite launches the production entry point. Run a full
build whenever `public/build` or `build/electron` is absent or stale:

```powershell
npm run build
npm run test:playwright
```

Do not run Playwright against a frontend-only or Electron-only partial build.
`npm run prebuild` removes generated frontend output, so it must be followed by
the complete build before Electron tests are trusted.

## Test commands

| Command                    | Purpose                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run test:unit`        | Node-based colocated Vitest tests under `src/**/*.test.ts`, excluding component and integration groups. |
| `npm run test:component`   | Svelte component behavior in jsdom with Svelte Testing Library.                                         |
| `npm run test:integration` | Integration scenarios, currently including multi-device cloud synchronization.                          |
| `npm run test:coverage`    | Critical Vitest scope with V8 thresholds and HTML/JSON/text reports.                                    |
| `npm run test:mutation`    | Targeted Stryker mutations for critical domain and boundary logic.                                      |
| `npm run test:playwright`  | Isolated production Electron workflows on Windows.                                                      |
| `npm run test:ci`          | Unit, component, integration, and coverage groups. It does not build or launch Electron.                |
| `npm run test:nightly`     | Local CI groups, mutation testing, and Electron workflows. Build first.                                 |
| `npm test`                 | Unit, component, integration, Electron, formatting, and Svelte checks.                                  |

Formatting and repository-wide Svelte checks currently contain inherited
backlog. They remain visible but non-blocking in the normal CI workflow. Do not
hide new errors in files being changed.

## What is protected today

The current critical suite includes behavioral protection for:

- atomic show and store writes when staging or rename operations fail;
- malformed, binary, colliding, traversal-derived, and partially damaged
  backup content;
- all-or-nothing preflight rejection before a malformed backup can replace a
  valid show;
- cloud tombstones, duplicate device IDs, stale acknowledgements, and legacy
  creation metadata;
- malformed and unknown main-process IPC channels;
- media-backed slide render identity during persistent/transition branch
  changes;
- invalid Svelte list spacing boundaries;
- empty show rejection, persisted show reconstruction after restart, truncated
  show startup behavior, left-drawer show creation, and visible damaged-backup
  rejection in Electron.

This is not a claim that every FreeShow workflow is covered. Priority expansion
areas include transactional rollback after a real restore write failure,
editing and undo/redo fault sequences, output destruction and playback cleanup,
server timeout/reconnect behavior, and wider import/export corruption cases.

## Test validity rules

New tests must follow these rules:

1. Assert a durable effect, forbidden effect, boundary response, or
   user-visible failure. Do not assert only that a mock was called, an element
   exists, a process started, or no exception was thrown.
2. A success workflow must prove an invariant and include a failure, boundary,
   restart, or forbidden-state assertion. Do not add happy-path-only coverage.
3. A regression test must fail against the buggy implementation or an
   equivalent deliberate fault.
4. Do not reproduce production algorithms in the test. Use semantic domain
   values and inspect the real resulting state, serialized file, protocol
   message, or UI.
5. Prefer Arrange-Act-Assert structure and names that state the failure being
   prevented.
6. Do not use fixed sleeps for readiness. Use application readiness markers,
   event completion, accessible locators, stable test IDs, and auto-waiting
   assertions.
7. Tests may mock uncontrollable boundaries, but they must assert the resulting
   state rather than the mock interaction alone.
8. Skips, retries, assertion-free tests, unexpected console errors, unhandled
   promises, unexplained network access, leaked processes, and residual test
   profiles are failures.
9. Keep snapshots narrow. Prefer explicit fields and domain values over broad
   UI or object snapshots.

## Isolation and network safety

Unit, component, and integration tests load `config/testing/testGuards.ts`,
which rejects unexpected `fetch` calls. Integration tests also use
deterministic temporary storage and controlled boundary implementations.

Electron workflows set `FS_MOCK_STORE_PATH` to a fresh temporary profile. This
redirects Electron store, `userData`, and session data away from the real
FreeShow profile. The first-run data chooser is redirected to another isolated
temporary directory. Tests must never select a real user folder, cloud account,
credential store, or external service.

Electron analytics is disabled in test mode. Known noncritical startup
requests are stubbed; any other HTTP request is recorded and fails the test.
Each workflow checks renderer errors, closes the application, waits for process
exit, and removes its temporary profile.

## Coverage and mutation gates

`config/testing/vitest.config.ts` defines the executable coverage policy. The
current critical scope has a global minimum of 90% lines/statements/functions
and 80% branches. Backup validation has a transitional file-specific minimum
of 85% lines/statements/functions and 75% branches. Thresholds must not be
lowered to make a change pass.

`stryker.config.mjs` mutation-checks the critical persistence, backup, IPC,
cloud-ledger, and slide-transition helpers. The mutation run breaks below 80%.
A meaningful surviving mutation should lead to a stronger assertion or an
explicitly justified exclusion.

Reports are written under `test-output/coverage`, `test-output/mutation`, and
`test-output/playwright-artifacts`. These paths are ignored by Git. CI uploads
available evidence on failure and completion.

## CI and qualification

On pushes to `main` and pull requests:

- Ubuntu runs unit, component, integration, coverage, formatting, Svelte
  checking, and a production build.
- Windows builds the production application and runs Electron Playwright.
- Unit tests and the production build are blocking today.
- Component, integration, coverage, and Electron groups are observational
  until each has 20 consecutive clean runs without retries, leaks, unexplained
  noise, or artifacts. Their outcome is recorded in the workflow summary.

Nightly CI runs the extended matrix on Windows, Ubuntu, and macOS. Mutation
testing runs on Windows and Ubuntu; Electron workflows currently run on
Windows. The fork release workflow is stricter: `test:ci`, the production
build, and Electron workflows must pass before publishing.

When a group completes its 20-run qualification, remove its
`continue-on-error` setting in the normal workflow and update this document in
the same commit.
