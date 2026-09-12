import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.DEEPSEEK_BALANCE_PORT || 17561);
const CACHE_TTL_MS = Number(process.env.PROVIDER_BALANCE_CACHE_MS || 30000);
const CONFIG_DIR = path.join(os.homedir(), ".codex-provider-balances");
const CONFIG_FILE = path.join(CONFIG_DIR, "providers.json");
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/user/balance";
const MOONSHOT_ENDPOINT = "https://api.moonshot.cn/v1/users/me/balance";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const RENDERER_FILE = path.join(REPO_ROOT, "desktop", "renderer", "index.html");
const ASSETS_DIR = path.join(REPO_ROOT, "desktop", "assets");

const providerTypes = {
  deepseek: { title: "DeepSeek", balance: fetchDeepSeekBalance, topup: "https://platform.deepseek.com/top_up" },
  moonshot: { title: "Kimi (Moonshot)", balance: fetchMoonshotBalance, topup: "https://platform.moonshot.cn/console/pay" },
  doubao: { title: "\u8c46\u5305 (\u706b\u5c71\u65b9\u821f)", balance: fetchDoubaoBalance, topup: "https://console.volcengine.com/finance/" },
  openai: { title: "OpenAI", balance: fetchUnsupportedBalance, topup: "https://platform.openai.com/settings/organization/billing/overview" },
  anthropic: { title: "Anthropic", balance: fetchUnsupportedBalance, topup: "https://console.anthropic.com/settings/billing" },
  siliconflow: { title: "SiliconFlow", balance: fetchUnsupportedBalance, topup: "https://cloud.siliconflow.cn/account/charge" },
  custom: { title: "Custom", balance: fetchUnsupportedBalance, topup: "" }
};

let cache = new Map();

function safeId(value) {
  const base = String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return base || `provider-${Date.now()}`;
}

function ensureConfig() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) {
    const envKey = process.env.DEEPSEEK_API_KEY || "";
    writeConfig({
      version: 1,
      providers: envKey ? [{ id: "deepseek", name: "DeepSeek", type: "deepseek", apiKey: envKey, showInCodex: true }] : []
    });
  }
}

function readConfig() {
  ensureConfig();
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return { version: 1, providers: Array.isArray(parsed.providers) ? parsed.providers : [] };
  } catch {
    return { version: 1, providers: [] };
  }
}

function writeConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const normalized = {
    version: 1,
    providers: (config.providers || []).map((provider) => ({
      id: safeId(provider.id || provider.name || provider.type || "provider"),
      name: String(provider.name || provider.type || "Provider").trim() || "Provider",
      type: String(provider.type || "custom").toLowerCase(),
      apiKey: String(provider.apiKey || ""),
      showInCodex: Boolean(provider.showInCodex)
    }))
  };
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  cache = new Map();
  return normalized;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function html(res, body) {
  cors(res);
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

const STATIC_TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon", ".js": "text/javascript", ".css": "text/css" };

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      cors(res);
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }
    cors(res);
    res.writeHead(200, { "content-type": STATIC_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}

function amount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : String(value ?? "0.00");
}

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 10) return `${key.slice(0, 3)}...`;
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function fetchDeepSeekBalance(provider) {
  if (!provider.apiKey) return { ok: false, label: `${provider.name} 未配置`, error: "Missing API key" };
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    headers: { authorization: `Bearer ${provider.apiKey}`, accept: "application/json" }
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`DeepSeek returned HTTP ${response.status} with non-JSON response`);
  }
  if (!response.ok) throw new Error(body?.error?.message || body?.message || `DeepSeek returned HTTP ${response.status}`);
  const balances = Array.isArray(body.balance_infos) ? body.balance_infos : [];
  const preferred = balances.find((item) => item.currency === "CNY") || balances[0];
  if (!preferred) throw new Error("DeepSeek response did not include balance_infos");
  const currency = String(preferred.currency || "CNY");
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : `${currency} `;
  const total = amount(preferred.total_balance);
  return {
    ok: true,
    provider: provider.id,
    providerName: provider.name,
    type: provider.type,
    available: Boolean(body.is_available),
    currency,
    totalBalance: total,
    grantedBalance: amount(preferred.granted_balance),
    toppedUpBalance: amount(preferred.topped_up_balance),
    label: `${provider.name} ${symbol}${total}`,
    fetchedAt: new Date().toISOString()
  };
}

