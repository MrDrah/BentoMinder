const q=process.argv[2],pages=+process.argv[3]||1;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{for(let p=1;p<=pages;p++){
const r=await fetch(`https://delishkitchen.tv/search?q=${encodeURIComponent(q)}&page=${p}`,{headers:{'user-agent':'Mozilla/5.0'}});
const s=await r.text();const re=/<a href="\/recipes\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;let m;const seen=new Set();
while((m=re.exec(s))){if(seen.has(m[1]))continue;seen.add(m[1]);console.log('D',m[1],m[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,110))}
await sleep(3000)}})();
