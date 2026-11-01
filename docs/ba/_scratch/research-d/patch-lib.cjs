const fs=require('fs');let s=fs.readFileSync('lib.cjs','utf8');
const a=s.indexOf(' const FORB=');const b=s.indexOf('return rec;',a)+'return rec;'.length;
s=s.slice(0,a)+` const FORB={vegetarian:['meat','pork','beef','chicken','fish-seafood','gelatin'],pescatarian:['meat','pork','beef','chicken','gelatin'],'no-pork':['pork','meat','gelatin'],'no-beef':['beef','meat'],'no-seafood':['fish-seafood']};
 rec.dietOk=rec.dietDataComplete?Object.keys(FORB).filter(d=>!FORB[d].some(t=>rec.animalOrigin.includes(t))):[];
 return rec;`+s.slice(b);
s=s.replace('module.exports={',`function save(recs){const f=ROOT+'/data/_research/batch-d.json';let a=[];try{a=JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){}for(const r of recs){const i=a.findIndex(x=>x.id===r.id);if(i>=0)a[i]=r;else a.push(r)}fs.writeFileSync(f,JSON.stringify(a,null,2)+'\n');}
module.exports={save,`);
fs.writeFileSync('lib.cjs',s);
