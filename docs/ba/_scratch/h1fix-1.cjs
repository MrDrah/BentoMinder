const fs=require('fs');const f='docs/ba/user-stories.md';let s=fs.readFileSync(f,'utf8');
function rep(a,b){if(!s.includes(a)){console.error('MISSING:',a.slice(0,80));process.exit(1)}s=s.replace(a,b)}
rep("The first level at which the profile has a like or a dislike decides: a dislike there makes the found id *disliked*, a like makes it *liked*; if that same level holds both a like and a dislike (only possible for an id with two categories, e.g. `ing-ground-mixed` in `cat-beef` and `cat-pork`), the found id is both liked and disliked.",
"The first level at which the profile has a like or a dislike decides: a dislike there makes the found id *disliked*, a like makes it *liked*; if that same level holds both a like and a dislike (only possible for an id with two categories, e.g. `ing-ground-mixed` in `cat-beef` and `cat-pork`), the dislike wins and the found id is disliked only.");
rep("  # A refresh that turns a planned school day into a \"bento-day\" no-lunch day is not a conflict: the plan is valid there (US-E5-08); the day is only flagged 「献立が変わりました」 because it is in changedDatesSincePrevious.",
"  # A refresh that turns a planned school day into a \"bento-day\" no-lunch day (お弁当の日) is not a conflict: the plan is valid there (BR-25, US-E5-08) and the day is NOT flagged.");
rep("  # The same holds for any other stored decision (not-confirmed, school-lunch-planned) on a date that a refresh turns into a non-bento-day no-lunch day or removes: kept, flagged, only keep or clear (data contract §3.6 decision-refresh-conflict).",
"  # Stored not-confirmed or school-lunch-planned records on such a date are handled by AC10 (dormant), not by this conflict flow.");
rep("  Then the stored decision, its recipe and its day-before reminder are unchanged, conflictAckMenuVersion is set to the current menu version, and the conflict leaves the upcoming summary",
"  Then the parent event KEEP_PLAN is recorded: the stored state, its recipe, plannedAt and its day-before reminder are unchanged, acknowledgedMenuVersion is set to the current ConfirmedMenu.version, and the conflict leaves the upcoming summary");
rep("  And no stored decision or override is changed by the refresh\n```",
`  And no stored decision or override is changed by the refresh

Scenario: AC10 A not-confirmed or school-lunch record on a date that becomes a no-lunch day stays dormant (BR-02, BR-13)
  Given 2026-11-11 has the stored decision not-confirmed and 2026-11-12 has the stored decision school-lunch-planned with reservationDoneExternally true
  When the refreshed menu marks both dates as no-lunch days with reason "closed" (or no longer lists them)
  Then both records are still stored, byte-for-byte unchanged (dormant)
  And both days display no-school-lunch (or, when unlisted, no decision) and offer no decision actions
  And both dates are listed in the refresh's 「確認が必要な日」 list
  When a later refresh lists 2026-11-11 and 2026-11-12 as school days again
  Then they display not-confirmed and school-lunch-planned (with the reservation record) again, unchanged
\`\`\``);
fs.writeFileSync(f,s);console.log('ok');
