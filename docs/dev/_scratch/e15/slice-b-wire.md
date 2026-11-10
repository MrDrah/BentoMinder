# E15 slice B: wire contract of the `sync` function (for slice C's HTTP adapter)

`POST <SYNC_BASE_URL>/v1/<op>`, `Authorization: Bearer <ID token>`, JSON body (empty body = `{}`). Replies are JSON; every 200 is
`{ok:true, ..., serverNowMs}`; every refusal is `{ok:false, error:CODE, ...}` and carries no content. Preflight `OPTIONS` answers 204.

| op | body | 200 reply (besides ok, serverNowMs) |
|----|------|------|
| `membership.get` | | `{status:'none'}` / `{status:'ended', reason}` / `{status:'deleting'}` / `{status:'member', familyId, consentVersion, consentedAt, maxMembers, members:[{uid,you,joinedAt,consentVersion,email?}], invite:{code,expiresAt}\|null}` |
| `membership.ack` | | `{}` (clears the caller's own ended marker) |
| `family.create` | `{consentVersion}` | `{familyId}` |
| `invite.create` | | `{code, expiresAt}` |
| `invite.cancel` | | `{}` |
| `invite.redeem` | `{code, consentVersion}` | `{familyId}` |
| `consent.set` | `{consentVersion}` | `{}` |
| `family.leave` | `{confirmation?}` | `{}`; the last member must send `confirmation:'削除する'` and gets `{deleted:true}` |
| `family.removeMember` | `{uid}` | `{}` |
| `family.delete` | `{confirmation:'削除する'}` | `{deleted:true}` |
| `records.push` | `{records: Envelope[]}` (at most 50, one per key, client fields only) | `{results: PushResult[], seq, schemaVersion}` |
| `records.pull` | `{cursor}` | `{envelopes: StoredEnvelope[], seq, hasMore, schemaVersion}` |

Refusals (status, code, extra) and the SyncPortError kind slice C should map them to:

| status | error | extra | kind |
|--------|-------|-------|------|
| 401 | UNAUTHENTICATED | | unauthenticated |
| 403 | NOT_MEMBER | | refused (account is in no family) |
| 410 | MEMBERSHIP_ENDED | reason: left, removed, family-deleted | membership-ended(reason) |
| 403 | CONSENT_REQUIRED | | consent-required |
| 403 | NOT_ALLOWED | | refused (not on the allow-list; create only) |
| 403 | ORIGIN_NOT_ALLOWED | | refused |
| 409 | ALREADY_IN_FAMILY / FAMILY_FULL | | refused |
| 409 | CONFIRMATION_REQUIRED | why | refused |
| 400 | INVITE_INVALID / INVITE_EXPIRED | | refused (invalid-code / expired) |
| 429 | TOO_MANY_ATTEMPTS | retryAfterSec | refused |
| 413 / 429 | LIMIT | scope: record, family, writes (writes has retryAfterSec); scope request for an oversized body | limit |
| 400 | INVALID_RECORD | index, rule, reason (no content) | refused |
| 400 | BAD_REQUEST | field | refused |
| 404 | TARGET_NOT_FOUND / NOT_FOUND | | refused |
| 503 | UNAVAILABLE | | temporary |

Notes for the engine: a refused push batch is refused as a whole (one invalid record blocks its batch, the reply names the index); after
`family.delete` the deleter's own account is simply in no family (`NOT_MEMBER` / `membership.get` = none); the other member gets
`membership-ended(family-deleted)` once. `updatedBy` and the family id are never taken from the request.
