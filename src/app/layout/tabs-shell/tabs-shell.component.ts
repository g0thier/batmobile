import { Component } from '@angular/core';
import { IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import { MaterialIconComponent } from '../../shared/material-icon/material-icon.component';

@Component({
  selector: 'app-tabs-shell',
  templateUrl: './tabs-shell.component.html',
  styleUrls: ['./tabs-shell.component.css'],
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonLabel, MaterialIconComponent],
})
export class TabsShellComponent {}
