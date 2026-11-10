// US-E15-03/AC6 (E15-D02, contract 14.12): invite codes never contain 1, I, L, 0 or O; length 10; every symbol equally likely.
import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET as SERVER_ALPHABET, codeWellFormed, normaliseCode as serverNormalise } from '../../../functions/src/sync/store.ts';
import { CODE_ALPHABET, CODE_LENGTH, codeIsValid, normaliseCode } from '../../../src/ui/sync/family/text.ts';

describe('US-E15-03/AC6 invite code alphabet', () => {
  it('has no 1, I, L, 0 or O, the same on the server and in the join screen', () => {
    expect(CODE_ALPHABET).toBe(SERVER_ALPHABET);
    expect(CODE_ALPHABET).not.toMatch(/[01ILO]/);
    expect(new Set(CODE_ALPHABET).size).toBe(CODE_ALPHABET.length);
    expect(CODE_LENGTH).toBe(10);
  });

  it('an input with a look-alike symbol is not a valid code (join button stays off, the server answers the one generic way)', () => {
    for (const bad of ['ABCDEFGHJ1', 'ABCDEFGHJL', 'ABCDEFGHJ0', 'ABCDEFGHJO', 'ABCDEFGHJI', 'abcde-fghjl']) {
      expect(codeIsValid(bad), bad).toBe(false);
      expect(codeWellFormed(serverNormalise(bad)), bad).toBe(false);
    }
    expect(codeIsValid('abcde-fghjk')).toBe(true);
    expect(normaliseCode(' abcde fghjk ')).toBe('ABCDEFGHJK');
  });
});
