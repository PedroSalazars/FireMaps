// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'vista-home', pathMatch: 'full' },

  {
    path: 'vista-home',
    loadComponent: () =>
      import('./vista-home/vista-home.page').then(m => (m as any).VistaHomePage || (m as any).default)
  },
  {
    path: 'vista-inicio',
    loadComponent: () =>
      import('./vista-inicio/vista-inicio.page').then(m => m.VistaInicioPage)
  },
  {
    path: 'vista-ajustes',
    loadComponent: () =>
      import('./vista-ajustes/vista-ajustes.page').then(m => m.VistaAjustesPage)
  },
  {
    path: 'vista-login',
    loadComponent: () =>
      import('./vista-login/vista-login.page').then(m => m.VistaLoginPage)
  },
  {

    path: 'vista-home',
    loadComponent: () => import('./vista-home/vista-home.page').then( m => m.VistaHomePage)
  }


    path: 'vista-registro-usuario',
    loadComponent: () =>
      import('./vista-registro-usuario/vista-registro-usuario.page').then(m => m.VistaRegistroUsuarioPage)
  },

  { path: '**', redirectTo: 'vista-home' }

];
