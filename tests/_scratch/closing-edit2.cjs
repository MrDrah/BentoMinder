// One-off editor: README + strategy for the H1 closing rulings.
const fs = require("fs");
function edit(p, f) { fs.writeFileSync(p, f(fs.readFileSync(p, "utf8"))); }
const rep = (s, a, b) => { if (s.split(a).length !== 2) throw new Error("not unique: " + a); return s.replace(a, b); };

edit("tests/oracle/README.md", (s) => {
  s = rep(s, "| 64 decision-table cases + 15 matcher cases |", "| 65 decision-table cases + 15 matcher cases |");
  s = rep(s, "| 54 transitions + 22 system events |", "| 56 transitions + 23 system events |");
  s = rep(s, "| 40 cases |", "| 43 cases |");
  s = rep(s, "64 fixed + 1000 seeded days", "65 fixed + 1000 seeded days");
  const i = s.indexOf("Still open, each with a QA proposal;");
  return s.slice(0, i) + "The last open items (O-2, O-3, O-4, U4, U5, RU1, N3) were closed by PLAN §7 \"H1 closing rulings\" and the BA's `definingIngredientId` (24 of 55 dishes set). **Nothing is open: every fixed case is asserted, no `todo`, and the random generators exclude no situation.**\n";
});

edit("tests/plan/test-strategy.md", (s) => {
  s = rep(s, "Assessment oracle (64 cases + 1,000 se", "Assessment oracle (65 cases + 1,000 se");
  s = rep(s, "Decision oracle: 54 transitions + 22 system e", "Decision oracle: 56 transitions + 23 system e");
  s = rep(s, "Reminder oracle (40 cases + 1,00", "Reminder oracle (43 cases + 1,00");
  s = rep(s, "Fixed cases: assessment 64 (+15 matcher), decisions 54 transitions + 22 system events, ranking 23 + 7 hidden-source diet cases, reminders 40.",
    "Fixed cases: assessment 65 (+15 matcher), decisions 56 transitions + 23 system events, ranking 23 + 7 hidden-source diet cases, reminders 43.");
  const a = s.indexOf("**Still open after the rulings**");
  const b = s.indexOf("**Not blocking H1:**");
  s = s.slice(0, a) + "**Closed by PLAN §7 \"H1 closing rulings\" (2026-10-24):** O-2 → A57 (removed date with an override is listed in \"needs review\"); O-3 → A65 (defining-ingredient links never cross items); O-4 → dictionary `definingIngredientId` published, assessment §1 reconciled (only みそ汁 differed: null; no result changed); U4 → S10, S23 (NC/SL on a removed date dormant, NC listed in review); U5 → T55 (`CONFIRM_RECIPE` on an お弁当の日 replaces a dormant record); RU1 → T56, RM41 (`plannedAt` cleared when the day leaves HB); AC15 → A61 (ingredient → dish → category). **No case depends on an undecided rule; no `todo` remains.**\n\n" + s.slice(b);
  s = rep(s, "| N3 | Shown-but-not-dismissed reminders | **Open** (not in the H1 rows); owner BA, by M4. No fixed case depends on it; the reminder generator writes dismissed entries only |",
    "| N3 | Shown-but-not-dismissed reminders | **Resolved 2026-10-24 (PLAN §7 \"H1 closing rulings\", OQ-20)**: shown again until dismissed or expired; RM42, RM43; RM22 now dismisses explicitly. The BA writes the AC at M4 (US-E7-04/AC2 \"already shown are not shown again\" is read as \"not fired again as a new reminder\") |");
  return s;
});
console.log("ok");
