import fs from "node:fs";
const asarPath = process.argv[2];
const want = process.argv[3];
const needle = process.argv[4];
const before = Number(process.argv[5]||200), after = Number(process.argv[6]||300);
const fd = fs.openSync(asarPath,"r");
const header = Buffer.alloc(16); fs.readSync(fd,header,0,16,0);
const jsonLen = header.readUInt32LE(12);
const json = Buffer.alloc(jsonLen); fs.readSync(fd,json,0,jsonLen,16);
const base = 16 + jsonLen + ((4-(jsonLen%4))%4);
const tree = JSON.parse(json.toString("utf8"));
function find(node,prefix,want){for(const [n,e] of Object.entries(node.files||{})){const p=prefix?prefix+"/"+n:n; if(e.files){const r=find(e,p,want); if(r)return r;} else if(p===want) return {p,e};} return null;}
const h = find(tree,"",want);
if(!h){ console.log("not found", want); process.exit(1); }
const size=Number(h.e.size);
const buf=Buffer.alloc(size); fs.readSync(fd,buf,0,size,base+Number(h.e.offset));
const s=buf.toString("utf8");
let i=-1,n=0;
while((i=s.indexOf(needle,i+1))>=0 && n<25){ n++; console.log("@"+i+": "+JSON.stringify(s.slice(Math.max(0,i-before), i+after))); }
console.log("total hits:", n);
fs.closeSync(fd);

