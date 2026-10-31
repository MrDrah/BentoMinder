import { readFileSync } from 'node:fs';
import { parseModelReply } from '../../../src/domain/menu/extraction.ts';
const t = readFileSync(process.argv[2],'utf8');
console.log(JSON.stringify(parseModelReply(t,{targetMonth:'2026-11',sha256:'a'.repeat(64),byteSize:1,model:'m',promptVersion:'p',at:new Date().toISOString()})).slice(0,1500));
