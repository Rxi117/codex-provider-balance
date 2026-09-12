import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(dirname, "server.mjs");
const child = spawn(process.execPath, [serverPath], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "test-key" }
});

let nextId = 1;
const pending = new Map();

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  for (const line of chunk.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  }
});

function call(method, params = {}) {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve) => pending.set(id, resolve));
}

const init = await call("initialize", { protocolVersion: "2025-06-18" });
const tools = await call("tools/list");
const resources = await call("resources/list");
const resource = await call("resources/read", { uri: "ui://deepseek-balance/balance.html" });
const tool = await call("tools/call", { name: "provider_balance", arguments: { provider: "deepseek" } });

const checks = [
  init.result?.serverInfo?.name === "deepseek-balance",
  tools.result?.tools?.some((item) => item.name === "provider_balance"),
  resources.result?.resources?.some((item) => item.uri === "ui://deepseek-balance/balance.html"),
  resource.result?.contents?.[0]?.mimeType === "text/html",
  tool.result?.structuredContent?.ok === false || tool.result?.structuredContent?.ok === true
];

child.kill();

if (checks.every(Boolean)) {
  console.log("MCP smoke test passed.");
} else {
  console.error("MCP smoke test failed.");
  process.exit(1);
}
