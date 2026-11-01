const urls=process.argv.slice(2);
(async()=>{for(const u of urls){const s=await (await fetch(u,{headers:{'user-agent':'Mozilla/5.0'}})).text();
const t=s.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
const m=[...t.matchAll(/.{0,25}(\d+) ?(分|時間).{0,10}/g)].slice(0,4).map(x=>x[0]);
console.log(decodeURI(u).slice(-30),'=>',m.join(' // '));await new Promise(r=>setTimeout(r,2500))}})();
