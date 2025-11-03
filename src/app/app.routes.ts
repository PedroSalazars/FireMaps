import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.page').then(m => m.HomePage)
  },
  {
    path: 'vista-ajustes',
    loadComponent: () => import('./vista-ajustes/vista-ajustes.page').then( m => m.VistaAjustesPage)
  },
  {
    path: 'vista-registro-usuario',
    loadComponent: () => import('./vista-registro-usuario/vista-registro-usuario.page').then( m => m.VistaRegistroUsuarioPage)
  }


];
