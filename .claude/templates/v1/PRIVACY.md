# Privacy and personal data — {{PROJECT_NAME}}

v1 module · Owner: BA + product owner · {{DATE}} · Not legal advice: have it reviewed before launch if you collect personal data from real users.

## 1. What we collect
| Data | Why (purpose) | Lawful basis (GDPR) | Where stored | Retention | Shared with |
|------|---------------|---------------------|--------------|-----------|-------------|
| Email | sign-in | contract | auth provider | until deletion | auth provider |
| | | | | | |

## 2. Rules
- Collect the minimum. No field without a purpose in the table above.
- Analytics: privacy-friendly or consent-gated; decline non-essential cookies by default.
- Account deletion removes or anonymises everything in the table within the stated time.
- A user can export their data (JSON) on request.

## 3. User-facing texts
Privacy notice, cookie notice (if needed), terms. Owner and review date for each.

## 4. Tests
- Deletion test covers every row in §1.
- No personal data in logs, URLs or analytics events.
