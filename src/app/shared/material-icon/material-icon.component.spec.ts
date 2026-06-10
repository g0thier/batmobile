import { TestBed } from '@angular/core/testing';
import { MaterialIconComponent } from './material-icon.component';

describe('MaterialIconComponent', () => {
  it('computes the expected class and variation settings', async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialIconComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(MaterialIconComponent);
    fixture.componentRef.setInput('name', 'home');
    fixture.componentRef.setInput('className', '  accent ');
    fixture.componentRef.setInput('size', 32);
    fixture.componentRef.setInput('weight', 500);
    fixture.componentRef.setInput('fill', 1);
    fixture.componentRef.setInput('grad', 200);
    fixture.detectChanges();

    expect(fixture.componentInstance.iconClass()).toBe('material-symbols-outlined accent');
    expect(fixture.componentInstance.fontVariationSettings()).toBe(`'FILL' 1, 'wght' 500, 'GRAD' 200, 'opsz' 32`);
  });
});

