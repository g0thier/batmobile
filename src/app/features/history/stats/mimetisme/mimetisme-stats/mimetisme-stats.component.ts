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
import { MimetismeSession, MimetismeSessionStats } from '../../../../../core/quiz/mimetisme-session';

Chart.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, Title, RadarController);

@Component({
  selector: 'app-mimetisme-stats',
  standalone: true,
  imports: [IonContent, IonHeader, IonSpinner, IonText, IonTitle, IonToolbar],
  templateUrl: './mimetisme-stats.component.html',
  styleUrl: './mimetisme-stats.component.css',
})
export class MimetismeStatsComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly mimetismeSession = inject(MimetismeSession);

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
  stats: MimetismeSessionStats | null = null;
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
      if (this.quizId !== 'mimetisme' || !this.sessionId) {
        await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
        return;
      }

      const currentUser = await firstValueFrom(this.authService.authUser$);
      const userId = currentUser?.uid?.trim() ?? '';
      if (!userId) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }

      this.stats = await this.mimetismeSession.getSessionStats(this.sessionId, userId);
    } catch (error: unknown) {
      console.error('Impossible de charger les statistiques mimetisme :', error);
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
    const chartTitle = this.stats.title || 'Mimetisme';

    this.destroyChart();

    try {
      this.chart = new Chart(canvas, {
        type: 'radar',
        data: {
          labels: this.stats.labels,
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
      console.error('Erreur de rendu chart mimetisme :', error);
    }
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }

}
