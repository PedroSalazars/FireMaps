import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VistaRegistroUsuarioPage } from './vista-registro-usuario.page';

describe('VistaRegistroUsuarioPage', () => {
  let component: VistaRegistroUsuarioPage;
  let fixture: ComponentFixture< VistaRegistroUsuarioPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VistaRegistroUsuarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
