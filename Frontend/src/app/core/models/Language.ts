/** Niveaux CECRL + langue maternelle (mêmes codes que l'enum Java LanguageLevel) */
export type LanguageLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'NATIVE';

/** Une langue du candidat, envoyée et reçue telle quelle : { code: 'en', level: 'B2' } */
export interface CandidateLanguage {
  code: string;
  level: LanguageLevel;
}

export interface LanguageOption {
  code: string;
  label: string;
}

export interface LevelOption {
  code: LanguageLevel;
  shortLabel: string;
  label: string;
  description: string;
  rank: number;
}

export interface LanguageReference {
  languages: LanguageOption[];
  levels: LevelOption[];
  maxPerCandidate: number;
}

/**
 * Valeurs de secours si GET /api/languages ne répond pas.
 * La source de référence reste LanguageCatalog.java côté backend.
 */
export const FALLBACK_LANGUAGE_REFERENCE: LanguageReference = {
  maxPerCandidate: 10,
  levels: [
    { code: 'A1', shortLabel: 'A1', label: 'Débutant', description: 'Comprend et utilise des expressions simples du quotidien', rank: 1 },
    { code: 'A2', shortLabel: 'A2', label: 'Élémentaire', description: 'Communique lors de tâches simples et habituelles', rank: 2 },
    { code: 'B1', shortLabel: 'B1', label: 'Intermédiaire', description: 'Se débrouille dans la plupart des situations courantes', rank: 3 },
    { code: 'B2', shortLabel: 'B2', label: 'Avancé', description: 'Communique avec aisance, y compris dans un cadre professionnel', rank: 4 },
    { code: 'C1', shortLabel: 'C1', label: 'Autonome', description: "S'exprime couramment et avec précision sur des sujets complexes", rank: 5 },
    { code: 'C2', shortLabel: 'C2', label: 'Maîtrise', description: "Comprend et s'exprime sans effort, avec nuance", rank: 6 },
    { code: 'NATIVE', shortLabel: 'Natif', label: 'Langue maternelle', description: "Langue parlée depuis l'enfance", rank: 7 },
  ],
  languages: [
    { code: 'fr', label: 'Français' }, { code: 'en', label: 'Anglais' }, { code: 'ar', label: 'Arabe' },
    { code: 'es', label: 'Espagnol' }, { code: 'de', label: 'Allemand' }, { code: 'it', label: 'Italien' },
    { code: 'pt', label: 'Portugais' }, { code: 'nl', label: 'Néerlandais' }, { code: 'zh', label: 'Chinois (mandarin)' },
    { code: 'ru', label: 'Russe' }, { code: 'tr', label: 'Turc' }, { code: 'ber', label: 'Berbère / Amazigh' },
  ],
};