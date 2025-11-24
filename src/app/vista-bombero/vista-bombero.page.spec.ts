import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VistaBomberoPage } from './vista-bombero.page';

describe('VistaBomberoPage', () => {
  let component: VistaBomberoPage;
  let fixture: ComponentFixture<VistaBomberoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VistaBomberoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
