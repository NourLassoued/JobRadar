import { CandidateLanguage } from "./Language";

export enum SectorType {
  TECH = 'TECH',
  HEALTH = 'HEALTH',
  COMMERCE = 'COMMERCE',
  BTP = 'BTP',
  HOSPITALITY = 'HOSPITALITY',
  TRANSPORT = 'TRANSPORT',
  INDUSTRY = 'INDUSTRY',
  COMMUNICATION = 'COMMUNICATION',
  AGRICULTURE = 'AGRICULTURE',
  BANKING = 'BANKING',
  EDUCATION = 'EDUCATION',
  ARTS = 'ARTS',
  PERSONAL_SERVICES = 'PERSONAL_SERVICES',
  MAINTENANCE = 'MAINTENANCE',
  OTHER = 'OTHER',
}

/**
 * Libellés avec emojis. Pour l'affichage sans emoji (profil, liste des offres…),
 * utiliser sectorLabel() ou cleanLabel() de sector.utils.ts.
 */
export const SECTOR_LABELS: Record<SectorType, string> = {
  [SectorType.TECH]: '💻 Informatique / Tech',
  [SectorType.HEALTH]: '🏥 Santé / Médical',
  [SectorType.COMMERCE]: '🛍️ Commerce / Vente',
  [SectorType.BTP]: '🏗️ BTP / Construction',
  [SectorType.HOSPITALITY]: '🏨 Hôtellerie / Restauration',
  [SectorType.TRANSPORT]: '🚚 Transport / Logistique',
  [SectorType.INDUSTRY]: '🏭 Industrie',
  [SectorType.COMMUNICATION]: '📢 Communication',
  [SectorType.AGRICULTURE]: '🌾 Agriculture',
  [SectorType.BANKING]: '💰 Banque / Assurance',
  [SectorType.EDUCATION]: '📚 Éducation / Formation',
  [SectorType.ARTS]: '🎭 Arts / Spectacle',
  [SectorType.PERSONAL_SERVICES]: '👤 Services à la personne',
  [SectorType.MAINTENANCE]: '🔧 Maintenance',
  [SectorType.OTHER]: '🎯 Autre',
};

/** Retire l'emoji de tête : « 💻 Informatique / Tech » → « Informatique / Tech » (pour le tri) */
const withoutEmoji = (label: string): string =>
  label.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/u, '').trim();

/** Options triées par ordre alphabétique (sans tenir compte des emojis), « Autre » en dernier */
export const SECTOR_OPTIONS_SORTED: Array<{ value: SectorType; label: string }> = (() => {
  const options = Object.entries(SECTOR_LABELS).map(([key, label]) => ({
    value: key as SectorType,
    label,
  }));

  const otherOption = options.find(opt => opt.value === SectorType.OTHER);
  const nonOtherOptions = options
    .filter(opt => opt.value !== SectorType.OTHER)
    .sort((a, b) => withoutEmoji(a.label).localeCompare(withoutEmoji(b.label), 'fr-FR'));

  return otherOption ? [...nonOtherOptions, otherOption] : nonOtherOptions;
})();

export function getSectorLabel(sector?: SectorType | string | null): string {
  if (!sector) return 'Non défini';
  return SECTOR_LABELS[sector as SectorType] || 'Non défini';
}

export interface Candidate {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  city?: string;
  sector?: SectorType;
  yearsOfExperience?: number;
  skills?: string[];
  /** Langues parlées : [{ code: 'fr', level: 'NATIVE' }, { code: 'en', level: 'B2' }] */
  languages?: CandidateLanguage[];
  bio?: string;
  expectedSalary?: number;
  remotePreference?: boolean;
  cvUrl?: string;
  linkedinUrl?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  profileImageUrl?: string;
}

export interface CandidateRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  city?: string;
  sector?: SectorType;
  yearsOfExperience?: number;
  skills?: string[];
  /** Envoyé même vide, pour pouvoir retirer toutes les langues */
  languages?: CandidateLanguage[];
  bio?: string;
  expectedSalary?: number;
  remotePreference?: boolean;
  cvUrl?: string;
  profileImageUrl?: string;
  linkedinUrl?: string;
}

export interface CandidateResponse extends Candidate {
  id: number;
  createdAt: string;
  updatedAt: string;
  profileImageUrl?: string;
}