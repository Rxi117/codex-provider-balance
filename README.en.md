# Codex Balance Menu Patch - Clone Edition (codex-provider-balance)

Make a **copy** of the genuine Codex desktop app, called the "clone", and patch only that copy so each provider's API balance shows up in the profile menu right under "Usage remaining". The clone and the official app can run at the same time.

Inside the clone's profile menu: one row per provider, each with the matching vendor logo, and clicking any row opens the local config panel.

## What is in this repository

Four independent pieces; install only what you need:

1. Local balance service + config panel - `scripts/deepseek-balance-agent.mjs`

   A small HTTP service bound to `127.0.0.1:17561`. It reads the API keys stored on your machine, queries each provider's official balance endpoint, and serves a web panel for adding vendors, entering keys, and toggling whether each provider shows in the Codex menu.

2. Codex desktop asar patch - `scripts/patch-asar.mjs` and friends

   The genuine Codex lives under WindowsApps, read-only and signature-checked, so it cannot be edited in place. The patch first copies Codex into a folder you can write to, then modifies the `app.asar` inside that copy, injecting React code that inserts the balance rows into the profile menu above "Show pet".

3. Codex MCP plugin - `plugins/deepseek-balance/`

   A standard Codex MCP plugin that can report DeepSeek balance in chat. Independent from the menu patch; the two can be used separately.

4. Standalone Electron config panel - `desktop/` (optional)

   A pink-themed desktop app for managing vendors and keys. It starts the local balance service automatically, so you do not need to launch it by hand.

## Clone + patch: side by side with the official app

This does not modify the Codex you installed. It **copies** the genuine build and patches only that copy. That copy is the "clone":

- the genuine Codex (the MSIX package under WindowsApps) is left untouched and still opens normally;
- the clone lives in `C:\CodexDeepSeekPatched` - its own folder, its own executable, and the only one carrying the patch;
- the clone uses its own Electron data directory `C:\CodexPatchedUserData`, so window state and local storage stay separate from the official app;
- to undo everything, just delete the clone folder; the official install is unaffected.

**The clone and the official app can run at the same time.** Two windows open together work fine:

- they sign in to the same account and read the same `%USERPROFILE%\.codex`, so the task list, config, skills, plugins, and quota are one shared set, not two separate accounts;
- the balance rows appear only in the **clone's** profile menu, since the patch is applied only to the clone; the official app stays as it was;
- the one caution: because both share a single `.codex`, do not edit the **same task** in both at once, to avoid writer-lock contention. Different tasks in parallel are fine.

The intended workflow: use the official app day to day, and open the clone whenever you want the provider balances under "Usage remaining". Running both together is fully supported.

## Requirements

