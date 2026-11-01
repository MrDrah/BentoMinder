const q=process.argv[2];
(async()=>{const r=await fetch('https://www.lettuceclub.net/recipe/search/result/?keyword='+encodeURIComponent(q),{headers:{'user-agent':'Mozilla/5.0'}});const s=await r.text();
const re=/href="(\/recipe\/dish\/\d+\/?)"[^>]*>([\s\S]*?)<\/a>/g;let m,seen=new Set();
while((m=re.exec(s))){if(seen.has(m[1]))continue;seen.add(m[1]);console.log('https://www.lettuceclub.net'+m[1],'|',m[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,70))}})();
