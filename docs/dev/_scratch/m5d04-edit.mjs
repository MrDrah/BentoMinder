import fs from 'node:fs';
const ed=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
const rep=(s,a,b)=>{ if(!s.includes(a)) throw new Error('missing '+a.slice(0,40)); return s.replace(a,b); };
ed('src/domain/reminders/plan.ts',s=>{
 s=rep(s,"  horizonDays?: number;\n}\n\nexport interface PlanResult","  horizonDays?: number;\n  /** US-E7-05 (M5-D04): reminders due before this instant (the profile's creation) are never planned, not even as missed. */\n  notBefore?: Instant | undefined;\n}\n\nexport interface PlanResult");
 return rep(s,".filter((j) => j.expiresAt > now && !dismissed.has(j.key))",".filter((j) => j.expiresAt > now && !dismissed.has(j.key) && (input.notBefore === undefined || j.dueAt >= input.notBefore))");});
ed('src/domain/calendar/reminder-days.ts',s=>rep(s,"    horizonDays: env.horizonDays ?? REMINDER_HORIZON_DAYS.web,\n  });","    horizonDays: env.horizonDays ?? REMINDER_HORIZON_DAYS.web,\n    // US-E7-05 (M5-D04): nothing due before the profile existed; without a profile record, today's behaviour.\n    notBefore: store.profile !== null ? (Date.parse(store.profile.createdAt) as Instant) : undefined,\n  });"));
ed('server/index.ts',s=>rep(s,"|| 'gemini-3.8-flash',\n    fallbackModel: env['GEMINI_MODEL_FALLBACK'] || 'gemini-3.5-flash-lite',","|| 'gemini-3.5-flash-lite',\n    fallbackModel: env['GEMINI_MODEL_FALLBACK'] || 'gemini-3.8-flash',"));
ed('tests/unit/server/health.test.ts',s=>rep(rep(s,"primaryModel).toBe('gemini-3.8-flash')","primaryModel).toBe('gemini-3.5-flash-lite')"),"fallbackModel).toBe('gemini-3.5-flash-lite')","fallbackModel).toBe('gemini-3.8-flash')"));
