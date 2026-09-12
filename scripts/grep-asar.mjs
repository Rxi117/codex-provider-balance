import fs from "node:fs";
const asarPath = process.argv[2];
const needle = process.argv[3];
const fd = fs.openSync(asarPath,"r");
const header = Buffer.alloc(16); fs.readSync(fd,header,0,16,0);
const jsonLen = header.readUInt32LE(12);
const json = Buffer.alloc(jsonLen); fs.readSync(fd,json,0,jsonLen,16);
const base = 16 + jsonLen + ((4-(jsonLen%4))%4);
const tree = JSON.parse(json.toString("utf8"));
function walk(node,prefix,out){for(const [n,e] of Object.entries(node.files||{})){const p=prefix?prefix+"/"+n:n; if(e.files)walk(e,p,out); else if(!e.unpacked)out.push({p,e});} return out;}
const all = walk(tree,"",[]);
for(const {p,e} of all){
  if(!/\.(js|mjs|cjs|json|html)$/.test(p)) continue;
  const size=Number(e.size); if(size>20*1024*1024) continue;
  const buf=Buffer.alloc(size); fs.readSync(fd,buf,0,size,base+Number(e.offset));
  const s=buf.toString("utf8");
  let i=-1, n=0;
  while((i=s.indexOf(needle,i+1))>=0 && n<6){
    n++;
    console.log("--- "+p+" @"+i+" ---");
    console.log(JSON.stringify(s.slice(Math.max(0,i-140), i+160)));
  }
}
fs.closeSync(fd);

