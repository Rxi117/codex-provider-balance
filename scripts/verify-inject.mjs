import fs from "node:fs";
const file = process.argv[2];
const fd = fs.openSync(file,"r");
const header = Buffer.alloc(16);
fs.readSync(fd,header,0,16,0);
const jsonLen = header.readUInt32LE(12);
const json = Buffer.alloc(jsonLen);
fs.readSync(fd,json,0,jsonLen,16);
const tree = JSON.parse(json.toString("utf8"));
const base = 16 + jsonLen + ((4 - (jsonLen % 4)) % 4);
function find(node,prefix){
  for(const [name,e] of Object.entries(node.files||{})){
    const p = prefix?prefix+"/"+name:name;
    if(e.files){ const r=find(e,p); if(r) return r; }
    else if(/app-primary-.*\.js$/.test(p)){ return {p,e}; }
  }
  return null;
}
const hit = find(tree,"");
console.log("file:",hit.p);
const buf = Buffer.alloc(Number(hit.e.size));
fs.readSync(fd,buf,0,Number(hit.e.size), base+Number(hit.e.offset));
fs.closeSync(fd);
const s = buf.toString("utf8");
console.log("has marker:", s.includes("provider-balance-menu-patch-v2"));
console.log("has label span:", s.includes("data-provider-balance-label"));
const i = s.indexOf("data-provider-balance-label");
if(i>=0) console.log(s.slice(Math.max(0,i-260), i+160));

// --- rename check: the window title comes from app.setName(...) in bootstrap ---
function findBoot(node, prefix) {
  for (const [name, e] of Object.entries(node.files || {})) {
    const p = prefix ? prefix + "/" + name : name;
    if (e.files) { const r = findBoot(e, p); if (r) return r; }
    else if (/\.vite\/build\/bootstrap-.*\.js$/.test(p)) return { p, e };
  }
  return null;
}
const boot = findBoot(tree, "");
if (boot) {
  const fd2 = fs.openSync(file, "r");
  const b = Buffer.alloc(Number(boot.e.size));
  fs.readSync(fd2, b, 0, Number(boot.e.size), base + Number(boot.e.offset));
  fs.closeSync(fd2);
  const t = b.toString("utf8");
  console.log("bootstrap:", boot.p);
  console.log("app name renamed:", t.includes('setName("ChatGPT\u5206\u8eab")'));
  const j = t.indexOf("setName(");
  if (j >= 0) console.log(t.slice(Math.max(0, j - 60), j + 90));
} else {
  console.log("bootstrap: NOT FOUND");
}
