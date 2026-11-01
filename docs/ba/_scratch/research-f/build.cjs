const fs = require('fs');
const path = require('path');
const { finish, root } = require('./lib.cjs');
const dir = path.join(__dirname, 'rec');
const order = fs.readdirSync(dir).filter((f) => f.endsWith('.cjs')).sort();
const out = order.map((f) => finish(require(path.join(dir, f))));
fs.writeFileSync(path.join(root, 'data/_research/batch-f.json'), JSON.stringify(out, null, 2) + '\n');
console.log('wrote', out.length, 'records');
