# Releases

Viking releases are tag-driven. Use Node 22, keep the worktree clean, and run
the version step from a short-lived branch before publishing from `main`.

## 1. Check the release

Preview the next patch release without changing anything:

```sh
npm run release:dry-run
```

Use `minor`, `major`, or an exact version when needed:

```sh
npm run release:dry-run -- minor
npm run release:dry-run -- 1.2.3
```

## 2. Prepare the version PR

On a short-lived branch, bump the version and push the release commit:

```sh
npm run release:prepare:patch   # or release:prepare:minor / release:prepare:major
```

Open a PR for the generated `Release vX.Y.Z` commit and merge it into `main`.

If the branch is not ready to push yet, add `--no-push` and push it later:

```sh
npm run release:prepare:patch -- --no-push
```

## 3. Publish from `main`

Sync local `main`, then create and push the tag:

```sh
git switch main
git pull --ff-only
npm run release:patch       # or release:minor / release:major
```

The script creates `vX.Y.Z` and pushes it to `origin`. To publish an exact
version, use `npm run release -- 1.2.3`.

## Local builds

Use these before publishing when you want to inspect artifacts locally:

```sh
npm run pack:mac             # unpacked Apple Silicon app
npm run dist:mac             # macOS DMG and ZIP
npm run dist:win             # Windows x64 installer and ZIP
npm run dist                 # current platform's installer
```

## What CI publishes

Pushing a `v*` tag starts `.github/workflows/release.yml`. It builds and
uploads Apple Silicon macOS DMG/ZIP files and Windows x64 NSIS/ZIP files to
the GitHub Release. The macOS unpacked build also runs its smoke test first.

Artifacts are unsigned: macOS may require Gatekeeper approval, Windows shows
an unknown-publisher warning, and macOS auto-update remains disabled.
