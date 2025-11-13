import { TestBed } from '@angular/core/testing';
import { VistaHomePage } from './vista-home.page';

describe('HomePage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VistaHomePage], // standalone
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(VistaHomePage);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
