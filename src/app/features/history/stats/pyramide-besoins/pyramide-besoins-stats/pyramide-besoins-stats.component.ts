import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartDataset,
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
export class PyramideBesoinsStatsComponent implements OnDestroy {
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
      this.scheduleChartRender();
    }
  }

  private chart: Chart<'bar'> | null = null;
  private stackedCanvas: HTMLCanvasElement | null = null;
  private chartRenderRafId: number | null = null;

  isLoading = true;
  errorMessage = '';
  stats: PyramideBesoinsSessionStats | null = null;

  constructor() {
    void this.initialize();
  }

  ionViewDidEnter(): void {
    this.scheduleChartRender();
  }

  ionViewDidLeave(): void {
    this.cleanupChartState();
  }

  ngOnDestroy(): void {
    this.cleanupChartState();
  }

  private scheduleChartRender(): void {
    this.cancelScheduledChartRender();
    this.chartRenderRafId = requestAnimationFrame(() => {
      this.chartRenderRafId = null;
      this.renderChart();
    });
  }

  formatPercentage(value: number): string {
    return `${Math.round(value)}%`;
  }

  formatNeedPercentage(value: number): string {
    const needCount = this.stats?.dimensions.length ?? 1;
    const normalized = clampValue(value * needCount, 0, 100);
    return `${Math.round(normalized)}%`;
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
        this.scheduleChartRender();
      }
    }
  }

  private renderChart(): void {
    const sessionStats = this.stats;
    const canvas = this.stackedCanvas;

    if (!sessionStats) {
      return;
    }

    if (!canvas) {
      this.scheduleChartRender();
      return;
    }

    if (!this.isCanvasReady(canvas)) {
      this.scheduleChartRender();
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
        categoryPercentage: 1,
        barPercentage: 1,
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
        plugins: [
          EQUILATERAL_TRIANGLE_MASK_PLUGIN,
          STACK_PERCENT_LABELS_PLUGIN,
          TOTAL_ACCOMPLISHED_MARKER_PLUGIN,
        ],
        options: {
          animation: false,
          maintainAspectRatio: true,
          aspectRatio: 2 / Math.sqrt(3),
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
                  return `${context.dataset.label}: ${Math.round(rawValue)}%`;
                },
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              offset: true,
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

  private cleanupChartState(): void {
    this.cancelScheduledChartRender();
    this.destroyChart();
  }

  private cancelScheduledChartRender(): void {
    if (this.chartRenderRafId === null) {
      return;
    }

    cancelAnimationFrame(this.chartRenderRafId);
    this.chartRenderRafId = null;
  }

  private isCanvasReady(canvas: HTMLCanvasElement): boolean {
    return canvas.clientWidth > 0 && canvas.clientHeight > 0;
  }
}

const NEED_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6'];

const EQUILATERAL_TRIANGLE_MASK_PLUGIN = {
  id: 'equilateralTriangleMask',
  beforeDatasetsDraw(chart: Chart<'bar'>): void {
    const ctx = chart.ctx;
    const triangle = getEquilateralTriangle(chart);

    if (!triangle) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(triangle.leftX, triangle.baseY);
    ctx.lineTo(triangle.rightX, triangle.baseY);
    ctx.lineTo(triangle.apexX, triangle.apexY);
    ctx.closePath();
    ctx.clip();
  },
  afterDatasetsDraw(chart: Chart<'bar'>): void {
    const ctx = chart.ctx;
    const triangle = getEquilateralTriangle(chart);

    if (!triangle) {
      return;
    }

    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(triangle.leftX, triangle.baseY);
    ctx.lineTo(triangle.rightX, triangle.baseY);
    ctx.lineTo(triangle.apexX, triangle.apexY);
    ctx.closePath();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  },
};

const STACK_PERCENT_LABELS_PLUGIN = {
  id: 'stackPercentLabels',
  afterDatasetsDraw(chart: Chart<'bar'>): void {
    const color = '#ffffff';
    const fontSize = 12;
    const ctx = chart.ctx;

    ctx.save();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;

    chart.data.datasets.forEach((dataset: ChartDataset<'bar'>, datasetIndex: number) => {
      const dataValue = Number(dataset.data?.[0] ?? 0);
      if (!Number.isFinite(dataValue) || dataValue <= 0) {
        return;
      }

      const meta = chart.getDatasetMeta(datasetIndex);
      const barElement = meta.data[0] as BarElement | undefined;
      if (!barElement) {
        return;
      }

      const geometry = barElement.getProps(['x', 'y', 'base'], true) as {
        x: number;
        y: number;
        base: number;
      };

      const segmentHeight = Math.abs(geometry.base - geometry.y);
      if (segmentHeight < fontSize + 4) {
        return;
      }

      const centerX = geometry.x;
      const centerY = (geometry.base + geometry.y) / 2;
      ctx.fillText(`${Math.round(dataValue)}%`, centerX, centerY);
    });

    ctx.restore();
  },
};

const TOTAL_ACCOMPLISHED_MARKER_PLUGIN = {
  id: 'totalAccomplishedMarker',
  afterDraw(chart: Chart<'bar'>): void {
    const yScale = chart.scales['y'];
    const triangle = getEquilateralTriangle(chart);

    if (!yScale || !triangle) {
      return;
    }

    const totalAccomplished = chart.data.datasets.reduce((sum, dataset, index) => {
      if (!chart.isDatasetVisible(index)) {
        return sum;
      }
      return sum + Number(dataset.data?.[0] ?? 0);
    }, 0);

    const cappedTotal = clampValue(totalAccomplished, 0, 100);
    const markerY = yScale.getPixelForValue(cappedTotal);
    if (!Number.isFinite(markerY)) {
      return;
    }

    const ctx = chart.ctx;
    const chartLeft = chart.chartArea.left;
    const chartRight = chart.chartArea.right;
    const totalRatio =
      triangle.baseY === triangle.apexY
        ? 0
        : clampValue((markerY - triangle.apexY) / (triangle.baseY - triangle.apexY), 0, 1);
    const halfBase = (triangle.rightX - triangle.leftX) / 2;
    const triangleRightAtMarker = triangle.apexX + halfBase * totalRatio;
    const rawTextX = triangleRightAtMarker + (chartRight - triangleRightAtMarker) / 2;
    const textX = clampValue(rawTextX, triangleRightAtMarker + 12, chartRight - 12);

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(chartLeft, markerY);
    ctx.lineTo(chartRight, markerY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    const textOffsetY = cappedTotal > 90 ? 10 : -10;
    const totalLabel = `${Math.round(cappedTotal)}%`;
    const paddedTotalLabel = cappedTotal > 90 ? ` ${totalLabel}` : `${totalLabel} `;
    ctx.fillText(paddedTotalLabel, textX, markerY + textOffsetY);
    ctx.restore();
  },
};

const getEquilateralTriangle = (
  chart: Chart<'bar'>,
): {
  leftX: number;
  rightX: number;
  baseY: number;
  apexX: number;
  apexY: number;
} | null => {
  const yScale = chart.scales['y'];
  const xScale = chart.scales['x'];
  if (!yScale || !xScale) {
    return null;
  }

  const baseY = yScale.getPixelForValue(0);
  const apexY = yScale.getPixelForValue(100);
  const triangleHeight = baseY - apexY;
  if (!Number.isFinite(triangleHeight) || triangleHeight <= 0) {
    return null;
  }

  const side = (2 * triangleHeight) / Math.sqrt(3);
  const chartAreaLeft = chart.chartArea.left;
  const chartAreaRight = chart.chartArea.right;
  const minCenterX = chartAreaLeft + side / 2;
  const maxCenterX = chartAreaRight - side / 2;
  const rawCenterX = xScale.getPixelForValue(0);
  const centerX = Number.isFinite(rawCenterX)
    ? Math.min(Math.max(rawCenterX, minCenterX), maxCenterX)
    : (chartAreaLeft + chartAreaRight) / 2;

  return {
    leftX: centerX - side / 2,
    rightX: centerX + side / 2,
    baseY,
    apexX: centerX,
    apexY,
  };
};

const clampValue = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
