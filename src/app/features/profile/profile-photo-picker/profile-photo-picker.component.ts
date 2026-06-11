import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IonAvatar, IonButton, IonModal, IonSpinner, IonText } from '@ionic/angular/standalone';
import { MaterialIconComponent } from '../../../shared/material-icon/material-icon.component';

@Component({
  selector: 'app-profile-photo-picker',
  standalone: true,
  templateUrl: './profile-photo-picker.component.html',
  styleUrls: ['./profile-photo-picker.component.css'],
  imports: [IonAvatar, IonButton, IonModal, IonSpinner, IonText, MaterialIconComponent],
})
export class ProfilePhotoPickerComponent {
  @Input() profilePicture = '';
  @Output() photoCaptured = new EventEmitter<string>();
  @Output() photoDeleted = new EventEmitter<void>();

  isPickerOpen = false;
  isCapturingPhoto = false;
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

  async onTakePhoto(): Promise<void> {
    if (this.isCapturingPhoto) {
      return;
    }

    this.captureError = '';
    this.isCapturingPhoto = true;

    try {
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
    this.photoDeleted.emit();
    this.isPickerOpen = false;
    this.captureError = '';
  }
}
