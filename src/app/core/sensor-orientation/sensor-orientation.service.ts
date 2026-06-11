import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SensorOrientationValue {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
}

const EMPTY_ORIENTATION: SensorOrientationValue = {
  alpha: null,
  beta: null,
  gamma: null,
  absolute: false,
};

type DeviceOrientationEventConstructor = {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

@Injectable({
  providedIn: 'root',
})
export class SensorOrientationService {
  private readonly orientationSubject = new BehaviorSubject<SensorOrientationValue>(EMPTY_ORIENTATION);
  private readonly deviceOrientationListener = (event: DeviceOrientationEvent): void => {
    this.setOrientation({
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      absolute: event.absolute,
    });
  };

  private isListening = false;

  readonly orientation$ = this.orientationSubject.asObservable();

  get currentOrientation(): SensorOrientationValue {
    return this.orientationSubject.value;
  }

  setOrientation(orientation: SensorOrientationValue): void {
    this.orientationSubject.next({
      alpha: orientation.alpha,
      beta: orientation.beta,
      gamma: orientation.gamma,
      absolute: orientation.absolute,
    });
  }

  async startListening(): Promise<void> {
    if (this.isListening) {
      return;
    }

    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      throw new Error("Les capteurs d'orientation ne sont pas disponibles dans cet environnement.");
    }

    const deviceOrientationConstructor = window.DeviceOrientationEvent as DeviceOrientationEventConstructor;

    if (deviceOrientationConstructor.requestPermission) {
      const permission = await deviceOrientationConstructor.requestPermission();

      if (permission !== 'granted') {
        throw new Error("L'accès à l'orientation a été refusé.");
      }
    }

    window.addEventListener('deviceorientation', this.deviceOrientationListener);
    this.isListening = true;
    console.log('[SensorOrientation] listening started');
  }

  stopListening(): void {
    if (!this.isListening || typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('deviceorientation', this.deviceOrientationListener);
    this.isListening = false;
    console.log('[SensorOrientation] listening stopped');
  }
}
