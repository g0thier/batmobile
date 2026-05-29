import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonText, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-session',
  standalone: true,
  imports: [RouterLink, IonButton, IonContent, IonHeader, IonText, IonTitle, IonToolbar],
  templateUrl: './session.component.html',
  styleUrls: ['./session.component.css'],
})
export class SessionComponent {
  private readonly route = inject(ActivatedRoute);
  readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
}
