# E15 open questions (BA, 2026-11-10)

Each has a DEFAULT already used in `docs/ba/user-stories.md` (E15) and `docs/ba/data-contract.md` §14. The product owner only needs to confirm or overturn. None blocks the developer's ADR.

Conflict check against the Orchestrator defaults in PLAN §7 (2026-11-10): none found. One point to note: contract §7 and §2 already said `ownerId` becomes the family id in v1; ADR 014 left it open; E15 settles it (14.7).

| # | Question | DEFAULT (used) | Alternative / trade-off |
|---|----------|----------------|-------------------------|
| Q1 | Maximum members | 2 (PO and spouse), a configuration value | 4 would allow grandparents later; every extra member widens who sees allergy data, so raise it only on request |
| Q2 | Are language and theme synced? | No: per person, stay on the device (each parent picks their own) | Sync them too: simpler, but the spouse's phone would flip language when the other changes it |
| Q3 | Consent wording: operator access and legal review | Notice says the operator can technically reach stored data through the hosting console and does not use it; no claim of legal compliance. The BA is not a lawyer: allergy data is APPI 要配慮個人情報 (consent to acquisition), and Google as hosting provider may raise cross-border questions even with the Tokyo region | Have the wording reviewed by someone qualified before the first real upload; or reword (e) after the PO decides what is true |
| Q4 | Contact line in the notice | PO's contact (an e-mail address the PO supplies) | A project mailbox; needed before release, not for the ADR |
| Q5 | Does the cloud member list store display name and e-mail? | Store only uid; show the other member as 「家族メンバー」 plus the name/e-mail the app received at sign-in only if the developer can keep it in the member record (members-only readable) | uid only is the most private but the "who is in my family" screen is less clear |
| Q6 | Granularity of last-edit-wins | Per whole record (month, date, profile, settings); accepted that one record's extra content can be lost (US-E15-07/AC9) | Merge inside MenuMonth or DayDecision: much more code for two users |
| Q7 | Invite expiry | 72 hours, single use | 24 h is safer, 7 days is easier |
| Q8 | Tombstone retention | 90 days, then reconcile rule for long-offline devices | 30 days (cheaper, more reconciles) |
| Q9 | Account deletion (the Google/Firebase user itself) | Out of E15; leaving or deleting the family removes the family's cloud data; deleting the sign-in account is a separate later story (E13 "later") | Include it now: needs re-authentication and deleting server data in one flow |
| Q10 | What a leaver or a removed member keeps | Their local copy stays on the device as stand-alone (nothing is deleted without their action) | Wipe the removed member's device copy: stronger privacy for the family, but destroys data the person legitimately had and cannot be guaranteed on an offline device |
| Q11 | May either member remove the other or delete the family? | Yes (both equal, with confirmations; deletion needs a typed confirmation) | Require both to agree: safer against an argument or a lost phone, but needs a pending-request flow |
| Q12 | Freshness target | Online devices show another device's change within 60 seconds | Seconds (live listeners) vs minutes (polling); cost and battery trade-off, the developer may choose within the target |

Also noted, no decision needed: pruning at 13 months and removing old tombstones are cloud housekeeping that the developer designs; the sample numbers in contract §14.10 (256 KiB, 5 MiB, 200 writes per hour) are guardrails chosen to stay far under the free tier for two users, not measured values, and the developer should confirm them against real record sizes and current quotas in the ADR.
