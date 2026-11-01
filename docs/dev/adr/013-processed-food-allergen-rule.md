`# ADR-013: Processed-food allergen rule (F1'', warning, F4 retired)
`
`Status: **accepted** · 2026-11-01 · Owner: Developer · Amends ADR-008 §2, §5, §6
`
`Rules source: PLAN §7 (2026-11-01 rows), data contract §3.7a and §4 `ranking-hard-filter` / `ranking-processed-warning`, dictionary §11.5, US-E6-02/AC9-AC16.
`
`## Decisions
`1. **F1''.** A recipe is excluded when an id in `allergenIds` is in the child's `knownAllergenIds`, or when an ingredient carries a dictionary `allergenGroupIds` group and the child has any member of it. `mayContainAllergenIds` is no longer read. The exclusion reason is still \`{kind:'allergen', allergenIds}\` and holds the child's own registered ids (never a group id). F2/F3 unchanged.
`2. **F4 and the "complete first" tier are gone.** Order: score desc, minutes asc, id asc. \`allergen-incomplete\` is never produced. \`RankedRecipe.complete\`, \`checkLabel\` and the \`allergen-incomplete\` reason type stay in the types only as \`@deprecated\` so \`src/ui\` compiles until slice 2 removes its readers; slice 2 should delete them.
`3. **Warning data.** \`RankedRecipe.processedWarning: null | {allergenIds (child's full list, registered order), processedIngredientIds (distinct, recipe order, dictionary info = varies)}\`. Trigger is the dictionary, not the recipe's \`allergenInfo\`. Null when the child has no registered allergen or the recipe has no processed ingredient.
`4. **Dictionary.** \`build-dictionary.mjs\` parses §11.5 by exact headers (\`group|members|basis\`, \`ingredient|groups\`) into \`allergenGroups[{id, memberAllergenIds, basis}]\` and \`allergenGroupIds\` per ingredient; an unknown ingredient in the second table fails the build. Validator rules \`dictionary-group-member-unknown\`, \`dictionary-ingredient-group-unknown\`, \`dictionary-group-ingredient-not-processed\` sit in \`dictionaryIssues\`. Group ids stay out of \`allergenIdSchema\`, so recipe/profile fields reject them (\`allergen-unknown\`).
`5. **Planning.** \`isRecipeAllowed\` is fed from \`result.excluded\`, so a planned date refuses what F1'' excludes with no code change.
`
`## Revisit when
`- A second group is added (the engine already handles any group) or the scheme gains a real "fish" allergen: drop the group.
`- Processed-ingredient warning granularity (open point P1) changes.
