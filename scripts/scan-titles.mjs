
import fs from "node:fs";
const asarPath = process.argv[2];
const needle = process.argv[3] || "<title>";
const fd = fs.openSync(asarPath,"r");
const header = Buffer.alloc(16); fs.readSync(fd,header,0,16,0);
const jsonLen = header.readUInt32LE(12);
const json = Buffer.alloc(jsonLen); fs.readSync(fd,json,0,jsonLen,16);
const base = 16 + jsonLen + ((4-(jsonLen%4))%4);
const tree = JSON.parse(json.toString("utf8"));
function walk(node,prefix,out){for(const [n,e] of Object.entries(node.files||{})){const p=prefix?prefix+"/"+n:n; if(e.files)walk(e,p,out); else if(!e.unpacked)out.push(p);} return out;}
const all = walk(tree,"",[]);
let hits=0;
for(const p of all){
  if(!/\.(html|json|js)$/.test(p)) continue;
  // need entry
}
function find(node,prefix,want){for(const [n,e] of Object.entries(node.files||{})){const p=prefix?prefix+"/"+n:n; if(e.files){const r=find(e,p,want); if(r)return r;} else if(p===want) return {p,e};} return null;}
for(const p of all){
  if(!/\.(html)$/.test(p)) continue;
  const h = find(tree,"",p);
  const size=Number(h.e.size); if(size>200000) continue;
  const buf=Buffer.alloc(size); fs.readSync(fd,buf,0,size,base+Number(h.e.offset));
  const s=buf.toString("utf8");
  const i=s.toLowerCase().indexOf("<title>");
  if(i>=0){ hits++; console.log(p+"  ::  "+JSON.stringify(s.slice(i, s.indexOf("</title>",i)+8))); }
}
console.log("html files with title:", hits);
fs.closeSync(fd);

