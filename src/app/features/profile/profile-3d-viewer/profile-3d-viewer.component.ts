import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { IonSpinner, IonText } from '@ionic/angular/standalone';

type GaussianSplats3DModule = typeof import('@mkkellogg/gaussian-splats-3d');

type GaussianSplats3DViewer = {
  addSplatScene(path: string, options?: Record<string, unknown>): Promise<unknown>;
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
  private readonly splatScenePath = '/profil/default.splat';
  private readonly splatSceneRotation = [0.70710678, 0, 0.70710678, 0];

  @ViewChild('viewerHost', { static: true })
  private viewerHostRef!: ElementRef<HTMLDivElement>;

  private viewer: GaussianSplats3DViewer | null = null;
  private initializationPromise: Promise<void> | null = null;
  private isDestroyed = false;

  isLoading = true;
  loadError = '';

  ngAfterViewInit(): void {
    void this.ensureViewerLoaded();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    void this.disposeViewer();
  }

  protected loadGaussianSplats3D(): Promise<GaussianSplats3DModule> {
    return import('@mkkellogg/gaussian-splats-3d');
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
        initialCameraPosition: [0, 0, 5],
        initialCameraLookAt: [0, 0, 0],
        cameraUp: [0, 1, 0],
        selfDrivenMode: true,
        useBuiltInControls: true,
        sharedMemoryForWorkers: false,
        gpuAcceleratedSort: false,
        renderMode: GaussianSplats3D.RenderMode.OnChange,
        sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
        logLevel: GaussianSplats3D.LogLevel.None,
      }) as GaussianSplats3DViewer;

      await this.viewer.addSplatScene(this.splatScenePath, {
        format: GaussianSplats3D.SceneFormat.Splat,
        rotation: this.splatSceneRotation,
        showLoadingUI: false,
      });

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
