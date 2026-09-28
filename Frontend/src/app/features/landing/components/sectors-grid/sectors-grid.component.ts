import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SECTOR_LABELS, SectorType } from '../../../../core/models/candidate';
import { SECTOR_ICONS } from '../../../../core/models/sector.utils';

interface SectorTile {
  code: SectorType;
  label: string;
  icon: string;
}

@Component({
  selector: 'jr-sectors-grid',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './sectors-grid.component.html',
  styleUrl: './sectors-grid.component.scss',
})
export class SectorsGridComponent {
  /** Tous les secteurs de l'enum Java, sauf « Autre » */
  readonly sectors: SectorTile[] = (Object.keys(SECTOR_LABELS) as SectorType[])
    .filter(code => code !== 'OTHER')
    .map(code => ({ code, label: SECTOR_LABELS[code], icon: SECTOR_ICONS[code] }));
}