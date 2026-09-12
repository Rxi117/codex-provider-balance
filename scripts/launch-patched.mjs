// Launch the patched Codex build.
//
// Paths are configurable so nothing is hard-coded to one machine:
//   CODEX_PATCH_EXE       full path to ChatGPT.exe inside the patched copy
//   CODEX_PATCH_USERDATA  user-data directory for the patched instance

import fs from "node:fs";
import { spawn } from "node:child_process";

const exe = process.env.CODEX_PATCH_EXE || "C:\\CodexDeepSeekPatched\\app\\ChatGPT.exe";
const userData = process.env.CODEX_PATCH_USERDATA || "C:\\CodexPatchedUserData";

if (!fs.existsSync(exe)) {
  console.error("patched Codex not found: " + exe);
  console.error("set CODEX_PATCH_EXE or run scripts/install-user-patched-codex.ps1 first");
  process.exit(1);
}

const args = ["--user-data-dir=" + userData];
const child = spawn(exe, args, { detached: true, stdio: "ignore" });
child.unref();
console.log("spawned pid", child.pid);

