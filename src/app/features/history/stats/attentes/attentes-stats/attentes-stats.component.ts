import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
  inject,
} from '@angular/core';
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
import { Subscription, firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth';
import { AttentesSession, AttentesSessionStats } from '../../../../../core/quiz/attentes-session';

Chart.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, Title, RadarController);

@Component({
  selector: 'app-attentes-stats',
  standalone: true,
  imports: [IonContent, IonHeader, IonSpinner, IonText, IonTitle, IonToolbar],
  templateUrl: './attentes-stats.component.html',
  styleUrl: './attentes-stats.component.css',
})
export class AttentesStatsComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly attentesSession = inject(AttentesSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  @ViewChildren('radarCanvas') radarCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  private chartInstances: Chart<'radar'>[] = [];
  private canvasesSubscription: Subscription | null = null;

  isLoading = true;
  errorMessage = '';
  stats: AttentesSessionStats | null = null;

  constructor() {
    void this.initialize();
  }

  ngAfterViewInit(): void {
    this.canvasesSubscription = this.radarCanvases.changes.subscribe(() => {
      queueMicrotask(() => this.renderCharts());
    });
    this.renderCharts();
  }

  ngOnDestroy(): void {
    this.canvasesSubscription?.unsubscribe();
    this.destroyCharts();
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'attentes' || !this.sessionId) {
        await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
        return;
      }

      const currentUser = await firstValueFrom(this.authService.authUser$);
      const userId = currentUser?.uid?.trim() ?? '';
      if (!userId) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }

      this.stats = await this.attentesSession.getSessionStats(this.sessionId, userId);
    } catch (error: unknown) {
      console.error('Impossible de charger les statistiques attentes :', error);
      this.errorMessage = 'Impossible de charger les statistiques pour le moment.';
    } finally {
      this.isLoading = false;
      if (this.stats) {
        queueMicrotask(() => this.renderCharts());
      }
    }
  }

  private renderCharts(): void {
    const sessionStats = this.stats;
    if (!sessionStats || !this.radarCanvases) {
      return;
    }

    const canvases = this.radarCanvases.toArray().map((canvasRef) => canvasRef.nativeElement);
    if (canvases.length === 0 || canvases.length < sessionStats.attentes.length) {
      return;
    }

    this.destroyCharts();

    sessionStats.attentes.forEach((attenteStats, index) => {
      const canvas = canvases[index];
      if (!canvas) {
        return;
      }

      try {
        const chart = new Chart(canvas, {
          type: 'radar',
          data: {
            labels: attenteStats.labels,
            datasets: [
              {
                data: attenteStats.scores,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.16)',
                borderWidth: 2,
                pointRadius: 2.5,
                pointHoverRadius: 3.5,
                pointBackgroundColor: '#1d4ed8',
              },
            ],
          },
          options: {
            animation: false,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false,
                position: 'bottom',
                labels: {
                  boxWidth: 8,
                  color: '#334155',
                  font: {
                    size: 10,
                  },
                  padding: 10,
                },
              },
              title: {
                display: true,
                text: attenteStats.title,
                color: '#0f172a',
                font: {
                  size: 13,
                  weight: 600,
                },
                padding: {
                  bottom: 8,
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
                    size: 10,
                    weight: 500,
                  },
                },
              },
            },
          },
        });

        this.chartInstances.push(chart);
      } catch (error: unknown) {
        console.error('Erreur de rendu chart attentes :', error);
      }
    });
  }

  private destroyCharts(): void {
    this.chartInstances.forEach((chart) => chart.destroy());
    this.chartInstances = [];
  }
}
