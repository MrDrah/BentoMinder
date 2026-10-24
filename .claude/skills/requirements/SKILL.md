---
name: requirements
description: Turn a product idea or request into numbered business rules, user stories with IDs and Given-When-Then acceptance criteria, a data contract, and open questions with proposed defaults. Use at kick-off, when scope changes, or before any feature is built.
---

# Requirements

## 1. Business rules first
Write the rules everything else depends on as a numbered table in `docs/PLAN.md` §3: `BR-01`, `BR-02`… One rule per row, testable, with numbers instead of adjectives ("2–10 items", not "a few"). Only the Orchestrator changes them; every change is a dated row in §7.

Good rule: **BR-05** *A result is shown only if every required item is in the user's set.*
Bad rule: *Results should be relevant.*

## 2. Scope in three columns
In `docs/PLAN.md` §1 keep **MVP / v1 / Later**. When something is pushed out of the MVP, write down the seam the MVP must leave for it (see §6).

## 3. User stories (`docs/ba/user-stories.md`, template `templates/USER_STORIES.md`)
- One epic per area (`E1 Input`, `E2 Errors`, … `E7 Accounts` in v1).
- ID `US-E<epic>-<nn>`, MoSCoW priority, size (S/M/L).
- *As a … I want … so that …* then ACs in Gherkin. Number each scenario `AC1`, `AC2`… within its story; its full ID is `US-E1-01/AC1`. Never renumber an AC once tests name it (retire it and add a new number instead).

```gherkin
Scenario: AC1 Subset match returns a smaller recipe
  Given the user has entered "White Rum", "Lime Juice", "Simple Syrup", "Mint", "Soda Water"
  When the user submits the search
  Then "Daiquiri" appears in the results
  And no result requires an ingredient outside the five entered
```

- Always cover: happy path, every boundary (min, max, max+1), invalid and hostile input, empty state, fallback state, and what happens on reload/back.
- Non-functional stories get IDs too (`US-NF-01` performance, `US-NF-02` accessibility…) so they are traced like the rest.
- QA names tests after story IDs. `validate.mjs trace` fails the gate if a story has no test.
- Milestone evidence counts **acceptance criteria**: an AC is verified only when an executed test names its full ID (`it('US-E1-01/AC2 rejects an empty list', …)`). A test that names only the story verifies no AC. Stories without AC numbers are counted as one criterion each, and the package says so.

## 4. Data contract (`docs/ba/data-contract.md`, template `templates/DATA_CONTRACT.md`)
- For every field: type, required, allowed values, validation rule, example.
- State cross-field rules explicitly (ids resolve, lengths, era agrees with year…).
- Define what "valid" or "authentic" means for this domain in one testable sentence.
- The developer turns every rule into the project's validator; the BA reviews the validator's rule list.

## 5. Domain dictionary (when users type free text)
- Canonical id (kebab-case, stable, never reused), display name, category, synonyms (each maps to **one** id).
- Ambiguity groups for words with several meanings; the UI must ask, never guess.
- Typos get "Did you mean…", never an automatic correction.

## 6. Open questions
Each brief ends with a table: `# | Question | Proposed default`. The product owner confirms or overrides; the Orchestrator logs the answer. Never block on a question that has a safe default.

## 7. Seams for v1 (decide now, build later)
Even when the MVP has no accounts, database or external API, record in `docs/PLAN.md`:
- **Identity:** will data ever belong to a user? If yes, every record gets an owner field in v1; MVP data is "anonymous/local".
- **Persistence:** what is in the browser today (URL, localStorage) that will move server-side?
- **Integrations:** which external APIs might replace static data, and the contract they'd need to meet.
- **Privacy:** what personal data v1 would collect, and the lawful basis (see `templates/v1/PRIVACY.md`).
