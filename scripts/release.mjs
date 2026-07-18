#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const VALID_BUMPS = new Set(["patch", "minor", "major"]);
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const MAIN_BRANCH = "main";

function run(command, args, { capture = true } = {}) {
  const result = execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit"
  });
  return capture ? result.trim() : "";
}

function parseArgs(argv) {
  const options = { bump: "patch", dryRun: false, noPush: false, prepare: false };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-push") options.noPush = true;
    else if (arg === "--prepare") options.prepare = true;
    else if (VALID_BUMPS.has(arg) || VERSION_PATTERN.test(arg)) options.bump = arg;
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

function parseVersion(rawVersion) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(rawVersion).trim());
  if (!match) throw new Error(`Invalid version: ${rawVersion}`);
  return {
    raw: `${match[1]}.${match[2]}.${match[3]}`,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareVersions(left, right) {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

function incrementVersion(version, bump) {
  if (bump === "major") return parseVersion(`${version.major + 1}.0.0`);
  if (bump === "minor") return parseVersion(`${version.major}.${version.minor + 1}.0`);
  return parseVersion(`${version.major}.${version.minor}.${version.patch + 1}`);
}

function latestReleaseTag() {
  const tags = run("git", ["tag", "--list", "--sort=-v:refname", "v*"]);
  return tags.split("\n").map(value => value.trim()).find(tag => /^v\d+\.\d+\.\d+$/.test(tag)) || null;
}

function currentBranch() {
  const branch = run("git", ["branch", "--show-current"]);
  if (!branch) throw new Error("Release script requires a named branch, not a detached HEAD.");
  return branch;
}

function tagExists(tag) {
  try {
    run("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]);
    return true;
  } catch {
    return false;
  }
}

function worktreeEntries() {
  const status = run("git", ["status", "--short"]);
  if (!status) return [];
  return status.split("\n").filter(Boolean).map(raw => ({ raw, path: raw.slice(3).trim() }));
}

function formatEntries(entries) {
  return entries.map(entry => `- ${entry.raw}`).join("\n");
}

function isRecoverablePreparedState(entries) {
  const allowed = new Set(["package.json", "package-lock.json"]);
  return entries.length > 0 && entries.every(entry => allowed.has(entry.path));
}

function targetVersion(packageVersion, latestTagVersion, options) {
  if (VERSION_PATTERN.test(options.bump)) return parseVersion(options.bump);
  if (latestTagVersion && compareVersions(packageVersion, latestTagVersion) > 0) return packageVersion;
  if (!latestTagVersion && !options.prepare) return packageVersion;
  const base = latestTagVersion && compareVersions(latestTagVersion, packageVersion) > 0
    ? latestTagVersion
    : packageVersion;
  return incrementVersion(base, options.bump);
}

function releaseCommand(options, version) {
  return VALID_BUMPS.has(options.bump)
    ? `npm run release:${options.bump}`
    : `npm run release -- ${version.raw}`;
}

function releaseUrl() {
  try {
    const remote = run("git", ["remote", "get-url", "origin"]);
    const match = /github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(remote);
    return match ? `https://github.com/${match[1]}/releases` : null;
  } catch {
    return null;
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
  const packageVersion = parseVersion(pkg.version);
  const latestTag = latestReleaseTag();
  const latestTagVersion = latestTag ? parseVersion(latestTag) : null;
  const version = targetVersion(packageVersion, latestTagVersion, options);
  const tag = `v${version.raw}`;
  const branch = currentBranch();
  const entries = worktreeEntries();
  const shouldBump = version.raw !== packageVersion.raw;
  const recoverable = Boolean(
    latestTagVersion &&
    compareVersions(packageVersion, latestTagVersion) > 0 &&
    isRecoverablePreparedState(entries)
  );
  const requiresCommit = shouldBump || recoverable;
  const command = releaseCommand(options, version);

  if (tagExists(tag)) throw new Error(`Tag ${tag} already exists.`);

  if (options.dryRun) {
    console.log(`Mode: ${options.prepare ? "prepare" : "publish"}`);
    console.log(`Branch: ${branch}`);
    console.log(`Package version: ${packageVersion.raw}`);
    console.log(`Latest tag: ${latestTag || "(none)"}`);
    console.log(`Next release version: ${version.raw}`);
    console.log(`Will bump package version: ${shouldBump ? "yes" : "no"}`);
    console.log(`Worktree clean: ${entries.length ? "no" : "yes"}`);
    if (entries.length) console.log(`Worktree changes:\n${formatEntries(entries)}`);
    console.log(`Will push branch: ${options.noPush ? "no" : "yes"}`);
    console.log(`Will create tag: ${options.prepare ? "no" : "yes"}`);
    return;
  }

  if (entries.length && !recoverable) {
    throw new Error(`Worktree is not clean. Commit or stash changes first.\n${formatEntries(entries)}`);
  }

  if (options.prepare && branch === MAIN_BRANCH) {
    throw new Error(`Release preparation must run on a short-lived branch, not ${MAIN_BRANCH}.`);
  }

  if (options.prepare && !requiresCommit) {
    throw new Error(`Nothing to prepare for ${tag}. Merge this branch, sync ${MAIN_BRANCH}, then run ${command}.`);
  }

  if (!options.prepare && branch !== MAIN_BRANCH) {
    throw new Error(`Release publishing must run from ${MAIN_BRANCH}. Use ${command} -- --prepare on ${branch}.`);
  }

  if (!options.prepare && requiresCommit) {
    throw new Error(
      `Protected ${MAIN_BRANCH} requires a version pull request before ${tag}.\n` +
      `Run ${command} -- --prepare on a short-lived branch, merge it, sync ${MAIN_BRANCH}, then rerun ${command}.`
    );
  }

  if (shouldBump) {
    run("npm", ["version", version.raw, "--no-git-tag-version"], { capture: false });
  }
  if (shouldBump || recoverable) {
    run("git", ["add", "package.json", "package-lock.json"], { capture: false });
    run("git", ["commit", "-m", `Release ${tag}`], { capture: false });
  }

  if (options.prepare) {
    if (!options.noPush) run("git", ["push", "origin", branch], { capture: false });
    console.log(`Prepared ${tag}. Open and merge a PR into ${MAIN_BRANCH}, sync ${MAIN_BRANCH}, then run ${command}.`);
    return;
  }

  if (!options.noPush) run("git", ["push", "origin", branch], { capture: false });
  run("git", ["tag", tag], { capture: false });
  if (!options.noPush) run("git", ["push", "origin", tag], { capture: false });

  console.log(`Released ${tag}`);
  const url = releaseUrl();
  if (url) console.log(`Releases: ${url}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
