// Decision-state oracle (tests/oracle/decision-state-oracle.md): a naive re-implementation of the E5 state
// machine, the dormant/conflict rules and the needs-review list. Imports nothing from src/ and no package.
export type Kind = 'school' | 'bento-day' | 'other-no-lunch' | 'none';
export type Ev =
  | { t: 'CONFIRM'; r: string }
  | { t: 'CHANGE'; r: string }
  | { t: 'LATER' }
  | { t: 'TO_SCHOOL_OK' }
  | { t: 'CLEAR_OK' }
  | { t: 'KEEP' }
  | { t: 'RESERVED'; done: boolean };

export interface Rec {
  state: 'school-lunch-planned' | 'not-confirmed' | 'homemade-bento-planned';
  recipeId: string | null;
  flag: boolean;
  planned: boolean;
  ack: number | null;
  last: string; // "state|recipe" of the latest history entry
}
export type Assign = 'school' | 'bento' | 'nolunch' | 'snack' | 'absent';

export const kindOf = (a: Assign): Kind => (a === 'school' ? 'school' : a === 'bento' ? 'bento-day' : a === 'nolunch' ? 'other-no-lunch' : 'none');

export class DecisionOracle {
  recs = new Map<string, Rec>();
  overrides = new Set<string>();
  menu = new Map<string, Assign>();
  version = 1;
  changed = new Set<string>();
  today = '2026-11-02';

  private validRecipes: Set<string>;
  constructor(validRecipes: Set<string>) {
    this.validRecipes = validRecipes;
  }

  kind(date: string): Kind {
    return kindOf(this.menu.get(date) ?? 'absent');
  }
  /** Displayed state: null = nothing shown. */
  shown(date: string): string | null {
    const rec = this.recs.get(date);
    switch (this.kind(date)) {
      case 'school':
        return rec?.state ?? 'school-lunch-planned';
      case 'bento-day':
        return rec?.state === 'homemade-bento-planned' ? rec.state : 'no-school-lunch';
      case 'other-no-lunch':
        return rec?.state === 'homemade-bento-planned' ? rec.state : 'no-school-lunch';
      default:
        return rec?.state === 'homemade-bento-planned' ? rec.state : null;
    }
  }
  conflict(date: string): boolean {
    const k = this.kind(date);
    return this.recs.get(date)?.state === 'homemade-bento-planned' && (k === 'other-no-lunch' || k === 'none');
  }
  needsAck(date: string): boolean {
    if (!this.conflict(date)) return false;
    const ack = this.recs.get(date)!.ack;
    return ack === null || (this.changed.has(date) && ack < this.version);
  }

  /** Is the event accepted right now? (the whole table, guards G1-G4). */
  accepts(date: string, ev: Ev): boolean {
    const k = this.kind(date);
    const rec = this.recs.get(date);
    const conflict = this.conflict(date);
    if (date < this.today) return false; // G1
    if (conflict) return ev.t === 'KEEP' || ev.t === 'CLEAR_OK'; // G4
    if (k === 'other-no-lunch' || k === 'none') return false; // G2, G3
    const s = this.shown(date);
    const hb = s === 'homemade-bento-planned';
    if ((ev.t === 'CONFIRM' || ev.t === 'CHANGE') && !this.validRecipes.has(ev.r)) return false;
    if (k === 'school') {
      switch (ev.t) {
        case 'CONFIRM': return s === 'school-lunch-planned' || s === 'not-confirmed';
        case 'LATER': return s === 'school-lunch-planned' || hb;
        case 'TO_SCHOOL_OK': return s === 'not-confirmed' || hb;
        case 'CHANGE': return hb;
        case 'CLEAR_OK': return false;
        case 'KEEP': return false;
        case 'RESERVED': return s === 'school-lunch-planned' && (ev.done ? !(rec?.flag ?? false) : rec?.flag === true);
      }
    }
    // bento-day
    switch (ev.t) {
      case 'CONFIRM': return s === 'no-school-lunch';
      case 'CHANGE': return hb;
      case 'CLEAR_OK': return hb;
      default: return false;
    }
  }

  /** Apply the event; returns accepted. */
  apply(date: string, ev: Ev): boolean {
    if (!this.accepts(date, ev)) return false;
    const rec = this.recs.get(date);
    const put = (state: Rec['state'], recipeId: string | null, planned: boolean, flag = false) =>
      this.recs.set(date, { state, recipeId, flag, planned, ack: rec?.ack ?? null, last: `${state}|${recipeId ?? ''}` });
    switch (ev.t) {
      case 'CONFIRM': put('homemade-bento-planned', ev.r, true); this.recs.get(date)!.ack = null; break;
      case 'CHANGE':
        if (rec!.recipeId !== ev.r) { rec!.recipeId = ev.r; rec!.last = `homemade-bento-planned|${ev.r}`; }
        break;
      case 'LATER': put('not-confirmed', null, false); break;
      case 'TO_SCHOOL_OK': put('school-lunch-planned', null, false); break;
      case 'CLEAR_OK': this.recs.delete(date); break;
      case 'KEEP': rec!.ack = this.version; break;
      case 'RESERVED':
        if (rec === undefined) this.recs.set(date, { state: 'school-lunch-planned', recipeId: null, flag: ev.done, planned: false, ack: null, last: 'school-lunch-planned|' });
        else rec.flag = ev.done;
        break;
    }
    return true;
  }

  /** Menu refresh: new assignment for the month, version + 1, changed = dates whose entry differs. Records untouched. */
  refresh(next: Map<string, Assign>) {
    this.changed = new Set();
    const all = new Set([...this.menu.keys(), ...next.keys()]);
    for (const date of all) if ((this.menu.get(date) ?? 'absent') !== (next.get(date) ?? 'absent')) this.changed.add(date);
    this.menu = next;
    this.version += 1;
  }
  /** The refresh's needs-review list (US-E3-05/AC9, AC11, AC12). */
  review(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const date of [...this.changed].sort()) {
      const reasons: string[] = [];
      const st = this.recs.get(date)?.state;
      if (st === 'homemade-bento-planned') reasons.push('planned');
      if (st === 'not-confirmed') reasons.push('not-confirmed');
      if (this.overrides.has(date)) reasons.push('override');
      if (reasons.length) out.set(date, reasons);
    }
    return out;
  }
  /** Overrides (US-E4-03/AC4, AC6, AC7): school day from today on only. */
  setOverride(date: string): boolean {
    if (date < this.today || this.kind(date) !== 'school') return false;
    this.overrides.add(date);
    return true;
  }
  clearOverride(date: string): boolean {
    if (date < this.today) return false;
    this.overrides.delete(date);
    return true;
  }
}
