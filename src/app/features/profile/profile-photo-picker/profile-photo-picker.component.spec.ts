import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Profile3dViewerComponent } from '../profile-3d-viewer/profile-3d-viewer.component';
import { ProfilePhotoPickerComponent } from './profile-photo-picker.component';

describe('ProfilePhotoPickerComponent', () => {
  beforeEach(async () => {
    TestBed.overrideComponent(ProfilePhotoPickerComponent, {
      remove: { imports: [Profile3dViewerComponent] },
    });

    await TestBed.configureTestingModule({
      imports: [ProfilePhotoPickerComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('opens and closes the popup', () => {
    const fixture = TestBed.createComponent(ProfilePhotoPickerComponent);
    fixture.componentInstance.openPicker();

    expect(fixture.componentInstance.isPickerOpen).toBeTrue();

    fixture.componentInstance.closePicker();

    expect(fixture.componentInstance.isPickerOpen).toBeFalse();
  });

  it('shows the default profile photo when none exists', () => {
    const fixture = TestBed.createComponent(ProfilePhotoPickerComponent);
    fixture.detectChanges();

    const triggerImage = fixture.nativeElement.querySelector('.profile-photo-picker__trigger img');

    expect(triggerImage?.getAttribute('src')).toBe('/profil/default.webp');
    expect(triggerImage?.getAttribute('alt')).toBe('Photo de profil par défaut');
  });

  it('emits a delete request from the popup', () => {
    const fixture = TestBed.createComponent(ProfilePhotoPickerComponent);
    const deleted: number[] = [];
    fixture.componentInstance.photoDeleted.subscribe(() => deleted.push(1));
    fixture.componentInstance.profilePicture = 'data:image/png;base64,current';

    fixture.componentInstance.onDeletePhoto();

    expect(deleted).toEqual([1]);
    expect(fixture.componentInstance.isPickerOpen).toBeFalse();
    expect(fixture.componentInstance.isPreview3D).toBeFalse();
  });

  it('shows the 3d toggle only for the default photo', () => {
    const fixture = TestBed.createComponent(ProfilePhotoPickerComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.profile-photo-picker__action--toggle')).not.toBeNull();

    fixture.componentInstance.profilePicture = 'data:image/png;base64,current';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.profile-photo-picker__action--toggle')).toBeNull();
  });

  it('toggles the 3d preview for the default photo', () => {
    const fixture = TestBed.createComponent(ProfilePhotoPickerComponent);

    fixture.detectChanges();
    fixture.componentInstance.togglePreviewMode();

    expect(fixture.componentInstance.isPreview3D).toBeTrue();

    fixture.componentInstance.togglePreviewMode();

    expect(fixture.componentInstance.isPreview3D).toBeFalse();
  });

  it('launches the camera and emits the captured photo', async () => {
    const fixture = TestBed.createComponent(ProfilePhotoPickerComponent);
    const emittedPhotos: string[] = [];
    fixture.componentInstance.photoCaptured.subscribe((photo) => emittedPhotos.push(photo));
    fixture.componentInstance.isPreview3D = true;

    spyOn(Camera, 'getPhoto').and.resolveTo({
      dataUrl: 'data:image/png;base64,abc123',
    } as never);

    fixture.componentInstance.openPicker();

    await fixture.componentInstance.onTakePhoto();

    expect(Camera.getPhoto).toHaveBeenCalledWith(
      jasmine.objectContaining({
        quality: 80,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      saveToGallery: false,
      }),
    );
    expect(emittedPhotos).toEqual(['data:image/png;base64,abc123']);
    expect(fixture.componentInstance.isPickerOpen).toBeFalse();
    expect(fixture.componentInstance.isPreview3D).toBeFalse();
  });

  it('shows an error when the camera fails', async () => {
    const fixture = TestBed.createComponent(ProfilePhotoPickerComponent);

    spyOn(Camera, 'getPhoto').and.rejectWith(new Error('Camera unavailable'));

    fixture.componentInstance.openPicker();

    await fixture.componentInstance.onTakePhoto();
    fixture.detectChanges();

    expect(fixture.componentInstance.captureError).toBe('Camera unavailable');
  });
});
