export interface Sector {
  id: string;
  label: string;
  icon: string;       // tabler icon name
  bg: string;         // tailwind bg class
  text: string;       // tailwind text class
}

export interface JobPreview {
  title: string;
  company: string;
  context: string;    // "CDI · Orléans · Hybride"
  sector: Sector;
  score: number;      // 0-100
}

export interface Step {
  index: string;      // "01"
  label: string;      // "Profil"
  title: string;
  description: string;
  icon: string;
  accentBg: string;
  accentText: string;
}