- Windows 10 / 11
- Node.js 18 or newer (the scripts rely on Node's built-in `fetch`)
- Genuine Codex desktop app (MSIX package `OpenAI.Codex`), started at least once
- Your own provider API keys (this repository ships none and embeds none)

## Quick start (menu patch route)

1. Install the genuine Codex desktop app and start it at least once.
2. Clone or download this repository.
3. In PowerShell, run the installer:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-user-patched-codex.ps1
```

   The script does the following:

   - copies Codex to `C:\CodexDeepSeekPatched`;
   - calls `patch-asar.mjs` to patch `app.asar`;
   - creates a desktop shortcut named `Codex Provider Balance Patched`;
   - creates two shortcuts in your Startup folder: balance service autostart, and auto re-patch after Codex updates;
   - starts the balance service if it is not already running.

   If this step fails with a permission error, run it again from an elevated PowerShell.

4. Open the config panel at `http://127.0.0.1:17561/`, fill in a vendor name, pick the type, paste the API key, and tick "show".

5. Launch the patched Codex from the `Codex Provider Balance Patched` desktop shortcut, open the profile menu, and the balance rows appear under "Usage remaining".

All paths can be overridden; the script takes parameters:

```powershell
.\scripts\install-user-patched-codex.ps1 -Target 'D:\CodexPatched' -UserData 'D:\CodexPatchedData'
```

The environment variables `CODEX_PATCH_TARGET` / `CODEX_PATCH_USERDATA` are also supported.

## MCP plugin only (without touching Codex files)

If you would rather not modify Codex's install files, use just the standard plugin:

```powershell
setx DEEPSEEK_API_KEY "sk-your-deepseek-key"
```

Restart Codex after setting it, then:

```powershell
codex plugin marketplace add .\.agents\plugins
codex plugin add deepseek-balance@deepseek-balance-local
```

Open a new task and ask Codex to "show my DeepSeek balance". Note: current Codex builds do not expose a plugin slot in the profile menu, so the plugin can only render a card in chat, not a row under "Usage remaining". To get a row there you need the asar patch above.

## Supported providers

| Type | Name | Balance endpoint | Status |
| --- | --- | --- | --- |
| `deepseek` | DeepSeek | `GET https://api.deepseek.com/user/balance` | implemented |
| `moonshot` | Kimi (Moonshot) | `GET https://api.moonshot.cn/v1/users/me/balance` | implemented |
| `doubao` | Doubao / Volcengine Ark | requires signed billing OpenAPI calls with Volcengine AK/SK | not possible with an API key alone |
| `openai` / `anthropic` / `siliconflow` / `custom` | same-named | - | currently a placeholder that only shows "configured"; add your own adapter |

To add a provider: add an entry to `providerTypes` at the top of `deepseek-balance-agent.mjs` and write a matching `fetchXxxBalance` adapter. Menu logos come from `scripts/logos.json`.

## Patch internals (the pitfalls)

`app.asar` is a custom format: a 16-byte header, a JSON directory tree, then file data. A few things bite when rewriting it:

1. The data start is `16 + aligned JSON length`, not `16 + JSON length`. The JSON length is padded up to a 4-byte boundary; using `jsonLen` directly shifts everything.
2. A batch of entries in the original archive carry `unpacked: true`, with their data actually in `app.asar.unpacked/`. Those entries must be preserved as-is; do not fold their data back into the asar.
3. The replacement range runs from the start of the function to the `}` just before `}var uGt,`, and the injected code supplies its own closing brace, so you need `slice(0,start) + injection + slice(end+1)` - otherwise you end up with one extra `}` and a syntax error.
4. The window title comes from `app.setName(...)` in `.vite/build/bootstrap-*.js`, not from `package.json`.

## Security and privacy

- Your API keys live only on your machine, in `%USERPROFILE%\.codex-provider-balances\providers.json`.
- The balance service binds to `127.0.0.1` only and never listens on an external interface.
- Keys are sent as Bearer tokens only to the official endpoint of the provider you configured.
- This repository contains no real keys; `.gitignore` already excludes `providers.json`. Please do not commit your own `providers.json`.

## Can other people just download and use it?

Not out of the box. They need to do some setup of their own:

1. Install the genuine Codex desktop app (MSIX). This repository does not contain, and cannot contain, the Codex binary.
2. Supply their own provider API keys and enter them in the config panel.
3. The default path is `C:\CodexDeepSeekPatched`; use the parameters or environment variables to relocate it.
4. Every Codex update replaces `app.asar`, which wipes the patch, so it must be re-applied. The installer already registers a logon autostart plus a timer to re-patch, so this is mostly hands-off.
5. The patch anchors on minified function names (such as `lGt` and `uGt`). A major Codex refactor can invalidate the anchor, at which point the injection point must be re-located. So this is closer to a self-maintained local mod than a forever-finished product.
6. It has only been verified on Windows; other platforms are untested.

## Uninstall / restore

- Delete the whole `C:\CodexDeepSeekPatched` folder; the genuine Codex is completely unaffected.
- Remove the `Codex Provider Balance Agent` and auto re-patch shortcuts from your Startup folder.
- Kill the `node` process to stop the service on port 17561.

## Repository layout

```
codex-provider-balance/
  README.md
  README.en.md
  LICENSE
  .gitignore
  .agents/plugins/marketplace.json     # local plugin marketplace manifest
  plugins/deepseek-balance/            # MCP plugin
  scripts/                             # balance service + asar patch toolchain
    deepseek-balance-agent.mjs         # balance service and config panel
    patch-asar.mjs                     # patcher
    gen-inject.mjs                     # generates the injection code
    inject-lgt.js                      # the generated injection snippet
    logos.json                         # vendor logo SVG paths
    verify-inject.mjs                  # verifies the patch landed
    install-user-patched-codex.ps1     # one-shot installer
    ensure-balance-agent.ps1           # watchdog: keeps the service running
    restart-agent.ps1                  # restarts the balance service
    launch-patched.mjs                 # launches the patched Codex
    do-patch.ps1                       # developer: re-patch an existing folder
    providers.example.json             # config sample
  desktop/                             # standalone Electron config panel (optional)
```

## License

MIT. See `LICENSE`.

