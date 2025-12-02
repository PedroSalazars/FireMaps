import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';

// Firebase App & Auth
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Firestore
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase-config';

// Environment
import { environment } from '../../environments/environment';

interface UsuarioPerfil {
  nombre?: string;
  apellidos?: string;
  correo?: string;
  rut?: string;
  telefono?: string;
  rol?: string;   // opcional
}

@Component({
  selector: 'app-vista-login',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, TranslateModule],
  templateUrl: './vista-login.page.html',
  styleUrls: ['./vista-login.page.scss']
})
export class VistaLoginPage {

  correo = '';
  clave = '';

  submitted = false;
  cargando = false;

  constructor(
    private toastController: ToastController,
    private translate: TranslateService,
    private router: Router
  ) {
    // Idioma
    const lang = localStorage.getItem('lang') || 'es';
    this.translate.setDefaultLang('es');
    this.translate.use(lang);

    // Firebase
    this.initFirebase();

    console.log('DEBUG LOGIN: VistaLoginPage construida');
  }

  // ================================
  //  INIT FIREBASE
  // ================================
  private initFirebase() {
    try {
      const apps = getApps();
      if (!apps.length) {
        initializeApp(environment.firebase);
        console.log('DEBUG LOGIN: Firebase inicializado en VistaLoginPage');
      } else {
        console.log('DEBUG LOGIN: Firebase ya estaba inicializado (login)');
      }
    } catch (e) {
      console.error('DEBUG LOGIN: Error inicializando Firebase', e);
    }
  }

  // ================================
  //  VALIDACIONES
  // ================================
  esCorreoBasicoValido(correo: string): boolean {
    if (!correo) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(correo.trim());
  }

  // ================================
  //  INICIO DE SESIÓN (AUTH + FIRESTORE)
  // ================================
  async iniciarSesion() {
    this.submitted = true;

    // 🔹 DEBUG 1: Confirmar que el click llega al método
    console.log('DEBUG LOGIN: iniciarSesion() llamado');
    try {
      window.alert('DEBUG: click login'); // si esto NO aparece, el botón no llama a este método
    } catch (e) {
      console.warn('DEBUG LOGIN: window.alert no disponible', e);
    }

    const email = this.correo.trim().toLowerCase();
    const password = this.clave;

    // Validaciones básicas
    if (!email || !password) {
      const toast = await this.toastController.create({
        message: 'Por favor completa todos los campos.',
        duration: 2500,
        color: 'danger'
      });
      toast.present();
      return;
    }

    if (!this.esCorreoBasicoValido(email)) {
      const toast = await this.toastController.create({
        message: 'El correo no es válido.',
        duration: 2500,
        color: 'danger'
      });
      toast.present();
      return;
    }

    this.cargando = true;
    console.log('DEBUG LOGIN: Intentando login con', email);

    try {
      const auth = getAuth();
      console.log('DEBUG LOGIN: Llamando a signInWithEmailAndPassword...');
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log('DEBUG LOGIN: Usuario autenticado UID =', cred.user.uid);

      const uid = cred.user.uid;

      // Leer perfil en Firestore (usuarios/{uid})
      let nombreMostrar = 'Usuario';
      let rol: string = 'usuario';

      try {
        const ref = doc(db, 'usuarios', uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const datos = snap.data() as UsuarioPerfil;
          nombreMostrar = datos.nombre || nombreMostrar;
          rol = datos.rol || rol;
          console.log('DEBUG LOGIN: Perfil Firestore =', datos);
        } else {
          console.warn('DEBUG LOGIN: No existe documento usuarios/' + uid);
        }
      } catch (err) {
        console.warn('DEBUG LOGIN: Error leyendo perfil en Firestore', err);
      }

      // ✅ Login exitoso
      const toast = await this.toastController.create({
        message: `Bienvenido ${nombreMostrar}!`,
        duration: 2000,
        color: 'success'
      });
      toast.present();

      // ✅ Redirección al mapa (igual que registro)
      console.log('DEBUG LOGIN: Navegando a /vista-home');
      this.router.navigate(['/vista-home']);

      // Si más adelante quieres respetar roles, puedes usar esto:
      /*
      switch (rol) {
        case 'bombero':
          this.router.navigate(['/vista-bombero']);
          break;
        case 'admin':
          this.router.navigate(['/vista-admin']);
          break;
        case 'usuario':
        default:
          this.router.navigate(['/vista-home']);
          break;
      }
      */

    } catch (error: any) {
      console.error('DEBUG LOGIN: Error completo =>', error);

      let mensaje = 'No se pudo iniciar sesión.';

      if (error.code === 'auth/user-not-found') {
        mensaje = 'No existe un usuario con ese correo.';
      } else if (error.code === 'auth/wrong-password') {
        mensaje = 'La contraseña es incorrecta.';
      } else if (error.code === 'auth/too-many-requests') {
        mensaje = 'Demasiados intentos. Intenta más tarde.';
      } else if (error.code === 'auth/invalid-email') {
        mensaje = 'El correo no es válido.';
      }

      const toast = await this.toastController.create({
        message: mensaje,
        duration: 2500,
        color: 'danger'
      });
      toast.present();

    } finally {
      this.cargando = false;
    }
  }
}
