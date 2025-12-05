import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VistaPerfilUsuarioPage } from './vista-perfil-usuario.page';

describe('VistaPerfilUsuarioPage', () => {
  let component: VistaPerfilUsuarioPage;
  let fixture: ComponentFixture<VistaPerfilUsuarioPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VistaPerfilUsuarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
