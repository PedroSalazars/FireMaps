import { Routes } from '@angular/router';
import { VistaInicioPage } from './vista-inicio/vista-inicio.page';
import { VistaAjustesPage } from './vista-ajustes/vista-ajustes.page';
import { VistaRegistroUsuarioPage } from './vista-registro-usuario/vista-registro-usuario.page';
import { VistaLoginPage } from './vista-login/vista-login.page';  
import { HomePage } from './home/home.page';

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
  },
  {
    path: 'vista-inicio',
    loadComponent: () => import('./vista-inicio/vista-inicio.page').then( m => m.VistaInicioPage)
  },
  {
    path: 'vista-login',
    loadComponent: () => import('./vista-login/vista-login.page').then( m => m.VistaLoginPage)
  }



];
