import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RegistroUsuarioPage } from './vista-registro-usuario.page';

const routes: Routes = [
  {
    path: '',
    component: RegistroUsuarioPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VistaRegistroUsuarioPageRoutingModule {}