async function fetchMoonshotBalance(provider) {
  if (!provider.apiKey) return { ok: false, label: provider.name + " \u672a\u914d\u7f6e", error: "Missing API key", fetchedAt: new Date().toISOString() };
  const response = await fetch(MOONSHOT_ENDPOINT, {
    headers: { authorization: "Bearer " + provider.apiKey, accept: "application/json" }
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Moonshot returned HTTP " + response.status + " with non-JSON response");
  }
  if (!response.ok) throw new Error(body?.error?.message || body?.message || ("Moonshot returned HTTP " + response.status));
  const data = body.data || {};
  const raw = data.available_balance != null ? data.available_balance : data.voucher_balance;
  if (raw == null) throw new Error("Moonshot response did not include available_balance");
  const total = amount(raw);
  return {
    ok: true,
    provider: provider.id,
    providerName: provider.name,
    type: provider.type,
    available: true,
    currency: "CNY",
    totalBalance: total,
    label: provider.name + " \u00a5" + total,
    fetchedAt: new Date().toISOString()
  };
}

async function fetchDoubaoBalance(provider) {
  if (!provider.apiKey) return { ok: false, label: provider.name + " \u672a\u914d\u7f6e", error: "Missing API key", fetchedAt: new Date().toISOString() };
  return {
    ok: false,
    provider: provider.id,
    providerName: provider.name,
    type: provider.type,
    label: provider.name + " \u9700 AK/SK",
    error: "\u706b\u5c71\u65b9\u821f\uff08\u8c46\u5305\uff09\u4f59\u989d\u9700\u7528\u706b\u5c71\u5f15\u64ce AK/SK \u8c03\u7528\u8ba1\u8d39 OpenAPI\uff0c\u4ec5\u51ed API key \u65e0\u6cd5\u67e5\u8be2\u3002",
    fetchedAt: new Date().toISOString()
  };
}

async function fetchUnsupportedBalance(provider) {
  return {
    ok: false,
    provider: provider.id,
    providerName: provider.name,
    type: provider.type,
    label: `${provider.name} 已配置`,
    error: "Balance API adapter is not implemented yet.",
    fetchedAt: new Date().toISOString()
  };
}

async function getProviderBalance(provider) {
  const now = Date.now();
  const hit = cache.get(provider.id);
  if (hit && now - hit.cachedAt < CACHE_TTL_MS) return hit.body;
  const adapter = providerTypes[provider.type]?.balance || fetchUnsupportedBalance;
  try {
    const body = await adapter(provider);
    cache.set(provider.id, { cachedAt: Date.now(), body });
    return body;
  } catch (error) {
    const body = {
      ok: false,
      provider: provider.id,
      providerName: provider.name,
      type: provider.type,
      label: `${provider.name} 获取失败`,
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString()
    };
    cache.set(provider.id, { cachedAt: Date.now(), body });
    return body;
  }
}

function publicConfigFrom(config) {
  return {
    version: config.version,
    providerTypes: Object.fromEntries(Object.entries(providerTypes).map(([key, value]) => [key, value.title])),
    providers: config.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      showInCodex: provider.showInCodex,
      apiKey: provider.apiKey,
      hasApiKey: Boolean(provider.apiKey),
      maskedApiKey: maskKey(provider.apiKey),
      topupUrl: providerTypes[provider.type]?.topup || ""
    }))
  };
}

function publicConfig() {
  return publicConfigFrom(readConfig());
}

async function menuLabels() {
  const visible = readConfig().providers.filter((provider) => provider.showInCodex);
  const balances = await Promise.all(visible.map(getProviderBalance));
  return { ok: true, labels: balances.map((balance) => balance.label), balances };
}

