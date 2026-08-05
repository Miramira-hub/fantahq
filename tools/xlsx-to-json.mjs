import fs from "fs";
const dir = process.argv[2] || "q27";
const ss = fs.existsSync(`${dir}/xl/sharedStrings.xml`) ? fs.readFileSync(`${dir}/xl/sharedStrings.xml`, "utf8") : "";
const shared = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m =>
  [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")
     .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'"));

const col = ref => { let s=0; for (const ch of ref) { const c=ch.charCodeAt(0); if(c>=65&&c<=90) s=s*26+(c-64); else break; } return s-1; };

// scegli il foglio con più righe
let best="", bestN=-1;
for (const f of fs.readdirSync(`${dir}/xl/worksheets`)) {
  const xml = fs.readFileSync(`${dir}/xl/worksheets/${f}`, "utf8");
  const n = (xml.match(/<row\b/g)||[]).length;
  if (n > bestN) { bestN = n; best = xml; }
}
const rows = [...best.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(r => {
  const arr = [];
  for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
    const i = col(c[1]);
    const isS = /t="s"/.test(c[2]);
    const isInline = /t="inlineStr"/.test(c[2]);
    const v = /<v>([\s\S]*?)<\/v>/.exec(c[3]);
    const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3]);
    arr[i] = isS ? (shared[+v[1]] ?? "") : isInline ? (t ? t[1] : "") : (v ? v[1] : "");
  }
  return arr;
});
console.log(JSON.stringify(rows.filter(r => r.some(x => x !== undefined && x !== ""))));
