import { Component } from '@angular/core';
import { SECTORS } from '../../../../core/data/sectors.data';

@Component({
  selector: 'jr-sectors-grid',
  standalone: true,
  templateUrl: './sectors-grid.component.html',
  styleUrl: './sectors-grid.component.scss',
})
export class SectorsGridComponent {
  sectors = SECTORS;
}