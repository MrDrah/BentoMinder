// usage: node gen.js url hrefRegex(with one capture group for url) [base]
const [u,rx,base='']=process.argv.slice(2);
(async()=>{const r=await fetch(u,{headers:{'user-agent':'Mozilla/5.0'}});const s=await r.text();
const re=new RegExp('<a [^>]*href="('+rx+')"[^>]*>([\s\S]*?)</a>','g');let m,seen=new Set();
while((m=re.exec(s))){if(seen.has(m[1]))continue;seen.add(m[1]);const t=m[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,70);if(t)console.log(base+decodeURI(m[1]).slice(0,90),'|',t)}})();
