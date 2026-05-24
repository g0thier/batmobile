import { Component, computed, input, numberAttribute } from '@angular/core';

@Component({
  selector: 'app-material-icon',
  templateUrl: './material-icon.component.html',
  styleUrls: ['./material-icon.component.css'],
  standalone: true,
})
export class MaterialIconComponent {
  readonly name = input.required<string>();
  readonly size = input(24, { transform: numberAttribute });
  readonly weight = input(400, { transform: numberAttribute });
  readonly fill = input(0, { transform: numberAttribute });
  readonly grad = input(0, { transform: numberAttribute });
  readonly className = input('');

  readonly iconClass = computed(() => {
    const extraClass = this.className().trim();
    return extraClass ? `material-symbols-outlined ${extraClass}` : 'material-symbols-outlined';
  });

  readonly fontVariationSettings = computed(
    () =>
      `'FILL' ${this.fill()}, 'wght' ${this.weight()}, 'GRAD' ${this.grad()}, 'opsz' ${this.size()}`,
  );
}
