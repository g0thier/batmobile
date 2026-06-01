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
import { TheorieXYSession, TheorieXYSessionStats } from '../../../../../core/quiz/theorie-x-y-session';

@Component({
  selector: 'app-theorie-x-y-stats',
  standalone: true,
  imports: [IonContent, IonHeader, IonSpinner, IonText, IonTitle, IonToolbar],
  templateUrl: './theorie-x-y-stats.component.html',
  styleUrl: './theorie-x-y-stats.component.css',
})
export class TheorieXYStatsComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly theorieXYSession = inject(TheorieXYSession);

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
  stats: TheorieXYSessionStats | null = null;

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
    return `${Math.round(value)}%`;
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'theorie-x-y' || !this.sessionId) {
        await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
        return;
      }

      const currentUser = await firstValueFrom(this.authService.authUser$);
      const userId = currentUser?.uid?.trim() ?? '';
      if (!userId) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }

      this.stats = await this.theorieXYSession.getSessionStats(this.sessionId, userId);
    } catch (error: unknown) {
      console.error('Impossible de charger les statistiques theorie-x-y :', error);
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

    this.destroyChart();

    try {
      this.chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: sessionStats.dimensions.map((dimension) => dimension.label),
          datasets: [
            {
              label: 'Contrainte',
              data: sessionStats.dimensions.map((dimension) => dimension.contraintePct),
              backgroundColor: '#ef4444',
              stack: 'theorie-xy',
              borderRadius: 3,
              borderSkipped: false,
            },
            {
              label: 'Engagement',
              data: sessionStats.dimensions.map((dimension) => dimension.engagementPct),
              backgroundColor: '#3b82f6',
              stack: 'theorie-xy',
              borderRadius: 3,
              borderSkipped: false,
            },
            {
              label: '',
              data: sessionStats.dimensions.map((dimension) => dimension.incompletePct),
              backgroundColor: '#94a3b8',
              stack: 'theorie-xy',
              borderRadius: 3,
              borderSkipped: false,
            },
          ],
        },
        options: {
          animation: false,
          indexAxis: 'y',
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                color: '#334155',
                padding: 14,
                filter: (legendItem) => {
                  const datasetIndex = legendItem.datasetIndex ?? -1;
                  return datasetIndex !== 2;
                },
              },
            },
            title: {
              display: true,
              text: sessionStats.title || 'Théorie X-Y',
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
              filter: (tooltipItem) => tooltipItem.datasetIndex !== 2,
              callbacks: {
                label: (context) => {
                  const rawValue = Number(context.raw ?? 0);
                  return `${context.dataset.label}: ${Math.round(rawValue)}%`;
                },
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              min: 0,
              max: 100,
              ticks: {
                color: '#475569',
                callback: (value) => `${value}%`,
                stepSize: 20,
              },
              grid: {
                color: '#dbe3ef',
              },
            },
            y: {
              stacked: true,
              ticks: {
                display: false,
                color: '#334155',
              },
              grid: {
                display: false,
              },
            },
          },
        },
      });
    } catch (error: unknown) {
      console.error('Erreur de rendu chart theorie-x-y :', error);
    }
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}

const FIFTY_PERCENT_REFERENCE_PLUGIN = {
  id: 'fiftyPercentReference',
  beforeDatasetsDraw(chart: Chart<'bar'>): void {
    const xScale = chart.scales['x'];
    const chartArea = chart.chartArea;
    if (!xScale || !chartArea) {
      return;
    }

    const x = xScale.getPixelForValue(50);
    const ctx = chart.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  },
};

const STACK_CENTER_LABELS_PLUGIN = {
  id: 'stackCenterLabels',
  afterDatasetsDraw(chart: Chart<'bar'>): void {
    const labels = (chart.data.labels ?? []).map((label) => String(label ?? ''));
    if (labels.length === 0) {
      return;
    }

    const xScale = chart.scales['x'];
    const yScale = chart.scales['y'];
    if (!xScale || !yScale) {
      return;
    }

    const firstDatasetMeta = chart.getDatasetMeta(0);
    const centerX = xScale.getPixelForValue(50);
    const ctx = chart.ctx;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';

    labels.forEach((label, index) => {
      const barElement = firstDatasetMeta.data[index];
      if (!barElement) {
        return;
      }

      const y = barElement.y;
      ctx.fillText(label, centerX, y);
    });

    ctx.restore();
  },
};

const MINORITY_PERCENT_LABELS_PLUGIN = {
  id: 'minorityPercentLabels',
  afterDatasetsDraw(chart: Chart<'bar'>): void {
    const labels = (chart.data.labels ?? []).map((label) => String(label ?? ''));
    if (labels.length === 0) {
      return;
    }

    const contraDataset = chart.data.datasets[0];
    const engageDataset = chart.data.datasets[1];
    if (!contraDataset || !engageDataset) {
      return;
    }

    const ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 10px system-ui, -apple-system, sans-serif';

    labels.forEach((_, index) => {
      const contrainteValue = Number(contraDataset.data[index] ?? 0);
      const engagementValue = Number(engageDataset.data[index] ?? 0);

      if (!Number.isFinite(contrainteValue) || !Number.isFinite(engagementValue)) {
        return;
      }

      if (Math.abs(contrainteValue - engagementValue) < Number.EPSILON) {
        return;
      }

      const minorityDatasetIndex = contrainteValue < engagementValue ? 0 : 1;
      const minorityValue = minorityDatasetIndex === 0 ? contrainteValue : engagementValue;

      if (minorityValue <= 5) {
        return;
      }

      const minorityMeta = chart.getDatasetMeta(minorityDatasetIndex);
      const barElement = minorityMeta.data[index] as BarElement | undefined;
      if (!barElement) {
        return;
      }

      const geometry = barElement.getProps(['x', 'base', 'y'], true) as {
        x: number;
        base: number;
        y: number;
      };

      const centerX = (geometry.x + geometry.base) / 2;
      ctx.fillText(`${Math.round(minorityValue)}%`, centerX, geometry.y);
    });

    ctx.restore();
  },
};

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
  FIFTY_PERCENT_REFERENCE_PLUGIN,
  STACK_CENTER_LABELS_PLUGIN,
  MINORITY_PERCENT_LABELS_PLUGIN,
);
