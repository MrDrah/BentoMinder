import { modelResponseSchema } from '../../../server/menu/gemini-prompt.ts';
const s = modelResponseSchema();
console.log(JSON.stringify(s).length);
console.log(JSON.stringify(s.properties.contract), JSON.stringify(s.properties.outOfMonthDays), JSON.stringify(s.properties.days.items.properties.ingredients), JSON.stringify(s.properties.days.items.required));
