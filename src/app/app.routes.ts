import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'admin-inicio',
    pathMatch: 'full'
  },

  // 🌟 Vista de inicio
  {
    path: 'vista-inicio',
    loadComponent: () =>
      import('./vista-inicio/vista-inicio.page')
        .then(m => m.VistaInicioPage)
  },

  // 🔐 Vista login
  {
    path: 'vista-login',
    loadComponent: () =>
      import('./vista-login/vista-login.page')
        .then(m => m.VistaLoginPage)
  },

  // 📝 Vista registro
  {
    path: 'vista-registro-usuario',
    loadComponent: () =>
      import('./vista-registro-usuario/vista-registro-usuario.page')
        .then(m => m.RegistroUsuarioPage)
  },

  // 🏠 Vista home (mapa principal)
  {
    path: 'vista-home',
    loadComponent: () =>
      import('./vista-home/vista-home.page')
        .then(m => m.VistaHomePage)
  },

  // 🚒 Vista del bombero
  {
    path: 'vista-bombero',
    loadComponent: () =>
      import('./vista-bombero/vista-bombero.page')
        .then(m => m.VistaBomberoPage)
  },

  // 🔔 Vista notificaciones
  {
    path: 'vista-notificaciones',
    loadComponent: () =>
      import('./vista-notificaciones/vista-notificaciones.page')
        .then(m => m.VistaNotificacionesPage)
  },

  // ⚙️ Vista ajustes
  {
    path: 'vista-ajustes',
    loadComponent: () =>
      import('./vista-ajustes/vista-ajustes.page')
        .then(m => m.VistaAjustesPage)
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
  },  {
    path: 'vista-perfil',
    loadComponent: () => import('./vista-perfil/vista-perfil.page').then( m => m.VistaPerfilPage)
  },


];
