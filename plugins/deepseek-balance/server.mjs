import readline from "node:readline";

const SERVER_NAME = "deepseek-balance";
const SERVER_TITLE = "Provider Balance";
const SERVER_VERSION = "0.1.0";
const RESOURCE_URI = "ui://deepseek-balance/balance.html";
const TOOL_NAME = "provider_balance";
const DEFAULT_PROVIDER = "deepseek";

const providers = {
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    balanceUrl: "https://api.deepseek.com/user/balance",
    docsUrl: "https://api-docs.deepseek.com/api/get-user-balance",
    async fetchBalance(apiKey) {
      const response = await fetch(this.balanceUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json"
        }
      });

      const bodyText = await response.text();
      let data;
      try {
        data = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        throw new Error(`DeepSeek returned HTTP ${response.status} with a non-JSON body.`);
      }

      if (!response.ok) {
        const message = data?.error?.message || data?.message || `DeepSeek balance API returned HTTP ${response.status}.`;
        throw new Error(message);
      }

      const balances = Array.isArray(data.balance_infos) ? data.balance_infos : [];
      const preferred = balances.find((item) => item.currency === "CNY") || balances[0] || null;
      if (!preferred) {
        throw new Error("DeepSeek balance response did not include balance_infos.");
      }

      return {
        provider: this.id,
        providerName: this.name,
        available: Boolean(data.is_available),
        currency: String(preferred.currency || "CNY"),
        totalBalance: normalizeAmount(preferred.total_balance),
        grantedBalance: normalizeAmount(preferred.granted_balance),
        toppedUpBalance: normalizeAmount(preferred.topped_up_balance),
        raw: data,
        fetchedAt: new Date().toISOString()
      };
    }
  }
};

function normalizeAmount(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric.toFixed(2);
  return String(value ?? "0.00");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function currencySymbol(currency) {
  if (currency === "CNY") return "¥";
  if (currency === "USD") return "$";
  return `${currency} `;
}

function getProvider(providerId = DEFAULT_PROVIDER) {
  const provider = providers[String(providerId).toLowerCase()];
  if (!provider) {
    const known = Object.keys(providers).join(", ");
    throw new Error(`Unknown provider "${providerId}". Available providers: ${known}.`);
  }
  return provider;
}

async function readBalance(providerId = DEFAULT_PROVIDER) {
  const provider = getProvider(providerId);
  const apiKey = process.env[provider.envKey];
  if (!apiKey) {
    throw new Error(`Missing ${provider.envKey}. Set it to your ${provider.name} API key before starting Codex.`);
  }
  return provider.fetchBalance(apiKey);
}

function renderBalanceCard(state) {
  const ok = state.ok;
  const balance = state.balance;
  const providerName = balance?.providerName || "Provider";
  const amount = balance ? `${currencySymbol(balance.currency)}${balance.totalBalance}` : "--";
  const sub = balance
    ? `Granted ${currencySymbol(balance.currency)}${balance.grantedBalance} · Topped up ${currencySymbol(balance.currency)}${balance.toppedUpBalance}`
    : state.error;
  const status = balance?.available ? "available" : ok ? "unavailable" : "needs setup";
  const color = ok && balance?.available ? "#10a37f" : ok ? "#b7791f" : "#d14b4b";
  const fetched = balance?.fetchedAt ? new Date(balance.fetchedAt).toLocaleString("zh-CN", { hour12: false }) : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: transparent; }
    body {
      color: inherit;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    }
    .card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      min-height: 128px;
      padding: 16px 18px;
      border: 1px solid rgba(128, 128, 128, .22);
      border-radius: 10px;
      background: rgba(128, 128, 128, .06);
    }
    .label {
      font-size: 12px;
      font-weight: 650;
      letter-spacing: .04em;
      text-transform: uppercase;
      opacity: .65;
    }
    .amount {
      margin-top: 6px;
      color: ${color};
      font-size: 32px;
      font-weight: 750;
      line-height: 1.05;
      font-variant-numeric: tabular-nums;
    }
    .sub {
      margin-top: 8px;
      max-width: 430px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      opacity: .66;
    }
    .right {
      text-align: right;
      font-size: 12px;
      opacity: .68;
      white-space: nowrap;
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 7px;
      border-radius: 999px;
      background: ${color};
    }
    .time {
      margin-top: 8px;
      font-size: 11px;
      opacity: .65;
    }
  </style>
