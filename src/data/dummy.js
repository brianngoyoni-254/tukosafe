export const USER = { name: 'Wanjiru', phone: '+254700000000', locale: 'en' };

export const CONTACTS = [
  { id: 1, name: 'Brian', joined: true, toldFirst: true, avatar: 'B' },
  { id: 2, name: 'Achieng', joined: false, toldFirst: false, avatar: 'A' },
  { id: 3, name: 'Kevin', joined: true, toldFirst: false, avatar: 'K' },
];

export const OUTING = {
  id: 'out_1',
  title: 'Concert at Uhuru Gardens',
  venue: 'Uhuru Gardens, Nairobi',
  startsAt: 'Today, 7 PM',
  endsAt: 'Today, 2 AM',
  returnPlan: { departure: '1:30 AM by Uber', homeEta: '2:05 AM', notify: 'Brian' },
  expiresInHours: 4,
};

export const MEMBERS = [
  { id: 'me', name: 'Wanjiru', you: true, consent: true, east: 0, north: 0 },
  { id: 'brian', name: 'Brian', consent: true, east: -260, north: -150 },
  { id: 'achieng', name: 'Achieng', consent: false, east: 140, north: 90 },
];

export const DEMO_POSITION = { lat: -1.2864, lng: 36.8172, accuracy: 40, heading: 35 };

export const CHECKIN_STEPS = ['Scheduled', 'Reminder sent', 'Grace period', 'Contact alerted', 'Resolved'];

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

export const AI_FACTS = {
  name: 'Wanjiru',
  lastLocationLabel: 'Westlands',
  lastLocationTime: '1:42 AM',
  battery: 8,
  usualTripMinutes: 35,
};