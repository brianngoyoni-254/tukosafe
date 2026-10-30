import { SHENG_LEXICON } from '../data/dummy';

// ─── Tokenise the input for matching ───
function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Score a lexicon entry against input ───
// Returns 1.0 for an exact substring match, 0.8 if all words present, 0 otherwise.
function score(phrase, input) {
  if (input.includes(phrase)) return 1.0;
  const words = phrase.split(' ');
  if (words.length > 1 && words.every((w) => input.split(' ').includes(w))) return 0.8;
  return 0;
}

// ─── Classify Get Me Home input ───
// Returns { option: 0..3, confidence: 'high'|'low', source, matchedPhrase?, meaning?, reasoning }
export function classifyGetMeHome(rawText) {
  const input = normalise(rawText || '');
  if (!input) {
    return {
      option: 0,
      confidence: 'low',
      source: 'none',
      reasoning: 'Empty input.',
      supportAvailable: true,
    };
  }

  // Score every lexicon entry, keep the best
  let best = null;
  for (const entry of SHENG_LEXICON) {
    const s = score(entry.phrase, input);
    if (s > 0 && (!best || s > best.score)) {
      best = { ...entry, score: s };
    }
  }

  if (best && best.option > 0) {
    return {
      option: best.option,
      confidence: best.score >= 0.8 ? 'high' : 'low',
      source: 'lexicon',
      matchedPhrase: best.phrase,
      meaning: best.meaning,
      reasoning: `Matched Sheng phrase “${best.phrase}” (${best.meaning}).`,
    };
  }

  // Fallback English keyword rules
  const englishRules = [
    { re: /(help|danger|scared|hurt|attack|unsafe|sos|follow)/, option: 2, label: 'danger' },
    { re: /(home|uber|bolt|taxi|ride|transport|leave)/, option: 3, label: 'transport' },
    { re: /(call|meet|find|where)/, option: 1, label: 'contact' },
  ];
  for (const r of englishRules) {
    if (r.re.test(input)) {
      return {
        option: r.option,
        confidence: 'high',
        source: 'keyword',
        reasoning: `Matched English keyword for ${r.label}.`,
      };
    }
  }

  // Nothing matched → support fallback
  return {
    option: 0,
    confidence: 'low',
    source: 'none',
    reasoning: 'Could not confidently understand the message.',
    supportAvailable: true,
  };
}

// ─── Draft a discrete message for the chosen option ───
export function draftMessage(option, { name = 'your friend' } = {}) {
  const drafts = {
    1: `Hey ${name}, can you call me or come find me? Keep it casual.`,
    2: `I need help. Please call me or come to my location now.`,
    3: `Can you follow my trip home? I am leaving now.`,
  };
  return drafts[option] || '';
}

// ─── Situation Brief (with validator + template fallback) ───
// Uses the same fixed facts as before. No LLM. Just cleaner structure.
export function buildSituationBrief(facts, { aiEnabled = true, aiFail = false } = {}) {
  const template =
    `ALERT: ${facts.name} missed a check-in. Last location: ${facts.location}, ${facts.time}. ` +
    `Battery ${facts.battery}%. Call ${facts.name} first. If you believe they are in danger, call 999 or 112.`;

  if (!aiEnabled) {
    return { text: template, ai: false, why: 'AI Situation Brief is switched off.' };
  }

  // Composed wording, same facts, more human
  let text =
    `${facts.name} hasn’t confirmed arrival yet. This may be a dead battery or poor signal. ` +
    `Last known location: ${facts.location}, ${facts.time}; battery was ${facts.battery}%. ` +
    `Trips home usually take about ${facts.usualTrip} minutes. ` +
    `Please try calling ${facts.name} first. If you believe ${facts.name} is in danger, call 999 or 112.`;

  // Simulated failure mode (used by Trust Panel test)
  if (aiFail) text = text.replace(facts.location, 'Kilimani');

  // Validator — every fact must appear verbatim
  const required = [
    facts.name,
    facts.location,
    facts.time,
    `${facts.battery}%`,
    `${facts.usualTrip} minutes`,
    '999 or 112',
    'dead battery',
  ];
  const ok = required.every((x) => text.includes(x));

  return ok
    ? { text, ai: true, why: null }
    : {
        text: template,
        ai: false,
        why: 'The validator found a fact that did not match, so a template alert was used.',
      };
}

// ─── Local support reference ───
export function createSupportReference() {
  return `SUP-${Date.now().toString(36).toUpperCase()}`;
}