import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'vista-inicio',
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

  // 🚒 NUEVA VISTA DEL BOMBERO (según tu carpeta real)
  {
    path: 'vista-bombero',
    loadComponent: () =>
      import('./vista-bombero/vista-bombero.page')
        .then(m => m.VistaBomberoPage)
  },

  // ⭐ Ruta comodín (por si alguien entra a una ruta no existente)
  {
    path: '**',
    redirectTo: 'vista-inicio',
    pathMatch: 'full'
  }
];
