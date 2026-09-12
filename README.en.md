# Codex Provider Balance

Show per-provider API balances (DeepSeek, Kimi, ...) directly inside the Codex desktop profile menu, right under "Usage remaining": one row per provider, each with its own logo, and clicking a row opens a local config panel.

## What is in this repository

1. `scripts/deepseek-balance-agent.mjs` - a local service bound to `127.0.0.1:17561` that reads your API keys, queries each provider's official balance endpoint, and serves a small config web page for adding providers, keys, and menu visibility.
2. `scripts/patch-asar.mjs` and friends - patches a user-writable copy of the Codex desktop `app.asar` to inject the balance rows into the profile menu above "Show pet".
3. `plugins/deepseek-balance/` - a standard Codex MCP plugin that can report DeepSeek balance in chat. Independent from the patch; install only what you need.
4. `desktop/` - an optional Electron control panel for managing providers.

The Chinese `README.md` is the full documentation; it covers install steps, supported providers, the asar patching pitfalls, and privacy.

## Clone + patch, side by side with the official app

This does not modify the Codex you installed. It **copies** the official build and patches only that copy. That copy is the "clone":

- the official Codex (the MSIX package under WindowsApps) is left untouched and still opens normally;
- the clone lives in `C:\CodexDeepSeekPatched` - its own folder, its own executable, the only one carrying the patch;
- the clone uses its own Electron data directory `C:\CodexPatchedUserData`, so window state and local storage stay separate;
- to undo everything, just delete the clone folder; the official install is unaffected.

**The clone and the official app can run at the same time.** Two windows open together work fine:

- they sign in to the same account and read the same `%USERPROFILE%\.codex`, so the task list, config, skills, plugins, and quota are one shared set, not two separate accounts;
- the balance rows appear only in the **clone's** profile menu, since the patch is applied only to the clone;
- the one caution: because both share a single `.codex`, do not edit the **same task** in both at once, to avoid writer-lock contention. Different tasks in parallel are fine.

The intended workflow is: use the official app day to day, and open the clone whenever you want the provider balances to show under "Usage remaining". Running both together is fully supported.

## Requirements

- Windows 10/11
- Node.js 18+
- Genuine Codex desktop app (MSIX package `OpenAI.Codex`)
- Your own provider API keys

## Quick start

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-user-patched-codex.ps1
```

The script copies Codex to `C:\CodexDeepSeekPatched`, patches `app.asar`, creates a desktop shortcut for the patched build, and registers two startup shortcuts (balance agent autostart, and auto re-patch after Codex updates). You can override the paths with the `-Target` / `-UserData` parameters or the `CODEX_PATCH_TARGET` / `CODEX_PATCH_USERDATA` environment variables.

Then open `http://127.0.0.1:17561/` to add providers and keys, and launch the patched Codex from the new desktop shortcut. The balance rows appear in the profile menu under "Usage remaining".

## Can other people just download and use it?

Not out of the box. They need a genuine Codex install, their own API keys, and the patch must be re-applied after every Codex update. The injection anchors are minified function names, so a major Codex refactor can break the patch and require re-locating the anchor.

## Privacy

Keys live only in `%USERPROFILE%\.codex-provider-balances\providers.json`. The service binds to loopback only and sends keys as Bearer tokens only to the provider you configured. No keys are committed to this repository.

## License

MIT. See `LICENSE`.
