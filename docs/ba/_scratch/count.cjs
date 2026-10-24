const fs=require('fs');const s=fs.readFileSync(process.argv[2],'utf8').split('\n');
let ep=null,st=null;const E={};let dup=[];const seen=new Set();
for(const l of s){const h=l.match(/^### US-((E\d+|NF)-\d+)/);if(h){st=h[1];ep=h[2];E[ep]=E[ep]||{stories:0,acs:0,v1:0};E[ep].stories++;continue;}
const m=l.match(/^Scenario(?: Outline)?: AC(\d+)/);if(m&&st){E[ep].acs++;if(/\(v1\)/.test(l))E[ep].v1++;const k=st+'/'+m[1];if(seen.has(k))dup.push(k);seen.add(k);}}
let ts=0,ta=0,tv=0;for(const e in E){console.log(e,E[e].stories,E[e].acs,'v1:',E[e].v1);ts+=E[e].stories;ta+=E[e].acs;tv+=E[e].v1}
console.log('TOTAL',ts,ta,'v1',tv,'dups',dup.join(','));
