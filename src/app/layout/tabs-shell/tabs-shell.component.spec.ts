import { TestBed } from '@angular/core/testing';
import { TabsShellComponent } from './tabs-shell.component';

describe('TabsShellComponent', () => {
  it('creates the tabs shell', async () => {
    await TestBed.configureTestingModule({
      imports: [TabsShellComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TabsShellComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});

