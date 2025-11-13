import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VistaLoginPage } from './vista-login.page';

describe('VistaLoginPage', () => {
  let component: VistaLoginPage;
  let fixture: ComponentFixture<VistaLoginPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VistaLoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
