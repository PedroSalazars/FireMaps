import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';

// Firebase App & Auth
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Environment
import { environment } from '../../environments/environment';

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
    const lang = localStorage.getItem('lang') || 'es';
    this.translate.setDefaultLang('es');
    this.translate.use(lang);

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
  //  INICIO DE SESIÓN (SOLO AUTH + NAVEGACIÓN)
  // ================================
  async iniciarSesion() {
    this.submitted = true;

    const email = this.correo.trim().toLowerCase();
    const password = this.clave;

    console.log('DEBUG LOGIN: iniciarSesion() llamado con', email);

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

    try {
      const auth = getAuth();
      console.log('DEBUG LOGIN: Llamando a Firebase Auth…');

      const cred = await signInWithEmailAndPassword(auth, email, password);

      const uid = cred.user.uid;
      console.log('DEBUG LOGIN: login OK, UID =', uid);

      // 🔥 REDIRECCIÓN DIRECTA AL MAPA
      console.log('DEBUG LOGIN: Navegando a /vista-home');
      this.router.navigate(['/vista-home']);

    } catch (error: any) {
      console.error('DEBUG LOGIN: Error completo =>', error);

      let mensaje = 'No se pudo iniciar sesión.';

      if (error.code === 'auth/user-not-found') {
        mensaje = 'Correo no registrado.';
      } else if (error.code === 'auth/wrong-password') {
        mensaje = 'Contraseña incorrecta.';
      } else if (error.code === 'auth/too-many-requests') {
        mensaje = 'Demasiados intentos, intenta más tarde.';
      } else if (error.code === 'auth/invalid-email') {
        mensaje = 'Correo inválido.';
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

  // ================================
  //  BOTÓN VOLVER ESTILO IOS
  // ================================
  goBack() {
    // Siempre volver a la vista de inicio
    this.router.navigate(['/vista-inicio']);
  }
}
