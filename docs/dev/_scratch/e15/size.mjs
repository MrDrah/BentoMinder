import { build } from '../../../../node_modules/esbuild/lib/main.js';
import zlib from 'node:zlib';
for (const m of ['firebase/firestore/lite','firebase/firestore']) {
  const names = m.endsWith('lite') ? 'getFirestore,doc,setDoc,getDoc,getDocs,collection,query,where,writeBatch,runTransaction' : 'initializeFirestore,persistentLocalCache,doc,setDoc,getDoc,getDocs,collection,query,where,onSnapshot,writeBatch,runTransaction';
  const r = await build({ stdin:{contents:`import {${names}} from '${m}'; globalThis.x=[${names}];`,resolveDir:process.cwd()}, bundle:true, minify:true, format:'esm', platform:'browser', write:false, define:{'process.env.NODE_ENV':'"production"'} });
  const b = r.outputFiles[0].contents; console.log(m, b.length, zlib.gzipSync(b).length);
}
