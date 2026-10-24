---
name: content-research
description: Grow a library of real, sourced content (recipes, places, products, facts) with parallel research agents in fixed-size batches, then merge, check for copied wording, verify a sample against sources, and ship. Use whenever the app ships content that must be authentic rather than invented.
---

# Content research

## 1. Candidates first
One agent builds `data/_research/candidates.json`: ranked, de-duplicated against existing records, each with its source URL **verified** (correct title, not just HTTP 200). Keep about 50% more candidates than you need, as reserves.

## 2. Research brief (`docs/ba/research-brief.md`)
Golden rules every research agent follows:
1. Research only assigned candidates. Never invent an item, an amount or a fact.
2. Every fact has a fetched, cited source. Record every URL.
3. **Own words.** Descriptions are written fresh. No run of ~8+ words copied from a source, except names and titles. Direct quotes go in quotation marks with attribution.
4. Check the page title, not just the status code. Fetch slowly, one at a time; back off on throttling.
5. Skip, don't guess. Use the next reserve.
6. **Never rename a candidate** to a shorter or "cleaner" name; another candidate may share the base name.
7. Use only ids from the dictionary; propose new ones in the report instead of inventing them in records.

## 3. Dispatch (one agent per 50 items, in parallel)
Prompt template:

> You are a research agent for <app> in <repo path>. Read docs/ba/research-brief.md and follow it exactly; look at one record in data/_research/batch-a.json for the format; use <dictionary> for ids. Your assignment: candidates ranked X–Y in data/_research/candidates.json. Reserves: R1–R2 only (other agents own other ranges). Write exactly N records to data/_research/batch-<letter>.json, **saving after every record**. Edit no other project file; run no git or npm install. Keep any helper files in your own scratch subfolder `<scratch>/research-<letter>/`. Self-check: `node scripts/validate-data.mjs data/_research/batch-<letter>.json`. Final reply: count, skips and reserves used, proposed new ids (id, name, category, synonyms), source disagreements, validator result.

## 4. Integrate (Orchestrator)
0. Before dispatching each agent: `validate.mjs task-start research-<letter> --allow "data/_research/batch-<letter>.json"`.
1. After it reports: `validate.mjs diff-guard --task research-<letter>` (catches changes even if the agent committed them).
2. Ids and names unique **across all batches** (the project validator must check this).
3. Add proposed dictionary entries; reject vague synonyms; one entry when two agents propose the same thing.
4. Merge (`npm run merge:research` or equivalent). The merged file is `generated`.
5. `validate.mjs overlap --fetch`: fetch every cited page once into a cache (`overlap.cacheDir`), then scan. Every record ends up **PASS**, **FAIL** or **UNVERIFIED** (no source URL, or its pages couldn't be fetched); UNVERIFIED blocks the release just like FAIL, so fix dead URLs or re-research the record. Dispatch one editor agent per batch for the FAIL sentences: REWRITE carried-over phrasing with the same facts. A run that is only a name, title or credit line is recorded as an individual exception (`overlap --accept --id … --field … --run "…" --reason "…" --reviewer …`); there is no bulk accept.
6. `verifier` agent spot-checks a stratified 10% against sources.
7. Run the full gate, then release.

## 5. Record the run in `CATCH-UP.md`
Which ranks were used, which reserves remain, what failed and was re-dispatched.
