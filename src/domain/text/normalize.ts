// Domain dictionary §1 rule 1: NFKC, katakana → hiragana, spaces, 「・」 and brackets removed,
// 「ー」 kept. Used for matching and for the dictionary's one-form-one-id rule.

const BRACKETS_AND_SPACES = /[\s・()（）「」『』【】[\]〔〕［］]/gu;

export function katakanaToHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/gu, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export function normalizeForMatch(text: string): string {
  return katakanaToHiragana(text.normalize('NFKC')).replace(BRACKETS_AND_SPACES, '');
}

/** Removes a full-width bracketed display disambiguator: 「なし（梨）」 → 「なし」 (dictionary §1 rule 2). */
export function stripDisambiguator(text: string): string {
  return text.replace(/（[^（）]*）/gu, '').trim();
}
