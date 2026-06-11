import { TestBed } from '@angular/core/testing';
import { Profile3dViewerComponent } from './profile-3d-viewer.component';

describe('Profile3dViewerComponent', () => {
  it('initializes the Gaussian splat viewer with the default scene', async () => {
    await TestBed.configureTestingModule({
      imports: [Profile3dViewerComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile3dViewerComponent);

    const viewerStub = {
      addSplatScene: jasmine.createSpy('addSplatScene').and.resolveTo(undefined),
      start: jasmine.createSpy('start'),
      dispose: jasmine.createSpy('dispose').and.resolveTo(undefined),
    };

    const loadGaussianSplats3D = spyOn(
      fixture.componentInstance as unknown as { loadGaussianSplats3D: () => Promise<unknown> },
      'loadGaussianSplats3D',
    ).and.resolveTo({
      Viewer: jasmine.createSpy('Viewer').and.returnValue(viewerStub),
      SceneFormat: { Splat: 'splat-format' },
      RenderMode: { OnChange: 'on-change' },
      SceneRevealMode: { Instant: 'instant' },
      LogLevel: { None: 'none' },
    } as never);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadGaussianSplats3D).toHaveBeenCalled();
    expect(viewerStub.addSplatScene).toHaveBeenCalledWith(
      '/profil/default.splat',
      jasmine.objectContaining({
        format: 'splat-format',
        rotation: [0.70710678, 0, 0.70710678, 0],
        showLoadingUI: false,
      }),
    );
    expect(viewerStub.start).toHaveBeenCalled();
  });

  it('disposes the viewer when destroyed', async () => {
    await TestBed.configureTestingModule({
      imports: [Profile3dViewerComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile3dViewerComponent);

    const viewerStub = {
      addSplatScene: jasmine.createSpy('addSplatScene').and.resolveTo(undefined),
      start: jasmine.createSpy('start'),
      dispose: jasmine.createSpy('dispose').and.resolveTo(undefined),
    };

    spyOn(
      fixture.componentInstance as unknown as { loadGaussianSplats3D: () => Promise<unknown> },
      'loadGaussianSplats3D',
    ).and.resolveTo({
      Viewer: jasmine.createSpy('Viewer').and.returnValue(viewerStub),
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
