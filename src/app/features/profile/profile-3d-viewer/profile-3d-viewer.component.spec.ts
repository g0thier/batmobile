import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import {
  SensorOrientationService,
  type SensorOrientationValue,
} from '../../../core/sensor-orientation/sensor-orientation.service';
import { Profile3dViewerComponent } from './profile-3d-viewer.component';

describe('Profile3dViewerComponent', () => {
  it('initializes the Gaussian splat viewer and logs orientation updates', async () => {
    const orientationSubject = new BehaviorSubject<SensorOrientationValue>({
      alpha: null,
      beta: null,
      gamma: null,
      absolute: false,
    });

    await TestBed.configureTestingModule({
      imports: [Profile3dViewerComponent],
      providers: [
        {
          provide: SensorOrientationService,
          useValue: {
            orientation$: orientationSubject.asObservable(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile3dViewerComponent);

    const viewerStub = {
      addSplatScene: jasmine.createSpy('addSplatScene').and.resolveTo(undefined),
      start: jasmine.createSpy('start'),
      dispose: jasmine.createSpy('dispose').and.resolveTo(undefined),
      camera: {
        zoom: 1,
        updateProjectionMatrix: jasmine.createSpy('updateProjectionMatrix'),
      },
      forceRenderNextFrame: jasmine.createSpy('forceRenderNextFrame'),
    };
    const viewerConstructorSpy = jasmine.createSpy('Viewer').and.returnValue(viewerStub);
    const consoleLogSpy = spyOn(console, 'log');

    const loadGaussianSplats3D = spyOn(
      fixture.componentInstance as unknown as { loadGaussianSplats3D: () => Promise<unknown> },
      'loadGaussianSplats3D',
    ).and.resolveTo({
      Viewer: viewerConstructorSpy,
      SceneFormat: { Splat: 'splat-format' },
      RenderMode: { OnChange: 'on-change' },
      SceneRevealMode: { Instant: 'instant' },
      LogLevel: { None: 'none' },
    } as never);

    fixture.detectChanges();
    await fixture.whenStable();

    orientationSubject.next({
      alpha: 11,
      beta: 22,
      gamma: 33,
      absolute: true,
    });

    expect(loadGaussianSplats3D).toHaveBeenCalled();
    expect((fixture.componentInstance as unknown as { viewer?: unknown }).viewer).toBeTruthy();
    expect(viewerStub.addSplatScene).toHaveBeenCalledWith(
      '/profil/default.splat',
      jasmine.objectContaining({
        format: 'splat-format',
        rotation: [0.70710678, 0, 0.70710678, 0],
        showLoadingUI: false,
      }),
    );
    expect(viewerConstructorSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        initialCameraPosition: [0, 0, 2.2],
      }),
    );
    expect(viewerStub.camera.zoom).toBe(1.6);
    expect(viewerStub.camera.updateProjectionMatrix).toHaveBeenCalled();
    expect(viewerStub.start).toHaveBeenCalled();
    expect(viewerStub.forceRenderNextFrame).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('[Profile3DViewer] orientation', {
      alpha: 11,
      beta: 22,
      gamma: 33,
      absolute: true,
    });
  });

  it('disposes the viewer when destroyed', async () => {
    await TestBed.configureTestingModule({
      imports: [Profile3dViewerComponent],
      providers: [
        {
          provide: SensorOrientationService,
          useValue: {
            orientation$: new BehaviorSubject<SensorOrientationValue>({
              alpha: null,
              beta: null,
              gamma: null,
              absolute: false,
            }).asObservable(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile3dViewerComponent);

    const viewerStub = {
      addSplatScene: jasmine.createSpy('addSplatScene').and.resolveTo(undefined),
      start: jasmine.createSpy('start'),
      dispose: jasmine.createSpy('dispose').and.resolveTo(undefined),
      camera: {
        zoom: 1,
        updateProjectionMatrix: jasmine.createSpy('updateProjectionMatrix'),
      },
      forceRenderNextFrame: jasmine.createSpy('forceRenderNextFrame'),
    };
    const viewerConstructorSpy = jasmine.createSpy('Viewer').and.returnValue(viewerStub);

    spyOn(
      fixture.componentInstance as unknown as { loadGaussianSplats3D: () => Promise<unknown> },
      'loadGaussianSplats3D',
    ).and.resolveTo({
      Viewer: viewerConstructorSpy,
      SceneFormat: { Splat: 'splat-format' },
      RenderMode: { OnChange: 'on-change' },
      SceneRevealMode: { Instant: 'instant' },
      LogLevel: { None: 'none' },
    } as never);

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.destroy();

    expect(viewerStub.dispose).toHaveBeenCalled();
  });
});
