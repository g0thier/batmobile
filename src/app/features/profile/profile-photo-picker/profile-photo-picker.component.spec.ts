import { TestBed } from '@angular/core/testing';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ProfilePhotoPickerComponent } from './profile-photo-picker.component';

describe('ProfilePhotoPickerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilePhotoPickerComponent],
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
  });

  it('uses the green empty action to cancel when no photo exists', () => {
    const fixture = TestBed.createComponent(ProfilePhotoPickerComponent);
    fixture.componentInstance.openPicker();
    fixture.componentInstance.closePicker();

    expect(fixture.componentInstance.isPickerOpen).toBeFalse();
  });

  it('launches the camera and emits the captured photo', async () => {
    const fixture = TestBed.createComponent(ProfilePhotoPickerComponent);
    const emittedPhotos: string[] = [];
    fixture.componentInstance.photoCaptured.subscribe((photo) => emittedPhotos.push(photo));

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
