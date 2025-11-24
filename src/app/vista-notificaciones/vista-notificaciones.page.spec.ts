import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VistaNotificacionesPage } from './vista-notificaciones.page';

describe('VistaNotificacionesPage', () => {
  let component: VistaNotificacionesPage;
  let fixture: ComponentFixture<VistaNotificacionesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VistaNotificacionesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
