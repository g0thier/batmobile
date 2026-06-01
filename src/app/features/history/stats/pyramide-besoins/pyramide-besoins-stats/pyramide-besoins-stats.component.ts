import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
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
import {
  PyramideBesoinsSession,
  PyramideBesoinsSessionStats,
} from '../../../../../core/quiz/pyramide-besoins-session';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

@Component({
  selector: 'app-pyramide-besoins-stats',
  standalone: true,
  imports: [IonContent, IonHeader, IonSpinner, IonText, IonTitle, IonToolbar],
  templateUrl: './pyramide-besoins-stats.component.html',
  styleUrl: './pyramide-besoins-stats.component.css',
})
export class PyramideBesoinsStatsComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly pyramideBesoinsSession = inject(PyramideBesoinsSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  @ViewChild('stackedCanvas')
  set stackedCanvasRef(value: ElementRef<HTMLCanvasElement> | undefined) {
    this.stackedCanvas = value?.nativeElement ?? null;

    if (this.stats && this.stackedCanvas) {
      queueMicrotask(() => this.renderChart());
    }
  }

  private chart: Chart<'bar'> | null = null;
  private stackedCanvas: HTMLCanvasElement | null = null;

  isLoading = true;
  errorMessage = '';
  stats: PyramideBesoinsSessionStats | null = null;

  constructor() {
    void this.initialize();
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  formatPercentage(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  getNeedColor(index: number): string {
    return NEED_COLORS[index % NEED_COLORS.length] ?? '#64748b';
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'pyramide-besoins' || !this.sessionId) {
        await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
        return;
      }

      const currentUser = await firstValueFrom(this.authService.authUser$);
      const userId = currentUser?.uid?.trim() ?? '';
      if (!userId) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }

      this.stats = await this.pyramideBesoinsSession.getSessionStats(this.sessionId, userId);
    } catch (error: unknown) {
      console.error('Impossible de charger les statistiques pyramide-besoins :', error);
      this.errorMessage = 'Impossible de charger les statistiques pour le moment.';
    } finally {
      this.isLoading = false;
      if (this.stats) {
        queueMicrotask(() => this.renderChart());
      }
    }
  }

  private renderChart(): void {
    const sessionStats = this.stats;
    const canvas = this.stackedCanvas;

    if (!sessionStats || !canvas) {
      return;
    }

    const datasets = sessionStats.dimensions.map((dimension, index) => {
      return {
        label: dimension.label,
        data: [dimension.score],
        backgroundColor: this.getNeedColor(index),
        borderColor: '#ffffff',
        borderWidth: 1,
        stack: 'pyramide-besoins',
        barThickness: 72,
      };
    });

    this.destroyChart();

    try {
      this.chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: ['Répartition'],
          datasets,
        },
        options: {
          animation: false,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            title: {
              display: true,
              text: sessionStats.title,
              color: '#0f172a',
              font: {
                size: 15,
                weight: 600,
              },
              padding: {
                bottom: 12,
              },
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const rawValue = Number(context.raw ?? 0);
                  return `${context.dataset.label}: ${rawValue.toFixed(2)}%`;
                },
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              grid: {
                display: false,
              },
              ticks: {
                display: false,
              },
            },
            y: {
              stacked: true,
              min: 0,
              max: 100,
              ticks: {
                stepSize: 20,
                color: '#475569',
                callback: (tickValue) => `${tickValue}%`,
              },
              grid: {
                color: '#dbe3ef',
              },
            },
          },
        },
      });
    } catch (error: unknown) {
      console.error('Erreur de rendu chart pyramide-besoins :', error);
    }
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}

const NEED_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6'];
