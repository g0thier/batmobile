import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { Euler, MathUtils, Quaternion } from 'three';
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
            currentOrientation: {
              alpha: null,
              beta: null,
              gamma: 33,
              absolute: false,
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile3dViewerComponent);
    const sceneStub = {
      quaternion: new Quaternion(),
    };

    const viewerStub = {
      addSplatScene: jasmine.createSpy('addSplatScene').and.resolveTo(undefined),
      getSplatScene: jasmine.createSpy('getSplatScene').and.returnValue(sceneStub),
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
      gamma: 40,
      absolute: true,
    });
    const expectedUpdatedRotation = new Quaternion().setFromEuler(
      new Euler(
        MathUtils.degToRad(0),
        MathUtils.degToRad(130),
        MathUtils.degToRad(190),
        'XYZ',
      ),
    );

    expect(loadGaussianSplats3D).toHaveBeenCalled();
    expect((fixture.componentInstance as unknown as { viewer?: unknown }).viewer).toBeTruthy();
    expect(viewerStub.addSplatScene).toHaveBeenCalledWith(
      '/profil/default.splat',
      jasmine.objectContaining({
        format: 'splat-format',
        rotation: [0.87547295, -0.07659396, 0.47534303, -0.04158713],
        showLoadingUI: false,
      }),
    );
    expect(viewerStub.getSplatScene).toHaveBeenCalledWith(0);
    expect(sceneStub.quaternion.x).toBeCloseTo(expectedUpdatedRotation.x, 8);
    expect(sceneStub.quaternion.y).toBeCloseTo(expectedUpdatedRotation.y, 8);
    expect(sceneStub.quaternion.z).toBeCloseTo(expectedUpdatedRotation.z, 8);
    expect(sceneStub.quaternion.w).toBeCloseTo(expectedUpdatedRotation.w, 8);
    expect(viewerConstructorSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        initialCameraPosition: [0, 0, 2.2],
        dynamicScene: true,
      }),
    );
    expect(viewerStub.camera.zoom).toBe(1.6);
    expect(viewerStub.camera.updateProjectionMatrix).toHaveBeenCalled();
    expect(viewerStub.start).toHaveBeenCalled();
    expect(viewerStub.forceRenderNextFrame).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenCalledWith('[Profile3DViewer] orientation', {
      alpha: 11,
      beta: 22,
      gamma: 40,
      absolute: true,
    });
  });

  it('ignores early orientation updates until the splat scene is ready', async () => {
    const orientationSubject = new BehaviorSubject<SensorOrientationValue>({
      alpha: null,
      beta: null,
      gamma: null,
      absolute: false,
    });
    let resolveViewerLoad!: (value: never) => void;
    const loadViewerPromise = new Promise<never>((resolve) => {
      resolveViewerLoad = resolve;
    });

    await TestBed.configureTestingModule({
      imports: [Profile3dViewerComponent],
      providers: [
        {
          provide: SensorOrientationService,
          useValue: {
            orientation$: orientationSubject.asObservable(),
            currentOrientation: {
              alpha: null,
              beta: null,
              gamma: null,
              absolute: false,
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile3dViewerComponent);
    const sceneStub = {
      quaternion: new Quaternion(),
    };

    const viewerStub = {
      addSplatScene: jasmine.createSpy('addSplatScene').and.resolveTo(undefined),
      getSplatScene: jasmine.createSpy('getSplatScene').and.returnValue(sceneStub),
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
    ).and.returnValue(loadViewerPromise as Promise<unknown>);

    spyOn(console, 'log');

    fixture.detectChanges();
    orientationSubject.next({
      alpha: null,
      beta: null,
      gamma: 25,
      absolute: true,
    });
    resolveViewerLoad({
      Viewer: viewerConstructorSpy,
      SceneFormat: { Splat: 'splat-format' },
      RenderMode: { OnChange: 'on-change' },
      SceneRevealMode: { Instant: 'instant' },
      LogLevel: { None: 'none' },
    } as never);
    await fixture.whenStable();

    expect(viewerStub.getSplatScene).toHaveBeenCalledWith(0);
    expect(viewerStub.forceRenderNextFrame).toHaveBeenCalled();
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
            currentOrientation: {
              alpha: null,
              beta: null,
              gamma: null,
              absolute: false,
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile3dViewerComponent);
    const sceneStub = {
      quaternion: new Quaternion(),
    };

    const viewerStub = {
      addSplatScene: jasmine.createSpy('addSplatScene').and.resolveTo(undefined),
      getSplatScene: jasmine.createSpy('getSplatScene').and.returnValue(sceneStub),
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
