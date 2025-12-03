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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase-config'; // 👈 ajusta la ruta si tu archivo está en otro lado

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
  //  INICIO DE SESIÓN (AUTH + PERFIL + NAVEGACIÓN POR ROL)
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

      // 1) LOGIN EN AUTH
      const cred = await signInWithEmailAndPassword(auth, email, password);

      const uid = cred.user.uid;
      console.log('DEBUG LOGIN: login OK, UID =', uid);

      // ================================
      //  2) OBTENER PERFIL DESDE FIRESTORE
      // ================================
      const usuarioRef = doc(db, 'usuarios', uid);
      const snap = await getDoc(usuarioRef);

      let perfil: any;

      if (snap.exists()) {
        perfil = snap.data();
        console.log('DEBUG LOGIN: perfil Firestore =', perfil);
      } else {
        // Si NO hay perfil en Firestore, creamos uno básico
        // (idealmente no debería pasar si tu registro ya lo crea siempre)
        perfil = {
          nombre: cred.user.displayName || email,
          correo: email,
          rol: 'usuario'  // 👈 por defecto "usuario" en minúscula
        };
        await setDoc(usuarioRef, perfil);
        console.log('DEBUG LOGIN: perfil creado en Firestore =', perfil);
      }

      // Normalizamos el rol (acepta 'Bombero', 'bombero', 'BOMBERO', etc.)
      const rolNormalizado = (perfil.rol || 'usuario').toString().toLowerCase();

      // Construimos el objeto que usas en la app
      const usuarioActivo = {
        uid,
        nombre: perfil.nombre || cred.user.displayName || email,
        correo: perfil.correo || email,
        rol: rolNormalizado    // 👈 guardamos el rol normalizado en localStorage
      };

      // Guardar en localStorage (lo que lees en vista-bombero)
      localStorage.setItem('usuarioActivo', JSON.stringify(usuarioActivo));
      console.log('DEBUG LOGIN: usuarioActivo guardado =>', usuarioActivo);

      // ================================
      //  3) NAVEGAR SEGÚN ROL
      // ================================
      if (rolNormalizado === 'bombero') {
        console.log('DEBUG LOGIN: Rol bombero → navegando a /vista-bombero');
        this.router.navigate(['/vista-bombero']);
      } else if (rolNormalizado === 'admin') {
        console.log('DEBUG LOGIN: Rol admin → navegando a /vista-admin');
        this.router.navigate(['/vista-admin']);
      } else {
        console.log('DEBUG LOGIN: Rol', rolNormalizado, '→ navegando a /vista-home');
        this.router.navigate(['/vista-home']);
      }

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
