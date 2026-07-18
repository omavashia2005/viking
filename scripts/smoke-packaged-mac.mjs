#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";

const appPath = path.resolve(process.argv[2] || "release/mac-arm64/Viking.app");
const executable = path.join(appPath, "Contents", "MacOS", "Viking");
const marker = "VIKING_SMOKE_OK";
const timeoutMs = 20_000;

if (process.platform !== "darwin") {
  throw new Error("The packaged smoke test only supports macOS.");
}

const child = spawn(executable, ["--smoke-test"], {
  env: { ...process.env, VIKING_SMOKE_TEST: "1" },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", chunk => {
  output += chunk;
  process.stdout.write(chunk);
});
child.stderr.on("data", chunk => {
  output += chunk;
  process.stderr.write(chunk);
});

const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
const { code, signal } = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => resolve({ code, signal }));
});
clearTimeout(timer);

if (code !== 0 || !output.includes(marker)) {
  throw new Error(`Packaged smoke test failed (code=${String(code)}, signal=${String(signal)}).`);
}
