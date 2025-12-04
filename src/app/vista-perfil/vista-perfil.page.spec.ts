import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VistaPerfilPage } from './vista-perfil.page';

describe('VistaPerfilPage', () => {
  let component: VistaPerfilPage;
  let fixture: ComponentFixture<VistaPerfilPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VistaPerfilPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
