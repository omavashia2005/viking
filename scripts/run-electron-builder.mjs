#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const env = { ...process.env };
const args = process.argv.slice(2);
const signing = Boolean(env.CSC_LINK?.trim()) || env.VIKING_FORCE_MAC_SIGNING === "1";

if (!signing) {
  delete env.CSC_LINK;
  delete env.CSC_KEY_PASSWORD;
  delete env.APPLE_API_KEY;
  delete env.APPLE_API_KEY_ID;
  delete env.APPLE_API_ISSUER;
  delete env.APPLE_ID;
  delete env.APPLE_APP_SPECIFIC_PASSWORD;
  delete env.APPLE_TEAM_ID;
  env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
  args.push("-c.mac.hardenedRuntime=false");
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["electron-builder", ...args],
  { cwd: process.cwd(), env, stdio: "inherit", shell: process.platform === "win32" }
);

if (result.error) {
  process.stderr.write(`run-electron-builder: ${result.error.message}\n`);
}

process.exit(typeof result.status === "number" ? result.status : 1);
