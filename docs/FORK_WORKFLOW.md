# FreeShow Fork Development and Release Workflow

This repository is the public `pitdapat/FreeShow` fork. It receives source-code
updates from `ChurchApps/FreeShow`, but installed application updates are
published by and downloaded only from `pitdapat/FreeShow`.

## Choose the right way to run FreeShow

There are three useful forms of the application:

| Form                                | Purpose                                        | Contains local fixes                         | Changes Windows installation |
| ----------------------------------- | ---------------------------------------------- | -------------------------------------------- | ---------------------------- |
| Development (`npm start`)           | Fast implementation and debugging              | Immediately                                  | No                           |
| Working build (`dist/win-unpacked`) | Everyday production-style use before a release | After rebuilding                             | No                           |
| Installed release                   | Stable daily/distributed version               | After a tagged fork release and installation | Yes                          |

All three use the normal external FreeShow settings and data. Do not run
multiple copies simultaneously because they can access the same data files.
Close FreeShow before replacing a working build or installing a release.

## Create an unpacked working build

Use this after fixing a bug or changing the UI when the change is useful for
daily use but is not ready to become a release:

```powershell
npm run build:working
```

On Windows, `Build-FreeShow-Working.cmd` runs the same command by double-click.
The working-build cache rebuilds only stale frontend, server, or Electron
groups, skips native dependency rebuilding when the lockfile and build inputs
are unchanged, and then refreshes `dist/win-unpacked`. Missing or unsafe cache
state automatically falls back to the normal full production build.

For a deliberately clean rebuild, use:

```powershell
npm run build
npx electron-builder --config config/building/electron-builder-fork.cjs --dir --win --x64 --publish never
```

Open:

```text
C:\Users\chewp\Documents\AI Application\Freeshow\dist\win-unpacked\FreeShow.exe
```

A shortcut may point to this executable. Rebuilding refreshes this working
copy. It does not create an installer, update Windows Installed Apps, change
the Start Menu release shortcut, publish to GitHub, or notify other installed
copies about an update.

## Publish and install a stable fork release

Automatic updates consume GitHub release assets, not ordinary commits. When a
change is stable and should replace the installed application:

1. Choose a version newer than the installed and latest fork versions, such as
   `1.6.4-pitdapat.2`.
2. Update the versions in `package.json` and `package-lock.json`.
3. Review the complete diff and run `npm run test:ci`, `npm run build`,
   `npm run test:playwright`, and `npm run pack:fork`. Run
   `npm run test:mutation` when critical persistence, backup, IPC,
   cloud-ledger, or output-transition logic changed.
4. Verify the unsigned installer, `latest.yml`, and packaged `app-update.yml`.
   The updater owner must be `pitdapat` and the repository must be `FreeShow`.
5. Commit and push the reviewed changes to `origin/main`.
6. Create and push the matching tag, for example
   `v1.6.4-pitdapat.2`.
7. Wait for `.github/workflows/fork-release.yml` to publish the installer,
   blockmap, and `latest.yml` to the fork's GitHub release.
8. Verify the public release, back up user data when appropriate, install the
   new package, and confirm the installed updater still targets the fork.

Never run the ChurchApps signing/publishing workflow for a fork release. Never
push to `upstream`. Fork installers are unsigned unless a separate signing
configuration is deliberately added, so Windows may show a publisher warning.

## Receive official source updates

Use the official repository only as a source remote:

```powershell
git switch main
git fetch upstream
git merge upstream/main
```

If both sides changed different files or different areas of one file, Git
normally merges them automatically. A conflict occurs when the fork and
upstream changed overlapping lines and Git cannot safely infer the intended
combined result. A conflict pauses the merge; it does not prevent the fork
from receiving the upstream update and does not automatically discard either
version.

Resolve every conflict individually:

1. Understand the purpose of the fork customization.
2. Understand the behavior or structural change introduced upstream.
3. Combine both when possible instead of blindly choosing all of `ours` or all
   of `theirs`.
4. Inspect related Svelte components, styles, stores, types, and tests.
5. Remove conflict markers, stage only resolved files, and complete the merge.
6. Run focused tests plus the production build before pushing to `origin/main`.

Fork updater configuration, release workflows, package versions, and heavily
customized Svelte components are likely conflict hot spots. Verify fork-only
update URLs after every upstream merge.

## Reduce UI merge conflicts

- Keep each customization small and focused.
- Avoid formatting or reorganizing an entire upstream file for a small visual
  change.
- Prefer a separate component or targeted CSS class when it fits the existing
  architecture.
- Keep behavior changes separate from cosmetic changes when practical.
- Commit completed changes with clear intent so a later conflict can be
  resolved from history.
- Merge upstream regularly rather than accumulating many official releases.

UI customization is compatible with continued upstream updates. Most updates
will merge automatically; overlapping redesigns require a deliberate manual
combination followed by testing.

## Test changes before publishing

Tests in this fork are adversarial rather than coverage padding. A regression
test must fail against the buggy behavior and assert a durable state,
serialized file, protocol result, or user-visible error. Do not accept
happy-path-only, assertion-free, fixed-sleep, retry-dependent, or mock-call-only
tests.

Electron tests use isolated profiles and must never read or write the normal
FreeShow data directory. Run a complete production build before Playwright;
partial production builds can leave the renderer bundle missing or stale.

See [Reliable and Adversarial Testing](TESTING.md) for suite commands, current
coverage and mutation gates, artifacts, CI qualification, and known expansion
areas.

## Codex workflow skills

When the personal skills are installed, use:

- `$freeshow-working-build` for the local unpacked everyday build. It must not
  version, commit, tag, publish, or install a release.
- `$freeshow-full-release` when a change is final and should be validated,
  published through the fork, and installed locally.
