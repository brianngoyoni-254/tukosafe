import {
  LuHouse, LuMap, LuUsers, LuMessageCircle, LuLifeBuoy,
  LuBookOpen, LuShieldCheck, LuInfo, LuCircleAlert,
} from 'react-icons/lu';

export const PRIMARY_NAV = [
  { to: '/', label: 'Home', icon: LuHouse },
  { to: '/how', label: 'How it works', icon: LuBookOpen },
  { to: '/map', label: 'Live map', icon: LuMap },
  { to: '/outing', label: 'Outing', icon: LuUsers },
  { to: '/checkin', label: 'Check-in', icon: LuMessageCircle },
  { to: '/help', label: 'Get help', icon: LuLifeBuoy },
];

export const SECONDARY_NAV = [
  { to: '/contacts', label: 'Contacts', icon: LuUsers },
  { to: '/contact', label: 'Contact view', icon: LuCircleAlert },
  { to: '/trust', label: 'Trust Panel', icon: LuShieldCheck },
  { to: '/safety', label: 'Safety', icon: LuShieldCheck },
  { to: '/about', label: 'About', icon: LuInfo },
];

// Below this width the centre navigation collapses into the mobile menu.
export const NAV_BREAKPOINT = 1240;
