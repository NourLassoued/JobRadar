/** Étapes d'une candidature (enum Java ApplicationStatus) */
export type ApplicationStatus =
  | 'TO_APPLY'
  | 'APPLIED'
  | 'UNDER_REVIEW'
  | 'INTERVIEW'
  | 'ASSESSMENT'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface BoardColumn {
  status: ApplicationStatus;
  /** Libellé de la colonne */
  label: string;
  /** Nom anglais (Saved, Applied…) affiché en info-bulle */
  english: string;
  /** Phrase d'aide affichée quand la colonne est vide */
  hint: string;
  icon: string;
}

/** Colonnes du Kanban, dans l'ordre. HIRED n'a pas de colonne : il s'affiche dans « Offre ». */
export const BOARD_COLUMNS: BoardColumn[] = [
  { status: 'TO_APPLY', label: 'Enregistrées', english: 'Saved', hint: 'Offres gardées de côté, pas encore envoyées.', icon: 'ti-bookmark' },
  { status: 'APPLIED', label: 'Envoyées', english: 'Applied', hint: 'Candidatures envoyées.', icon: 'ti-send' },
  { status: 'UNDER_REVIEW', label: 'En examen', english: 'Under review', hint: 'Le recruteur étudie votre profil.', icon: 'ti-eye' },
  { status: 'INTERVIEW', label: 'Entretien', english: 'Interview', hint: 'Entretiens programmés ou passés.', icon: 'ti-calendar-event' },
  { status: 'ASSESSMENT', label: 'Évaluation', english: 'Assessment', hint: 'Tests techniques et évaluations.', icon: 'ti-clipboard-check' },
  { status: 'OFFER', label: 'Offre', english: 'Offer', hint: 'Propositions reçues.', icon: 'ti-confetti' },
  { status: 'REJECTED', label: 'Refusées', english: 'Rejected', hint: 'Candidatures non retenues.', icon: 'ti-circle-x' },
  { status: 'WITHDRAWN', label: 'Retirées', english: 'Withdrawn', hint: 'Candidatures que vous avez retirées.', icon: 'ti-arrow-back-up' },
];

/** Libellé court d'un statut (étiquettes, historique, menus) */
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  TO_APPLY: 'Enregistrée',
  APPLIED: 'Envoyée',
  UNDER_REVIEW: 'En examen',
  INTERVIEW: 'Entretien',
  ASSESSMENT: 'Évaluation',
  OFFER: 'Offre reçue',
  HIRED: 'Embauché(e)',
  REJECTED: 'Refusée',
  WITHDRAWN: 'Retirée',
};

/** Colonne où s'affiche une carte (HIRED → Offre) */
export function columnOf(status: ApplicationStatus): ApplicationStatus {
  return status === 'HIRED' ? 'OFFER' : status;
}

/** Types d'événements planifiés (enum Java ActivityType) */
export type ActivityType = 'INTERVIEW' | 'CALL' | 'TECHNICAL_TEST' | 'OTHER';

export const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: string }[] = [
  { value: 'INTERVIEW', label: 'Entretien', icon: 'ti-users' },
  { value: 'CALL', label: 'Appel', icon: 'ti-phone' },
  { value: 'TECHNICAL_TEST', label: 'Test technique', icon: 'ti-code' },
  { value: 'OTHER', label: 'Autre', icon: 'ti-calendar' },
];

export function activityLabel(type: ActivityType | null | undefined): string {
  return ACTIVITY_TYPES.find(t => t.value === type)?.label ?? 'Événement';
}

export function activityIcon(type: ActivityType | null | undefined): string {
  return ACTIVITY_TYPES.find(t => t.value === type)?.icon ?? 'ti-calendar';
}

/** Types de contrat proposés à la saisie d'une candidature externe */
export const CONTRACT_TYPES = ['CDI', 'CDD', 'STAGE', 'ALTERNANCE', 'INTERIM', 'FREELANCE'];

/** Affichage lisible d'un type de contrat (CDI, Stage, Alternance…) */
export function contractLabel(value: string | null | undefined): string {
  if (!value) return '';
  const v = value.toUpperCase();
  const labels: Record<string, string> = {
    CDI: 'CDI', CDD: 'CDD', STAGE: 'Stage', ALTERNANCE: 'Alternance', INTERIM: 'Intérim',
    FREELANCE: 'Freelance', MIS: 'Intérim', LIB: 'Libéral', SAI: 'Saisonnier',
  };
  return labels[v] ?? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
