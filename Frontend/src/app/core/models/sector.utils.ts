import { SECTOR_LABELS, SectorType } from './candidate';

/** Icône (tracé SVG 24×24, trait) associée à chaque secteur de l'enum Java SectorType */
export const SECTOR_ICONS: Record<string, string> = {
  TECH: 'M3 5h18v11H3z M8 20h8 M12 16v4',
  HEALTH: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z M9.5 11h5 M12 8.5v5',
  COMMERCE: 'M5 8h14l-1 12H6z M9 8V6a3 3 0 016 0v2',
  BTP: 'M3 18h18 M5 18v-3a7 7 0 0114 0v3 M10 8.5V5h4v3.5',
  HOSPITALITY: 'M7 3v7a2 2 0 002 2v9 M11 3v7a2 2 0 01-2 2 M17 3c-2 1.5-2.5 6 0 8v10',
  TRANSPORT: 'M3 6h11v10H3z M14 9h4l3 3.5V16h-7 M5.5 18a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z M15.5 18a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z',
  INDUSTRY: 'M3 20V10l5 3v-3l5 3V5h4v15z M3 20h18 M20 20V9',
  COMMUNICATION: 'M4 10v4h3l7 4V6l-7 4z M17.5 9a4 4 0 010 6',
  AGRICULTURE: 'M5 19C5 10 11 5 19 5c0 8-5 14-14 14z M5 19l7-7',
  BANKING: 'M3 10l9-6 9 6 M5 10v8 M9.5 10v8 M14.5 10v8 M19 10v8 M3 20h18',
  EDUCATION: 'M2 9l10-5 10 5-10 5z M6 11v5c3 2 9 2 12 0v-5',
  ARTS: 'M9 18V6l10-2v12 M5 18a2 2 0 104 0 2 2 0 00-4 0z M15 16a2 2 0 104 0 2 2 0 00-4 0z',
  PERSONAL_SERVICES: 'M9 11a3 3 0 100-6 3 3 0 000 6z M3 20a6 6 0 0112 0 M16 5.5a2.5 2.5 0 010 5 M21 20a5 5 0 00-3.5-4.8',
  MAINTENANCE: 'M14.5 4a5 5 0 00-4.6 6.9L3 17.8V21h3.2l6.9-6.9A5 5 0 0019.9 8l-3 3-2.9-.9-.9-2.9 3-3a5 5 0 00-1.6-.2z',
  OTHER: 'M5 5h5v5H5z M14 5h5v5h-5z M5 14h5v5H5z M14 14h5v5h-5z',
};

/** Retrouve le code enum à partir d'un code ("TECH") ou d'un libellé ("Informatique / Tech") */
export function sectorCode(sector?: string | null): string | null {
  if (!sector) return null;
  if (sector in SECTOR_LABELS) return sector;
  const match = Object.entries(SECTOR_LABELS).find(
    ([, label]) => label.toLowerCase() === sector.toLowerCase()
  );
  return match ? match[0] : null;
}

/** Tracé SVG de l'icône du secteur (icône « Autre » par défaut) */
export function sectorIcon(sector?: string | null): string {
  const code = sectorCode(sector);
  return (code && SECTOR_ICONS[code]) || SECTOR_ICONS['OTHER'];
}
/** Retire les emojis et espaces en début de libellé ("💻 Informatique / Tech" → "Informatique / Tech") */
export function cleanLabel(label: string): string {
  return label.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/u, '').trim();
}

/** Libellé lisible du secteur ("TECH" → "Informatique / Tech") */
export function sectorLabel(sector?: string | null): string {
  if (!sector) return '';
  const code = sectorCode(sector);
  return code ? SECTOR_LABELS[code as SectorType] : sector;
}