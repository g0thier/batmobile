import { AfterViewInit, Component, DestroyRef, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { IonSpinner, IonText } from '@ionic/angular/standalone';
import { Euler, MathUtils, Quaternion } from 'three';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import {
  SensorOrientationService,
  type SensorOrientationValue,
} from '../../../core/sensor-orientation/sensor-orientation.service';

type GaussianSplats3DModule = typeof import('@mkkellogg/gaussian-splats-3d');

type GaussianSplats3DScene = {
  quaternion: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
};

type GaussianSplats3DViewer = {
  addSplatScene(path: string, options?: Record<string, unknown>): Promise<unknown>;
  getSplatScene(sceneIndex: number): GaussianSplats3DScene | null;
  forceRenderNextFrame(): void;
  start(): void;
  dispose(): Promise<void> | void;
};

@Component({
  selector: 'app-profile-3d-viewer',
  standalone: true,
  templateUrl: './profile-3d-viewer.component.html',
  styleUrls: ['./profile-3d-viewer.component.css'],
  imports: [IonSpinner, IonText],
})
export class Profile3dViewerComponent implements AfterViewInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly sensorOrientationService = inject(SensorOrientationService);
  private readonly splatScenePath = '/profil/default.splat';
  private readonly splatSceneRotationXDeg = 0;
  private readonly splatSceneRotationYDeg = 90;
  private readonly splatSceneRotationZDeg = 190;
  private readonly splatSceneRotationOrder = 'XYZ' as const;

  @ViewChild('viewerHost', { static: true })
  private viewerHostRef!: ElementRef<HTMLDivElement>;

  private viewer: GaussianSplats3DViewer | null = null;
  private initializationPromise: Promise<void> | null = null;
  private isDestroyed = false;
  private isSplatSceneReady = false;

  isLoading = true;
  loadError = '';

  ngAfterViewInit(): void {
    void this.ensureViewerLoaded();
    this.sensorOrientationService.orientation$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .pipe(filter((orientation) => this.hasOrientationValue(orientation)))
      .subscribe((orientation) => {
        this.logOrientation(orientation);
        this.applyOrientationToViewer(orientation);
      });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    void this.disposeViewer();
  }

  protected loadGaussianSplats3D(): Promise<GaussianSplats3DModule> {
    return import('@mkkellogg/gaussian-splats-3d');
  }

  private logOrientation(orientation: SensorOrientationValue): void {
    console.log('[Profile3DViewer] orientation', orientation);
  }

  private hasOrientationValue(orientation: SensorOrientationValue): boolean {
    return (
      orientation.alpha !== null ||
      orientation.beta !== null ||
      orientation.gamma !== null ||
      orientation.absolute
    );
  }

  private applyCurrentOrientationToViewer(): void {
    this.applyOrientationToViewer(this.sensorOrientationService.currentOrientation);
  }

  private applyOrientationToViewer(orientation: SensorOrientationValue): void {
    const viewer = this.viewer;
    if (!viewer || !this.isSplatSceneReady) {
      return;
    }

    const scene = viewer.getSplatScene(0);
    if (!scene) {
      return;
    }

    const quaternion = this.getSplatSceneQuaternion(orientation.gamma);
    scene.quaternion.x = quaternion.x;
    scene.quaternion.y = quaternion.y;
    scene.quaternion.z = quaternion.z;
    scene.quaternion.w = quaternion.w;
    viewer.forceRenderNextFrame();
  }

  private getSplatSceneQuaternion(gamma: number | null = null): Quaternion {
    return new Quaternion().setFromEuler(
      new Euler(
        MathUtils.degToRad(this.splatSceneRotationXDeg),
        MathUtils.degToRad(this.splatSceneRotationYDeg + (gamma ?? 0)),
        MathUtils.degToRad(this.splatSceneRotationZDeg),
        this.splatSceneRotationOrder,
      ),
    );
  }

  private getSplatSceneRotation(): [number, number, number, number] {
    const quaternion = this.getSplatSceneQuaternion(this.sensorOrientationService.currentOrientation.gamma);

    return [quaternion.x, quaternion.y, quaternion.z, quaternion.w].map((value) =>
      Math.abs(value) < 1e-10 ? 0 : Math.round(value * 1e8) / 1e8,
    ) as [number, number, number, number];
  }

  private ensureViewerLoaded(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeViewer();
    }

    return this.initializationPromise;
  }

  private async initializeViewer(): Promise<void> {
    const hostElement = this.viewerHostRef?.nativeElement;
    if (!hostElement || this.isDestroyed) {
      this.isLoading = false;
      return;
    }

    this.loadError = '';

    try {
      const GaussianSplats3D = await this.loadGaussianSplats3D();
      if (this.isDestroyed) {
        return;
      }

      this.viewer = new GaussianSplats3D.Viewer({
        rootElement: hostElement,
        initialCameraPosition: [0, 0, 1.6],
        initialCameraLookAt: [0, 0, 0],
        cameraUp: [0, 1, 0],
        selfDrivenMode: true,
        useBuiltInControls: true,
        dynamicScene: true,
        sharedMemoryForWorkers: false,
        gpuAcceleratedSort: false,
        renderMode: GaussianSplats3D.RenderMode.OnChange,
        sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
        logLevel: GaussianSplats3D.LogLevel.None,
      }) as GaussianSplats3DViewer;

      await this.viewer.addSplatScene(this.splatScenePath, {
        format: GaussianSplats3D.SceneFormat.Splat,
        rotation: this.getSplatSceneRotation(),
        showLoadingUI: false,
      });
      this.isSplatSceneReady = true;

      this.applyCurrentOrientationToViewer();

      if (this.isDestroyed) {
        await this.disposeViewer();
        return;
      }

      this.viewer.start();
    } catch (error: unknown) {
      this.loadError =
        error instanceof Error ? error.message : 'Impossible de charger la vue 3D pour le moment.';
      console.error('Impossible de charger la vue 3D du profil :', error);
      await this.disposeViewer();
    } finally {
      this.isLoading = false;
      this.initializationPromise = null;
    }
  }

  private async disposeViewer(): Promise<void> {
    const viewer = this.viewer;
    this.viewer = null;
    this.isSplatSceneReady = false;

    if (!viewer) {
      return;
    }

    try {
      await viewer.dispose();
    } catch (error: unknown) {
      console.error('Impossible de fermer la vue 3D du profil :', error);
    }
  }
}
