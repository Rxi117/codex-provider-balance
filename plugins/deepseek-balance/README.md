# DeepSeek Balance for Codex

DeepSeek Balance is a Codex MCP plugin that shows your DeepSeek API account balance inside Codex.

It uses the official DeepSeek balance endpoint directly:

```text
GET https://api.deepseek.com/user/balance
```

The plugin reads your API key from `DEEPSEEK_API_KEY`. It does not depend on opencodex, local proxy APIs, Claude, or any copied Codex authentication.

## Features

- Native Codex plugin manifest.
- MCP tool: `provider_balance`.
- Inline HTML balance card for Codex plugin UI.
- Direct DeepSeek API balance lookup.
- Provider adapter structure, so more model providers can be added later.
- No account password storage. Only an API key is used.

## Setup

Create a DeepSeek API key in your DeepSeek account dashboard, then set it before starting Codex.

PowerShell:

```powershell
setx DEEPSEEK_API_KEY "sk-your-deepseek-api-key"
```

Restart Codex after setting the variable.

## Local Install

From the repository root:

```powershell
codex plugin marketplace add .\.agents\plugins
codex plugin add deepseek-balance@deepseek-balance-local
```

After installing, open a new Codex task so the plugin tools are loaded.

## Usage

Ask Codex:

```text
Show my DeepSeek balance.
```

The plugin returns the total balance and renders a small balance card when Codex shows the plugin UI.

## Provider Switching

The MCP tool accepts a `provider` argument. Version `0.1.0` supports:

```json
{
  "provider": "deepseek"
}
```

The code is structured so additional providers can be added as adapters. If Codex exposes the current selected model/provider to plugins in a stable context API, this plugin can use that signal to automatically switch which balance it displays.

## Limitations

Codex plugins can render plugin UI and expose tools, but current Codex builds do not expose a documented plugin slot inside the built-in account menu's "remaining usage" section. Displaying directly beside Codex's own 5-hour and weekly limits would require Codex to expose that UI slot or require patching Codex internals.

## Optional Account Menu Patch

This repository also includes optional scripts in the root `scripts/` folder that can patch the local Codex desktop app so the profile menu shows configured provider balances near the built-in usage section.

That patch is separate from the standard plugin. It modifies the local Codex desktop bundle, so it requires administrator permission once and may need to be reapplied after Codex updates. The included scheduled task handles that reapply step automatically.

The local agent also serves a configuration page at `http://127.0.0.1:17561/`, where you can add provider names, API keys, and choose whether each provider should be shown or hidden in Codex.

## Privacy

Your DeepSeek API key is read from the environment of the MCP server process. The key is sent only to `https://api.deepseek.com/user/balance` as a Bearer token.

## License

MIT
