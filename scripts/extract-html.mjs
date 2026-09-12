import fs from "node:fs";

const asarPath = process.argv[2] || "C:\\CodexDeepSeekPatched\\app\\resources\\app.asar";
const want = process.argv[3] || "webview/index.html";
const fd = fs.openSync(asarPath, "r");
const header = Buffer.alloc(16);
fs.readSync(fd, header, 0, 16, 0);
const jsonLen = header.readUInt32LE(12);
const json = Buffer.alloc(jsonLen);
fs.readSync(fd, json, 0, jsonLen, 16);
const base = 16 + jsonLen + ((4 - (jsonLen % 4)) % 4);
const tree = JSON.parse(json.toString("utf8"));

function find(node, prefix) {
  for (const [name, e] of Object.entries(node.files || {})) {
    const p = prefix ? prefix + "/" + name : name;
    if (e.files) {
      const r = find(e, p);
      if (r) return r;
    } else if (p === want) return { p, e };
  }
  return null;
}
const hit = find(tree, "");
console.log("found:", hit && hit.p, hit && "size=" + hit.e.size);
if (!hit) process.exit(1);
const buf = Buffer.alloc(Number(hit.e.size));
fs.readSync(fd, buf, 0, Number(hit.e.size), base + Number(hit.e.offset));
fs.closeSync(fd);
const s = buf.toString("utf8");
console.log(s.slice(0, 2500));
