import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Chart,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import {
  IonContent,
  IonHeader,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import { BesoinsAcquisSession, BesoinsAcquisSessionStats } from '../../../../../core/quiz/besoins-acquis-session';

Chart.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, Title, RadarController);

@Component({
  selector: 'app-besoins-acquis-stats',
  standalone: true,
  imports: [IonContent, IonHeader, IonSpinner, IonText, IonTitle, IonToolbar],
  templateUrl: './besoins-acquis-stats.component.html',
  styleUrl: './besoins-acquis-stats.component.css',
})
export class BesoinsAcquisStatsComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly besoinsAcquisSession = inject(BesoinsAcquisSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  @ViewChild('radarCanvas')
  set radarCanvasRef(value: ElementRef<HTMLCanvasElement> | undefined) {
    this.radarCanvas = value?.nativeElement ?? null;

    if (this.stats && this.radarCanvas) {
      queueMicrotask(() => this.renderChart());
    }
  }

  private chart: Chart<'radar'> | null = null;
  private radarCanvas: HTMLCanvasElement | null = null;

  isLoading = true;
  errorMessage = '';
  stats: BesoinsAcquisSessionStats | null = null;
  userLegendLabel = 'Vous';

  constructor() {
    void this.initialize();
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'besoins-acquis' || !this.sessionId) {
        await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
        return;
      }

      const currentUser = await firstValueFrom(this.authService.authUser$);
      const userId = currentUser?.uid?.trim() ?? '';
      if (!userId) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }

      this.stats = await this.besoinsAcquisSession.getSessionStats(this.sessionId, userId);
    } catch (error: unknown) {
      console.error('Impossible de charger les statistiques besoins-acquis :', error);
      this.errorMessage = 'Impossible de charger les statistiques pour le moment.';
    } finally {
      this.isLoading = false;
      if (this.stats) {
        queueMicrotask(() => this.renderChart());
      }
    }
  }

  private renderChart(): void {
    if (!this.stats || !this.radarCanvas) {
      return;
    }

    const canvas = this.radarCanvas;
    const labels = this.stats.labels;
    const referenceAt25 = labels.map(() => 25);
    const referenceAt50 = labels.map(() => 50);
    const referenceAt75 = labels.map(() => 75);
    const chartTitle = this.stats.title || 'Besoins acquis';

    this.destroyChart();

    try {
      this.chart = new Chart(canvas, {
        type: 'radar',
        data: {
          labels,
          datasets: [
            {
              label: this.userLegendLabel,
              data: this.stats.scores,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.16)',
              borderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 4,
              pointBackgroundColor: '#1d4ed8',
            },
            {
              label: 'Positif',
              data: referenceAt75,
              borderColor: '#16a34a',
              backgroundColor: 'rgba(22, 163, 74, 0.16)',
              borderWidth: 1.5,
              fill: false,
              pointRadius: 0,
              pointHoverRadius: 0,
            },
            {
              label: 'Neutre',
              data: referenceAt50,
              borderColor: '#94a3b8',
              borderDash: [6, 6],
              borderWidth: 1.5,
              fill: false,
              pointRadius: 0,
              pointHoverRadius: 0,
            },
            {
              label: 'Négatif',
              data: referenceAt25,
              borderColor: '#dc2626',
              backgroundColor: 'rgba(220, 38, 38, 0.16)',
              borderWidth: 1.5,
              fill: false,
              pointRadius: 0,
              pointHoverRadius: 0,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                color: '#334155',
                padding: 14,
              },
            },
            title: {
              display: true,
              text: chartTitle,
              color: '#0f172a',
              font: {
                size: 16,
                weight: 600,
              },
              padding: {
                bottom: 12,
              },
            },
          },
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: {
                display: false,
              },
              grid: {
                color: '#dbe3ef',
              },
              angleLines: {
                color: '#dbe3ef',
              },
              pointLabels: {
                color: '#334155',
                font: {
                  size: 12,
                  weight: 500,
                },
              },
            },
          },
        },
      });
    } catch (error: unknown) {
      console.error('Erreur de rendu chart besoins-acquis :', error);
    }
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }

}
