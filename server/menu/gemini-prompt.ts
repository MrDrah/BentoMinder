// The fixed extraction prompt and the response schema sent to Gemini (ADR 002 §3). Nothing here
// ever contains child or profile data (contract `ai-payload-allowlist`): only the target month,
// the prompt text, the schema and (repair retry only) the rule ids of the previous failure.
import { extractedMenuJsonSchema } from '../../src/domain/schema/extracted-menu.ts';

const APP_SET_FIELDS = ['id', 'source', 'extractedAt'];

/** JSON Schema of the model's output: ExtractedMenu v1 minus the fields the app sets itself. */
export function modelResponseSchema(): Record<string, unknown> {
  const schema = extractedMenuJsonSchema();
  const out: Record<string, unknown> = { ...schema };
  delete out['$schema'];
  out['properties'] = Object.fromEntries(Object.entries((schema['properties'] ?? {}) as Record<string, unknown>).filter(([k]) => !APP_SET_FIELDS.includes(k)));
  out['required'] = ((schema['required'] ?? []) as string[]).filter((f) => !APP_SET_FIELDS.includes(f));
  return out;
}

export function buildPrompt(targetMonth: string, repairErrors?: string[]): string {
  const lines = [
    'あなたは日本の幼稚園・保育園の給食献立表（PDF）を読み取り、構造化データに書き起こす係です。',
    `対象月は ${targetMonth} です。見出しが令和表記（例: 令和8年11月）の場合は西暦に直して detectedMonth に入れてください。`,
    '',
    'You transcribe a Japanese school lunch menu PDF into the JSON schema provided. Rules:',
    '- Transcribe what is printed. Do not infer, translate, correct or add anything the PDF does not show.',
    '- One entry per printed date. Keep the printed date text and weekday exactly as printed (printedDateText, printedWeekday).',
    '- An item text is the dish name only. Do not copy a printed label or prefix such as おやつ：, 主菜：, 汁物：, デザート： into the text; use the item kind instead (おやつ is kind "snack").',
  '- A printed date with no dish and no printed reason (a blank or shaded cell, for example a public holiday with no text) is left out completely: no entry in days, none in noLunchDays. Every entry in days has at least one item.',
  '- Days marked as bento day (お弁当の日), no lunch (給食なし, 午前保育 etc.) go to noLunchDays with the original text.',
    '- The contract field must be exactly "extracted-menu/1".',
    '- If a field is not printed (for example ingredients), leave it out; never guess it from the dish name. When ingredientsStatus is not "listed", omit the ingredients key entirely (never an empty array).',
    '- Do not invent allergens. If the PDF lists no allergen information for a day, report the allergen declaration as not declared. Only say "declared none" when the PDF explicitly says so (例: アレルゲンなし).',
    '- If a reading is doubtful (blurry, partly legible, ambiguous), still give your best reading but set that field verification status to "uncertain" with a short reason. Otherwise use "ok". No other statuses.',
    '- Put every printed date, in any month, in days or noLunchDays (even an odd one such as a Saturday or a weekday that does not match) and leave outOfMonthDays as an empty array: the app sorts out-of-month dates itself.',
    '- If the document is not a lunch menu, return the schema with no days and no noLunchDays.',
    '- Answer with JSON only.',
  ];
  if (repairErrors !== undefined && repairErrors.length > 0) {
    lines.push('', `Your previous answer failed validation (${repairErrors.join(', ')}). Answer again with JSON that follows the schema exactly.`);
  }
  return lines.join('\n');
}
