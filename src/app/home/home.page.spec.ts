import { TestBed } from '@angular/core/testing';
import { HomePage } from './home.page';

describe('HomePage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage], // standalone
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(HomePage);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
