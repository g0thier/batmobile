import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Title,
  Tooltip,
  type ChartDataset,
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
import { EquiteSession, EquiteSessionStats } from '../../../../../core/quiz/equite-session';

type EquiteFloatingBar = [number, number];

interface EquiteChartDataset extends ChartDataset<'bar', EquiteFloatingBar[]> {
  averageValues: number[];
  minValues: number[];
  maxValues: number[];
  hasResponses: boolean[];
}

@Component({
  selector: 'app-equite-stats',
  standalone: true,
  imports: [IonContent, IonHeader, IonSpinner, IonText, IonTitle, IonToolbar],
  templateUrl: './equite-stats.component.html',
  styleUrl: './equite-stats.component.css',
})
export class EquiteStatsComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly equiteSession = inject(EquiteSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  @ViewChild('equiteCanvas')
  set equiteCanvasRef(value: ElementRef<HTMLCanvasElement> | undefined) {
    this.equiteCanvas = value?.nativeElement ?? null;

    if (this.stats && this.equiteCanvas) {
      queueMicrotask(() => this.renderChart());
    }
  }

  private chart: Chart<'bar'> | null = null;
  private equiteCanvas: HTMLCanvasElement | null = null;

  isLoading = true;
  errorMessage = '';
  stats: EquiteSessionStats | null = null;
  chartCanvasHeightPx = 360;
  readonly userLegendLabel = 'Vous';

  constructor() {
    void this.initialize();
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  formatSignedValue(value: number, digits = 0): string {
    const roundedValue = Number(value.toFixed(digits));
    return `${roundedValue > 0 ? '+' : ''}${roundedValue.toFixed(digits)}`;
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'equite' || !this.sessionId) {
        await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
        return;
      }

      const currentUser = await firstValueFrom(this.authService.authUser$);
      const userId = currentUser?.uid?.trim() ?? '';
      if (!userId) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }

      this.stats = await this.equiteSession.getSessionStats(this.sessionId, userId);
    } catch (error: unknown) {
      console.error('Impossible de charger les statistiques equite :', error);
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
    const canvas = this.equiteCanvas;

    if (!sessionStats || !canvas) {
      return;
    }

    const themeStats = sessionStats.themes;
    if (themeStats.length === 0) {
      return;
    }

    const chartLabels = themeStats.map((theme) => theme.label);
    const values = themeStats.map((theme) => [0, theme.averageValue] as EquiteFloatingBar);
    const averageValues = themeStats.map((theme) => theme.averageValue);
    const minValues = themeStats.map((theme) => theme.minValue);
    const maxValues = themeStats.map((theme) => theme.maxValue);
    const hasResponses = themeStats.map((theme) => theme.responseCount > 0);
    const backgroundColors = themeStats.map((theme, index) => {
      if (!hasResponses[index]) {
        return EMPTY_BAR_BACKGROUND_COLOR;
      }

      return theme.averageValue < 0
        ? NEGATIVE_BAR_BACKGROUND_COLOR
        : POSITIVE_BAR_BACKGROUND_COLOR;
    });
    const borderColors = themeStats.map((theme, index) => {
      if (!hasResponses[index]) {
        return EMPTY_BAR_BORDER_COLOR;
      }

      return theme.averageValue < 0 ? NEGATIVE_BAR_BORDER_COLOR : POSITIVE_BAR_BORDER_COLOR;
    });

    this.chartCanvasHeightPx = Math.max(
      360,
      chartLabels.length * BAR_THICKNESS + CHART_VERTICAL_PADDING,
    );

    this.destroyChart();

    const dataset: EquiteChartDataset = {
      label: this.userLegendLabel,
      data: values,
      averageValues,
      minValues,
      maxValues,
      hasResponses,
      backgroundColor: backgroundColors,
      borderColor: borderColors,
      borderWidth: 1.5,
      borderRadius: 8,
      borderSkipped: false,
      barThickness: BAR_THICKNESS,
      maxBarThickness: BAR_THICKNESS,
    };

    try {
      this.chart = new Chart<'bar', EquiteFloatingBar[], string>(canvas, {
        type: 'bar',
        data: {
          labels: chartLabels,
          datasets: [dataset],
        },
        options: {
          animation: false,
          indexAxis: 'y',
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            title: {
              display: true,
              text: sessionStats.title || 'Équité',
              color: '#0f172a',
              font: {
                size: 16,
                weight: 600,
              },
              padding: {
                bottom: 12,
              },
            },
            tooltip: {
              displayColors: false,
              callbacks: {
                title: (items) => {
                  const theme = themeStats[items[0]?.dataIndex ?? -1];
                  return theme?.label ?? '';
                },
                label: (context) => {
                  const theme = themeStats[context.dataIndex];
                  if (!theme) {
                    return '';
                  }

                  return [
                    `Moyenne: ${this.formatSignedValue(theme.averageValue, 1)}`,
                    `Min: ${this.formatSignedValue(theme.minValue)}`,
                    `Max: ${this.formatSignedValue(theme.maxValue)}`,
                  ];
                },
              },
            },
          },
          scales: {
            x: {
              min: -5,
              max: 5,
              ticks: {
                color: '#475569',
                callback: (value) => this.formatSignedValue(Number(value)),
                stepSize: 1,
              },
              grid: {
                color: '#dbe3ef',
              },
            },
            y: {
              ticks: {
                color: '#334155',
                font: {
                  size: 12,
                  weight: 600,
                },
              },
              grid: {
                display: false,
              },
            },
          },
        },
      }) as Chart<'bar'>;
    } catch (error: unknown) {
      console.error('Erreur de rendu chart equite :', error);
    }
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}

