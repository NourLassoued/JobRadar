/**
 * SectorType Enum — Aligné avec le backend Java
 * src/app/models/sector-type.enum.ts
 */

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
 * Metadata pour chaque secteur
 * Aligné avec displayName du backend Java
 */
export const SECTOR_METADATA: Record<SectorType, { displayName: string; icon: string }> = {
  [SectorType.TECH]: {
    displayName: 'Informatique / Tech',
    icon: '💻',
  },
  [SectorType.HEALTH]: {
    displayName: 'Santé / Médical',
    icon: '🏥',
  },
  [SectorType.COMMERCE]: {
    displayName: 'Commerce / Vente',
    icon: '🛍️',
  },
  [SectorType.BTP]: {
    displayName: 'BTP / Construction',
    icon: '🏗️',
  },
  [SectorType.HOSPITALITY]: {
    displayName: 'Hôtellerie / Restauration',
    icon: '🏨',
  },
  [SectorType.TRANSPORT]: {
    displayName: 'Transport / Logistique',
    icon: '🚚',
  },
  [SectorType.INDUSTRY]: {
    displayName: 'Industrie',
    icon: '🏭',
  },
  [SectorType.COMMUNICATION]: {
    displayName: 'Communication',
    icon: '📢',
  },
  [SectorType.AGRICULTURE]: {
    displayName: 'Agriculture',
    icon: '🌾',
  },
  [SectorType.BANKING]: {
    displayName: 'Banque / Assurance',
    icon: '💰',
  },
  [SectorType.EDUCATION]: {
    displayName: 'Éducation / Formation',
    icon: '📚',
  },
  [SectorType.ARTS]: {
    displayName: 'Arts / Spectacle',
    icon: '🎭',
  },
  [SectorType.PERSONAL_SERVICES]: {
    displayName: 'Services à la personne',
    icon: '👤',
  },
  [SectorType.MAINTENANCE]: {
    displayName: 'Maintenance',
    icon: '🔧',
  },
  [SectorType.OTHER]: {
    displayName: 'Autre',
    icon: '🎯',
  },
};

/**
 * Utilitaires
 */
export class SectorTypeUtils {
  /**
   * Récupérer le displayName avec emoji
   * Ex: TECH → "💻 Informatique / Tech"
   */
  static getLabel(sector: SectorType | string | null | undefined): string {
    if (!sector || sector === '') {
      return 'Non défini';
    }
    const metadata = SECTOR_METADATA[sector as SectorType];
    if (!metadata) {
      return 'Non défini';
    }
    return `${metadata.icon} ${metadata.displayName}`;
  }

  /**
   * Récupérer juste le displayName
   * Ex: TECH → "Informatique / Tech"
   */
  static getDisplayName(sector: SectorType | string | null | undefined): string {
    if (!sector || sector === '') {
      return 'Non défini';
    }
    const metadata = SECTOR_METADATA[sector as SectorType];
    return metadata?.displayName || 'Non défini';
  }

  /**
   * Récupérer juste l'emoji
   * Ex: TECH → "💻"
   */
  static getIcon(sector: SectorType | string | null | undefined): string {
    if (!sector || sector === '') {
      return '🎯';
    }
    const metadata = SECTOR_METADATA[sector as SectorType];
    return metadata?.icon || '🎯';
  }

  /**
   * Get all sectors as options
   * Retourne: [{ value: 'TECH', label: '💻 Informatique / Tech' }, ...]
   */
  static getAllOptions(): Array<{ value: SectorType; label: string }> {
    return Object.values(SectorType).map(sector => ({
      value: sector as SectorType,
      label: this.getLabel(sector),
    }));
  }

  /**
   * Check if sector is valid
   */
  static isValid(sector: string | null | undefined): sector is SectorType {
    return sector !== null && sector !== undefined && Object.values(SectorType).includes(sector as SectorType);
  }

  /**
   * Get sortable sectors (exclude OTHER which is last)
   */
  static getSortedSectors(): SectorType[] {
    const sectors = Object.values(SectorType) as SectorType[];
    return sectors.sort((a, b) => {
      if (a === SectorType.OTHER) return 1;
      if (b === SectorType.OTHER) return -1;
      return this.getDisplayName(a).localeCompare(this.getDisplayName(b), 'fr-FR');
    });
  }

  /**
   * Get grouped sectors by category (optionnel)
   */
  static getGroupedOptions(): Array<{ group: string; sectors: Array<{ value: SectorType; label: string }> }> {
    return [
      {
        group: 'IT & Tech',
        sectors: [SectorType.TECH, SectorType.COMMUNICATION].map(s => ({
          value: s,
          label: this.getLabel(s),
        })),
      },
      {
        group: 'Business & Finance',
        sectors: [SectorType.COMMERCE, SectorType.BANKING].map(s => ({
          value: s,
          label: this.getLabel(s),
        })),
      },
      {
        group: 'Construction & Industry',
        sectors: [SectorType.BTP, SectorType.INDUSTRY, SectorType.MAINTENANCE].map(s => ({
          value: s,
          label: this.getLabel(s),
        })),
      },
      {
        group: 'Services',
        sectors: [SectorType.HOSPITALITY, SectorType.TRANSPORT, SectorType.PERSONAL_SERVICES].map(s => ({
          value: s,
          label: this.getLabel(s),
        })),
      },
      {
        group: 'Social & Education',
        sectors: [SectorType.HEALTH, SectorType.EDUCATION, SectorType.AGRICULTURE].map(s => ({
          value: s,
          label: this.getLabel(s),
        })),
      },
      {
        group: 'Creative',
        sectors: [SectorType.ARTS].map(s => ({
          value: s,
          label: this.getLabel(s),
        })),
      },
      {
        group: 'Other',
        sectors: [SectorType.OTHER].map(s => ({
          value: s,
          label: this.getLabel(s),
        })),
      },
    ];
  }
}