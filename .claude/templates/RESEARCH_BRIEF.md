# Research brief — {{PROJECT_NAME}}

Owner: BA · {{DATE}} · Process: `content-research` skill · Format: `docs/ba/data-contract.md`

## Golden rules
1. **Real items only.** Research only the candidates you're assigned in `data/_research/candidates.json`. Never invent an item, a value or a fact.
2. **Every fact has a fetched source.** Record every URL you used in `sources`.
3. **Own words.** Descriptions are written fresh. No run of 8 or more words copied from a source except names and titles; real quotes go in quotation marks with attribution. `validate.mjs overlap` blocks the merge otherwise.
4. **Check the page, not just HTTP 200.** Confirm the title matches the candidate. Fetch slowly and one at a time (~3 s apart); retry after a pause on throttled or empty responses.
5. **Skip, don't guess.** If a candidate can't be researched properly, skip it and take the next one from your reserve range.
6. **Never rename a candidate** to a shorter or cleaner name. Another candidate may share the base name.
7. **Only known ids.** Use ids from the dictionary; if nothing fits, use the closest generic one with a note, or propose a new id in your report.
8. **Save after every record.** An interruption must not lose finished work.

## Approved sources
| Source | Use for | Notes / quirks |
|--------|---------|----------------|
| | | |

## Record format
See one record in `data/_research/batch-a.json` and the field table in the data contract.

## Self-check before reporting
```bash
node scripts/validate-data.mjs data/_research/<your-file>.json
```