const BAR_THICKNESS = 28;
const CHART_VERTICAL_PADDING = 88;
const POSITIVE_BAR_BACKGROUND_COLOR = 'rgba(59, 130, 246, 0.26)';
const POSITIVE_BAR_BORDER_COLOR = '#2563eb';
const NEGATIVE_BAR_BACKGROUND_COLOR = 'rgba(34, 197, 94, 0.26)';
const NEGATIVE_BAR_BORDER_COLOR = '#16a34a';
const EMPTY_BAR_BACKGROUND_COLOR = 'rgba(148, 163, 184, 0.18)';
const EMPTY_BAR_BORDER_COLOR = '#94a3b8';
const REFERENCE_LINE_COLOR = '#94a3b8';

const EQUITE_ZERO_REFERENCE_PLUGIN = {
  id: 'equiteZeroReference',
  afterDatasetsDraw(chart: Chart<'bar'>): void {
    const xScale = chart.scales['x'];
    const chartArea = chart.chartArea;
    if (!xScale || !chartArea) {
      return;
    }

    const x = xScale.getPixelForValue(0);
    const ctx = chart.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.strokeStyle = REFERENCE_LINE_COLOR;
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  },
};

const EQUITE_WICK_PLUGIN = {
  id: 'equiteWick',
  afterDatasetsDraw(chart: Chart<'bar'>): void {
    const xScale = chart.scales['x'];
    const dataset = chart.data.datasets[0] as EquiteChartDataset | undefined;
    const meta = chart.getDatasetMeta(0);

    if (!xScale || !dataset || meta.data.length === 0) {
      return;
    }

    const ctx = chart.ctx;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;

    dataset.minValues.forEach((minValue, index) => {
      if (!dataset.hasResponses[index]) {
        return;
      }

      const barElement = meta.data[index] as BarElement | undefined;
      if (!barElement) {
        return;
      }

      const maxValue = dataset.maxValues[index];
      if (maxValue === undefined) {
        return;
      }

      const y = barElement.y;

      if (minValue < 0) {
        ctx.strokeStyle = NEGATIVE_BAR_BORDER_COLOR;
        drawHorizontalSegmentWithCaps(
          ctx,
          xScale.getPixelForValue(minValue),
          xScale.getPixelForValue(Math.min(maxValue, 0)),
          y,
          true,
          maxValue < 0,
        );
      }

      if (maxValue > 0) {
        ctx.strokeStyle = POSITIVE_BAR_BORDER_COLOR;
        drawHorizontalSegmentWithCaps(
          ctx,
          xScale.getPixelForValue(Math.max(minValue, 0)),
          xScale.getPixelForValue(maxValue),
          y,
          minValue > 0,
          true,
        );
      }
    });

    ctx.restore();
  },
};

const drawHorizontalSegmentWithCaps = (
  ctx: CanvasRenderingContext2D,
  xStart: number,
  xEnd: number,
  y: number,
  drawStartCap: boolean,
  drawEndCap: boolean,
): void => {
  const startX = Math.min(xStart, xEnd);
  const endX = Math.max(xStart, xEnd);

  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(endX, y);
  ctx.stroke();

  if (drawStartCap) {
    drawCap(ctx, startX, y);
  }

  if (drawEndCap) {
    drawCap(ctx, endX, y);
  }
};

const drawCap = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  ctx.beginPath();
  ctx.moveTo(x, y - CAP_HALF_HEIGHT_PX);
  ctx.lineTo(x, y + CAP_HALF_HEIGHT_PX);
  ctx.stroke();
};

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Title,
  EQUITE_ZERO_REFERENCE_PLUGIN,
  EQUITE_WICK_PLUGIN,
);

const CAP_HALF_HEIGHT_PX = 4;
