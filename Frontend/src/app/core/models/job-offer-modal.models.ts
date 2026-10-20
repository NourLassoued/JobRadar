import { MatchResult } from '../services/matching.service';

/** Onglets de la fenêtre */
export type ModalTab = 'score' | 'cv' | 'letter' | 'interview';

/** Action IA en cours */
export type AiBusy = 'cv' | 'letter' | 'interview' | 'import' | null;

/** Onglet d'une action IA (pour afficher l'erreur au bon endroit) */
export type AiTab = 'cv' | 'letter' | 'interview';

export type ScoreLevel = 'high' | 'mid' | 'low';

/** Bloc de texte affiché sans innerHTML : titre, puce ou paragraphe */
export interface TextBlock { kind: 'h' | 'li' | 'p'; text: string }

/** Un des 3 critères du score (60 / 20 / 20), prêt pour une barre */
export interface Criterion {
  key: 'skills' | 'experience' | 'sector';
  label: string;
  weight: number;
  icon: string;
  value: number;
  level: ScoreLevel;
  points: number;
}

/** Verdict affiché sous le score : « l'offre vous correspond-elle ? » */
export interface FitVerdict {
  level: ScoreLevel;
  icon: string;
  title: string;
  text: string;
}

/** Avant / après adaptation : uniquement si l'API renvoie les deux valeurs */
export interface CoverageGain {
  before: number;
  after: number;
  gain: number;
}

const CRITERIA = [
  { key: 'skills', label: 'Compétences', weight: 60, icon: 'ti-code' },
  { key: 'experience', label: 'Expérience', weight: 20, icon: 'ti-briefcase' },
  { key: 'sector', label: 'Secteur', weight: 20, icon: 'ti-category' },
] as const;

/** Catégories de questions d'entretien : libellé, icône Tabler et explication, dans l'ordre d'affichage */
export const INTERVIEW_CATEGORIES = [
  { key: 'MOTIVATION', label: 'Motivation', icon: 'ti-heart-handshake', hint: 'Pourquoi ce poste et cette entreprise' },
  { key: 'EXPERIENCE', label: 'Parcours et projets', icon: 'ti-briefcase', hint: 'Vos expériences racontées concrètement' },
  { key: 'TECHNICAL', label: 'Questions techniques', icon: 'ti-code', hint: 'Les technologies de l\'offre que vous maîtrisez' },
  { key: 'BEHAVIORAL', label: 'Mises en situation', icon: 'ti-users', hint: 'Répondez avec la méthode STAR : Situation, Tâche, Action, Résultat' },
  { key: 'GAP', label: 'Points à renforcer', icon: 'ti-alert-triangle', hint: 'Compétences demandées absentes de votre profil : restez honnête' },
] as const;

export function levelOf(score: number): ScoreLevel {
  return score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
}

export function levelLabel(score: number): string {
  const l = levelOf(score);
  return l === 'high' ? 'Très compatible' : l === 'mid' ? 'Compatible' : 'Peu compatible';
}

/** Les 3 critères d'un résultat de matching */
export function criteriaOf(r: MatchResult): Criterion[] {
  const values = { skills: r.skillsScore, experience: r.experienceScore, sector: r.sectorScore };
  return CRITERIA.map(c => {
    const value = Math.max(0, Math.min(100, Math.round(values[c.key] ?? 0)));
    return { ...c, value, level: levelOf(value), points: Math.round((value * c.weight) / 100) };
  });
}

/** Phrase de conclusion, construite uniquement à partir de la réponse du backend */
export function verdictOf(r: MatchResult): FitVerdict {
  const level = levelOf(r.score);
  const missing = r.missingSkills?.length ?? 0;
  const otherSector = r.sectorScore < 40;

  if (level === 'high') {
    return {
      level, icon: 'ti-circle-check',
      title: 'Cette offre correspond à votre profil',
      text: missing
        ? `Vous pouvez postuler. ${missing} technologie${missing > 1 ? 's' : ''} de l'offre ${missing > 1 ? 'sont' : 'est'} à mettre en avant ou à renforcer.`
        : 'Vous pouvez postuler : vos compétences couvrent ce que demande l\'offre.',
    };
  }
  if (level === 'mid') {
    return {
      level, icon: 'ti-adjustments-horizontal',
      title: 'Correspondance partielle',
      text: otherSector
        ? 'L\'offre relève d\'un autre secteur que le vôtre. Un CV adapté peut aider à valoriser vos compétences transférables.'
        : 'Plusieurs points communs. Un CV adapté peut mieux faire ressortir ce que l\'offre recherche.',
    };
  }
  return {
    level, icon: 'ti-alert-triangle',
    title: 'Cette offre correspond peu à votre profil',
    text: r.matchedSkills.length
      ? 'Peu de critères concordent. Vérifiez les exigences avant de postuler.'
      : 'Aucune de vos compétences n\'apparaît dans l\'offre.',
  };
}

/** Markdown simple renvoyé par l'IA → blocs (« ## Titre », « - puce », paragraphe) */
export function toBlocks(markdown: string | null | undefined): TextBlock[] {
  const clean = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').trim();
  const blocks: TextBlock[] = [];
  for (const raw of (markdown || '').split('\n')) {
    const line = raw.trim();
    if (!line || /^[-*_]{3,}$/.test(line)) continue;
    if (/^#{1,6}\s/.test(line)) blocks.push({ kind: 'h', text: clean(line.replace(/^#{1,6}\s+/, '')) });
    else if (/^[-*•]\s/.test(line)) blocks.push({ kind: 'li', text: clean(line.replace(/^[-*•]\s+/, '')) });
    else blocks.push({ kind: 'p', text: clean(line) });
  }
  return blocks;
}

/** « Société Générale » → « societe-generale » (noms de fichiers) */
export function slug(text: string | null | undefined): string {
  return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'offre';
}