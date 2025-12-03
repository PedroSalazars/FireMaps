import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VistaAdminPage } from './vista-admin.page';

describe('VistaAdminPage', () => {
  let component: VistaAdminPage;
  let fixture: ComponentFixture<VistaAdminPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VistaAdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