function page() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Provider Balances</title><style>
*{box-sizing:border-box}body{margin:0;background:#0f1115;color:#eef0f4;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}main{max-width:860px;margin:0 auto;padding:32px 20px}h1{font-size:22px;margin:0 0 6px}p{color:#a8afbd;margin:0 0 20px}.panel{border:1px solid #2a303b;border-radius:10px;background:#161a22;padding:16px;margin:14px 0}.grid{display:grid;grid-template-columns:1fr 160px 1.3fr 96px 84px;gap:10px;align-items:center}input,select{width:100%;border:1px solid #343b49;border-radius:8px;background:#0f1115;color:#eef0f4;padding:10px}button{border:0;border-radius:8px;background:#10a37f;color:white;padding:10px 12px;font-weight:650;cursor:pointer}button.secondary{background:#29303b}.row{padding:10px 0;border-top:1px solid #252b35}.muted{color:#8e97a8}.key{font-family:ui-monospace,Consolas,monospace}label{display:flex;align-items:center;gap:8px}.top{display:flex;align-items:center;justify-content:space-between;gap:12px}
</style></head><body><main><div class="top"><div><h1>Provider Balances</h1><p>写入厂商名和 API key，选择是否在 Codex 头像菜单显示。</p></div><button class="secondary" onclick="refresh()">刷新</button></div><section class="panel"><div class="grid"><input id="name" placeholder="厂商名字，例如 DeepSeek"><select id="type"></select><input id="apiKey" placeholder="API key" type="password"><label><input id="show" type="checkbox" checked>显示</label><button onclick="addProvider()">添加</button></div></section><section class="panel" id="providers"></section></main><script>
let providerTypes={};async function api(path,options){const r=await fetch(path,{headers:{'content-type':'application/json'},...options});return r.json()}function esc(v){return String(v||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')}async function refresh(){const cfg=await api('/config');providerTypes=cfg.providerTypes;type.innerHTML=Object.entries(providerTypes).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');providers.innerHTML=cfg.providers.length?cfg.providers.map(p=>'<div class="row"><div class="grid"><input value="'+esc(p.name)+'" onchange="updateProvider(\\''+p.id+'\\',{name:this.value})"><select onchange="updateProvider(\\''+p.id+'\\',{type:this.value})">'+Object.entries(providerTypes).map(([k,v])=>'<option value="'+k+'" '+(p.type===k?'selected':'')+'>'+v+'</option>').join('')+'</select><input class="key" type="password" placeholder="'+(p.maskedApiKey||'API key')+'" onchange="updateProvider(\\''+p.id+'\\',{apiKey:this.value})"><label><input type="checkbox" '+(p.showInCodex?'checked':'')+' onchange="updateProvider(\\''+p.id+'\\',{showInCodex:this.checked})">显示</label><button class="secondary" onclick="removeProvider(\\''+p.id+'\\')">删除</button></div><div class="muted">key: '+(p.hasApiKey?p.maskedApiKey:'未填写')+'</div></div>').join(''):'<div class="muted">还没有配置厂商。</div>'}async function addProvider(){await api('/config/providers',{method:'POST',body:JSON.stringify({name:name.value,type:type.value,apiKey:apiKey.value,showInCodex:show.checked})});name.value='';apiKey.value='';show.checked=true;await refresh()}async function updateProvider(id,patch){await api('/config/providers/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify(patch)});await refresh()}async function removeProvider(id){await api('/config/providers/'+encodeURIComponent(id)+'/delete',{method:'POST'});await refresh()}refresh();
</script></body></html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      cors(res);
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      if (fs.existsSync(RENDERER_FILE)) return sendFile(res, RENDERER_FILE);
      return html(res, page());
    }
    if (url.pathname === "/assets/icon.png") return sendFile(res, path.join(ASSETS_DIR, "icon.png"));
    if (url.pathname === "/assets/icon.ico") return sendFile(res, path.join(ASSETS_DIR, "icon.ico"));
    if (url.pathname === "/health") return json(res, 200, { ok: true, service: "provider-balance-agent" });
    if (url.pathname === "/config") return json(res, 200, publicConfig());
    if (url.pathname === "/menu-labels") return json(res, 200, await menuLabels());
    if (url.pathname === "/balance") {
      const labels = await menuLabels();
      return json(res, 200, labels.balances[0] || { ok: false, label: "余额未配置" });
    }
    if (req.method === "POST" && url.pathname === "/config/providers") {
      const body = await readBody(req);
      const config = readConfig();
      config.providers.push({ id: safeId(body.id || body.name || body.type || `provider-${Date.now()}`), name: body.name, type: body.type, apiKey: body.apiKey, showInCodex: body.showInCodex });
      return json(res, 200, publicConfigFrom(writeConfig(config)));
    }
    const updateMatch = /^\/config\/providers\/([^/]+)$/.exec(url.pathname);
    if (req.method === "POST" && updateMatch) {
      const id = decodeURIComponent(updateMatch[1]);
      const body = await readBody(req);
      const config = readConfig();
      config.providers = config.providers.map((provider) => provider.id === id ? { ...provider, ...body, apiKey: body.apiKey === "" ? provider.apiKey : body.apiKey ?? provider.apiKey } : provider);
      return json(res, 200, publicConfigFrom(writeConfig(config)));
    }
    const deleteMatch = /^\/config\/providers\/([^/]+)\/delete$/.exec(url.pathname);
    if (req.method === "POST" && deleteMatch) {
      const id = decodeURIComponent(deleteMatch[1]);
      const config = readConfig();
      config.providers = config.providers.filter((provider) => provider.id !== id);
      return json(res, 200, publicConfigFrom(writeConfig(config)));
    }
    return json(res, 404, { ok: false, error: "not found" });
  } catch (error) {
    return json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  ensureConfig();
  console.log(`provider-balance-agent listening on http://127.0.0.1:${PORT}`);
});
