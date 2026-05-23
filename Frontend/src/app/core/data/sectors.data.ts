import { Sector } from '../models/sector.model';

export const SECTORS: Sector[] = [
  { id: 'tech',       label: 'Tech',       icon: 'ti-code',                 bg: 'bg-blue-100',   text: 'text-blue-700' },
  { id: 'sante',      label: 'Santé',      icon: 'ti-stethoscope',          bg: 'bg-pink-100',   text: 'text-pink-600' },
  { id: 'btp',        label: 'BTP',        icon: 'ti-tools',                bg: 'bg-orange-100', text: 'text-orange-600' },
  { id: 'commerce',   label: 'Commerce',   icon: 'ti-shopping-cart',        bg: 'bg-violet-100', text: 'text-violet-700' },
  { id: 'hotel',      label: 'Hôtel.',     icon: 'ti-tools-kitchen-2',      bg: 'bg-amber-100',  text: 'text-amber-700' },
  { id: 'transport',  label: 'Transport',  icon: 'ti-truck',                bg: 'bg-emerald-100',text: 'text-emerald-700' },
  { id: 'industrie',  label: 'Industrie',  icon: 'ti-building-factory-2',   bg: 'bg-gray-100',   text: 'text-gray-700' },
  { id: 'com',        label: 'Com.',       icon: 'ti-palette',              bg: 'bg-pink-100',   text: 'text-pink-600' },
  { id: 'agri',       label: 'Agri.',      icon: 'ti-plant-2',              bg: 'bg-lime-100',   text: 'text-lime-700' },
  { id: 'banque',     label: 'Banque',     icon: 'ti-building-bank',        bg: 'bg-blue-100',   text: 'text-blue-700' },
  { id: 'educ',       label: 'Éduc.',      icon: 'ti-school',               bg: 'bg-violet-100', text: 'text-violet-700' },
  { id: 'arts',       label: 'Arts',       icon: 'ti-masks-theater',        bg: 'bg-orange-100', text: 'text-orange-600' },
  { id: 'services',   label: 'Services',   icon: 'ti-heart-handshake',      bg: 'bg-emerald-100',text: 'text-emerald-700' },
  { id: 'maint',      label: 'Maint.',     icon: 'ti-wrench',               bg: 'bg-amber-100',  text: 'text-amber-700' },
];