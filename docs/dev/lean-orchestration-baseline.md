# Lean orchestration: baseline and measurements

Recorded 2026-10-25 at checkpoint tag `checkpoint/pre-lean-orchestration-2026-10-25` (main 456f7df). Source: `docs/evidence/usage.jsonl` (63 hourly records, snapshots of Claude Code session logs, 2026-10-24 → 25) and `docs/evidence/events.jsonl`. Nothing here is a saving; it is the "before".

## Baseline (all history to the pause)
| Agent | Requests | Output tok | Cache-read tok | Avg context / request | Models |
|-------|---------:|-----------:|---------------:|----------------------:|--------|
| developer | 657 | 984k | 194.6M | ~306k | 361 req Opus (M1 build), 296 req Sonnet |
| ba | 623 | 758k | 77.0M | ~127k | Opus |
| main (Orchestrator) | 297 | 251k | 86.8M | ~303k | Opus |
| qa | 249 | 497k | 42.4M | ~175k | 123 Opus, 126 Sonnet |
| designer | 194 | 413k | 29.4M | ~156k | Opus |
| verifier | 52 | 30k | 2.4M | ~50k | Opus |
| general-purpose | 37 | 40k | 3.4M | ~93k | Opus |
| **Total** | **2109** | **2.97M** | **436M** | | **Opus 80 % of requests, 81 % of output tokens; Sonnet 20 % / 19 %** |

Avg context = (cache-read + cache-write + input) / requests. Request share: developer 31 %, BA 30 %, main 14 %, QA 12 %, designer 9 %, verifier 2.5 %. These differ from the PO's usage report (76 % weekly, 83 % Opus, developer 46 %, BA 23 %), which measures other windows; they agree on direction (Opus-heavy, developer and BA dominant, large contexts).

Events: 25 task dispatches, 14 defects, 6 technical corrections, 4 interruptions (3 by usage limit), 7 verifications. Tests at the pause: M1 376 unit + 24 e2e (domain coverage 99.2 %), QA suite 446 passed.

## Measure for the next feature (compare against the above)
Record per feature or slice, from the usage log plus events:
1. **Model mix**: Opus vs Sonnet share of requests and output tokens (target: Opus 0 without PO approval).
2. **Agent invocations**: dispatches per agent (`task-start` events) and BA dispatches that were not initial requirements, an open decision or acceptance (target: 0).
3. **Context size**: avg and max context per request per agent; requests above 150k.
4. **Tokens**: input, output, cache-read and cache-write per feature; weekly-allowance % only if the usage screen is read at start and end (otherwise `null`).
5. **Quality**: tests added/passing, gate result, defects found by QA by severity, fix cycles used (limit 2), escalations.
6. **Interruptions** by usage limit.

Command (per agent and model, from a start date):
```bash
node -e "const r=require('fs').readFileSync('docs/evidence/usage.jsonl','utf8').trim().split('\n').map(JSON.parse).filter(x=>x.at>=process.argv[1]);const a={};for(const x of r){const k=x.agent+'|'+x.model;a[k]=a[k]||{req:0,out:0,ctx:0};a[k].req+=x.requests;a[k].out+=x.outputTokens;a[k].ctx+=x.cacheReadTokens+x.cacheWriteTokens+x.inputTokens}for(const[k,v]of Object.entries(a))console.log(k,v.req,v.out,Math.round(v.ctx/v.req))" 2026-10-26
```
