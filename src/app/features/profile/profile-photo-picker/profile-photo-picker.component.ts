import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IonAvatar, IonButton, IonModal, IonSpinner, IonText } from '@ionic/angular/standalone';
import { MaterialIconComponent } from '../../../shared/material-icon/material-icon.component';
import { Profile3dViewerComponent } from '../profile-3d-viewer/profile-3d-viewer.component';

@Component({
  selector: 'app-profile-photo-picker',
  standalone: true,
  templateUrl: './profile-photo-picker.component.html',
  styleUrls: ['./profile-photo-picker.component.css'],
  imports: [
    IonAvatar,
    IonButton,
    IonModal,
    IonSpinner,
    IonText,
    MaterialIconComponent,
    Profile3dViewerComponent,
  ],
})
export class ProfilePhotoPickerComponent {
  readonly defaultProfilePicture = '/profil/default.webp';

  private _profilePicture = '';

  @Input()
  set profilePicture(value: string) {
    this._profilePicture = value.trim();

    if (this._profilePicture) {
      this.isPreview3D = false;
    }
  }

  get profilePicture(): string {
    return this._profilePicture;
  }

  @Output() photoCaptured = new EventEmitter<string>();
  @Output() photoDeleted = new EventEmitter<void>();

  isPickerOpen = false;
  isCapturingPhoto = false;
  isPreview3D = false;
  captureError = '';

  openPicker(): void {
    this.captureError = '';
    this.isPickerOpen = true;
  }

  closePicker(): void {
    if (this.isCapturingPhoto) {
      return;
    }

    this.isPickerOpen = false;
    this.captureError = '';
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openPicker();
    }
  }

  togglePreviewMode(): void {
    if (this.isCapturingPhoto || this.profilePicture) {
      return;
    }

    this.isPreview3D = !this.isPreview3D;
  }

  get canShow3DPreview(): boolean {
    return !this.profilePicture;
  }

  getPreviewToggleLabel(): string {
    return this.isPreview3D ? "Revenir à l'aperçu 2D" : "Passer à l'aperçu 3D";
  }

  getPreviewToggleIcon(): string {
    return this.isPreview3D ? 'image' : 'view_in_ar';
  }

  async onTakePhoto(): Promise<void> {
    if (this.isCapturingPhoto) {
      return;
    }

    this.captureError = '';
    this.isCapturingPhoto = true;

    try {
      // Keep the Capacitor Camera API here so the native/web bridge stays explicit.
      const photo = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
      });
      const capturedPhoto = photo.dataUrl?.trim() || photo.webPath?.trim() || '';

      if (!capturedPhoto) {
        throw new Error('La photo capturée est vide.');
      }

      this.isPreview3D = false;
      this.photoCaptured.emit(capturedPhoto);
      this.isPickerOpen = false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isCancellation = errorMessage.toLowerCase().includes('cancel');

      if (!isCancellation) {
        this.captureError = errorMessage || 'Impossible de prendre la photo pour le moment.';
      }
    } finally {
      this.isCapturingPhoto = false;
    }
  }

  onDeletePhoto(): void {
    this.isPreview3D = false;
    this.photoDeleted.emit();
    this.isPickerOpen = false;
    this.captureError = '';
  }
}