</head>
<body>
  <div class="card">
    <div>
      <div class="label">${escapeHtml(providerName)} Balance</div>
      <div class="amount">${escapeHtml(amount)}</div>
      <div class="sub">${escapeHtml(sub || "")}</div>
    </div>
    <div class="right">
      <div><span class="dot"></span>${escapeHtml(status)}</div>
      <div class="time">${escapeHtml(fetched)}</div>
    </div>
  </div>
</body>
</html>`;
}

const uiMeta = {
  ui: { resourceUri: RESOURCE_URI },
  "openai/ui": {
    entrypoints: [{ type: "global" }, { type: "settings" }, { type: "thread" }],
    preferredModelDisplayMode: ["inline", "fullscreen"]
  },
  "openai/widgetShowCodexWidgetInline": true,
  "openai/widgetHeightHint": 180,
  "openai/widgetPrefersBorder": false
};

const toolDefinition = {
  name: TOOL_NAME,
  title: "Provider Balance",
  description: "Show the API account balance for the selected provider. Currently supports DeepSeek.",
  inputSchema: {
    type: "object",
    properties: {
      provider: {
        type: "string",
        enum: Object.keys(providers),
        description: "Provider to query. Defaults to deepseek."
      }
    },
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: true,
    title: "Provider Balance"
  },
  _meta: uiMeta
};

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  if (id !== undefined && id !== null) write({ jsonrpc: "2.0", id, result: value });
}

function error(id, code, message) {
  if (id !== undefined && id !== null) write({ jsonrpc: "2.0", id, error: { code, message } });
}

async function currentState(providerId = DEFAULT_PROVIDER) {
  try {
    return { ok: true, balance: await readBalance(providerId), error: null };
  } catch (err) {
    return { ok: false, balance: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handle(message) {
  const { id, method, params } = message;

  if (method === "initialize") {
    result(id, {
      protocolVersion: params?.protocolVersion || "2025-06-18",
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false }
      },
      serverInfo: {
        name: SERVER_NAME,
        title: SERVER_TITLE,
        version: SERVER_VERSION
      },
      instructions: "Use provider_balance to show the current API balance for the selected provider."
    });
    return;
  }

  if (method === "notifications/initialized" || method === "initialized" || method === "notifications/cancelled") return;
  if (method === "ping") {
    result(id, {});
    return;
  }
  if (method === "tools/list") {
    result(id, { tools: [toolDefinition] });
    return;
  }
  if (method === "resources/list") {
    result(id, {
      resources: [{
        uri: RESOURCE_URI,
        name: "Provider Balance",
        title: "Provider Balance",
        mimeType: "text/html",
        _meta: uiMeta
      }]
    });
    return;
  }
  if (method === "resources/templates/list") {
    result(id, { resourceTemplates: [] });
    return;
  }
  if (method === "prompts/list") {
    result(id, { prompts: [] });
    return;
  }
  if (method === "resources/read") {
    if (params?.uri !== RESOURCE_URI) {
      error(id, -32002, `Resource not found: ${params?.uri || ""}`);
      return;
    }
    const state = await currentState(DEFAULT_PROVIDER);
    result(id, {
      contents: [{
        uri: RESOURCE_URI,
        mimeType: "text/html",
        text: renderBalanceCard(state),
        _meta: uiMeta
      }]
    });
    return;
  }
  if (method === "tools/call") {
    if (params?.name !== TOOL_NAME) {
      error(id, -32602, `Unknown tool: ${params?.name || ""}`);
      return;
    }
    const provider = params?.arguments?.provider || DEFAULT_PROVIDER;
    const state = await currentState(provider);
    const text = state.ok
      ? `${state.balance.providerName} balance: ${currencySymbol(state.balance.currency)}${state.balance.totalBalance}`
      : `Provider balance unavailable: ${state.error}`;
    result(id, {
      content: [{ type: "text", text }],
      structuredContent: state,
      _meta: uiMeta,
      isError: false
    });
    return;
  }

  error(id, -32601, `Method not found: ${method}`);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }
  handle(message).catch((err) => {
    error(message.id, -32603, err instanceof Error ? err.message : String(err));
  });
});
