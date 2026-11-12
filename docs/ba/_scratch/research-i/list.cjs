const c=require('../../../../data/_research/candidates-2.json').candidates;
const fs=require('fs');
const urls=new Set();for(const f of 'abcdefgh'.split(''))for(const r of require('../../../../data/_research/batch-'+f+'.json'))for(const s of r.sources||[])urls.add(s.url);
const un=c.filter(k=>!urls.has(k.sourceUrl));
fs.writeFileSync('list.tsv',un.map(k=>[k.candidateId,encodeURI(k.sourceUrl.replace(/ /g,' ')).replace(/%25/g,'%'),k.nameJa].join('\t')).join('\n'));
