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
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.profile-photo-picker__trigger');
    trigger.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(fixture.componentInstance.isPickerOpen).toBeTrue();
    expect(fixture.nativeElement.querySelector('.profile-photo-picker__panel')).toBeTruthy();

    const cancelButton = fixture.nativeElement.querySelector(
      'ion-button[aria-label="Annuler"]',
    ) as HTMLElement;
    cancelButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isPickerOpen).toBeFalse();
    expect(fixture.nativeElement.querySelector('.profile-photo-picker__panel')).toBeFalsy();
  });

  it('emits a delete request from the popup', () => {
    const fixture = TestBed.createComponent(ProfilePhotoPickerComponent);
    const deleted: number[] = [];
    fixture.componentInstance.photoDeleted.subscribe(() => deleted.push(1));
    fixture.componentInstance.profilePicture = 'data:image/png;base64,current';

    fixture.componentInstance.openPicker();
    fixture.detectChanges();

    const deleteButton = fixture.nativeElement.querySelector(
      'ion-button[aria-label="Supprimer la photo"]',
    ) as HTMLElement;
    deleteButton.click();
    fixture.detectChanges();

    expect(deleted).toEqual([1]);
    expect(fixture.componentInstance.isPickerOpen).toBeFalse();
  });

  it('uses the green empty action to cancel when no photo exists', () => {
    const fixture = TestBed.createComponent(ProfilePhotoPickerComponent);
    fixture.componentInstance.openPicker();
    fixture.detectChanges();

    const emptyAction = fixture.nativeElement.querySelector(
      'ion-button.profile-photo-picker__action--empty',
    ) as HTMLElement;
    emptyAction.click();
    fixture.detectChanges();

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
    fixture.detectChanges();

    const takePhotoButton = fixture.nativeElement.querySelector(
      'ion-button[aria-label="Prendre une photo"]',
    ) as HTMLElement;

    takePhotoButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

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
    fixture.detectChanges();

    await fixture.componentInstance.onTakePhoto();
    fixture.detectChanges();

    expect(fixture.componentInstance.captureError).toBe('Camera unavailable');
    expect(fixture.nativeElement.querySelector('.profile-photo-picker__error')?.textContent).toContain(
      'Camera unavailable',
    );
  });
});
