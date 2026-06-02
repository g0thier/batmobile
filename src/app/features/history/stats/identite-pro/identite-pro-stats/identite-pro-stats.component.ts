import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  type ChartDataset,
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
  IdentiteProSession,
  IdentiteProSessionStats,
  IdentiteProThemeStats,
} from '../../../../../core/quiz/identite-pro-session';

type IdentiteProCandlestickValue = [number, number];
type IdentiteProCandlestickPoint = IdentiteProCandlestickValue | null;

interface IdentiteProChartDataset extends ChartDataset<'bar', IdentiteProCandlestickPoint[]> {
  selfAverageValues: number[];
  perceivedAverageValues: number[];
  selfResponseCounts: number[];
  perceivedResponseCounts: number[];
  hasSelfResponses: boolean[];
  hasPerceivedResponses: boolean[];
}

@Component({
  selector: 'app-identite-pro-stats',
  standalone: true,
  imports: [IonContent, IonHeader, IonSpinner, IonText, IonTitle, IonToolbar],
  templateUrl: './identite-pro-stats.component.html',
  styleUrl: './identite-pro-stats.component.css',
})
export class IdentiteProStatsComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly identiteProSession = inject(IdentiteProSession);

  private readonly sessionId = this.route.snapshot.paramMap.get('sessionId')?.trim() ?? '';
  private readonly quizId = this.route.snapshot.paramMap.get('quizId')?.trim().toLowerCase() ?? '';

  @ViewChild('identiteProCanvas')
  set identiteProCanvasRef(value: ElementRef<HTMLCanvasElement> | undefined) {
    this.identiteProCanvas = value?.nativeElement ?? null;

    if (this.stats && this.identiteProCanvas) {
      queueMicrotask(() => this.renderChart());
    }
  }

  private chart: Chart<'bar', IdentiteProCandlestickPoint[], string> | null = null;
  private identiteProCanvas: HTMLCanvasElement | null = null;

  isLoading = true;
  errorMessage = '';
  stats: IdentiteProSessionStats | null = null;
  chartCanvasHeightPx = 360;
  readonly themeLegendItems = [
    { color: '#2563eb', label: 'Identité de soi' },
    { color: '#14b8a6', label: 'Identité perçue' },
  ];

  constructor() {
    void this.initialize();
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  formatAverage(value: number): string {
    return value.toFixed(1);
  }

  formatSignedAverage(value: number): string {
    const rounded = Number(value.toFixed(1));
    return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`;
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.quizId !== 'identite-pro' || !this.sessionId) {
        await this.router.navigateByUrl('/tabs/history', { replaceUrl: true });
        return;
      }

      const currentUser = await firstValueFrom(this.authService.authUser$);
      const userId = currentUser?.uid?.trim() ?? '';
      if (!userId) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }

      this.stats = await this.identiteProSession.getSessionStats(this.sessionId, userId);
    } catch (error: unknown) {
      console.error('Impossible de charger les statistiques identite-pro :', error);
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
    const canvas = this.identiteProCanvas;

    if (!sessionStats || !canvas) {
      return;
    }

    const themeStats = sessionStats.themes;
    if (themeStats.length === 0) {
      return;
    }

    const chartLabels = themeStats.map((theme) => theme.label);
    const chartValues = themeStats.map((theme) => this.buildCandlestickValue(theme));
    const barColors = themeStats.map((theme) => this.getBarColors(theme));
    const selfAverageValues = themeStats.map((theme) => theme.identiteDeSoi.averageValue);
    const perceivedAverageValues = themeStats.map((theme) => theme.identitePercue.averageValue);
    const selfResponseCounts = themeStats.map((theme) => theme.identiteDeSoi.responseCount);
    const perceivedResponseCounts = themeStats.map((theme) => theme.identitePercue.responseCount);
    const hasSelfResponses = selfResponseCounts.map((count) => count > 0);
    const hasPerceivedResponses = perceivedResponseCounts.map((count) => count > 0);

    this.chartCanvasHeightPx = Math.max(360, chartLabels.length * BAR_THICKNESS + CHART_VERTICAL_PADDING);
    this.destroyChart();

    const dataset: IdentiteProChartDataset = {
      label: 'Vous',
      data: chartValues,
      selfAverageValues,
      perceivedAverageValues,
      selfResponseCounts,
      perceivedResponseCounts,
      hasSelfResponses,
      hasPerceivedResponses,
      backgroundColor: barColors.map((colors) => colors.backgroundColor),
      borderColor: barColors.map((colors) => colors.borderColor),
      borderWidth: 1,
      borderRadius: 10,
      borderSkipped: false,
      barThickness: BAR_THICKNESS,
      maxBarThickness: BAR_THICKNESS,
      categoryPercentage: 0.82,
      barPercentage: 0.92,
    };

    try {
      this.chart = new Chart<'bar', IdentiteProCandlestickPoint[], string>(canvas, {
        type: 'bar',
        data: {
          labels: chartLabels,
          datasets: [dataset],
        },
        plugins: [identiteProCapsPlugin],
        options: {
          animation: false,
          maintainAspectRatio: false,
          indexAxis: 'x',
          plugins: {
            legend: {
              display: false,
            },
            title: {
              display: true,
              text: sessionStats.title || 'Identité Pro',
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
              callbacks: {
                title: (items) => {
                  const theme = themeStats[items[0]?.dataIndex ?? -1];
                  return theme?.label ?? '';
                },
                label: (context) => this.buildTooltipLines(themeStats[context.dataIndex] ?? null),
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: '#334155',
                font: {
                  size: 12,
                  weight: 600,
                },
                callback: (value, index) => this.formatThemeLabel(themeStats[index]?.label ?? String(value)),
                maxRotation: 0,
                minRotation: 0,
              },
              grid: {
                display: false,
              },
            },
            y: {
              min: 0,
              max: 10,
              ticks: {
                color: '#475569',
                stepSize: 2,
              },
              grid: {
                color: '#dbe3ef',
              },
            },
          },
        },
      });
    } catch (error: unknown) {
      console.error('Erreur de rendu chart identite-pro :', error);
    }
  }

  private buildCandlestickValue(theme: IdentiteProThemeStats): IdentiteProCandlestickPoint {
    const selfHasResponses = theme.identiteDeSoi.responseCount > 0;
    const perceivedHasResponses = theme.identitePercue.responseCount > 0;

    if (!selfHasResponses && !perceivedHasResponses) {
      return null;
    }

    if (selfHasResponses && perceivedHasResponses) {
      return [
        Math.min(theme.identiteDeSoi.averageValue, theme.identitePercue.averageValue),
        Math.max(theme.identiteDeSoi.averageValue, theme.identitePercue.averageValue),
      ];
    }

    const value = selfHasResponses
      ? theme.identiteDeSoi.averageValue
      : theme.identitePercue.averageValue;

    return [value, value];
  }

  private getBarColors(
    theme: IdentiteProThemeStats | null,
  ): { backgroundColor: string; borderColor: string } {
    if (!theme) {
      return {
        backgroundColor: NEUTRAL_BAR_BACKGROUND_COLOR,
        borderColor: NEUTRAL_BAR_BORDER_COLOR,
      };
    }

    const selfHasResponses = theme.identiteDeSoi.responseCount > 0;
    const perceivedHasResponses = theme.identitePercue.responseCount > 0;

    if (!selfHasResponses || !perceivedHasResponses) {
      return {
        backgroundColor: NEUTRAL_BAR_BACKGROUND_COLOR,
        borderColor: NEUTRAL_BAR_BORDER_COLOR,
      };
    }

    if (theme.identiteDeSoi.averageValue > theme.identitePercue.averageValue) {
      return {
        backgroundColor: BLUE_BAR_BACKGROUND_COLOR,
        borderColor: BLUE_BAR_BORDER_COLOR,
      };
    }

    if (theme.identiteDeSoi.averageValue < theme.identitePercue.averageValue) {
      return {
        backgroundColor: GREEN_BAR_BACKGROUND_COLOR,
        borderColor: GREEN_BAR_BORDER_COLOR,
      };
    }

    return {
      backgroundColor: NEUTRAL_BAR_BACKGROUND_COLOR,
      borderColor: NEUTRAL_BAR_BORDER_COLOR,
    };
  }

  private buildTooltipLines(theme: IdentiteProThemeStats | null): string | string[] {
    if (!theme) {
      return '';
    }

    const lines = [
      `${theme.identiteDeSoi.label}: ${this.formatAverage(theme.identiteDeSoi.averageValue)} /10 (${theme.identiteDeSoi.responseCount} réponses)`,
      `${theme.identitePercue.label}: ${this.formatAverage(theme.identitePercue.averageValue)} /10 (${theme.identitePercue.responseCount} réponses)`,
    ];

    if (theme.identiteDeSoi.responseCount > 0 && theme.identitePercue.responseCount > 0) {
      lines.push(
        `Écart: ${this.formatSignedAverage(
          theme.identitePercue.averageValue - theme.identiteDeSoi.averageValue,
        )}`,
      );
    } else {
      lines.push('Données partielles pour ce thème.');
    }

    return lines;
  }

  private formatThemeLabel(label: string): string | string[] {
    const words = label.trim().split(/\s+/).filter(Boolean);

    if (words.length <= 1) {
      return label;
    }

    return [words[0], words.slice(1).join(' ')];
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}

const BAR_THICKNESS = 28;
const CHART_VERTICAL_PADDING = 96;
const BLUE_BAR_BACKGROUND_COLOR = 'rgba(59, 130, 246, 0.16)';
const BLUE_BAR_BORDER_COLOR = 'rgba(37, 99, 235, 0.4)';
const GREEN_BAR_BACKGROUND_COLOR = 'rgba(34, 197, 94, 0.16)';
const GREEN_BAR_BORDER_COLOR = 'rgba(22, 163, 74, 0.45)';
const NEUTRAL_BAR_BACKGROUND_COLOR = 'rgba(148, 163, 184, 0.18)';
const NEUTRAL_BAR_BORDER_COLOR = 'rgba(148, 163, 184, 0.45)';
const IDENTITE_DE_SOI_CAP_COLOR = '#2563eb';
const IDENTITE_PERCUE_CAP_COLOR = '#14b8a6';
const CAP_HALF_WIDTH = 12;
const CAP_STROKE_WIDTH = 3;

const identiteProCapsPlugin = {
  id: 'identiteProCaps',
  afterDatasetsDraw: (chart: Chart<'bar', IdentiteProCandlestickPoint[], string>) => {
    const dataset = chart.data.datasets[0] as IdentiteProChartDataset | undefined;
    const yScale = chart.scales['y'];
    const meta = chart.getDatasetMeta(0);

    if (!dataset || !yScale || meta.type !== 'bar') {
      return;
    }

    const ctx = chart.ctx;

    meta.data.forEach((element, index) => {
      const selfValue = dataset.selfAverageValues[index];
      const perceivedValue = dataset.perceivedAverageValues[index];
      const selfHasResponses = dataset.selfResponseCounts[index] > 0;
      const perceivedHasResponses = dataset.perceivedResponseCounts[index] > 0;

      if (!selfHasResponses && !perceivedHasResponses) {
        return;
      }

      const barElement = element as { x?: number; width?: number };
      const centerX = barElement.x ?? 0;
      const capHalfWidth = Math.min(CAP_HALF_WIDTH, Math.max(8, (barElement.width ?? 0) * 0.22));

      ctx.save();
      ctx.lineWidth = CAP_STROKE_WIDTH;
      ctx.lineCap = 'round';

      if (selfHasResponses) {
        ctx.strokeStyle = IDENTITE_DE_SOI_CAP_COLOR;
        ctx.beginPath();
        ctx.moveTo(centerX - capHalfWidth, yScale.getPixelForValue(selfValue));
        ctx.lineTo(centerX + capHalfWidth, yScale.getPixelForValue(selfValue));
        ctx.stroke();
      }

      if (perceivedHasResponses) {
        ctx.strokeStyle = IDENTITE_PERCUE_CAP_COLOR;
        ctx.beginPath();
        ctx.moveTo(centerX - capHalfWidth, yScale.getPixelForValue(perceivedValue));
        ctx.lineTo(centerX + capHalfWidth, yScale.getPixelForValue(perceivedValue));
        ctx.stroke();
      }

      ctx.restore();
    });
  },
};

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Title);
