import { AI_FACTS } from '../data/dummy';

export const CHECKIN_TEMPLATES = {
  en: (n) => `Hi ${n}, are you home safe? Can you confirm you’re okay? Tap to let your friends know.`,
  sw: (n) => `Habari ${n}, umefika nyumbani salama? Tafadhali thibitisha ili marafiki zako wajue uko sawa.`,
  sh: (n) => `Niaje ${n}, uko poa? Unaeza confirm uko sawa? Gonga marafiki wajue.`,
};

export const LANG_LABELS = { en: 'English', sw: 'Kiswahili', sh: 'Sheng' };

export function buildSituationBrief({ aiEnabled = true, aiFail = false } = {}) {
  const f = AI_FACTS;
  const template =
    `ALERT: ${f.name} missed a check-in. Last location: ${f.lastLocationLabel}, ${f.lastLocationTime}. ` +
    `Battery ${f.battery}%. Call ${f.name} first. If you believe they are in danger, call 999 or 112.`;

  if (!aiEnabled) return { text: template, ai: false, why: 'AI Situation Brief is switched off.' };

  let text =
    `${f.name} hasn’t confirmed arrival yet. This may be a dead battery or poor signal. ` +
    `Last known location: ${f.lastLocationLabel}, ${f.lastLocationTime}; battery was ${f.battery}%. ` +
    `Trips home usually take about ${f.usualTripMinutes} minutes. ` +
    `Please try calling ${f.name} first. If you believe ${f.name} is in danger, call 999 or 112.`;

  if (aiFail) text = text.replace(f.lastLocationLabel, 'Kilimani');

  const required = [
    f.name, f.lastLocationLabel, f.lastLocationTime,
    `${f.battery}%`, `${f.usualTripMinutes} minutes`, '999 or 112', 'dead battery',
  ];
  const ok = required.every((x) => text.includes(x));

  return ok
    ? { text, ai: true, why: null }
    : { text: template, ai: false, why: 'The validator found a fact that did not match, so a template alert was used.' };
}

export function copilotClassify(input) {
  const t = (input || '').toLowerCase();
  if (/(follow|threat|drug|drunk|hurt|danger|sos|help me|attack|si poa)/.test(t)) return 2;
  if (/(ride|uber|transport|home|bolt|taxi|nyumbani)/.test(t)) return 3;
  return 1;
}

export const COPILOT_DRAFTS = {
  1: 'Hey, can you call me or come find me? Keep it casual.',
  2: 'I need help. Please call me or come to my location now.',
  3: 'Can you follow my trip home? I am leaving now.',
};