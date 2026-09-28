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
  OTHER = 'OTHER'
}

// ✅ AVEC EMOJIS
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
  [SectorType.OTHER]: '🎯 Autre'
};

// ✅ NOUVEAU — C'EST CE QUE LE SELECT VA AFFICHER!
export const SECTOR_OPTIONS_SORTED: Array<{ value: SectorType; label: string }> = (() => {
  const options = Object.entries(SECTOR_LABELS).map(([key, label]) => ({
    value: key as SectorType,
    label: label,
  }));

  const otherOption = options.find(opt => opt.value === SectorType.OTHER);
  const nonOtherOptions = options.filter(opt => opt.value !== SectorType.OTHER);

  nonOtherOptions.sort((a, b) => a.label.localeCompare(b.label, 'fr-FR'));

  return otherOption ? [...nonOtherOptions, otherOption] : nonOtherOptions;
})();

// ✅ FONCTION UTILITAIRE
export function getSectorLabel(sector?: SectorType | string | null): string {
  if (!sector || sector === '') {
    return 'Non défini';
  }
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
  skills?: string;
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
  skills?: string;
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