export const CHECKIN_STEPS = ['Planned', 'Journey active', 'Grace period', 'Contact alerted', 'Arrived'];

export const SAFETY_CHECKLIST = [
  'Charge your phone and carry a power bank',
  'Create an outing and let friends opt in',
  'Pick your return-home plan',
  'Save 999 and 112 as favourites',
  'Try holding SOS for three seconds, once, in daylight',
];

export const SAFETY_HELPLINES = [
  { number: '999', label: 'Call 999', desc: 'National emergency number.', icon: 'siren', kind: 'sos' },
  { number: '112', label: 'Call 112', desc: 'Emergency from any mobile phone.', icon: 'phone', kind: 'pri' },
  { number: '1195', label: '1195', desc: 'Gender violence helpline.', icon: 'heart', kind: 'default' },
  { number: '116', label: '116', desc: 'Child helpline.', icon: 'shield', kind: 'default' },
];

// ─── Sheng + Swahili safety lexicon ───
// Editable in one place. Add new phrases as Sheng evolves.
// Each entry: { phrase, meaning, category, option, urgency }
//   option: 1 = friend, 2 = share + help, 3 = transport, 0 = unsure → support
export const SHENG_LEXICON = [
  // ── Danger / help (option 2) ──
  { phrase: 'si poa', meaning: 'not okay / unsafe', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'siko sawa', meaning: 'I am not okay', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'noma', meaning: 'trouble / problem', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'ngori', meaning: 'trouble', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'nisaidie', meaning: 'help me', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'msaada', meaning: 'help', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'naogopa', meaning: 'I am scared', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'ninahisi vibaya', meaning: 'I feel bad / unwell', category: 'danger', option: 2, urgency: 'medium' },
  { phrase: 'amenichukua', meaning: 'he/she took me', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'nataka kutoka', meaning: 'I want to leave', category: 'exit', option: 2, urgency: 'medium' },
  { phrase: 'chapa', meaning: 'run / leave fast', category: 'exit', option: 2, urgency: 'high' },
  { phrase: 'sepa', meaning: 'leave / go away', category: 'exit', option: 2, urgency: 'high' },
  { phrase: 'toka', meaning: 'get out', category: 'exit', option: 2, urgency: 'medium' },
  { phrase: 'sijui niko wapi', meaning: "I don't know where I am", category: 'lost', option: 2, urgency: 'high' },
  { phrase: 'nimepotea', meaning: 'I am lost', category: 'lost', option: 2, urgency: 'high' },
  { phrase: 'nataka msaada', meaning: 'I want help', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'saidia', meaning: 'help', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'sitaki kuwa hapa', meaning: "I don't want to be here", category: 'danger', option: 2, urgency: 'medium' },
  { phrase: 'niko na shida', meaning: 'I have a problem', category: 'danger', option: 2, urgency: 'medium' },
  { phrase: 'wapi polisi', meaning: 'where is police', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'naiogopa', meaning: 'I fear them', category: 'danger', option: 2, urgency: 'medium' },
  { phrase: 'aliniibia', meaning: 'he/she robbed me', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'amenishika', meaning: 'he/she grabbed me', category: 'danger', option: 2, urgency: 'high' },
  { phrase: 'niko chini ya kitanda', meaning: 'I am under the bed (hiding)', category: 'danger', option: 2, urgency: 'high' },

  // ── Safe (option 1, low urgency) ──
  { phrase: 'niko poa', meaning: 'I am okay', category: 'safe', option: 1, urgency: 'none' },
  { phrase: 'niko sawa', meaning: 'I am fine', category: 'safe', option: 1, urgency: 'none' },
  { phrase: 'nimefika', meaning: 'I have arrived', category: 'safe', option: 1, urgency: 'none' },

  // ── Transport / going home (option 3) ──
  { phrase: 'nataka kwenda nyumbani', meaning: 'I want to go home', category: 'transport', option: 3, urgency: 'low' },
  { phrase: 'nataka nyumbani', meaning: 'I want home', category: 'transport', option: 3, urgency: 'low' },
  { phrase: 'naenda nyumbani', meaning: 'I am going home', category: 'transport', option: 3, urgency: 'low' },
  { phrase: 'nyumbani', meaning: 'home', category: 'destination', option: 3, urgency: 'low' },
  { phrase: 'nataka uber', meaning: 'I want an Uber', category: 'transport', option: 3, urgency: 'low' },
  { phrase: 'nataka bolt', meaning: 'I want Bolt', category: 'transport', option: 3, urgency: 'low' },
  { phrase: 'nataka taxi', meaning: 'I want a taxi', category: 'transport', option: 3, urgency: 'low' },
  { phrase: 'gari', meaning: 'car / vehicle', category: 'transport', option: 3, urgency: 'low' },
  { phrase: 'ndai', meaning: 'vehicle', category: 'transport', option: 3, urgency: 'low' },
  { phrase: 'naenda', meaning: 'I am leaving', category: 'transport', option: 3, urgency: 'low' },

  // ── Low urgency contact friend (option 1) ──
  { phrase: 'niko hapa', meaning: 'I am here', category: 'contact', option: 1, urgency: 'low' },
  { phrase: 'call me', meaning: 'call me', category: 'contact', option: 1, urgency: 'low' },
  { phrase: 'nipigie', meaning: 'call me', category: 'contact', option: 1, urgency: 'low' },
  { phrase: 'niambie', meaning: 'tell me', category: 'contact', option: 1, urgency: 'low' },
  { phrase: 'uko wapi', meaning: 'where are you', category: 'contact', option: 1, urgency: 'low' },

  // ── Context words (do not classify alone) ──
  { phrase: 'msee', meaning: 'person / guy', category: 'context', option: 0, urgency: 'none' },
  { phrase: 'dame', meaning: 'girl / woman', category: 'context', option: 0, urgency: 'none' },
  { phrase: 'buda', meaning: 'father / older man', category: 'context', option: 0, urgency: 'none' },
  { phrase: 'chapaa', meaning: 'money', category: 'context', option: 0, urgency: 'none' },
  { phrase: 'mtaa', meaning: 'neighbourhood / street', category: 'context', option: 0, urgency: 'none' },
];

// ── Check-in templates with support line ──
export const CHECKIN_TEMPLATES = {
  en: (n) => `Hi ${n}, are you home safe? Can you confirm you’re okay? Tap to let your friends know. If something isn’t right, reply “help” or tap Talk to support.`,
  sw: (n) => `Habari ${n}, umefika nyumbani salama? Tafadhali thibitisha ili marafiki zako wajue uko sawa. Kama kuna shida, jibu “msaada” au gusa Talk to support.`,
  sh: (n) => `Niaje ${n}, uko poa? Unaeza confirm uko sawa? Gonga marafiki wajue. Kama kuna noma, jibu “msaada” ama gonga Talk to support.`,
};

export const LANG_LABELS = { en: 'English', sw: 'Kiswahili', sh: 'Sheng' };

export const COPILOT_DRAFTS = {
  1: 'Hey, can you call me or come find me? Keep it casual.',
  2: 'I need help. Please call me or come to my location now.',
  3: 'Can you follow my trip home? I am leaving now.',
};