const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

const PORT = Number(process.env.DEEPSEEK_BALANCE_PORT || 17561);
const AGENT_ORIGIN = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = path.resolve(__dirname, "..");
const AGENT_SCRIPT = path.join(REPO_ROOT, "scripts", "deepseek-balance-agent.mjs");

let agentProcess = null;
let mainWindow = null;

function iconPath() {
  const ico = path.join(__dirname, "assets", "icon.ico");
  if (fs.existsSync(ico)) return ico;
  const png = path.join(__dirname, "assets", "icon.png");
  return fs.existsSync(png) ? png : undefined;
}

async function isAgentUp() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${AGENT_ORIGIN}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForAgent(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isAgentUp()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function spawnAgent() {
  if (!fs.existsSync(AGENT_SCRIPT)) return;
  if (agentProcess && !agentProcess.killed) return;
  try {
    agentProcess = spawn("node", [AGENT_SCRIPT], {
      cwd: REPO_ROOT,
      windowsHide: true,
      detached: false,
      stdio: "ignore"
    });
    agentProcess.on("exit", () => {
      agentProcess = null;
    });
  } catch {
    agentProcess = null;
  }
}

async function ensureAgent() {
  if (await isAgentUp()) return true;
  spawnAgent();
  return waitForAgent();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 780,
    minWidth: 760,
    minHeight: 620,
    show: false,
    title: "Provider Balance",
    backgroundColor: "#ffeef4",
    autoHideMenuBar: true,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"), {
    query: { agent: AGENT_ORIGIN }
  });
}

app.whenReady().then(async () => {
  await ensureAgent();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.handle("agent:restart", async () => {
  if (agentProcess && !agentProcess.killed) {
    try {
      agentProcess.kill();
    } catch {}
    agentProcess = null;
  }
  return ensureAgent();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (agentProcess && !agentProcess.killed) {
    try {
      agentProcess.kill();
    } catch {}
  }
});
