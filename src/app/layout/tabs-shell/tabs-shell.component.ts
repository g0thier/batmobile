import { Component } from '@angular/core';
import { IonBadge, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, IonIcon } from '@ionic/angular/standalone';
import { MaterialIconComponent } from '../../shared/material-icon/material-icon.component';

@Component({
  selector: 'app-tabs-shell',
  templateUrl: './tabs-shell.component.html',
  styleUrls: ['./tabs-shell.component.css'],
  standalone: true,
  imports: [IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, IonLabel, MaterialIconComponent],
})
export class TabsShellComponent {}
