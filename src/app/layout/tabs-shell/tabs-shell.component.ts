import { Component } from '@angular/core';
import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-tabs-shell',
  templateUrl: './tabs-shell.component.html',
  styleUrls: ['./tabs-shell.component.css'],
  standalone: true,
  imports: [IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, IonLabel, IonIcon],
})
export class TabsShellComponent {}
