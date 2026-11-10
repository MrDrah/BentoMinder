// Variant B of the Family card, everything below the status row (components §16.1, §16.4, §16.6): the member list, the
// invite block, the consent row, the backup-copy row and the leave / delete actions with their dialogs. Lazy chunk `family`.
import { useCallback, useEffect, useRef, useState } from 'react';
import { SYNC_LIMITS } from '../../../domain/sync/config.ts';
import type { Invite, Membership } from '../../../domain/sync/types.ts';
import { useApp } from '../../app-store.tsx';
import { Banner, BannerIcon } from '../../components/Controls.tsx';
import { reopenConsentPrompt } from '../consent-prompt.ts';
import { formatExpiry, formatLongDate, formatUntil } from '../format.ts';
import { useFamily, useOnline } from '../hooks.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { ConsentNotice } from './ConsentNotice.tsx';
import { chunkText } from './text.ts';

type MemberState = Extract<Membership, { status: 'member' }>;

const SOON_MS = 6 * 3_600_000;
const POLL_WHILE_INVITING_MS = 10_000;

/** The cloud's view of the family (members, open invite), read on open, on focus, and while an invite is waiting. */
function useMembership(pollMs: number | null) {
  const fam = useFamily();
  const [data, setData] = useState<MemberState | null>(null);
  const alive = useRef(true);
  const sync = fam?.sync;
  const reload = useCallback(async () => {
    if (sync === undefined) return;
    try {
      const m = await sync.family.membership();
      if (alive.current && m.status === 'member') setData(m);
    } catch {
      // Offline or temporary: the list keeps what it had; nothing to tell the parent here.
    }
  }, [sync]);
  useEffect(() => {
    alive.current = true;
    void reload();
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => {
      alive.current = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [reload]);
  useEffect(() => {
    if (pollMs === null) return undefined;
    const id = setInterval(() => void reload(), pollMs);
    return () => clearInterval(id);
  }, [pollMs, reload]);
  return { data, reload, setData };
}

const initialOf = (text: string): string => Array.from(text.trim())[0] ?? '';

export function FamilyMembers() {
  const fam = useFamily();
  const { t, state: app, showToast } = useApp();
  const online = useOnline();
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const { data, reload, setData } = useMembership(invite != null ? POLL_WHILE_INVITING_MS : null);
  const [dialog, setDialog] = useState<'leave' | 'remove' | 'delete' | 'consent' | null>(null);
  const [removing, setRemoving] = useState<{ uid: string; name: string } | null>(null);
  const known = useRef<Set<string> | null>(null);

  const members = data?.members ?? [];
  // Someone joined while an invite was waiting: the invite is gone and the list has a new row (US-E15-03/AC8).
  useEffect(() => {
    if (data === null) return;
    const before = known.current;
    known.current = new Set(members.map((m) => m.uid));
    if (before === null) return;
    const added = members.find((m) => !before.has(m.uid));
    if (added !== undefined) {
      showToast(t('family.toast.joined', { name: added.email ?? t('family.member.noName') }));
      setInvite(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (fam === null) return null;
  const s = fam.state;
  const lang = app.language;
  const full = data !== null && members.length >= (data.maxMembers ?? SYNC_LIMITS.maxMembers);
  const uploading = s.view.lastSyncedAt === null || s.adoptionPending;
  const currentInvite: Invite | null = invite !== undefined ? invite : (data?.invite ?? null);

  const closeDialog = () => {
    setDialog(null);
    setRemoving(null);
    setTimeout(() => document.getElementById('settings-family-title')?.focus(), 0);
  };

  const afterLeave = (key: 'family.toast.left' | 'family.toast.deleted') => {
    showToast(t(key));
    setDialog(null);
    setTimeout(() => document.getElementById('settings-family-title')?.focus(), 0);
  };

  const lastMember = members.length === 1;
  return (
    <>
      {s.view.state === 'paused-no-consent' && (
        <Banner variant="warning" testId="consent-cloud-paused" title={t('consent.cloud.paused.title')}>
          <p className="banner__body">{t('consent.cloud.paused.body')}</p>
          <div className="banner__actions">
            <button type="button" className="btn btn--secondary btn--small" data-testid="consent-cloud-review" onClick={reopenConsentPrompt}>
              {t('consent.cloud.paused.review')}
            </button>
            <button type="button" className="btn btn--text btn--small" data-testid="consent-cloud-paused-leave" onClick={() => setDialog('leave')}>
              {t('family.leave')}
            </button>
          </div>
        </Banner>
      )}

      <div className="family-block" data-testid="family-members">
        <h3 className="family-h3">{t('family.members')}</h3>
        <ul className="family-list">
          {members.map((m, i) => {
            const name = m.email ?? t('family.member.noName');
            return (
              <li key={m.uid} className="family-member" data-testid={`family-member-${i}`}>
                <span className="family-member__tile" aria-hidden="true">
                  {initialOf(m.email ?? '')}
                </span>
                <span className="family-member__name" title={name}>
                  {name}
                </span>
                {m.you && <span className="tag">{t('family.member.you')}</span>}
                {!m.you && (
                  <button
                    type="button"
                    className="btn btn--destructive-text"
                    data-testid="family-remove"
                    onClick={() => {
                      setRemoving({ uid: m.uid, name });
                      setDialog('remove');
                    }}
                  >
                    {t('family.remove')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {data !== null && members.length === 1 && <p className="field__hint">{t('family.members.room')}</p>}
      </div>

      <InviteBlock
        invite={currentInvite}
        online={online}
        uploading={uploading}
        full={full}
        onInvite={setInvite}
        reload={reload}
      />

      {s.consent !== null && (
        <div className="family-row" data-testid="family-consent-row-wrap">
          <button type="button" className="btn btn--text family-row__button" data-testid="family-consent-row" onClick={() => setDialog('consent')}>
            {t('family.consent.row')}
          </button>
          <p className="field__hint">{t('consent.cloud.agreedOn', { consentDate: formatLongDate(lang, s.consent.at) })}</p>
        </div>
      )}

      {s.safetyCreatedAt !== null && <SafetyRow />}

      <div className="family-leave">
        <button type="button" className="btn btn--destructive-text" data-testid="family-leave" onClick={() => setDialog('leave')}>
          {t('family.leave')}
        </button>
        <button type="button" className="btn btn--destructive-text" data-testid="family-delete" onClick={() => setDialog('delete')}>
          {t('family.delete')}
        </button>
      </div>

      {dialog === 'leave' && !lastMember && (
        <ConfirmDialog
          name="leave"
          title={t('family.leave.title')}
          body={<p>{t('family.leave.body')}</p>}
          confirmLabel={t('family.leave.confirm')}
          needsNetwork
          online={online}
          onClose={closeDialog}
          onConfirm={async () => {
            await fam.sync.family.leave(false);
            afterLeave('family.toast.left');
          }}
        />
      )}
      {dialog === 'leave' && lastMember && (
        <ConfirmDialog
          name="leave-last"
          title={t('family.leaveLast.title')}
          body={<p>{t('family.leaveLast.body')}</p>}
          confirmLabel={t('family.leaveLast.confirm')}
          typed={t('family.typed.word')}
          needsNetwork
          online={online}
          onClose={closeDialog}
          onConfirm={async () => {
            await fam.sync.family.leave(true);
            afterLeave('family.toast.deleted');
          }}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          name="delete-family"
          title={t('family.delete.title')}
          body={<p>{t('family.delete.body')}</p>}
          confirmLabel={t('family.delete.confirm')}
          typed={t('family.typed.word')}
          needsNetwork
          online={online}
          onClose={closeDialog}
          onConfirm={async () => {
            await fam.sync.family.deleteFamily();
            afterLeave('family.toast.deleted');
          }}
        />
      )}
      {dialog === 'remove' && removing !== null && (
        <ConfirmDialog
          name="remove-member"
          title={t('family.remove.title', { name: removing.name })}
          body={<p>{t('family.remove.body', { name: removing.name })}</p>}
          confirmLabel={t('family.remove.confirm')}
          needsNetwork
          online={online}
          onClose={closeDialog}
          onConfirm={async () => {
            await fam.sync.family.removeMember(removing.uid);
            const name = removing.name;
            setData((d) => (d === null ? d : { ...d, members: (d.members ?? []).filter((m) => m.uid !== removing.uid) }));
            showToast(t('family.toast.removed', { name }));
            closeDialog();
            void reload();
          }}
        />
      )}
      {dialog === 'consent' && s.consent !== null && (
        <ConsentNotice
          mode="read"
          online={online}
          agreedOn={formatLongDate(lang, s.consent.at)}
          onClose={() => setDialog(null)}
          onLeave={() => setDialog('leave')}
        />
      )}
    </>
  );
}

interface InviteBlockProps {
  invite: Invite | null;
  online: boolean;
  uploading: boolean;
  full: boolean;
  onInvite: (invite: Invite | null) => void;
  reload: () => Promise<void>;
}

export function InviteBlock({ invite, online, uploading, full, onInvite, reload }: InviteBlockProps) {
  const fam = useFamily();
  const { t, state: app, now, showToast, services } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [expiredNote, setExpiredNote] = useState(false);
  const codeRef = useRef<HTMLSpanElement>(null);
  const [tick, setTick] = useState(0);

  // The code stops working at its expiry: the panel returns to "none" with a note (US-E15-03/AC2).
  const expiresAt = invite?.expiresAt;
  useEffect(() => {
    if (expiresAt === undefined) return undefined;
    const wait = Date.parse(expiresAt) - now();
    if (wait <= 0) {
      onInvite(null);
      setExpiredNote(true);
      return undefined;
    }
    const id = setTimeout(() => setTick((n) => n + 1), Math.min(wait + 50, 2_000_000_000));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, tick]);

  if (fam === null) return null;
  const lang = app.language;
  const blockedHint: 'family.invite.offline' | 'family.invite.waitUpload' | 'family.invite.full' | null = !online ? 'family.invite.offline' : uploading ? 'family.invite.waitUpload' : full ? 'family.invite.full' : null;

  const create = async () => {
    if (busy || blockedHint !== null) return;
    setBusy(true);
    setError(false);
    setExpiredNote(false);
    try {
      onInvite(await fam.sync.family.createInvite());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const link = invite === null ? '' : `${window.location.origin}${window.location.pathname}#/join/${invite.code}`;
  const groups = invite === null ? '' : `${invite.code.slice(0, 5)} ${invite.code.slice(5)}`;
  const copy = async (text: string, toast: 'family.toast.codeCopied' | 'family.toast.linkCopied') => {
    setCopyFailed(false);
    if (await services.share.copy(text)) showToast(t(toast));
    else {
      setCopyFailed(true);
      const node = codeRef.current;
      if (node !== null) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  const soon = invite !== null && Date.parse(invite.expiresAt) - now() < SOON_MS;
  const expiry = invite === null ? '' : formatExpiry(t, lang, invite.expiresAt);

  return (
    <div className="family-invite" data-testid="invite-section">
      <h3 className="family-h3">{t('family.invite.section')}</h3>
      {invite === null ? (
        <>
          <p>{t('family.invite.lead')}</p>
          {expiredNote && (
            <p className="field__hint" data-testid="invite-expired">
              {t('family.invite.expired')}
            </p>
          )}
          <button
            type="button"
            className={`btn btn--primary${blockedHint !== null ? ' is-disabled' : ''}`}
            data-testid="invite-create"
            aria-disabled={blockedHint !== null || busy ? true : undefined}
            aria-busy={busy ? true : undefined}
            aria-describedby={blockedHint !== null ? 'invite-hint' : undefined}
            onClick={() => void create()}
          >
            {busy && <span className="auth-spinner" aria-hidden="true" />}
            {busy ? t('family.invite.busy') : t('family.invite')}
          </button>
          {blockedHint !== null && (
            <p id="invite-hint" className="field__hint" data-testid="invite-hint">
              {t(blockedHint)}
            </p>
          )}
          {error && (
            <p className="field-error" role="alert">
              {t('common.error.generic')}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="field__label">{t('family.invite.codeLabel')}</p>
          <p className="family-code" data-testid="invite-code">
            <span ref={codeRef} aria-hidden="true">
              {groups}
            </span>
            <span className="visually-hidden">{chunkText(invite.code)}</span>
          </p>
          <div className="family-actions family-actions--row">
            <button type="button" className="btn btn--secondary" data-testid="invite-copy-code" onClick={() => void copy(invite.code, 'family.toast.codeCopied')}>
              {t('family.invite.copyCode')}
            </button>
            <button type="button" className="btn btn--secondary" data-testid="invite-copy-link" onClick={() => void copy(link, 'family.toast.linkCopied')}>
              {t('family.invite.copyLink')}
            </button>
            {services.share.canShare() && (
              <button
                type="button"
                className="btn btn--secondary"
                data-testid="invite-share"
                onClick={() => void services.share.share(t('family.invite.shareText', { code: groups, link, expiry }))}
              >
                {t('family.invite.share')}
              </button>
            )}
          </div>
          {copyFailed && (
            <p className="field-error" role="alert" data-testid="invite-copy-failed">
              {t('family.invite.copyFailed')}
            </p>
          )}
          <p className="field__hint" data-testid="invite-expiry">
            {t(soon ? 'family.invite.expiresSoon' : 'family.invite.expires', { expiry })}
            {soon && (
              <span className="tag tag--warning">
                <BannerIcon variant="warning" />
              </span>
            )}
          </p>
          <button type="button" className="btn btn--text" data-testid="invite-new" aria-busy={busy ? true : undefined} onClick={() => void create()}>
            {t('family.invite.newCode')}
          </button>
          <p className="field__hint">{t('family.invite.newCode.hint')}</p>
          <button
            type="button"
            className="btn btn--destructive-text"
            data-testid="invite-cancel"
            onClick={() => {
              void (async () => {
                try {
                  await fam.sync.family.cancelInvite();
                  onInvite(null);
                  setExpiredNote(false);
                  showToast(t('family.toast.inviteCancelled'));
                  void reload();
                } catch {
                  setError(true);
                }
              })();
            }}
          >
            {t('family.invite.cancel')}
          </button>
          {error && (
            <p className="field-error" role="alert">
              {t('common.error.generic')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** US-E15-04/AC5: the backup copy of what this device held before it joined; export it or delete it. */
export function SafetyRow() {
  const fam = useFamily();
  const { t, state: app, services, repository, showToast } = useApp();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (fam === null || fam.state.safetyCreatedAt === null) return null;
  const until = new Date(Date.parse(fam.state.safetyCreatedAt) + SYNC_LIMITS.safetyCopyDays * 86_400_000).toISOString();

  const exportCopy = async () => {
    setBusy(true);
    setError(false);
    try {
      const raw = await fam.sync.family.safetyCopy();
      if (raw === null) throw new Error('none');
      const parsed = repository.importJson(raw);
      const text = parsed.ok ? repository.exportJson(parsed.state) : raw;
      await services.fileExport.save(repository.exportFileName(), text, 'application/json');
      showToast(t('data.export.done'));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="family-safety" data-testid="safety-copy">
      <p className="family-safety__title">{t('family.safety.title')}</p>
      <p className="field__hint">{t('family.safety.until', { until: formatUntil(t, app.language, until) })}</p>
      <div className="family-actions family-actions--row">
        <button type="button" className="btn btn--secondary" data-testid="safety-export" aria-busy={busy ? true : undefined} aria-disabled={busy ? true : undefined} onClick={() => void exportCopy()}>
          {busy ? t('common.loading') : t('family.safety.export')}
        </button>
        <button type="button" className="btn btn--destructive-text" data-testid="safety-delete" onClick={() => setAsking(true)}>
          {t('family.safety.delete')}
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {t('common.error.generic')}
        </p>
      )}
      {asking && (
        <ConfirmDialog
          name="safety-delete"
          title={t('family.safety.delete.title')}
          body={<p>{t('family.safety.delete.body')}</p>}
          confirmLabel={t('family.safety.delete.confirm')}
          online
          onClose={() => setAsking(false)}
          onConfirm={async () => {
            await fam.sync.family.deleteSafetyCopy();
            setAsking(false);
          }}
        />
      )}
    </div>
  );
}
