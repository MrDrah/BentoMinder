Scratch (developer, kick-off architecture)
- Done: ADR 001, ADR 003. Next: ADR 004, architecture.md.
- Finding: validate.mjs overlap `words()` matches only [a-z0-9'] -> Japanese text yields 0 words, so overlap never flags copied Japanese prose. Also only string fields are checked (arrays skipped). Framework lesson for the Orchestrator.
- Node 20 EOL April 2026; recommend preflight.nodeMajor 22 (type stripping >= 22.18).
- All four files written. Report sent.
