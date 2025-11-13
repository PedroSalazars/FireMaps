import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VistaAjustesPage } from './vista-ajustes.page';

describe('VistaAjustesPage', () => {
  let component: VistaAjustesPage;
  let fixture: ComponentFixture<VistaAjustesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VistaAjustesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
