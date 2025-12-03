import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'admin-inicio',
    pathMatch: 'full'
  },
  {
    path: 'vista-inicio',
    loadComponent: () =>
      import('./vista-inicio/vista-inicio.page').then(m => m.VistaInicioPage)
  },
  {
    path: 'vista-login',
    loadComponent: () =>
      import('./vista-login/vista-login.page').then(m => m.VistaLoginPage)
  },
  {
    path: 'vista-home',
    loadComponent: () =>
      import('./vista-home/vista-home.page').then(m => m.VistaHomePage)
  },
  {
    path: 'vista-ajustes',
    loadComponent: () =>
      import('./vista-ajustes/vista-ajustes.page').then(m => m.VistaAjustesPage)
  },
  {
    path: 'vista-registro-usuario',
    loadComponent: () =>
      import('./vista-registro-usuario/vista-registro-usuario.page').then(
        m => m.RegistroUsuarioPage
      )
  },
  {
    path: 'vista-bombero',
    loadComponent: () =>
      import('./vista-bombero/vista-bombero.page').then(m => m.VistaBomberoPage)
  },
  {
    path: 'vista-notificaciones',
    loadComponent: () =>
      import('./vista-notificaciones/vista-notificaciones.page').then(
        m => m.VistaNotificacionesPage
      )
  },
    {
    path: 'vista-admin',
    loadComponent: () => 
      import('./vista-admin/vista-admin.page').then( 
        m => m.VistaAdminPage)
  },
  {
    path: '**',
    redirectTo: 'vista-inicio'
  },

];
