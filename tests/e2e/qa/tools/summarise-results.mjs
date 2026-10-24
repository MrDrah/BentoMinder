import { readFileSync } from 'node:fs';
const j = JSON.parse(readFileSync('tests/reports/qa-m1-results.json', 'utf8'));
const per = {};
const walk = (suite) => {
  for (const sp of suite.specs ?? []) {
    for (const t of sp.tests) {
      const file = sp.file.split('\\').join('/').split('/').pop();
      const key = file;
      per[key] ??= { passed: 0, skipped: 0, failed: 0, projects: new Set() };
      const st = t.status === 'expected' ? 'passed' : t.status === 'skipped' ? 'skipped' : 'failed';
      per[key][st]++;
      per[key].projects.add(t.projectName);
    }
  }
  for (const s of suite.suites ?? []) walk(s);
};
for (const s of j.suites) walk(s);
let P = 0, S = 0, F = 0;
for (const [k, v] of Object.entries(per)) {
  console.log(k.padEnd(28), 'passed', String(v.passed).padStart(4), 'skipped', String(v.skipped).padStart(3), 'failed', v.failed, [...v.projects].join(','));
  P += v.passed; S += v.skipped; F += v.failed;
}
console.log('TOTAL', P, S, F, 'duration(s)', Math.round(j.stats.duration / 1000));
const titles = new Set();
const w2 = (suite) => { for (const sp of suite.specs ?? []) titles.add(sp.title); for (const s of suite.suites ?? []) w2(s); };
for (const s of j.suites) w2(s);
console.log('distinct test titles', titles.size);
