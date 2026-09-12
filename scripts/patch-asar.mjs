import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const MARKER = "provider-balance-menu-patch-v2";
const PORT = process.env.DEEPSEEK_BALANCE_PORT || "17561";
const asarPath = process.argv[2];
if (!asarPath) throw new Error("usage: node patch-asar.mjs <app.asar>");

function readAsar(file) {
  const fd = fs.openSync(file, "r");
  const header = Buffer.alloc(16);
  fs.readSync(fd, header, 0, 16, 0);
  const jsonLen = header.readUInt32LE(12);
  const json = Buffer.alloc(jsonLen);
  fs.readSync(fd, json, 0, jsonLen, 16);
  const padded = jsonLen + ((4 - (jsonLen % 4)) % 4);
  const dataStart = 16 + padded;
  return { header, tree: JSON.parse(json.toString("utf8")), jsonLen, dataStart, fd, file };
}

function walk(node, prefix = "", out = []) {
  for (const [name, entry] of Object.entries(node.files || {})) {
    const p = prefix ? prefix + "/" + name : name;
    if (entry.files) walk(entry, p, out);
    else if (entry.unpacked) continue; // data lives in app.asar.unpacked; leave entry untouched
    else out.push({ path: p, entry });
  }
  return out;
}

function readEntry(fd, baseOffset, entry) {
  const size = Number(entry.size || 0);
  const buf = Buffer.alloc(size);
  if (size > 0) fs.readSync(fd, buf, 0, size, baseOffset + Number(entry.offset || 0));
  return buf;
}

const injection = fs
  .readFileSync(path.join(here, "inject-lgt.js"), "utf8")
  .replace(/__PORT__/g, PORT)
  .replace(/__MARKER__/g, MARKER);

function patchedSource(source) {
  if (source.includes(MARKER)) return source;
  const start = source.indexOf("function lGt(e){");
  const end = source.indexOf("}var uGt,", start);
  if (start < 0 || end < 0) throw new Error("Could not locate profile pet menu function anchor");
  // end points at the '}' that closes the original function; the injection already
  // supplies its own closing brace, so drop that one to keep the braces balanced.
  return source.slice(0, start) + injection + source.slice(end + 1);
}

function sha256(b) {
  return crypto.createHash("sha256").update(b).digest("hex");
}

function buildIntegrity(entry, buffer) {
  if (!entry.integrity) return;
  const blockSize = Number(entry.integrity.blockSize) || 4194304;
  const blocks = [];
  for (let o = 0; o < buffer.length; o += blockSize) blocks.push(sha256(buffer.subarray(o, o + blockSize)));
  entry.integrity = { algorithm: entry.integrity.algorithm || "SHA256", hash: sha256(buffer), blockSize, blocks };
}

const asar = readAsar(asarPath);
console.log("jsonLen", asar.jsonLen, "dataStart", asar.dataStart);
const entries = walk(asar.tree);
const files = [];
let patched = false;
try {
  for (const item of entries) {
    const buf = readEntry(asar.fd, asar.dataStart, item.entry);
    if (/app-primary-.*\.js$/.test(item.path)) {
      const before = buf.toString("utf8");
      const after = patchedSource(before);
      if (after !== before) patched = true;
      fs.writeFileSync(path.join(here, "patched-primary.mjs"), after);
      files.push({ entry: item.entry, buffer: Buffer.from(after, "utf8") });
    } else if (/\.vite\/build\/bootstrap-.*\.js$/.test(item.path)) {
      const raw = buf.toString("utf8");
      const renamed = raw.replace("a.app.setName(t.Ao(Z))", `a.app.setName("ChatGPT\u5206\u8eab")`);
      if (renamed !== raw) patched = true;
      files.push({ entry: item.entry, buffer: Buffer.from(renamed, "utf8") });
    } else if (/webview\/(index|detached-window)\.html$/.test(item.path)) {
      const before = buf.toString("utf8");
      const after = before
        .replace(
          /connect-src &#39;self&#39;/g,
          `connect-src &#39;self&#39; http://127.0.0.1:${PORT}`
        )
        .replace(/<title>ChatGPT<\/title>/, "<title>ChatGPT\u5206\u8eab<\/title>");
      if (after !== before) patched = true;
      files.push({ entry: item.entry, buffer: Buffer.from(after, "utf8") });
    } else {
      files.push({ entry: item.entry, buffer: buf });
    }
  }
} finally {
  fs.closeSync(asar.fd);
}

if (!patched) {
  console.log("already patched");
  process.exit(0);
}

let offset = 0;
const chunks = [];
for (const f of files) {
  f.entry.offset = String(offset);
  f.entry.size = f.buffer.length;
  buildIntegrity(f.entry, f.buffer);
  chunks.push(f.buffer);
  offset += f.buffer.length;
}

const json = Buffer.from(JSON.stringify(asar.tree), "utf8");
const padded = json.length + ((4 - (json.length % 4)) % 4);
const pad = padded - json.length;
const header = Buffer.alloc(16);
header.writeUInt32LE(4, 0);
header.writeUInt32LE(padded + 8, 4);
header.writeUInt32LE(padded + 4, 8);
header.writeUInt32LE(json.length, 12);

const tmp = asarPath + ".new";
fs.writeFileSync(tmp, Buffer.concat([header, json, Buffer.alloc(pad), ...chunks]));
console.log("wrote", tmp, "size", fs.statSync(tmp).size, "pad", pad);
